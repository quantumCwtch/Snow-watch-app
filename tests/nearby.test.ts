import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseWxGroups, metarWeather } from '../src/lib/presentWeather';
import { applySnowRule } from '../src/lib/snowRule';
import type { NearbyReport } from '../src/lib/types';
import { parseAwsCsv } from '../pipeline/parsers';
import { parseMetarJson } from '../pipeline/nearby';
import { day } from './helpers';

const FIX = join(__dirname, 'fixtures');

describe('present-weather groups', () => {
  it('reads the real values seen at Heathrow, Northolt and Kenley', () => {
    expect(parseWxGroups('NSW')).toMatchObject({ reported: true, snow: false, rain: false });
    expect(parseWxGroups('BR').fog).toBe(true);
    expect(parseWxGroups('-RA').rain).toBe(true);
    expect(parseWxGroups('RERA').rain).toBe(true);
    expect(parseWxGroups('-RADZ').rain).toBe(true);
    expect(parseWxGroups('UP').unknownPrecip).toBe(true);
    expect(parseWxGroups('+UP').unknownPrecip).toBe(true);
    expect(parseWxGroups('').reported).toBe(false);
    expect(parseWxGroups(null).reported).toBe(false);
  });

  it.each(['SN', '-SN', '+SN', 'SHSN', '-SHSN', 'TSSN', 'SG', 'RESN', 'RESHSN'])('%s is snow', (g) => {
    const f = parseWxGroups(g);
    expect(f.snow).toBe(true);
    expect(f.sleet).toBe(false);
  });

  it.each(['RASN', '-RASN', 'SNRA', 'SHRASN', 'DZSN', 'PL'])('%s is sleet, not snow', (g) => {
    const f = parseWxGroups(g);
    expect(f.sleet).toBe(true);
    expect(f.snow).toBe(false);
  });

  it('hail, blowing snow and vicinity showers', () => {
    expect(parseWxGroups('SHGS').hail).toBe(true);
    expect(parseWxGroups('GR').hail).toBe(true);
    expect(parseWxGroups('BLSN').snow).toBe(false);
    expect(parseWxGroups('DRSN').snow).toBe(false);
    expect(parseWxGroups('VCSH').snow).toBe(false);
  });

  it('extracts weather from raw METARs, ignoring trends and remarks', () => {
    expect(metarWeather('METAR EGLC 120650Z AUTO 30003KT 9999 NCD 05/03 Q1004')).toBe('NSW');
    expect(metarWeather('METAR EGLC 120650Z AUTO 30003KT 4000 -SN BKN010 00/M01 Q1004')).toBe('-SN');
    expect(metarWeather('METAR EGLC 120650Z 30003KT 9999 FEW020 05/03 Q1004 TEMPO 3000 SHSN')).toBe('NSW');
    expect(metarWeather('METAR EGLC 120650Z AUTO 30003KT 9999 // NCD 05/03 Q1004')).toBeNull();
    expect(metarWeather('METAR EGLC 120650Z 30003KT 9999 -RA FEW020 05/03 Q1004 RESN')).toBe('-RA RESN');
  });
});

