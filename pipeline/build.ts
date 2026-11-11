// Pure builders that turn source data into the published JSON shapes.
import type {
  HourlyObs,
  DayRecord,
  CrossCheck,
  StationIdentity,
  Summary,
  SummaryDay,
  LatestSnapshot,
  Verdict,
  SourceId,
  AwsRawMinutes,
  FeedStatus,
} from '../src/lib/types';
import { applySnowRule, completenessOf } from '../src/lib/snowRule';
import { classify } from '../src/lib/classifier';
import { utcHoursOfUkDay, ukDayBoundsUtc, addDays, daysBetween } from '../src/lib/ukTime';
import { config } from '../src/lib/config';
import type { AwsMinute, DatahubObservation } from './parsers';
import { toRawMinutes } from './parsers';

/** Merge DataHub hourly obs (primary) with AWS hourly aggregates (secondary). */
export function mergeHourly(datahub: HourlyObs[], aws: HourlyObs[]): HourlyObs[] {
  const map = new Map<string, HourlyObs>();
  for (const a of aws) map.set(a.time, { ...a });
  for (const d of datahub) {
    const a = map.get(d.time);
    if (!a) {
      map.set(d.time, { ...d });
      continue;
    }
    map.set(d.time, {
      time: d.time,
      weatherCode: d.weatherCode,
      temperatureC: d.temperatureC ?? a.temperatureC,
      minTemperatureC: a.minTemperatureC,
      maxTemperatureC: a.maxTemperatureC,
      visibilityM: d.visibilityM ?? a.visibilityM,
      windSpeedMs: d.windSpeedMs ?? a.windSpeedMs,
      windGustMs: d.windGustMs,
      windDirection: d.windDirection,
      humidityPct: d.humidityPct ?? a.humidityPct,
      mslpHpa: d.mslpHpa ?? a.mslpHpa,
      precipMm: a.precipMm,
      sources: ['datahub', 'aws'],
    });
  }
  return [...map.values()].sort((x, y) => x.time.localeCompare(y.time));
}

export function crossCheck(datahub: HourlyObs[], aws: HourlyObs[]): CrossCheck | null {
  const awsBy = new Map(aws.map((a) => [a.time, a]));
  let compared = 0;
  let maxDiff: number | null = null;
  const outside: string[] = [];
  for (const d of datahub) {
    const a = awsBy.get(d.time);
    if (!a || d.temperatureC === null || a.temperatureC === null) continue;
    compared++;
    const diff = Math.abs(d.temperatureC - a.temperatureC);
    maxDiff = maxDiff === null ? diff : Math.max(maxDiff, diff);
    if (diff > config.crossCheck.temperatureToleranceC) outside.push(d.time);
  }
  if (compared === 0) return null;
  return {
    comparedHours: compared,
    maxTemperatureDifferenceC: maxDiff === null ? null : Math.round(maxDiff * 100) / 100,
    hoursOutsideTolerance: outside,
    ok: outside.length === 0,
  };
}

function hoursForDay(date: string, hourly: HourlyObs[], upTo?: Date): HourlyObs[] {
  const set = new Set(utcHoursOfUkDay(date));
  return hourly.filter((h) => set.has(h.time) && (!upTo || Date.parse(h.time) <= upTo.getTime()));
}

function boundaryHour(date: string): string {
  return ukDayBoundsUtc(date).end.toISOString().replace('.000Z', 'Z');
}

export interface DayInputs {
  date: string;
  datahubHourly: HourlyObs[];
  datahubRaw: DatahubObservation[];
  awsHourly: HourlyObs[];
  awsMinutes: AwsMinute[];
  awsObjectKeys: string[];
  station: StationIdentity;
  retrievedAt: string;
  upTo?: Date;
}

export function summariseDay(inp: DayInputs) {
  const merged = mergeHourly(inp.datahubHourly, inp.awsHourly);
  const inDay = hoursForDay(inp.date, merged, inp.upTo);
  // Include the boundary (next local midnight) obs for the snow rule only.
  const boundary = inp.upTo ? [] : merged.filter((h) => h.time === boundaryHour(inp.date));
  const rule = applySnowRule({ date: inp.date, hourly: [...inDay, ...boundary], upTo: inp.upTo });
  const scene = classify(inDay);
  const { start, end } = ukDayBoundsUtc(inp.date);
  const dayMinutes = inp.awsMinutes.filter((m) => {
    const t = Date.parse(m.time);
    return t >= start.getTime() && t < end.getTime() && (!inp.upTo || t <= inp.upTo.getTime());
  });
  const temps = [
    ...inDay.map((h) => h.temperatureC),
    ...dayMinutes.map((m) => m.temperatureC),
  ].filter((t): t is number => t !== null);
  const precipMinutes = dayMinutes.filter((m) => m.precipMm !== null);
  const totalPrecip = precipMinutes.length
    ? Math.round(precipMinutes.reduce((s, m) => s + (m.precipMm ?? 0), 0) * 10) / 10
    : null;
  const sources: SourceId[] = [];
  if (inDay.some((h) => h.sources.includes('datahub'))) sources.push('datahub');
  if (inDay.some((h) => h.sources.includes('aws'))) sources.push('aws');
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    merged: inDay,
    boundary,
    rule,
    scene,
    minTemperatureC: temps.length ? r1(Math.min(...temps)) : null,
    maxTemperatureC: temps.length ? r1(Math.max(...temps)) : null,
    totalPrecipMm: totalPrecip,
    completeness: completenessOf(inp.date, inDay, inp.upTo),
    sources,
    dayMinutes,
  };
}

