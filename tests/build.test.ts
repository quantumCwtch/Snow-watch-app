import { describe, it, expect } from 'vitest';
import { buildSummary, mergeHourly, crossCheck, feedStatus, buildDayRecord, emptyStation } from '../pipeline/build';
import type { SummaryDay, Verdict } from '../src/lib/types';
import { obs, day } from './helpers';

const sd = (date: string, verdict: Verdict): SummaryDay => ({
  date, verdict, possibleSnow: false, hailSeen: false, category: 'overcast', variant: 'normal',
  minTemperatureC: 1, maxTemperatureC: 5, completeness: 1,
});

describe('summary', () => {
  it('counts verdicts and longest run without snow (gaps break runs)', () => {
    const s = buildSummary(
      [
        sd('2026-01-01', 'NO_SNOW'), sd('2026-01-02', 'SLEET'), sd('2026-01-03', 'SNOW'),
        sd('2026-01-04', 'NO_SNOW'), sd('2026-01-05', 'UNCONFIRMED'), sd('2026-01-06', 'NO_SNOW'),
        sd('2026-01-08', 'NO_SNOW'),
      ],
      '2026-01-09T00:00:00Z',
    );
    expect(s.counts.SNOW).toBe(1);
    expect(s.snowDays).toEqual(['2026-01-03']);
    expect(s.sleetDays).toEqual(['2026-01-02']);
    expect(s.longestRunWithoutSnow).toEqual({ days: 3, from: '2026-01-04', to: '2026-01-06' });
    expect(s.currentRunWithoutSnow).toBe(1);
    expect(s.launchDate).toBe('2026-01-01');
  });
});

describe('merge and cross-check', () => {
  it('DataHub provides codes, AWS provides precipitation', () => {
    const dh = [obs('2026-01-01T10:00:00Z', { weatherCode: 24, temperatureC: 0.4, precipMm: null, sources: ['datahub'] })];
    const aws = [obs('2026-01-01T10:00:00Z', { weatherCode: null, temperatureC: 0.6, precipMm: 1.2, sources: ['aws'] })];
    const m = mergeHourly(dh, aws);
    expect(m[0]).toMatchObject({ weatherCode: 24, temperatureC: 0.4, precipMm: 1.2, sources: ['datahub', 'aws'] });
    expect(crossCheck(dh, aws)).toMatchObject({ comparedHours: 1, ok: true });
    expect(crossCheck(dh, [{ ...aws[0], temperatureC: 4 }])!.ok).toBe(false);
  });

  it('day record links verdict to its triggering hours and raw data', () => {
    const dh = day('2026-01-15', (i) => (i === 8 ? { weatherCode: 23, temperatureC: 0.5 } : { temperatureC: 1 })).map((h) => ({ ...h, sources: ['datahub' as const] }));
    const raw = dh.map((h) => ({ datetime: h.time, weather_code: h.weatherCode, temperature: h.temperatureC }));
    const rec = buildDayRecord({
      date: '2026-01-15', datahubHourly: dh, datahubRaw: raw, awsHourly: [], awsMinutes: [], awsObjectKeys: [],
      station: emptyStation(), retrievedAt: '2026-01-16T00:30:00Z',
    });
    expect(rec.verdict).toBe('SNOW');
    expect(rec.rule.triggers[0]).toMatchObject({ localTime: '08:00', code: 23 });
    expect(rec.raw.datahub).toHaveLength(24);
    expect(rec.completeness).toEqual({ hoursExpected: 24, hoursReceived: 24, hoursWithCode: 24 });
    expect(rec.sources).toEqual(['datahub']);
  });
});

describe('feed status', () => {
  const now = new Date('2026-01-01T12:20:00Z');
  it('SIGNAL_LOST when nothing or stale', () => {
    expect(feedStatus(false, false, null, now).status).toBe('SIGNAL_LOST');
    expect(feedStatus(true, true, '2026-01-01T07:00:00Z', now).status).toBe('SIGNAL_LOST');
  });
  it('OK or PARTIAL otherwise', () => {
    expect(feedStatus(true, true, '2026-01-01T12:00:00Z', now).status).toBe('OK');
    expect(feedStatus(false, true, '2026-01-01T11:00:00Z', now).status).toBe('PARTIAL');
  });
});
