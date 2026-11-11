// Snow Watch data pipeline. Run hourly by GitHub Actions (see .github/workflows/observe.yml).
//
// Every run:
//   1. Fetches DataHub observations (last ~48 h) for St James's Park, after confirming
//      the station identity. Skipped, with a clear status, if DATAHUB_API_KEY is unset.
//   2. Fetches the AWS one-minute observations covering every day that needs work.
//   3. Finalises every complete UK day that has no day file yet (yesterday, plus any
//      days missed by earlier runs, back to the AWS retention window), and upgrades a
//      finalised day that was AWS-only if DataHub data for it is now available.
//   4. Recomputes "today so far", data/latest.json and data/summary.json.
//
// Usage: tsx pipeline/run.ts [--now ISO] [--backfill-from YYYY-MM-DD] [--no-datahub] [--data-dir DIR]
// Exit codes: 0 ok, 2 station identity mismatch (nothing published), 3 every source failed.

import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../src/lib/config';
import { ukDateOf, addDays, ukDayBoundsUtc, isValidDate, daysBetween } from '../src/lib/ukTime';
import type { DayRecord, HourlyObs, StationIdentity, SummaryDay } from '../src/lib/types';
import { fetchDatahub, fetchAws, StationMismatchError, type DatahubResult, type AwsResult } from './sources';
import { aggregateAwsHourly } from './parsers';
import {
  buildDayRecord,
  buildSummary,
  emptyStation,
  feedStatus,
  latestOf,
  mergeHourly,
  summariseDay,
  summaryDayOf,
} from './build';

interface Args {
  now: Date;
  backfillFrom: string | null;
  noDatahub: boolean;
  dataDir: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const now = get('--now') ? new Date(get('--now')!) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('Invalid --now');
  const backfillFrom = get('--backfill-from') ?? null;
  if (backfillFrom && !isValidDate(backfillFrom)) throw new Error('Invalid --backfill-from');
  return { now, backfillFrom, noDatahub: argv.includes('--no-datahub'), dataDir: get('--data-dir') ?? 'data' };
}

const log = (...a: unknown[]) => console.log('[snow-watch]', ...a);

