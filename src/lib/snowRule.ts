// The snow rule. Pure function: observations in, verdict out. No I/O, no clocks.
//
// Primary evidence: Met Office weather type codes for London, St James's Park, from the
// Weather DataHub "Definition of Codes" table (https://datahub.metoffice.gov.uk/definition-of-codes,
// checked 2026-11-11): 16-18 sleet, 19-21 hail, 22-27 snow. Codes outside -1..30 are
// treated as unexpected and can never produce SNOW on their own.
//
// Confirmation from nearby stations: St James's Park has no present-weather sensor (its
// AWS files carry no present-weather values, checked 2026-11-11), so codes are usually
// missing. Snow reported by a nearby official present-weather sensor (London City Airport,
// Northolt, Heathrow; see config.confirmation) counts ONLY when St James's Park itself
// recorded precipitation with its temperature at or below `snowConfirmMaxTempC` within
// `windowHours` of that report. Nearby snow alone never gives SNOW.
//
// Verdicts, in order of precedence:
//   NO_DATA      no St James's Park observations at all for the period
//   SNOW         a snow code at St James's Park in any hour of the UK day (or at the following
//                local midnight), or nearby snow confirmed by cold precipitation at St James's Park
//   UNCONFIRMED  snow cannot be ruled out: hours with no code where snow was plausible
//                (temperature <= missingCodeRelevantMaxTempC or unknown) and which nearby
//                sensors cannot resolve, or the day is too incomplete. `possibleSnow` is set when
//                precipitation fell at or below possibleSnowMaxTempC and nothing explains it.
//   SLEET        the only wintry weather was sleet (St James's Park code, or nearby sleet
//                with precipitation at St James's Park at or below sleetConfirmMaxTempC)
//   NO_SNOW      otherwise (hail is flagged separately via `hailSeen`)
//
// An hour with a missing code is RESOLVED by nearby sensors when at least one of them
// reported present weather during that hour, none reported snow or unidentified
// precipitation within the window (UP counts only if St James's Park was wet or at or below
// possibleSnowMaxTempC), and any cold precipitation at St James's Park is explained by
// nearby sleet or hail.

import type { HourlyObs, SnowRuleResult, SnowTrigger, Completeness, NearbyReport } from './types';
import { config as defaultConfig, codeLabel, type Config } from './config';
import { ukTimeOf, utcHoursOfUkDay, ukDayBoundsUtc } from './ukTime';
import { parseWxGroups, mergeWx, NO_WX, type WxFlags } from './presentWeather';

export interface SnowRuleInput {
  /** UK calendar date being judged. */
  date: string;
  /** Hourly St James's Park observations (keyed by the hour they start). */
  hourly: HourlyObs[];
  /** Present-weather reports from nearby confirmation stations. */
  nearby?: NearbyReport[];
  /** For "today so far", only hours up to this instant are expected. */
  upTo?: Date;
}

const HOUR = 3600000;

export function expectedHours(date: string, upTo?: Date): string[] {
  const all = utcHoursOfUkDay(date);
  if (!upTo) return all;
  return all.filter((h) => new Date(h).getTime() <= upTo.getTime());
}

export function completenessOf(date: string, hourly: HourlyObs[], upTo?: Date): Completeness {
  const expected = new Set(expectedHours(date, upTo));
  const inDay = hourly.filter((h) => expected.has(h.time));
  return {
    hoursExpected: expected.size,
    hoursReceived: inDay.length,
    hoursWithCode: inDay.filter((h) => h.weatherCode !== null).length,
  };
}

interface ParsedReport extends NearbyReport {
  t: number;
  flags: WxFlags;
}

/** Combined nearby weather in [from, to), plus the stations/wx that showed snow. */
function nearbyIn(reports: ParsedReport[], from: number, to: number) {
  let flags: WxFlags = { ...NO_WX };
  const snowy: ParsedReport[] = [];
  const sleety: ParsedReport[] = [];
  const haily: ParsedReport[] = [];
  for (const r of reports) {
    if (r.t < from || r.t >= to) continue;
    flags = mergeWx(flags, r.flags);
    if (r.flags.snow) snowy.push(r);
    if (r.flags.sleet) sleety.push(r);
    if (r.flags.hail) haily.push(r);
  }
  return { flags, snowy, sleety, haily };
}

