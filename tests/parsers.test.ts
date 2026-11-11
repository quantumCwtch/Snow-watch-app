import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseDatahubNearest,
  parseDatahubObservations,
  parseAwsCsv,
  aggregateAwsHourly,
  awsStationMatches,
  parseAwsPrefix,
  mergeMinutes,
  datahubAreaMatches,
  ParseError,
} from '../pipeline/parsers';
import { applySnowRule } from '../src/lib/snowRule';
import { classify } from '../src/lib/classifier';

const FIX = join(__dirname, 'fixtures');
const json = (p: string) => JSON.parse(readFileSync(join(FIX, p), 'utf8'));

describe('DataHub parser (official Met Office sample responses)', () => {
  it('parses the nearest-station sample', () => {
    const n = parseDatahubNearest(json('datahub/official-sample-nearest.json'));
    expect(n[0]).toEqual({ geohash: 'gcj8ds', area: 'Devon', region: 'sw', country: 'England', olson_time_zone: 'Europe/London' });
    // The sample is in Devon, so it must NOT pass the St James's Park identity check.
    expect(datahubAreaMatches(n[0].area)).toBe(false);
  });

  it('accepts likely St James\'s Park area spellings', () => {
    for (const a of ["London St James's Park", 'St. James Park', 'ST JAMESS PARK']) expect(datahubAreaMatches(a)).toBe(true);
    expect(datahubAreaMatches('Heathrow')).toBe(false);
  });

  it('parses the observation sample with real field names', () => {
    const { hourly, raw } = parseDatahubObservations(json('datahub/official-sample-observations.json'));
    expect(hourly.length).toBe(raw.length);
    expect(hourly[0]).toMatchObject({
      time: '2025-07-23T12:00:00Z',
      weatherCode: 7,
      temperatureC: 21.77,
      visibilityM: 38710,
      windSpeedMs: 3.3,
      windGustMs: 6,
      windDirection: 'N',
      humidityPct: 58,
      mslpHpa: 1015,
      precipMm: null,
    });
    // Sorted ascending
    expect([...hourly].map((h) => h.time)).toEqual(hourly.map((h) => h.time).sort());
  });

  it('treats null weather_code as missing, not zero', () => {
    const { hourly } = parseDatahubObservations([{ datetime: '2026-01-01T00:00:00Z', weather_code: null, temperature: 1 }]);
    expect(hourly[0].weatherCode).toBeNull();
  });

  it('rejects malformed bodies', () => {
    expect(() => parseDatahubObservations({ error: 'x' })).toThrow(ParseError);
    expect(() => parseDatahubObservations([{ temperature: 3 }])).toThrow(ParseError);
  });
});

describe('AWS parser (real St James\'s Park files, 2026-11-10)', () => {
  const dir = join(FIX, 'aws/2026-11-10');
  const files = readdirSync(dir).sort();
  const minutes = mergeMinutes(
    files.map((f) => ({ published: parseAwsPrefix(f.replace('.csv', ''))!.published, minutes: parseAwsCsv(readFileSync(join(dir, f), 'utf8')) })),
  );

  it('reads every minute of the day', () => {
    expect(minutes).toHaveLength(1440);
    expect(minutes[0].time).toBe('2026-11-10T00:00:00Z');
    expect(minutes.at(-1)!.time).toBe('2026-11-10T23:59:00Z');
  });

  it('confirms the station identity', () => {
    expect(minutes.every(awsStationMatches)).toBe(true);
    expect(awsStationMatches({ name: 'Heathrow Automatic Weather Station', latitude: 51.48, longitude: -0.45 })).toBe(false);
  });

  it('has no present-weather code at this station (so never infers one)', () => {
    expect(minutes.every((m) => m.presentWeather === null)).toBe(true);
  });

  it('aggregates to 24 hourly records with precipitation totals', () => {
    const hourly = aggregateAwsHourly(minutes);
    expect(hourly).toHaveLength(24);
    expect(hourly.every((h) => h.weatherCode === null && h.temperatureC !== null)).toBe(true);
    const total = hourly.reduce((s, h) => s + (h.precipMm ?? 0), 0);
    expect(total).toBeCloseTo(3.0, 1);
    const tmin = Math.min(...hourly.map((h) => h.minTemperatureC!));
    expect(tmin).toBeGreaterThan(5);
    expect(tmin).toBeLessThan(6.5);
  });

  it('real day without codes: cool hours below 6 °C make it UNCONFIRMED (not possible snow); scene from measured rain', () => {
    const hourly = aggregateAwsHourly(minutes);
    const r = applySnowRule({ date: '2026-11-10', hourly });
    // AWS carries no weather codes and the temperature dipped to 5.8 °C, so snow cannot be
    // formally ruled out, but no precipitation fell at or below 2 °C.
    expect(r.verdict).toBe('UNCONFIRMED');
    expect(r.possibleSnow).toBe(false);
    expect(classify(hourly).category).toBe('light-rain');
  });
});

describe('AWS prefixes', () => {
  it('parses normal and late-correction prefixes', () => {
    const p = parseAwsPrefix('202611112159_202611112000_202611112059/')!;
    expect(p.start.toISOString()).toBe('2026-11-11T20:00:00.000Z');
    expect(p.end.toISOString()).toBe('2026-11-11T20:59:00.000Z');
    expect(parseAwsPrefix('202611040059_202611032358_202611032359/')!.published.toISOString()).toBe('2026-11-04T00:59:00.000Z');
    expect(parseAwsPrefix('index.html')).toBeNull();
  });

  it('later publication wins on duplicate minutes', () => {
    const base = { name: 'x', latitude: 1, longitude: 1, precipMm: 0, precipIntensity: 0, humidityPct: 50, presentWeather: null, visibilityM: null, windSpeedMs: null, mslpHpa: null };
    const merged = mergeMinutes([
      { published: new Date('2026-01-01T01:00Z'), minutes: [{ ...base, time: '2026-01-01T00:10:00Z', temperatureC: 1 }] },
      { published: new Date('2026-01-01T02:00Z'), minutes: [{ ...base, time: '2026-01-01T00:10:00Z', temperatureC: 2 }] },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].temperatureC).toBe(2);
  });
});
