// Source adapters: Met Office Weather DataHub (primary) and the Met Office
// UK Land Surface Observations bucket on the AWS Open Data Registry (secondary).
import { config } from '../src/lib/config';
import { fetchWithRetry } from './http';
import {
  parseDatahubNearest,
  parseDatahubObservations,
  datahubAreaMatches,
  parseAwsCsv,
  parseAwsPrefix,
  mergeMinutes,
  awsStationMatches,
  type DatahubNearest,
  type DatahubObservation,
  type AwsMinute,
} from './parsers';
import type { HourlyObs } from '../src/lib/types';

// ---------------------------------------------------------------- DataHub

export interface DatahubResult {
  station: DatahubNearest;
  hourly: HourlyObs[];
  raw: DatahubObservation[];
}

export class StationMismatchError extends Error {}

export async function fetchDatahubNearest(apiKey: string, max = 1): Promise<DatahubNearest[]> {
  const d = config.station.datahub;
  const url = `${d.baseUrl}/nearest?lat=${d.nearestQueryLatitude}&lon=${d.nearestQueryLongitude}&max=${max}`;
  const res = await fetchWithRetry(url, { headers: { apikey: apiKey, accept: 'application/json' } });
  return parseDatahubNearest(await res.json());
}

/**
 * Looks up the nearest station to Trafalgar Square and refuses to continue unless it is
 * St James's Park (area name check) and, once confirmed, the stored geohash matches.
 */
export async function fetchDatahub(apiKey: string): Promise<DatahubResult> {
  const d = config.station.datahub;
  const [nearest] = await fetchDatahubNearest(apiKey, 1);
  if (!nearest) throw new StationMismatchError('DataHub nearest-station lookup returned no station.');
  if (!datahubAreaMatches(nearest.area)) {
    throw new StationMismatchError(
      `DataHub nearest station to Trafalgar Square is "${nearest.area}" (${nearest.geohash}), not St James's Park. Refusing to use it.`,
    );
  }
  if (d.confirmedGeohash && d.confirmedGeohash !== nearest.geohash) {
    throw new StationMismatchError(
      `DataHub nearest geohash ${nearest.geohash} does not match the confirmed St James's Park geohash ${d.confirmedGeohash}.`,
    );
  }
  const res = await fetchWithRetry(`${d.baseUrl}/${encodeURIComponent(nearest.geohash)}`, {
    headers: { apikey: apiKey, accept: 'application/json' },
  });
  const { hourly, raw } = parseDatahubObservations(await res.json());
  return { station: nearest, hourly, raw };
}

// ---------------------------------------------------------------- AWS

export interface AwsResult {
  minutes: AwsMinute[];
  objectKeys: string[];
  stationVerified: boolean;
  stationName: string | null;
}

async function listS3(params: Record<string, string>): Promise<{ prefixes: string[]; keys: string[] }> {
  const base = config.station.aws.baseUrl;
  const prefixes: string[] = [];
  const keys: string[] = [];
  let token: string | null = null;
  do {
    const q = new URLSearchParams({ 'list-type': '2', ...params });
    if (token) q.set('continuation-token', token);
    const res = await fetchWithRetry(`${base}/?${q.toString()}`);
    const xml = await res.text();
    for (const m of xml.matchAll(/<Prefix>([^<]+)<\/Prefix>/g)) if (m[1] !== params.prefix) prefixes.push(decodeXml(m[1]));
    for (const m of xml.matchAll(/<Key>([^<]+)<\/Key>/g)) keys.push(decodeXml(m[1]));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml) ? (/<NextContinuationToken>([^<]+)</.exec(xml)?.[1] ?? null) : null;
    if (token) token = decodeXml(token);
  } while (token);
  return { prefixes, keys };
}

const decodeXml = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');

/** Fetch all St James's Park one-minute rows overlapping [start, end). */
export async function fetchAws(start: Date, end: Date): Promise<AwsResult> {
  const a = config.station.aws;
  // Prefixes start with the publication time, which is at or after the period covered.
  const dates = new Set<string>();
  for (let t = start.getTime(); t <= end.getTime() + 86400000; t += 86400000) dates.add(ymd(new Date(t)));
  const prefixes = (await pool([...dates], 4, (d) => listS3({ prefix: d, delimiter: '/' }))).flatMap((r) => r.prefixes);

  const wanted = prefixes
    .map((p) => ({ p, info: parseAwsPrefix(p) }))
    .filter((x): x is { p: string; info: NonNullable<ReturnType<typeof parseAwsPrefix>> } => x.info !== null)
    .filter((x) => x.info.end.getTime() >= start.getTime() && x.info.start.getTime() < end.getTime());

  const files: Array<{ published: Date; minutes: AwsMinute[] }> = [];
  const objectKeys: string[] = [];
  let stationVerified = true;
  let stationName: string | null = null;

  const fetched = await pool(wanted, 8, async (w) => {
    const { keys } = await listS3({ prefix: `${w.p}${a.fileKeyPrefix}` });
    const out: Array<{ key: string; minutes: AwsMinute[] }> = [];
    for (const key of keys) {
      const res = await fetchWithRetry(`${a.baseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`);
      out.push({ key, minutes: parseAwsCsv(await res.text()) });
    }
    return { w, out };
  });

  for (const { w, out } of fetched) {
    for (const { key, minutes } of out) {
      if (minutes.length === 0) continue;
      if (!minutes.every(awsStationMatches)) {
        stationVerified = false;
        stationName = minutes[0].name;
        continue; // never use rows from a different station
      }
      stationName = minutes[0].name;
      objectKeys.push(key);
      files.push({
        published: w.info.published,
        minutes: minutes.filter((m) => {
          const t = Date.parse(m.time);
          return t >= start.getTime() && t < end.getTime();
        }),
      });
    }
  }
  return { minutes: mergeMinutes(files), objectKeys: objectKeys.sort(), stationVerified, stationName };
}

/** Run async jobs with bounded concurrency, preserving input order. */
async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}
