import { describe, it, expect } from 'vitest';
import { applySnowRule, completenessOf } from '../src/lib/snowRule';
import { day, obs } from './helpers';

describe('snow rule', () => {
  it('returns NO_SNOW for a dull, fully coded day', () => {
    const r = applySnowRule({ date: '2026-11-10', hourly: day('2026-11-10') });
    expect(r.verdict).toBe('NO_SNOW');
    expect(r.triggers).toHaveLength(0);
  });

  it.each([22, 23, 24, 25, 26, 27])('code %i in any hour gives SNOW', (code) => {
    const r = applySnowRule({
      date: '2026-01-15',
      hourly: day('2026-01-15', (i) => (i === 9 ? { weatherCode: code, temperatureC: 0.5 } : { temperatureC: 1 })),
    });
    expect(r.verdict).toBe('SNOW');
    expect(r.triggers).toEqual([expect.objectContaining({ code, localTime: '09:00' })]);
  });

  it('sleet-only day gives SLEET', () => {
    const r = applySnowRule({
      date: '2026-01-15',
      hourly: day('2026-01-15', (i) => (i >= 6 && i <= 8 ? { weatherCode: 17 } : {})),
    });
    expect(r.verdict).toBe('SLEET');
    expect(r.triggers.map((t) => t.code)).toEqual([17, 17, 17]);
  });

  it('hail is not snow: NO_SNOW with hailSeen', () => {
    const r = applySnowRule({
      date: '2026-04-02',
      hourly: day('2026-04-02', (i) => (i === 14 ? { weatherCode: 20 } : {})),
    });
    expect(r.verdict).toBe('NO_SNOW');
    expect(r.hailSeen).toBe(true);
  });

  it('sleet together with hail is not "sleet only"', () => {
    const r = applySnowRule({
      date: '2026-04-02',
      hourly: day('2026-04-02', (i) => (i === 10 ? { weatherCode: 18 } : i === 11 ? { weatherCode: 21 } : {})),
    });
    expect(r.verdict).toBe('NO_SNOW');
    expect(r.sleetSeen && r.hailSeen).toBe(true);
  });

  it('snow beats sleet and hail', () => {
    const r = applySnowRule({
      date: '2026-01-15',
      hourly: day('2026-01-15', (i) => ({ weatherCode: [18, 21, 24][i % 3] ?? 7, temperatureC: 0 })),
    });
    expect(r.verdict).toBe('SNOW');
  });

  describe('snow late in the evening (UK local time)', () => {
    it('GMT: snow at 23:00 local is counted for that day', () => {
      // 2026-01-15 is GMT; 23:00 local = 23:00Z
      const hourly = day('2026-01-15', (i) => (i === 23 ? { weatherCode: 24, temperatureC: 0 } : {}));
      expect(applySnowRule({ date: '2026-01-15', hourly }).verdict).toBe('SNOW');
      expect(applySnowRule({ date: '2026-01-16', hourly: [...hourly, ...day('2026-01-16')] }).verdict).toBe('NO_SNOW');
    });

    it('BST: snow at 23:30 local is first seen in the 23:00Z obs (next local midnight) and counts for both days', () => {
      // 2026-06-10 is BST. Snow from 23:30 to 00:10 local is first visible in the
      // obs stamped 23:00Z, which is 00:00 local on the 11th: the midnight boundary.
      const d10 = day('2026-06-10');
      const d11 = day('2026-06-11', (i) => (i === 0 ? { weatherCode: 22, temperatureC: 1 } : {}));
      expect(d11[0].time).toBe('2026-06-10T23:00:00Z');
      const r10 = applySnowRule({ date: '2026-06-10', hourly: [...d10, ...d11] });
      expect(r10.verdict).toBe('SNOW');
      expect(r10.triggers[0]).toMatchObject({ localTime: '24:00', code: 22 });
      // It also counts for the 11th, because it was snowing at 00:00 on the 11th.
      expect(applySnowRule({ date: '2026-06-11', hourly: d11 }).verdict).toBe('SNOW');
    });

    it('BST: an obs at 23:00 local is 22:00Z and belongs to the same UK day', () => {
      const d = day('2026-06-10', (i) => (i === 23 ? { weatherCode: 25, temperatureC: 0 } : {}));
      expect(d[23].time).toBe('2026-06-10T22:00:00Z');
      expect(applySnowRule({ date: '2026-06-10', hourly: d }).verdict).toBe('SNOW');
    });
  });

  describe('clock-change days', () => {
    it('spring forward day has 23 expected hours', () => {
      const hourly = day('2026-03-29');
      expect(hourly).toHaveLength(23);
      expect(completenessOf('2026-03-29', hourly)).toEqual({ hoursExpected: 23, hoursReceived: 23, hoursWithCode: 23 });
      expect(applySnowRule({ date: '2026-03-29', hourly }).verdict).toBe('NO_SNOW');
    });

    it('autumn back day has 25 expected hours and snow in the repeated hour counts', () => {
      const hourly = day('2026-10-25', (i) => (i === 2 ? { weatherCode: 23, temperatureC: 1 } : {}));
      expect(hourly).toHaveLength(25);
      // index 1 = 00:00Z (01:00 BST), index 2 = 01:00Z (01:00 GMT, the repeated hour)
      expect(hourly[2].time).toBe('2026-10-25T01:00:00Z');
      const r = applySnowRule({ date: '2026-10-25', hourly });
      expect(r.verdict).toBe('SNOW');
      expect(r.triggers[0].localTime).toBe('01:00');
    });
  });

  describe('missing codes', () => {
    it('codes missing entirely on a cold day: UNCONFIRMED, never SNOW', () => {
      const r = applySnowRule({
        date: '2026-01-15',
        hourly: day('2026-01-15', () => ({ weatherCode: null, temperatureC: 1.5, precipMm: 0 })),
      });
      expect(r.verdict).toBe('UNCONFIRMED');
      expect(r.possibleSnow).toBe(false);
    });

    it('codes missing with cold precipitation: UNCONFIRMED with possibleSnow', () => {
      const r = applySnowRule({
        date: '2026-01-15',
        hourly: day('2026-01-15', (i) => ({ weatherCode: null, temperatureC: 1.0, precipMm: i === 5 ? 0.8 : 0 })),
      });
      expect(r.verdict).toBe('UNCONFIRMED');
      expect(r.possibleSnow).toBe(true);
      expect(r.possibleSnowHours).toEqual(['2026-01-15T05:00:00Z']);
    });

    it('precipitation above 2 °C does not raise possibleSnow', () => {
      const r = applySnowRule({
        date: '2026-01-15',
        hourly: day('2026-01-15', () => ({ weatherCode: null, temperatureC: 3.5, minTemperatureC: 2.6, precipMm: 1 })),
      });
      expect(r.verdict).toBe('UNCONFIRMED');
      expect(r.possibleSnow).toBe(false);
    });

    it('codes missing on a warm day: missing hours are not snow-relevant, NO_SNOW', () => {
      const r = applySnowRule({
        date: '2026-07-01',
        hourly: day('2026-07-01', () => ({ weatherCode: null, temperatureC: 19 })),
      });
      expect(r.verdict).toBe('NO_SNOW');
    });

    it('a missing hour (no observation at all) cannot be ruled out', () => {
      const hourly = day('2026-07-01').filter((_, i) => i !== 4);
      const r = applySnowRule({ date: '2026-07-01', hourly });
      expect(r.verdict).toBe('UNCONFIRMED');
      expect(r.relevantMissingCodeHours).toEqual(['2026-07-01T03:00:00Z']);
    });

    it('a snow code still wins even if other hours are missing', () => {
      const hourly = day('2026-01-15', (i) => (i === 3 ? { weatherCode: 26, temperatureC: 0 } : { weatherCode: null, temperatureC: 0 }));
      expect(applySnowRule({ date: '2026-01-15', hourly }).verdict).toBe('SNOW');
    });

    it('sleet seen but snow-relevant hours missing: UNCONFIRMED, not SLEET', () => {
      const hourly = day('2026-01-15', (i) => (i === 3 ? { weatherCode: 18, temperatureC: 1 } : i === 4 ? { weatherCode: null, temperatureC: 1 } : {}));
      expect(applySnowRule({ date: '2026-01-15', hourly }).verdict).toBe('UNCONFIRMED');
    });

    it('unexpected code (outside documented table) never gives snow', () => {
      const hourly = day('2026-01-15', (i) => (i === 3 ? { weatherCode: 71, temperatureC: 0 } : {}));
      const r = applySnowRule({ date: '2026-01-15', hourly });
      expect(r.verdict).toBe('UNCONFIRMED');
      expect(r.unexpectedCodes).toEqual([71]);
    });

    it('no observations at all: NO_DATA', () => {
      expect(applySnowRule({ date: '2026-01-15', hourly: [] }).verdict).toBe('NO_DATA');
    });

    it('a mostly empty warm day is UNCONFIRMED (too incomplete to trust)', () => {
      const hourly = [obs('2026-07-01T10:00:00Z', { temperatureC: 20 })];
      expect(applySnowRule({ date: '2026-07-01', hourly }).verdict).toBe('UNCONFIRMED');
    });
  });

  describe('today so far', () => {
    it('only expects hours up to now', () => {
      const hourly = day('2026-11-11').slice(0, 10);
      const upTo = new Date('2026-11-11T09:30:00Z');
      expect(completenessOf('2026-11-11', hourly, upTo)).toMatchObject({ hoursExpected: 10, hoursReceived: 10 });
      expect(applySnowRule({ date: '2026-11-11', hourly, upTo }).verdict).toBe('NO_SNOW');
    });

    it('hours not yet published (after the latest received obs) are pending, not missing', () => {
      const hourly = day('2026-11-11').slice(0, 8);
      const upTo = new Date('2026-11-11T09:30:00Z');
      expect(applySnowRule({ date: '2026-11-11', hourly, upTo }).verdict).toBe('NO_SNOW');
      // ...but a gap in the middle is still missing
      const gappy = hourly.filter((_, i) => i !== 3);
      expect(applySnowRule({ date: '2026-11-11', hourly: gappy, upTo }).verdict).toBe('UNCONFIRMED');
    });
  });
});
