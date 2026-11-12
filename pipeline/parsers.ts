// Parsers for the two Met Office sources. Field names were taken from real data:
//  - DataHub: the official Land Observations OpenAPI spec and sample responses
//    (tests/fixtures/datahub/, downloaded from datahub.metoffice.gov.uk 2026-11-11).
//  - AWS: real St James's Park CSV objects from s3://met-office-land-observations-data
//    (tests/fixtures/aws/, downloaded 2026-11-11). Files are pipe-separated, one row
//    per minute, with a `_qc` JSON column after each variable.

import type { HourlyObs, AwsRawMinutes } from '../src/lib/types';
import { config } from '../src/lib/config';

// ---------------------------------------------------------------- DataHub

export interface DatahubNearest {
  geohash: string;
  area: string;
  region: string | null;
  country: string | null;
  olson_time_zone: string;
}

export interface DatahubObservation {
  datetime: string;
  weather_code?: number | null;
  temperature?: number | null;
  visibility?: number | null;
  wind_speed?: number | null;
  wind_gust?: number | null;
  wind_direction?: string | null;
  humidity?: number | null;
  mslp?: number | null;
  pressure_tendency?: string | null;
}

export class ParseError extends Error {}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : null);

export function parseDatahubNearest(body: unknown): DatahubNearest[] {
  if (!Array.isArray(body)) throw new ParseError('DataHub nearest: expected a JSON array');
  return body.map((item, i) => {
    if (!item || typeof item !== 'object') throw new ParseError(`DataHub nearest[${i}] is not an object`);
    const o = item as Record<string, unknown>;
    if (typeof o.geohash !== 'string' || typeof o.area !== 'string') {
      throw new ParseError(`DataHub nearest[${i}] missing geohash or area`);
    }
    return {
      geohash: o.geohash,
      area: o.area,
      region: str(o.region),
      country: str(o.country),
      olson_time_zone: String(o.olson_time_zone ?? ''),
    };
  });
}

export function parseDatahubObservations(body: unknown): { hourly: HourlyObs[]; raw: DatahubObservation[] } {
  if (!Array.isArray(body)) throw new ParseError('DataHub observations: expected a JSON array');
  const raw: DatahubObservation[] = [];
  const hourly: HourlyObs[] = [];
  for (const [i, item] of body.entries()) {
    if (!item || typeof item !== 'object') throw new ParseError(`observation[${i}] is not an object`);
    const o = item as Record<string, unknown>;
    if (typeof o.datetime !== 'string' || Number.isNaN(Date.parse(o.datetime))) {
      throw new ParseError(`observation[${i}] has no valid datetime`);
    }
    raw.push(o as unknown as DatahubObservation);
    const code = num(o.weather_code);
    hourly.push({
      time: new Date(o.datetime).toISOString().replace('.000Z', 'Z'),
      weatherCode: code === null ? null : Math.round(code),
      temperatureC: num(o.temperature),
      visibilityM: num(o.visibility),
      windSpeedMs: num(o.wind_speed),
      windGustMs: num(o.wind_gust),
      windDirection: str(o.wind_direction),
      humidityPct: num(o.humidity),
      mslpHpa: num(o.mslp),
      precipMm: null,
      sources: ['datahub'],
    });
  }
  hourly.sort((a, b) => a.time.localeCompare(b.time));
  return { hourly, raw };
}

export function datahubAreaMatches(area: string): boolean {
  return new RegExp(config.station.datahub.expectedAreaPattern, 'i').test(area);
}

// ---------------------------------------------------------------- AWS

/** Columns we keep from the AWS CSV. Names verified against real files. */
export const AWS_COLUMNS = {
  temperature: 'air_temperature_near_surface_1_minute_mean',
  precip: 'accumulated_precipitation_1_minute_total',
  precipIntensity: 'precipitation_intensity_1_minute_rolling_algorithm',
  humidity: 'relative_humidity_near_surface_1_minute_mean',
  presentWeather: 'present_weather_1_minute_10_minute_weighted_mean',
  visibility: 'meteorological_optical_range_horizontal_1_minute_mean',
  windSpeed: 'wind_speed_near_surface_1_minute_mean',
  pressureMsl: 'air_pressure_near_surface_mean_sea_level_1_minute_mean',
} as const;

