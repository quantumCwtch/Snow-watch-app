// Parser for aviation-style (METAR / WMO FM 15 table 4678) present-weather groups.
//
// Both confirmation sources use this vocabulary:
//  - the Met Office AWS one-minute files for Heathrow and Northolt, whose
//    `present_weather_1_minute_10_minute_weighted_mean` column holds values such as
//    NSW, BR, FG, -RA, RERA, -RADZ, UP and +UP (seen in real files, Nov 2026);
//  - London City Airport METAR reports (wxString / rawOb), e.g. "-RA", "RA DZ".
//
// Snow:   SN or SG (snow grains) as the only precipitation, including SHSN, +SN, TSSN, and
//         recent snow (RESN, RESHSN). BLSN and DRSN (snow lifted by wind) are NOT falling snow.
// Sleet:  snow mixed with rain or drizzle (RASN, SNRA, DZSN, SHRASN): the UK meaning of sleet;
//         also ice pellets (PL).
// Hail:   GR (hail) and GS (small hail / snow pellets).
// UP:     unidentified precipitation from an automatic sensor: could be anything, never ignored.

export interface WxFlags {
  snow: boolean;
  sleet: boolean;
  hail: boolean;
  rain: boolean;
  unknownPrecip: boolean;
  fog: boolean;
  thunder: boolean;
  /** True when the report contained at least one readable weather group or NSW / no weather. */
  reported: boolean;
}

export const NO_WX: WxFlags = {
  snow: false, sleet: false, hail: false, rain: false, unknownPrecip: false, fog: false, thunder: false, reported: false,
};

const GROUP = /^(RE)?(\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP)+|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)?$/;

/** Parse one or more space-separated weather groups (not a whole METAR). */
export function parseWxGroups(text: string | null | undefined): WxFlags {
  if (text === null || text === undefined) return { ...NO_WX };
  const t = text.trim();
  if (t === '' || t === '//' || /^\/+$/.test(t)) return { ...NO_WX };
  const out: WxFlags = { ...NO_WX, reported: true };
  if (t === 'NSW') return out;
  for (const g of t.split(/\s+/)) {
    const m = GROUP.exec(g);
    if (!m || (!m[3] && !m[4])) continue;
    const [, , intensity, descriptor, phen = ''] = m;
    if (intensity === 'VC') continue; // in the vicinity, not at the station
    if (descriptor === 'TS') out.thunder = true;
    if (phen === 'BR' || phen === 'FG') out.fog = true;
    if (descriptor === 'BL' || descriptor === 'DR') continue; // lifted, not falling
    const types: string[] = phen.match(/DZ|RA|SN|SG|IC|PL|GR|GS|UP/g) ?? [];
    if (!types.length) continue;
    const snowy = types.some((x) => x === 'SN' || x === 'SG');
    const liquid = types.some((x) => x === 'RA' || x === 'DZ');
    if (snowy && liquid) out.sleet = true;
    else if (snowy) out.snow = true;
    if (types.includes('PL')) out.sleet = true;
    if (types.includes('GR') || types.includes('GS')) out.hail = true;
    if (liquid && !snowy) out.rain = true;
    if (types.includes('UP')) out.unknownPrecip = true;
  }
  return out;
}

export function mergeWx(a: WxFlags, b: WxFlags): WxFlags {
  return {
    snow: a.snow || b.snow,
    sleet: a.sleet || b.sleet,
    hail: a.hail || b.hail,
    rain: a.rain || b.rain,
    unknownPrecip: a.unknownPrecip || b.unknownPrecip,
    fog: a.fog || b.fog,
    thunder: a.thunder || b.thunder,
    reported: a.reported || b.reported,
  };
}

/**
 * Extract the present-weather groups from a raw METAR. Stops at the trend (TEMPO,
 * BECMG, NOSIG), which is a forecast, and at remarks (RMK). Returns null when the
 * report says present weather is unavailable ("//").
 */
export function metarWeather(raw: string): string | null {
  const tokens = raw.trim().split(/\s+/);
  const out: string[] = [];
  let unavailable = false;
  for (const tok of tokens.slice(2)) {
    if (/^(TEMPO|BECMG|NOSIG|RMK)$/.test(tok)) break;
    if (tok === '//') {
      unavailable = true;
      continue;
    }
    if (/^(RE)?(\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?((?:DZ|RA|SN|SG|IC|PL|GR|GS|UP)+|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)$/.test(tok) || /^(RE)?TS$/.test(tok)) {
      out.push(tok);
    }
  }
  if (out.length) return out.join(' ');
  return unavailable ? null : 'NSW';
}
