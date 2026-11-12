// Nearby confirmation stations with present-weather sensors.
//  - London City Airport: METAR reports from NOAA's Aviation Weather Center API
//    (https://aviationweather.gov/api/data/metar), no key needed. Field names taken from a
//    real response saved in tests/fixtures/metar/eglc-48h.json.
//  - Northolt and Heathrow: Met Office one-minute files from the same AWS Open Data bucket
//    as St James's Park (present_weather_1_minute_10_minute_weighted_mean column).
import { config } from '../src/lib/config';
import type { NearbyReport } from '../src/lib/types';
import { metarWeather } from '../src/lib/presentWeather';
import { fetchWithRetry } from './http';
import { fetchAws } from './sources';
import { ParseError } from './parsers';

export interface MetarStationSpec {
  id: string;
  name: string;
  icao: string;
  latitude: number;
  longitude: number;
  maxCoordinateDifferenceDegrees: number;
}

/** Parse the aviationweather.gov JSON response, verifying the station identity. */
export function parseMetarJson(body: unknown, st: MetarStationSpec): NearbyReport[] {
  if (!Array.isArray(body)) throw new ParseError('METAR: expected a JSON array');
  const out: NearbyReport[] = [];
  for (const [i, item] of body.entries()) {
    const o = item as Record<string, unknown>;
    if (o.icaoId !== st.icao) throw new ParseError(`METAR[${i}] is for ${String(o.icaoId)}, not ${st.icao}`);
    const lat = Number(o.lat);
    const lon = Number(o.lon);
    if (Math.abs(lat - st.latitude) > st.maxCoordinateDifferenceDegrees || Math.abs(lon - st.longitude) > st.maxCoordinateDifferenceDegrees) {
      throw new ParseError(`METAR[${i}] coordinates ${lat},${lon} do not match ${st.name}`);
    }
    if (typeof o.rawOb !== 'string' || typeof o.obsTime !== 'number') throw new ParseError(`METAR[${i}] missing rawOb or obsTime`);
    out.push({
      stationId: st.id,
      stationName: st.name,
      time: new Date(o.obsTime * 1000).toISOString().replace('.000Z', 'Z'),
      wx: metarWeather(o.rawOb),
    });
  }
  return out.sort((a, b) => a.time.localeCompare(b.time));
}

export interface NearbyFetchResult {
  reports: NearbyReport[];
  /** Raw source records kept for traceability (METAR raw text by time). */
  rawMetars: Array<{ stationId: string; time: string; rawOb: string }>;
  errors: string[];
  stationsOk: string[];
}

export async function fetchNearby(start: Date, end: Date, now: Date): Promise<NearbyFetchResult> {
  const reports: NearbyReport[] = [];
  const rawMetars: NearbyFetchResult['rawMetars'] = [];
  const errors: string[] = [];
  const stationsOk: string[] = [];
  for (const st of config.confirmation.stations) {
    try {
      if (st.source === 'metar') {
        const s = st as unknown as MetarStationSpec & { baseUrl: string };
        const hours = Math.min(360, Math.ceil((now.getTime() - start.getTime()) / 3600000) + 2);
        const res = await fetchWithRetry(`${s.baseUrl}?ids=${encodeURIComponent(s.icao)}&format=json&hours=${hours}`);
        const body = (await res.json()) as Array<Record<string, unknown>>;
        const parsed = parseMetarJson(body, s).filter((r) => {
          const t = Date.parse(r.time);
          return t >= start.getTime() - 3600000 && t < end.getTime() + 3600000;
        });
        for (const o of body) {
          rawMetars.push({ stationId: s.id, time: new Date((o.obsTime as number) * 1000).toISOString(), rawOb: String(o.rawOb) });
        }
        reports.push(...parsed);
        if (parsed.length) stationsOk.push(s.name);
      } else {
        const s = st as unknown as { id: string; name: string; fileKeyPrefix: string; expectedName: string; latitude: number; longitude: number; maxCoordinateDifferenceDegrees: number };
        const r = await fetchAws(new Date(start.getTime() - 3600000), new Date(end.getTime() + 3600000), {
          fileKeyPrefix: s.fileKeyPrefix,
          expectedName: s.expectedName,
          expectedLatitude: s.latitude,
          expectedLongitude: s.longitude,
          maxCoordinateDifferenceDegrees: s.maxCoordinateDifferenceDegrees,
        });
        if (!r.stationVerified) errors.push(`${s.name}: station identity check failed; rows ignored.`);
        const rows = r.minutes.filter((m) => m.presentWeather !== null);
        for (const m of rows) reports.push({ stationId: s.id, stationName: s.name, time: m.time, wx: m.presentWeather });
        if (rows.length) stationsOk.push(s.name);
      }
    } catch (e) {
      errors.push(`${st.name}: ${(e as Error).message}`);
    }
  }
  return { reports: reports.sort((a, b) => a.time.localeCompare(b.time)), rawMetars, errors, stationsOk };
}

/** Compress reports into runs of identical weather per station, for the day files. */
export function toRuns(reports: NearbyReport[]): Array<[string, string, string, string | null]> {
  const runs: Array<[string, string, string, string | null]> = [];
  const byStation = new Map<string, NearbyReport[]>();
  for (const r of reports) {
    const arr = byStation.get(r.stationId) ?? [];
    arr.push(r);
    byStation.set(r.stationId, arr);
  }
  for (const [id, arr] of byStation) {
    arr.sort((a, b) => a.time.localeCompare(b.time));
    let cur: [string, string, string, string | null] | null = null;
    for (const r of arr) {
      const gapOk = cur && Date.parse(r.time) - Date.parse(cur[2]) <= 31 * 60000;
      if (cur && cur[3] === r.wx && gapOk) cur[2] = r.time;
      else {
        if (cur) runs.push(cur);
        cur = [id, r.time, r.time, r.wx];
      }
    }
    if (cur) runs.push(cur);
  }
  return runs;
}