export interface AwsMinute {
  time: string; // ISO, minute resolution, Z
  name: string;
  latitude: number | null;
  longitude: number | null;
  temperatureC: number | null;
  precipMm: number | null;
  precipIntensity: number | null;
  humidityPct: number | null;
  /** Aviation-style weather groups (e.g. NSW, -RA, UP); null when not reported. */
  presentWeather: string | null;
  visibilityM: number | null;
  windSpeedMs: number | null;
  mslpHpa: number | null;
}

/** QC column is JSON like {"good": []}; treat anything flagged as bad/suspect as missing. */
function qcOk(qc: string | undefined): boolean {
  if (!qc) return true;
  try {
    const o = JSON.parse(qc) as Record<string, unknown>;
    for (const k of Object.keys(o)) {
      if (/bad|fail|reject|suspect/i.test(k)) return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function parseAwsCsv(text: string): AwsMinute[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split('|');
  const idx = (name: string) => header.indexOf(name);
  const iTime = idx('timestep');
  const iName = idx('name');
  if (iTime < 0 || iName < 0) throw new ParseError('AWS CSV: missing timestep or name column');
  const iLat = idx('latitude');
  const iLon = idx('longitude');
  const getNum = (cells: string[], col: string): number | null => {
    const i = idx(col);
    if (i < 0) return null;
    const v = cells[i];
    if (v === undefined || v === '') return null;
    if (!qcOk(cells[idx(col + '_qc')])) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const getStr = (cells: string[], col: string): string | null => {
    const i = idx(col);
    if (i < 0) return null;
    const v = cells[i];
    if (v === undefined || v.trim() === '') return null;
    return qcOk(cells[idx(col + '_qc')]) ? v.trim() : null;
  };
  const out: AwsMinute[] = [];
  for (const line of lines.slice(1)) {
    const c = line.split('|');
    const t = Date.parse(c[iTime]);
    if (Number.isNaN(t)) continue;
    out.push({
      time: new Date(t).toISOString().replace('.000Z', 'Z'),
      name: c[iName],
      latitude: iLat >= 0 && c[iLat] !== '' ? Number(c[iLat]) : null,
      longitude: iLon >= 0 && c[iLon] !== '' ? Number(c[iLon]) : null,
      temperatureC: getNum(c, AWS_COLUMNS.temperature),
      precipMm: getNum(c, AWS_COLUMNS.precip),
      precipIntensity: getNum(c, AWS_COLUMNS.precipIntensity),
      humidityPct: getNum(c, AWS_COLUMNS.humidity),
      presentWeather: getStr(c, AWS_COLUMNS.presentWeather),
      visibilityM: getNum(c, AWS_COLUMNS.visibility),
      windSpeedMs: getNum(c, AWS_COLUMNS.windSpeed),
      mslpHpa: getNum(c, AWS_COLUMNS.pressureMsl),
    });
  }
  return out;
}

export interface AwsStationSpec {
  fileKeyPrefix: string;
  expectedName: string;
  expectedLatitude: number;
  expectedLongitude: number;
  maxCoordinateDifferenceDegrees: number;
}

export const SJP_AWS: AwsStationSpec = config.station.aws;

export function awsStationMatches(m: Pick<AwsMinute, 'name' | 'latitude' | 'longitude'>, a: AwsStationSpec = SJP_AWS): boolean {
  if (m.name !== a.expectedName) return false;
  if (m.latitude === null || m.longitude === null) return false;
  return (
    Math.abs(m.latitude - a.expectedLatitude) <= a.maxCoordinateDifferenceDegrees &&
    Math.abs(m.longitude - a.expectedLongitude) <= a.maxCoordinateDifferenceDegrees
  );
}

/** Minimum one-minute samples for an hour's precipitation total to be trusted. */
export const MIN_MINUTES_FOR_PRECIP = 54;

/**
 * Aggregate one-minute AWS rows into hourly records. Each record is keyed by the
 * hour it STARTS (HH:00Z) and summarises minutes HH:00 to HH:59: temperature is the
 * HH:00 value (nearest within 5 minutes), min/max over the hour, precipitation summed.
 * The AWS feed for St James's Park carries no present-weather code, so `weatherCode`
 * is always null here; it is never inferred.
 */
export function aggregateAwsHourly(minutes: AwsMinute[]): HourlyObs[] {
  const byHour = new Map<string, AwsMinute[]>();
  for (const m of minutes) {
    const h = m.time.slice(0, 13) + ':00:00Z';
    let arr = byHour.get(h);
    if (!arr) byHour.set(h, (arr = []));
    arr.push(m);
  }
  const out: HourlyObs[] = [];
  for (const [hour, rows] of [...byHour.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.sort((a, b) => a.time.localeCompare(b.time));
    const minuteOf = (r: AwsMinute) => Number(r.time.slice(14, 16));
    const near = rows.filter((r) => minuteOf(r) <= 5 && r.temperatureC !== null);
    const temps = rows.map((r) => r.temperatureC).filter((t): t is number => t !== null);
    const precipRows = rows.filter((r) => r.precipMm !== null);
    const precip =
      precipRows.length >= MIN_MINUTES_FOR_PRECIP
        ? round(precipRows.reduce((s, r) => s + (r.precipMm ?? 0), 0), 2)
        : null;
    const hum = rows.find((r) => r.humidityPct !== null && minuteOf(r) <= 5)?.humidityPct ?? null;
    const vis = rows.find((r) => r.visibilityM !== null && minuteOf(r) <= 5)?.visibilityM ?? null;
    const wind = rows.find((r) => r.windSpeedMs !== null && minuteOf(r) <= 5)?.windSpeedMs ?? null;
    const mslp = rows.find((r) => r.mslpHpa !== null && minuteOf(r) <= 5)?.mslpHpa ?? null;
    out.push({
      time: hour,
      weatherCode: null,
      temperatureC: near.length ? round(near[0].temperatureC!, 2) : null,
      minTemperatureC: temps.length ? round(Math.min(...temps), 2) : null,
      maxTemperatureC: temps.length ? round(Math.max(...temps), 2) : null,
      visibilityM: vis,
      windSpeedMs: wind,
      windGustMs: null,
      windDirection: null,
      humidityPct: hum === null ? null : round(hum, 1),
      mslpHpa: mslp,
      precipMm: precip,
      sources: ['aws'],
    });
  }
  return out;
}

export function toRawMinutes(minutes: AwsMinute[], objectKeys: string[]): AwsRawMinutes {
  return {
    objectKeys,
    columns: ['time', AWS_COLUMNS.temperature, AWS_COLUMNS.precip, AWS_COLUMNS.humidity, AWS_COLUMNS.precipIntensity],
    rows: minutes.map((m) => [
      m.time,
      m.temperatureC === null ? null : round(m.temperatureC, 3),
      m.precipMm,
      m.humidityPct === null ? null : round(m.humidityPct, 2),
      m.precipIntensity,
    ]),
  };
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;

// ---------------------------------------------------------------- AWS object listing

/**
 * Object prefixes look like `202611112159_202611112000_202611112059/`:
 * publication time, then the first and last minute (UTC) the file covers.
 * Late or corrected minutes arrive in short extra prefixes, e.g.
 * `202611040059_202611032358_202611032359/`.
 */
export function parseAwsPrefix(prefix: string): { published: Date; start: Date; end: Date } | null {
  const m = /^(\d{12})_(\d{12})_(\d{12})\/?$/.exec(prefix);
  if (!m) return null;
  const d = (s: string) =>
    new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12)));
  return { published: d(m[1]), start: d(m[2]), end: d(m[3]) };
}

/** Merge minute rows from several files; on duplicate timesteps the later-published file wins. */
export function mergeMinutes(files: Array<{ published: Date; minutes: AwsMinute[] }>): AwsMinute[] {
  const map = new Map<string, { p: number; m: AwsMinute }>();
  for (const f of files) {
    for (const m of f.minutes) {
      const prev = map.get(m.time);
      if (!prev || f.published.getTime() >= prev.p) map.set(m.time, { p: f.published.getTime(), m });
    }
  }
  return [...map.values()].map((v) => v.m).sort((a, b) => a.time.localeCompare(b.time));
}