describe('real nearby data fixtures', () => {
  it('London City METAR sample (aviationweather.gov, 2026-11-12) parses and is verified', () => {
    const body = JSON.parse(readFileSync(join(FIX, 'metar/eglc-48h.json'), 'utf8'));
    const reports = parseMetarJson(body, { id: 'london-city', name: 'London City Airport', icao: 'EGLC', latitude: 51.505, longitude: 0.055, maxCoordinateDifferenceDegrees: 0.02 });
    expect(reports.length).toBe(96);
    expect(reports.every((r) => r.stationId === 'london-city')).toBe(true);
    expect(reports.some((r) => r.wx === '-RA')).toBe(true);
    expect(reports.every((r) => !parseWxGroups(r.wx).snow)).toBe(true);
    expect(() => parseMetarJson([{ ...body[0], icaoId: 'EGLL' }], { id: 'x', name: 'x', icao: 'EGLC', latitude: 51.505, longitude: 0.055, maxCoordinateDifferenceDegrees: 0.02 })).toThrow();
  });

  it('Heathrow AWS files carry string present-weather codes', () => {
    const dir = join(FIX, 'aws/heathrow');
    const minutes = readdirSync(dir).flatMap((f) => parseAwsCsv(readFileSync(join(dir, f), 'utf8')));
    const codes = new Set(minutes.map((m) => m.presentWeather).filter(Boolean));
    expect(codes).toContain('UP');
    expect(codes).toContain('RERA');
    expect(minutes[0].name).toBe('Heathrow Automatic Weather Station');
  });
});