async function readJson<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(path: string, value: unknown, compact = false) {
  await writeFile(path, (compact ? JSON.stringify(value) : JSON.stringify(value, null, 1)) + '\n', 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { now, dataDir } = args;
  const daysDir = join(dataDir, 'days');
  await mkdir(daysDir, { recursive: true });

  const today = ukDateOf(now);
  const yesterday = addDays(today, -1);
  const retrievedAt = now.toISOString();
  const station: StationIdentity = emptyStation();

  // ---- Existing day files
  const existing = new Map<string, DayRecord>();
  for (const f of (await readdir(daysDir)).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
    const r = await readJson<DayRecord>(join(daysDir, f));
    if (r) existing.set(r.date, r);
  }

  // ---- 1. DataHub (primary)
  let dh: DatahubResult | null = null;
  let datahubError: string | null = null;
  const apiKey = process.env.DATAHUB_API_KEY?.trim();
  if (args.noDatahub || !apiKey) {
    datahubError = args.noDatahub ? 'DataHub disabled by --no-datahub.' : 'DATAHUB_API_KEY is not set.';
    log(datahubError, 'Continuing with AWS observations only.');
  } else {
    try {
      dh = await fetchDatahub(apiKey);
      station.datahubGeohash = dh.station.geohash;
      station.datahubArea = dh.station.area;
      station.verified.datahub = true;
      log(`DataHub: ${dh.hourly.length} hourly obs from "${dh.station.area}" (${dh.station.geohash}).`);
      if (!config.station.datahub.confirmedGeohash) {
        log(`NOTE: confirm and store geohash ${dh.station.geohash} in config/snow-watch.json (station.datahub.confirmedGeohash).`);
      }
    } catch (e) {
      if (e instanceof StationMismatchError) {
        // Refuse to publish any verdict. Record the failure for the front end, then fail the job.
        log('STATION MISMATCH:', e.message);
        const prev = (await readJson<Record<string, unknown>>(join(dataDir, 'latest.json'))) ?? {};
        await writeJson(join(dataDir, 'latest.json'), {
          ...prev,
          schema: 1,
          generatedAt: retrievedAt,
          status: 'STATION_MISMATCH',
          statusMessage: e.message,
        });
        process.exit(2);
      }
      datahubError = `DataHub request failed: ${(e as Error).message}`;
      log(datahubError);
    }
  }

  // ---- Which days need finalising?
  const earliestAllowed = addDays(today, -config.pipeline.maxBackfillDays);
  const toFinalise: string[] = [];
  let startDay = args.backfillFrom ?? (existing.size ? addDays([...existing.keys()].sort().at(-1)!, 1) : earliestAllowed);
  if (startDay < earliestAllowed && !args.backfillFrom) startDay = earliestAllowed;
  for (let d = startDay; d <= yesterday; d = addDays(d, 1)) toFinalise.push(d);
  // Upgrade AWS-only finalised days that DataHub (48 h window) can now improve.
  if (dh && dh.hourly.length) {
    const firstDh = dh.hourly[0].time;
    for (const [date, rec] of existing) {
      if (!rec.sources.includes('datahub') && ukDayBoundsUtc(date).start.toISOString() >= firstDh && !toFinalise.includes(date)) {
        toFinalise.push(date);
      }
    }
  }
  toFinalise.sort();
  log('Days to finalise:', toFinalise.length ? toFinalise.join(', ') : 'none');

  // ---- 2. AWS (secondary): one fetch covering everything needed.
  const awsFrom = ukDayBoundsUtc(toFinalise[0] ?? today).start;
  const awsTo = new Date(Math.max(ukDayBoundsUtc(today).end.getTime(), now.getTime()));
  let aws: AwsResult | null = null;
  let awsError: string | null = null;
  try {
    aws = await fetchAws(awsFrom, awsTo);
    station.awsName = aws.stationName;
    station.verified.aws = aws.stationVerified && aws.minutes.length > 0;
    if (!aws.stationVerified) log(`AWS: rejected rows from unexpected station "${aws.stationName}".`);
    log(`AWS: ${aws.minutes.length} minutes from ${aws.objectKeys.length} objects.`);
  } catch (e) {
    awsError = `AWS request failed: ${(e as Error).message}`;
    log(awsError);
  }

  const awsMinutes = aws?.minutes ?? [];
  const awsHourly = aggregateAwsHourly(awsMinutes);
  const dhHourly: HourlyObs[] = dh?.hourly ?? [];
  const dhRaw = dh?.raw ?? [];

  if (!dhHourly.length && !awsMinutes.length) {
    log('All sources failed or returned nothing.');
  }

  // ---- 3. Finalise days
  const finalised: DayRecord[] = [];
  for (const date of toFinalise) {
    if (daysBetween(date, today) > config.pipeline.awsRetentionDays + 1 && !dhHourly.length) {
      log(`${date}: outside the AWS retention window; recording as NO_DATA.`);
    }
    const rec = buildDayRecord({
      date,
      datahubHourly: dhHourly,
      datahubRaw: dhRaw,
      awsHourly,
      awsMinutes,
      awsObjectKeys: (aws?.objectKeys ?? []).filter((k) => keyOverlapsDay(k, date)),
      station,
      retrievedAt,
    });
    const prev = existing.get(date);
    // Never downgrade: keep an existing record if the new one has fewer hours.
    if (prev && prev.completeness.hoursReceived > rec.completeness.hoursReceived && prev.sources.length >= rec.sources.length) {
      log(`${date}: keeping existing record (more complete).`);
      continue;
    }
    // Do not write an empty day while the run itself failed entirely: try again next run.
    if (rec.verdict === 'NO_DATA' && (datahubError && awsError)) {
      log(`${date}: no data and both sources failed; will retry next run.`);
      continue;
    }
    await writeJson(join(daysDir, `${date}.json`), rec, true);
    existing.set(date, rec);
    finalised.push(rec);
    log(`${date}: ${rec.verdict} (${rec.scene.label}), ${rec.completeness.hoursReceived}/${rec.completeness.hoursExpected} h, sources ${rec.sources.join('+') || 'none'}`);
  }

  // ---- 4. Today so far, summary, latest
  const todaySummary = summariseDay({
    date: today,
    datahubHourly: dhHourly,
    datahubRaw: dhRaw,
    awsHourly,
    awsMinutes,
    awsObjectKeys: [],
    station,
    retrievedAt,
    upTo: now,
  });

  const summaryDays: SummaryDay[] = [...existing.values()].map(summaryDayOf);
  const summary = buildSummary(summaryDays, retrievedAt);
  await writeJson(join(dataDir, 'summary.json'), summary);

  const merged = mergeHourly(dhHourly, awsHourly).filter((h) => Date.parse(h.time) <= now.getTime());
  const latestObservation = merged.at(-1) ?? null;
  const status = feedStatus(Boolean(dhHourly.length), Boolean(awsMinutes.length), latestObservation?.time ?? null, now);
  if (datahubError && status.status !== 'SIGNAL_LOST') status.message += ` (${datahubError})`;

  const latest = latestOf({
    now,
    today,
    station,
    todaySummary: todaySummary.completeness.hoursReceived ? todaySummary : null,
    yesterday: existing.get(yesterday) ?? null,
    summary,
    status,
    latestObservation,
  });
  await writeJson(join(dataDir, 'latest.json'), latest);
  log(`Today so far (${today}): ${todaySummary.rule.verdict}, ${todaySummary.scene.label}. Status ${status.status}.`);

  if (!dhHourly.length && !awsMinutes.length) process.exit(3);
}

/** AWS object keys start with the publication time; keep those relevant to a day. */
function keyOverlapsDay(key: string, date: string): boolean {
  const m = /^(\d{12})_(\d{12})_(\d{12})\//.exec(key);
  if (!m) return false;
  const toIso = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00.000Z`;
  const { start, end } = ukDayBoundsUtc(date);
  return Date.parse(toIso(m[3])) >= start.getTime() && Date.parse(toIso(m[2])) < end.getTime();
}

if (!existsSync('package.json')) {
  console.error('Run from the repository root.');
  process.exit(1);
}

main().catch((e) => {
  console.error('[snow-watch] Fatal:', e);
  process.exit(1);
});