export function applySnowRule(input: SnowRuleInput, cfg: Config = defaultConfig): SnowRuleResult {
  const wc = cfg.weatherCodes;
  const rule = cfg.snowRule;
  const conf = cfg.confirmation;
  const win = conf.windowHours * HOUR;
  const byTime = new Map(input.hourly.map((h) => [h.time, h]));
  const reports: ParsedReport[] = (input.nearby ?? [])
    .map((r) => ({ ...r, t: Date.parse(r.time), flags: parseWxGroups(r.wx) }))
    .filter((r) => !Number.isNaN(r.t));

  let expected = expectedHours(input.date, input.upTo);
  if (input.upTo) {
    // Today so far: hours after the latest received observation are still pending
    // publication, not missing. (Stale feeds are caught separately as SIGNAL LOST.)
    const received = expected.filter((h) => byTime.has(h));
    const last = received.at(-1);
    expected = last ? expected.filter((h) => h <= last) : expected;
  }

  const snowSet = new Set(wc.snow);
  const sleetSet = new Set(wc.sleet);
  const hailSet = new Set(wc.hail);

  const snowTriggers: SnowTrigger[] = [];
  const sleetTriggers: SnowTrigger[] = [];
  const hailTriggers: SnowTrigger[] = [];
  const relevantMissing: string[] = [];
  const possibleSnowHours: string[] = [];
  const nearbySnowHours: string[] = [];
  const unexpectedCodes: number[] = [];
  const reasons: string[] = [];
  let received = 0;
  let coverage = 0;
  let nearbyConfirmedSleet = false;

  const codeTrig = (hour: string, code: number): SnowTrigger => ({
    time: hour,
    localTime: ukTimeOf(new Date(hour)),
    code,
    label: codeLabel(code, cfg),
  });
  const nearTrig = (hour: string, r: ParsedReport, label: string): SnowTrigger => ({
    time: hour,
    localTime: ukTimeOf(new Date(hour)),
    code: -999,
    label: `${label} at ${r.stationName} (${r.wx}, ${ukTimeOf(new Date(r.t))})`,
    station: r.stationName,
    wx: r.wx ?? undefined,
  });

  for (const hour of expected) {
    const h0 = Date.parse(hour);
    const inHour = nearbyIn(reports, h0, h0 + HOUR);
    const around = nearbyIn(reports, h0 - win, h0 + HOUR + win);
    const covered = inHour.flags.reported;
    if (covered) coverage++;
    if (around.flags.snow && !nearbySnowHours.includes(hour)) nearbySnowHours.push(hour);

    const obs = byTime.get(hour);
    if (!obs) {
      // Whole hour missing at St James's Park. Nearby sensors can rule out snow only if
      // they were reporting and saw no precipitation of any kind.
      const f = around.flags;
      const dry = covered && !f.snow && !f.sleet && !f.hail && !f.rain && !f.unknownPrecip;
      if (!dry) relevantMissing.push(hour);
      continue;
    }
    received++;

    const coldest = minDefined(obs.minTemperatureC ?? null, obs.temperatureC);
    const wet = obs.precipMm !== null && obs.precipMm > 0;
    const coldWet =
      obs.precipMm !== null && obs.precipMm >= rule.possibleSnowMinPrecipMm && coldest !== null && coldest <= rule.possibleSnowMaxTempC;

    // 1. St James's Park's own weather code.
    if (obs.weatherCode !== null && (obs.weatherCode > wc.maxKnownCode || obs.weatherCode < -1)) {
      unexpectedCodes.push(obs.weatherCode);
    } else if (obs.weatherCode !== null) {
      if (snowSet.has(obs.weatherCode)) snowTriggers.push(codeTrig(hour, obs.weatherCode));
      else if (sleetSet.has(obs.weatherCode)) sleetTriggers.push(codeTrig(hour, obs.weatherCode));
      else if (hailSet.has(obs.weatherCode)) hailTriggers.push(codeTrig(hour, obs.weatherCode));
    }

    // 2. Nearby confirmation, only with precipitation measured at St James's Park.
    if (wet && coldest !== null) {
      if (around.snowy.length && coldest <= conf.snowConfirmMaxTempC) {
        snowTriggers.push(nearTrig(hour, around.snowy[0], 'Snow'));
      } else if (around.sleety.length && coldest <= conf.sleetConfirmMaxTempC) {
        sleetTriggers.push(nearTrig(hour, around.sleety[0], 'Sleet'));
        nearbyConfirmedSleet = true;
      }
      if (around.haily.length) hailTriggers.push(nearTrig(hour, around.haily[0], 'Hail'));
    }

    // 3. Can snow be ruled out for this hour?
    const hasValidCode = obs.weatherCode !== null && obs.weatherCode >= -1 && obs.weatherCode <= wc.maxKnownCode;
    const t = obs.temperatureC;
    const plausible = t === null || t <= rule.missingCodeRelevantMaxTempC || (coldest !== null && coldest <= rule.missingCodeRelevantMaxTempC);
    if (!hasValidCode && plausible) {
      const f = around.flags;
      const explained = !coldWet || f.sleet || f.hail;
      // Unidentified precipitation (UP) nearby matters only if St James's Park was wet or
      // near freezing: automatic sensors also report brief UP blips in fog (seen at Northolt).
      const upMatters = f.unknownPrecip && (wet || (coldest !== null && coldest <= rule.possibleSnowMaxTempC));
      const resolved = covered && !f.snow && !upMatters && explained;
      if (!resolved) relevantMissing.push(hour);
    }
    if (coldWet && !hasValidCode && !(around.flags.sleet || around.flags.hail || around.flags.snow)) {
      possibleSnowHours.push(hour);
    }
  }

  // Midnight boundary: hourly codes describe the weather AT the observation time, so
  // snow reported at exactly the following local midnight (00:00) was falling at the
  // end of this day too (finalised days only).
  if (!input.upTo) {
    const boundary = ukDayBoundsUtc(input.date).end.toISOString().replace('.000Z', 'Z');
    const b = byTime.get(boundary);
    if (b && b.weatherCode !== null && snowSet.has(b.weatherCode)) {
      snowTriggers.push({ time: boundary, localTime: '24:00', code: b.weatherCode, label: codeLabel(b.weatherCode, cfg) });
    }
  }

  const base = {
    hailSeen: hailTriggers.length > 0,
    sleetSeen: sleetTriggers.length > 0,
    possibleSnowHours,
    relevantMissingCodeHours: relevantMissing,
    unexpectedCodes,
    nearbySnowHours,
    nearbyCoverageHours: coverage,
  };
  const nearbyNote = () => {
    if (!nearbySnowHours.length) return;
    const names = [...new Set(reports.filter((r) => r.flags.snow).map((r) => r.stationName))].join(', ');
    reasons.push(`Snow was reported nearby (${names}) but not confirmed at St James's Park.`);
  };

  if (received === 0) {
    reasons.push('No observations were received from St James\'s Park for this period.');
    nearbyNote();
    return { ...base, verdict: 'NO_DATA', triggers: [], possibleSnow: false, confirmedBy: null, reasons };
  }

  if (snowTriggers.length > 0) {
    const own = snowTriggers.filter((x) => !x.station);
    const near = snowTriggers.filter((x) => x.station);
    if (own.length) {
      reasons.push(
        `Snow weather code reported at St James's Park in ${own.length} hour(s): ` +
          own.map((x) => `${x.localTime} code ${x.code} (${x.label})`).join(', ') + '.',
      );
    }
    if (near.length) {
      reasons.push(
        `Snow reported nearby while St James's Park recorded precipitation at or below ${conf.snowConfirmMaxTempC} °C in ${near.length} hour(s): ` +
          near.map((x) => `${x.localTime} ${x.label}`).join('; ') + '.',
      );
    }
    return {
      ...base,
      verdict: 'SNOW',
      triggers: snowTriggers,
      possibleSnow: false,
      confirmedBy: own.length ? 'st-jamess-park' : 'nearby',
      reasons,
    };
  }

  const completeness = received / Math.max(expected.length, 1);
  const tooIncomplete = completeness < rule.minCompletenessForVerdict;

  if (relevantMissing.length > 0 || tooIncomplete || unexpectedCodes.length > 0) {
    if (relevantMissing.length > 0) {
      reasons.push(
        `Snow could not be ruled out for ${relevantMissing.length} hour(s): no weather code at St James's Park and no nearby sensor report that settles it.`,
      );
    }
    if (tooIncomplete) reasons.push(`Only ${received} of ${expected.length} hours received.`);
    if (unexpectedCodes.length) reasons.push(`Unexpected weather code(s) ${[...new Set(unexpectedCodes)].join(', ')}.`);
    const possibleSnow = possibleSnowHours.length > 0;
    if (possibleSnow) {
      reasons.push(`Precipitation recorded at or below ${rule.possibleSnowMaxTempC} °C in ${possibleSnowHours.length} hour(s).`);
    }
    nearbyNote();
    return {
      ...base,
      verdict: 'UNCONFIRMED',
      triggers: [...sleetTriggers, ...hailTriggers],
      possibleSnow,
      confirmedBy: null,
      reasons,
    };
  }

  if (sleetTriggers.length > 0 && hailTriggers.length === 0) {
    reasons.push(`Only sleet seen (${sleetTriggers.length} hour(s)). So close.`);
    const own = sleetTriggers.some((x) => !x.station);
    nearbyNote();
    return {
      ...base,
      verdict: 'SLEET',
      triggers: sleetTriggers,
      possibleSnow: false,
      confirmedBy: own ? 'st-jamess-park' : nearbyConfirmedSleet ? 'nearby' : null,
      reasons,
    };
  }

  if (hailTriggers.length > 0) reasons.push(`Hail reported in ${hailTriggers.length} hour(s). Hail is not snow.`);
  if (sleetTriggers.length > 0) reasons.push('Sleet seen alongside hail.');
  if (coverage > 0 && input.hourly.every((h) => h.weatherCode === null)) {
    reasons.push(`No snow: nearby present-weather sensors covered ${coverage} hour(s) and ruled out snow wherever it was cold enough.`);
  } else {
    reasons.push('No snow codes in any reported hour.');
  }
  nearbyNote();
  return {
    ...base,
    verdict: 'NO_SNOW',
    triggers: [...sleetTriggers, ...hailTriggers],
    possibleSnow: false,
    confirmedBy: null,
    reasons,
  };
}

function minDefined(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}
