// Weather classifier for the scene. Picks the MOST SIGNIFICANT weather of the period
// (not the average), in this priority order:
//   snow > sleet/hail > thunder > heavy rain > light rain > fog/mist > strong wind
//   > overcast > partly cloudy > sunny (hot / cold-and-bright variants) > unknown
// Snow is only ever chosen from a reported snow code, never inferred.
// If no weather codes exist, rain is inferred from measured precipitation and the
// sky is reported as "unknown" rather than guessed.

import type { HourlyObs, Classification, SceneCategory, SceneVariant } from './types';
import { config as defaultConfig, type Config } from './config';

const LABELS: Record<SceneCategory, string> = {
  snow: 'Snow',
  'sleet-hail': 'Sleet or hail',
  thunder: 'Thunder',
  'heavy-rain': 'Heavy rain',
  'light-rain': 'Light rain or drizzle',
  fog: 'Fog or mist',
  wind: 'Strong wind',
  overcast: 'Overcast',
  'partly-cloudy': 'Partly cloudy',
  sunny: 'Sunny',
  unknown: 'Sky not reported',
};

export const CATEGORY_ORDER: SceneCategory[] = [
  'snow',
  'sleet-hail',
  'thunder',
  'heavy-rain',
  'light-rain',
  'fog',
  'wind',
  'overcast',
  'partly-cloudy',
  'sunny',
  'unknown',
];

export function categoryLabel(c: SceneCategory, v: SceneVariant = 'normal'): string {
  if (c === 'sunny' && v === 'hot') return 'Sunny and hot';
  if (c === 'sunny' && v === 'cold-bright') return 'Cold and bright';
  return LABELS[c];
}

export function classify(hourly: HourlyObs[], cfg: Config = defaultConfig): Classification {
  const wc = cfg.weatherCodes;
  const th = cfg.classifier;
  const has = (list: number[]) => hourly.some((h) => h.weatherCode !== null && list.includes(h.weatherCode));
  const temps = hourly.flatMap((h) => [h.temperatureC, h.maxTemperatureC ?? null]).filter((t): t is number => t !== null);
  const maxT = temps.length ? Math.max(...temps) : null;

  const pick = (category: SceneCategory, basis: string, variant: SceneVariant = 'normal'): Classification => ({
    category,
    variant,
    label: categoryLabel(category, variant),
    basis,
  });

  if (hourly.length === 0) return pick('unknown', 'No observations.');

  if (has(wc.snow)) return pick('snow', 'Snow weather code reported.');
  if (has(wc.sleet) || has(wc.hail)) return pick('sleet-hail', 'Sleet or hail weather code reported.');
  if (has(wc.thunder)) return pick('thunder', 'Thunder weather code reported.');

  const maxPrecip = Math.max(0, ...hourly.map((h) => h.precipMm ?? 0));
  if (has(wc.heavyRain)) return pick('heavy-rain', 'Heavy rain weather code reported.');
  if (maxPrecip >= th.heavyRainHourlyMm) return pick('heavy-rain', `Up to ${maxPrecip.toFixed(1)} mm fell in one hour.`);
  if (has(wc.lightRain)) return pick('light-rain', 'Rain or drizzle weather code reported.');
  if (maxPrecip >= th.lightRainHourlyMm) return pick('light-rain', `Up to ${maxPrecip.toFixed(1)} mm fell in one hour.`);

  const minVis = Math.min(Infinity, ...hourly.map((h) => h.visibilityM ?? Infinity));
  if (has(wc.fog)) return pick('fog', 'Fog or mist weather code reported.');
  if (minVis < th.fogVisibilityMetres) return pick('fog', `Visibility fell to ${Math.round(minVis)} m.`);

  const maxGust = Math.max(0, ...hourly.map((h) => h.windGustMs ?? 0));
  if (maxGust >= th.strongWindGustMs) return pick('wind', `Gusts reached ${maxGust.toFixed(1)} m/s.`);

  if (has(wc.overcast)) return pick('overcast', 'Cloudy or overcast weather code reported.');
  if (minVis < th.mistVisibilityMetres && hourly.some((h) => h.weatherCode !== null)) {
    return pick('fog', `Hazy: visibility fell to ${Math.round(minVis)} m.`);
  }
  if (has(wc.partlyCloudy)) return pick('partly-cloudy', 'Partly cloudy weather code reported.');
  if (has(wc.clear)) {
    let variant: SceneVariant = 'normal';
    if (maxT !== null && maxT > th.hotMaxTempC) variant = 'hot';
    else if (maxT !== null && maxT < th.coldBrightMaxTempC) variant = 'cold-bright';
    return pick('sunny', 'Clear-sky weather code reported.', variant);
  }
  return pick('unknown', 'No weather code reported, and no measurable rain.');
}