describe('snow rule with nearby confirmation', () => {
  const D = '2026-01-15'; // GMT
  const near = (time: string, wx: string | null, stationName = 'Heathrow'): NearbyReport => ({ stationId: stationName.toLowerCase(), stationName, time, wx });
  /** Nearby reports every 30 minutes all day with the given default wx. */
  const fullCover = (wxAt: (iso: string) => string | null = () => 'NSW') => {
    const out: NearbyReport[] = [];
    for (let t = Date.parse(`${D}T00:00:00Z`); t < Date.parse(`${D}T00:00:00Z`) + 86400000; t += 1800000) {
      const iso = new Date(t).toISOString();
      out.push(near(iso, wxAt(iso), 'London City Airport'));
    }
    return out;
  };
  // St James's Park: no codes (as in reality), cold day.
  const coldNoCodes = (over: (i: number) => object = () => ({})) => day(D, (i) => ({ weatherCode: null, temperatureC: 3, precipMm: 0, ...over(i) }));

  it('nearby snow + cold precipitation at St James\'s Park = SNOW (confirmed nearby)', () => {
    const hourly = coldNoCodes((i) => (i === 8 ? { temperatureC: 0.8, precipMm: 0.4 } : {}));
    const r = applySnowRule({ date: D, hourly, nearby: [...fullCover(), near(`${D}T08:20:00Z`, '-SN')] });
    expect(r.verdict).toBe('SNOW');
    expect(r.confirmedBy).toBe('nearby');
    expect(r.triggers[0]).toMatchObject({ station: 'Heathrow', wx: '-SN', localTime: '08:00' });
  });

  it('confirmation window: snow reported within an hour either side still counts', () => {
    const hourly = coldNoCodes((i) => (i === 8 ? { temperatureC: 1.5, precipMm: 0.2 } : {}));
    expect(applySnowRule({ date: D, hourly, nearby: [...fullCover(), near(`${D}T09:50:00Z`, 'SHSN')] }).verdict).toBe('SNOW');
    expect(applySnowRule({ date: D, hourly, nearby: [...fullCover(), near(`${D}T10:10:00Z`, 'SHSN')] }).verdict).not.toBe('SNOW');
  });

  it('nearby snow but St James\'s Park dry: never SNOW', () => {
    const r = applySnowRule({ date: D, hourly: coldNoCodes(), nearby: [...fullCover(), near(`${D}T08:20:00Z`, 'SN')] });
    expect(r.verdict).toBe('UNCONFIRMED');
    expect(r.nearbySnowHours.length).toBeGreaterThan(0);
    expect(r.reasons.join(' ')).toMatch(/not confirmed at St James's Park/);
  });

  it('nearby snow but St James\'s Park too warm (rain in town): not SNOW', () => {
    const hourly = day(D, (i) => ({ weatherCode: null, temperatureC: 7.5, precipMm: i === 8 ? 1 : 0 }));
    const r = applySnowRule({ date: D, hourly, nearby: [...fullCover(), near(`${D}T08:20:00Z`, 'SN')] });
    expect(r.verdict).toBe('NO_SNOW');
    expect(r.nearbySnowHours.length).toBeGreaterThan(0);
  });

  it('full nearby coverage with no snow resolves missing codes: NO_SNOW instead of UNCONFIRMED', () => {
    expect(applySnowRule({ date: D, hourly: coldNoCodes() }).verdict).toBe('UNCONFIRMED');
    const r = applySnowRule({ date: D, hourly: coldNoCodes(), nearby: fullCover() });
    expect(r.verdict).toBe('NO_SNOW');
    expect(r.nearbyCoverageHours).toBe(24);
  });

  it('gaps in nearby coverage leave those hours unconfirmed', () => {
    const cover = fullCover().filter((r) => !r.time.startsWith(`${D}T05`));
    const r = applySnowRule({ date: D, hourly: coldNoCodes(), nearby: cover });
    expect(r.verdict).toBe('UNCONFIRMED');
    expect(r.relevantMissingCodeHours).toEqual([`${D}T05:00:00Z`]);
  });

  it('unidentified precipitation (UP) nearby blocks a verdict only if St James\'s Park was wet or near freezing', () => {
    const upAtNoon = fullCover((iso) => (iso.includes('T12:') ? 'UP' : 'NSW'));
    // dry and 3 °C in town: a UP blip (e.g. in fog) does not matter
    expect(applySnowRule({ date: D, hourly: coldNoCodes(), nearby: upAtNoon }).verdict).toBe('NO_SNOW');
    // wet in town: UP could have been snow
    const wet = coldNoCodes((i) => (i === 12 ? { precipMm: 0.4 } : {}));
    expect(applySnowRule({ date: D, hourly: wet, nearby: upAtNoon }).verdict).toBe('UNCONFIRMED');
    // dry but 1 °C in town: still cannot be ruled out
    const freezing = coldNoCodes((i) => (i === 12 ? { temperatureC: 1 } : {}));
    expect(applySnowRule({ date: D, hourly: freezing, nearby: upAtNoon }).verdict).toBe('UNCONFIRMED');
  });

  it('cold precipitation with only rain nearby stays POSSIBLE SNOW', () => {
    const hourly = coldNoCodes((i) => (i === 8 ? { temperatureC: 1.0, precipMm: 0.6 } : {}));
    const r = applySnowRule({ date: D, hourly, nearby: fullCover((iso) => (iso.includes('T08:') ? '-RA' : 'NSW')) });
    expect(r.verdict).toBe('UNCONFIRMED');
    expect(r.possibleSnow).toBe(true);
  });

  it('nearby sleet with wet, cold St James\'s Park = SLEET near-miss', () => {
    const hourly = coldNoCodes((i) => (i === 8 ? { temperatureC: 1.8, precipMm: 0.4 } : {}));
    const r = applySnowRule({ date: D, hourly, nearby: fullCover((iso) => (iso.includes('T08:') ? '-RASN' : 'NSW')) });
    expect(r.verdict).toBe('SLEET');
    expect(r.confirmedBy).toBe('nearby');
  });

  it('nearby hail with precipitation at St James\'s Park flags hail', () => {
    const hourly = day(D, (i) => ({ weatherCode: null, temperatureC: 8, precipMm: i === 14 ? 0.8 : 0 }));
    const r = applySnowRule({ date: D, hourly, nearby: fullCover((iso) => (iso.includes('T14:') ? 'SHGS' : 'NSW')) });
    expect(r.verdict).toBe('NO_SNOW');
    expect(r.hailSeen).toBe(true);
  });

  it('St James\'s Park\'s own snow code still wins', () => {
    const hourly = day(D, (i) => (i === 3 ? { weatherCode: 24, temperatureC: 0 } : {}));
    expect(applySnowRule({ date: D, hourly, nearby: fullCover() })).toMatchObject({ verdict: 'SNOW', confirmedBy: 'st-jamess-park' });
  });
});