export function buildDayRecord(inp: DayInputs): DayRecord {
  const s = summariseDay(inp);
  const hours = new Set([...s.merged, ...s.boundary].map((h) => h.time));
  const dhRaw = inp.datahubRaw.filter((r) => hours.has(new Date(r.datetime).toISOString().replace('.000Z', 'Z')));
  const awsRaw: AwsRawMinutes | null = s.dayMinutes.length ? toRawMinutes(s.dayMinutes, inp.awsObjectKeys) : null;
  return {
    schema: 1,
    date: inp.date,
    provisional: Boolean(inp.upTo),
    verdict: s.rule.verdict,
    rule: s.rule,
    scene: s.scene,
    minTemperatureC: s.minTemperatureC,
    maxTemperatureC: s.maxTemperatureC,
    totalPrecipMm: s.totalPrecipMm,
    completeness: s.completeness,
    sources: s.sources,
    crossCheck: crossCheck(
      inp.datahubHourly.filter((h) => hours.has(h.time)),
      inp.awsHourly.filter((h) => hours.has(h.time)),
    ),
    station: inp.station,
    retrievedAt: inp.retrievedAt,
    hourly: s.merged,
    raw: { datahub: dhRaw.length ? dhRaw : null, aws: awsRaw },
  };
}

export function summaryDayOf(r: DayRecord): SummaryDay {
  return {
    date: r.date,
    verdict: r.verdict,
    possibleSnow: r.rule.possibleSnow,
    hailSeen: r.rule.hailSeen,
    category: r.scene.category,
    variant: r.scene.variant,
    minTemperatureC: r.minTemperatureC,
    maxTemperatureC: r.maxTemperatureC,
    completeness: r.completeness.hoursExpected ? Math.round((r.completeness.hoursReceived / r.completeness.hoursExpected) * 100) / 100 : 0,
  };
}

/**
 * Runs without snow count consecutive calendar days that have a finalised record
 * whose verdict is not SNOW. A date with no record breaks the run.
 */
export function buildSummary(days: SummaryDay[], generatedAt: string): Summary {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const counts: Record<Verdict, number> = { SNOW: 0, SLEET: 0, UNCONFIRMED: 0, NO_SNOW: 0, NO_DATA: 0 };
  for (const d of sorted) counts[d.verdict]++;
  let best = { days: 0, from: null as string | null, to: null as string | null };
  let run = 0;
  let runStart: string | null = null;
  let prev: string | null = null;
  for (const d of sorted) {
    const contiguous = prev !== null && daysBetween(prev, d.date) === 1;
    if (d.verdict === 'SNOW') {
      run = 0;
      runStart = null;
    } else {
      if (run === 0 || !contiguous) {
        run = 1;
        runStart = d.date;
      } else run++;
      if (run > best.days) best = { days: run, from: runStart, to: d.date };
    }
    prev = d.date;
  }
  return {
    schema: 1,
    generatedAt,
    launchDate: sorted[0]?.date ?? null,
    counts,
    snowDays: sorted.filter((d) => d.verdict === 'SNOW').map((d) => d.date),
    sleetDays: sorted.filter((d) => d.verdict === 'SLEET').map((d) => d.date),
    longestRunWithoutSnow: best,
    currentRunWithoutSnow: run,
    days: sorted,
  };
}

export function feedStatus(
  datahubOk: boolean,
  awsOk: boolean,
  latestObsTime: string | null,
  now: Date,
): { status: FeedStatus; message: string } {
  const ageH = latestObsTime ? (now.getTime() - Date.parse(latestObsTime)) / 3600000 : Infinity;
  if (!latestObsTime || ageH > 3) {
    return {
      status: 'SIGNAL_LOST',
      message: latestObsTime
        ? `Latest observation is ${Math.floor(ageH)} hours old. Data is late or missing.`
        : 'No observations could be retrieved from any source.',
    };
  }
  if (datahubOk && awsOk) return { status: 'OK', message: 'Met Office DataHub and AWS observations received.' };
  if (datahubOk) return { status: 'PARTIAL', message: 'DataHub received; AWS cross-check unavailable.' };
  return {
    status: 'PARTIAL',
    message: 'Running on AWS observations only: no weather codes, so snow cannot be confirmed.',
  };
}

export function emptyStation(): StationIdentity {
  return {
    name: config.station.name,
    wmoId: config.station.wmoId,
    datahubGeohash: null,
    datahubArea: null,
    awsName: null,
    verified: { datahub: false, aws: false },
  };
}

export function latestOf(params: {
  now: Date;
  today: string;
  station: StationIdentity;
  todaySummary: ReturnType<typeof summariseDay> | null;
  yesterday: DayRecord | null;
  summary: Summary;
  status: { status: FeedStatus; message: string };
  latestObservation: HourlyObs | null;
}): LatestSnapshot {
  const t = params.todaySummary;
  return {
    schema: 1,
    generatedAt: params.now.toISOString(),
    status: params.status.status,
    statusMessage: params.status.message,
    station: params.station,
    latestObservation: params.latestObservation,
    today: t
      ? {
          date: params.today,
          verdict: t.rule.verdict,
          rule: t.rule,
          scene: t.scene,
          minTemperatureC: t.minTemperatureC,
          maxTemperatureC: t.maxTemperatureC,
          totalPrecipMm: t.totalPrecipMm,
          completeness: t.completeness,
          sources: t.sources,
        }
      : null,
    yesterday: params.yesterday
      ? {
          date: params.yesterday.date,
          verdict: params.yesterday.verdict,
          possibleSnow: params.yesterday.rule.possibleSnow,
          hailSeen: params.yesterday.rule.hailSeen,
          scene: params.yesterday.scene,
          dayFile: `data/days/${params.yesterday.date}.json`,
        }
      : null,
    snowDaysRecorded: params.summary.counts.SNOW,
  };
}

export { addDays };
