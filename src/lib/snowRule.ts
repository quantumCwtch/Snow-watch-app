// The snow rule. Pure function: observations in, verdict out. No I/O, no clocks.
//
// Weather type codes follow the Met Office Weather DataHub "Definition of Codes"
// table (https://datahub.metoffice.gov.uk/definition-of-codes, checked 2026-11-11):
//   16-18 sleet (shower night / shower day / sleet)
//   19-21 hail
//   22-27 snow (light snow shower night/day, light snow, heavy snow shower night/day, heavy snow)
// The Land Observations API spec describes `weather_code` as the "numerical code for the
// weather symbol"; the official sample response uses values 7 and 8 (cloudy/overcast),
// consistent with this table. Codes above `maxKnownCode` are treated as unexpected and
// can never produce a SNOW verdict on their own.
//
// Verdicts, in order of precedence:
//   NO_DATA      no observations at all for the day
//   SNOW         any hour in the UK calendar day has a snow code
//   UNCONFIRMED  no snow code, but codes are missing for hours where snow was plausible
//                (temperature unknown or at/below `missingCodeRelevantMaxTempC`), or the
//                day is too incomplete to trust. `possibleSnow` is set when precipitation
//                was recorded with the temperature at/below `possibleSnowMaxTempC`.
//   SLEET        the only wintry codes seen were sleet codes
//   NO_SNOW      otherwise (hail is flagged separately via `hailSeen`)

import type { HourlyObs, SnowRuleResult, SnowTrigger, Completeness } from './types';
import { config as defaultConfig, codeLabel, type Config } from './config';
import { ukTimeOf, utcHoursOfUkDay, ukDayBoundsUtc } from './ukTime';

export interface SnowRuleInput {
  /** UK calendar date being judged. */
  date: string;
  /** Hourly observations. Hours outside the UK day are ignored. */
  hourly: HourlyObs[];
  /**
   * For "today so far", only hours up to this instant are expected.
   * Omit for a full finalised day.
   */
  upTo?: Date;
}

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

export function applySnowRule(input: SnowRuleInput, cfg: Config = defaultConfig): SnowRuleResult {
  const wc = cfg.weatherCodes;
  const rule = cfg.snowRule;
  const byTime = new Map(input.hourly.map((h) => [h.time, h]));
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
  const unexpectedCodes: number[] = [];
  const reasons: string[] = [];
  let received = 0;

  for (const hour of expected) {
    const obs = byTime.get(hour);
    if (!obs) {
      // Whole hour missing: temperature unknown, so snow cannot be ruled out.
      relevantMissing.push(hour);
      continue;
    }
    received++;
    const trig = (code: number): SnowTrigger => ({
      time: hour,
      localTime: ukTimeOf(new Date(hour)),
      code,
      label: codeLabel(code, cfg),
    });

    if (obs.weatherCode === null) {
      const t = obs.temperatureC;
      if (t === null || t <= rule.missingCodeRelevantMaxTempC) relevantMissing.push(hour);
    } else if (obs.weatherCode > wc.maxKnownCode || obs.weatherCode < -1) {
      unexpectedCodes.push(obs.weatherCode);
      relevantMissing.push(hour);
    } else if (snowSet.has(obs.weatherCode)) {
      snowTriggers.push(trig(obs.weatherCode));
    } else if (sleetSet.has(obs.weatherCode)) {
      sleetTriggers.push(trig(obs.weatherCode));
    } else if (hailSet.has(obs.weatherCode)) {
      hailTriggers.push(trig(obs.weatherCode));
    }

    // Possible-snow evidence (used only to flavour an UNCONFIRMED verdict).
    const coldest = minDefined(obs.minTemperatureC ?? null, obs.temperatureC);
    if (
      obs.precipMm !== null &&
      obs.precipMm >= rule.possibleSnowMinPrecipMm &&
      coldest !== null &&
      coldest <= rule.possibleSnowMaxTempC
    ) {
      possibleSnowHours.push(hour);
    }
  }

  // Midnight boundary: hourly codes describe the weather AT the observation time, so
  // snow reported at exactly the following local midnight (00:00) was falling at the
  // end of this day too. Count it for this day as well (finalised days only).
  if (!input.upTo) {
    const boundary = ukDayBoundsUtc(input.date).end.toISOString().replace('.000Z', 'Z');
    const b = byTime.get(boundary);
    if (b && b.weatherCode !== null && snowSet.has(b.weatherCode)) {
      snowTriggers.push({
        time: boundary,
        localTime: '24:00',
        code: b.weatherCode,
        label: codeLabel(b.weatherCode, cfg),
      });
    }
  }

  const base = {
    hailSeen: hailTriggers.length > 0,
    sleetSeen: sleetTriggers.length > 0,
    possibleSnowHours,
    relevantMissingCodeHours: relevantMissing,
    unexpectedCodes,
  };

  if (received === 0) {
    reasons.push('No observations were received for this period.');
    return { ...base, verdict: 'NO_DATA', triggers: [], possibleSnow: false, reasons };
  }

  if (snowTriggers.length > 0) {
    reasons.push(
      `Snow weather code reported in ${snowTriggers.length} hour(s): ` +
        snowTriggers.map((t) => `${t.localTime} code ${t.code} (${t.label})`).join(', ') + '.',
    );
    return { ...base, verdict: 'SNOW', triggers: snowTriggers, possibleSnow: false, reasons };
  }

  const completeness = received / Math.max(expected.length, 1);
  const tooIncomplete = completeness < rule.minCompletenessForVerdict;

  if (relevantMissing.length > 0 || tooIncomplete) {
    if (relevantMissing.length > 0) {
      reasons.push(
        `Weather code missing for ${relevantMissing.length} hour(s) where snow could not be ruled out.`,
      );
    }
    if (tooIncomplete) {
      reasons.push(`Only ${received} of ${expected.length} hours received.`);
    }
    if (unexpectedCodes.length) {
      reasons.push(`Unexpected weather code(s) ${[...new Set(unexpectedCodes)].join(', ')}.`);
    }
    const possibleSnow = possibleSnowHours.length > 0;
    if (possibleSnow) {
      reasons.push(
        `Precipitation recorded at or below ${rule.possibleSnowMaxTempC} °C in ${possibleSnowHours.length} hour(s).`,
      );
    }
    return {
      ...base,
      verdict: 'UNCONFIRMED',
      triggers: [...sleetTriggers, ...hailTriggers],
      possibleSnow,
      reasons,
    };
  }

  if (sleetTriggers.length > 0 && hailTriggers.length === 0) {
    reasons.push(`Only sleet codes seen (${sleetTriggers.length} hour(s)). So close.`);
    return { ...base, verdict: 'SLEET', triggers: sleetTriggers, possibleSnow: false, reasons };
  }

  if (hailTriggers.length > 0) reasons.push(`Hail reported in ${hailTriggers.length} hour(s). Hail is not snow.`);
  if (sleetTriggers.length > 0) reasons.push('Sleet seen alongside hail.');
  reasons.push('No snow codes in any reported hour.');
  return {
    ...base,
    verdict: 'NO_SNOW',
    triggers: [...sleetTriggers, ...hailTriggers],
    possibleSnow: false,
    reasons,
  };
}

function minDefined(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}
