// Helpers shared by every page.
import type { SnowRuleResult, LatestSnapshot, Summary, DayRecord, SceneCategory, SceneVariant, Verdict, HourlyObs } from '../lib/types';
import { categoryLabel } from '../lib/classifier';
import { config } from '../lib/config';
import { ukTimeOf, ukDateOf, addDays } from '../lib/ukTime';
import { soundEnabled, setSoundEnabled } from '../game/audio';
import { startMusic, stopMusic } from '../game/music';

export const BASE = import.meta.env.BASE_URL;

export async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}?v=${Math.floor(Date.now() / 300000)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const loadLatest = () => loadJson<LatestSnapshot>('data/latest.json');
export const loadSummary = () => loadJson<Summary>('data/summary.json');
export const loadDay = (date: string) => loadJson<DayRecord>(`data/days/${date}.json`);

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const fmtTemp = (t: number | null | undefined) => (t === null || t === undefined ? '--' : `${t.toFixed(1)}°C`);

export function fmtWind(o: HourlyObs | null): string {
  if (!o || o.windSpeedMs === null) return 'Not reported';
  const mph = (ms: number) => Math.round(ms * 2.23694);
  const gust = o.windGustMs !== null ? `, gusts ${mph(o.windGustMs)} mph` : '';
  return `${mph(o.windSpeedMs)} mph${o.windDirection ? ' from ' + o.windDirection : ''}${gust}`;
}

export function fmtObsTime(iso: string | null | undefined): string {
  if (!iso) return '--';
  const d = new Date(iso);
  return `${ukTimeOf(d)} UK time, ${ukDateOf(d)}`;
}

export const VERDICT_TEXT: Record<Verdict, string> = {
  SNOW: 'SNOW! Snow was observed.',
  SLEET: 'Sleet only. So close.',
  UNCONFIRMED: 'Unconfirmed: snow could not be ruled out.',
  NO_SNOW: 'No snow.',
  NO_DATA: 'No data received.',
};

export function verdictLabel(
  v: Verdict,
  possibleSnow = false,
  hail = false,
  confirmedBy: string | null = null,
  nearbySnow = false,
): string {
  if (v === 'SNOW' && confirmedBy === 'nearby') {
    return 'SNOW! Confirmed by a nearby snow sensor, with cold precipitation at St James\'s Park.';
  }
  if (v === 'SNOW') return 'SNOW! A snow weather code was reported at St James\'s Park.';
  if (v === 'UNCONFIRMED' && possibleSnow) return 'Possible snow, awaiting confirmation.';
  if (v === 'UNCONFIRMED' && nearbySnow) return 'Unconfirmed: snow seen nearby, not confirmed in central London.';
  if (v === 'NO_SNOW' && nearbySnow) return 'No snow in central London (snow was reported further out).';
  if (v === 'NO_SNOW' && hail) return 'No snow (hail is not snow).';
  return VERDICT_TEXT[v];
}

export function setupSoundToggle(btn: HTMLButtonElement) {
  const paint = () => {
    const on = soundEnabled();
    btn.setAttribute('aria-pressed', String(on));
    btn.textContent = on ? 'SOUND: ON' : 'SOUND: OFF';
  };
  btn.addEventListener('click', () => {
    const on = !soundEnabled();
    setSoundEnabled(on);
    if (on) startMusic();
    else stopMusic();
    paint();
  });
  paint();
  // Sound was left ON last visit: browsers only allow audio after an interaction,
  // so start the music on the first click, tap or key press anywhere on the page.
  if (soundEnabled()) {
    const kick = (e: Event) => {
      if (e.target === btn) return; // the toggle handles itself
      if (soundEnabled()) startMusic();
      window.removeEventListener('pointerdown', kick);
      window.removeEventListener('keydown', kick);
    };
    window.addEventListener('pointerdown', kick);
    window.addEventListener('keydown', kick);
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: Array<Node | string>): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

// ------------------------------------------------------------------ preview mode

export const PREVIEW_SCENES: Array<{ id: string; category: SceneCategory; variant: SceneVariant }> = [
  { id: 'snow', category: 'snow', variant: 'normal' },
  { id: 'sleet', category: 'sleet-hail', variant: 'normal' },
  { id: 'hail', category: 'sleet-hail', variant: 'normal' },
  { id: 'thunder', category: 'thunder', variant: 'normal' },
  { id: 'heavy-rain', category: 'heavy-rain', variant: 'normal' },
  { id: 'light-rain', category: 'light-rain', variant: 'normal' },
  { id: 'fog', category: 'fog', variant: 'normal' },
  { id: 'wind', category: 'wind', variant: 'normal' },
  { id: 'overcast', category: 'overcast', variant: 'normal' },
  { id: 'partly-cloudy', category: 'partly-cloudy', variant: 'normal' },
  { id: 'sunny', category: 'sunny', variant: 'normal' },
  { id: 'sunny-hot', category: 'sunny', variant: 'hot' },
  { id: 'cold-bright', category: 'sunny', variant: 'cold-bright' },
  { id: 'unknown', category: 'unknown', variant: 'normal' },
  { id: 'unconfirmed', category: 'overcast', variant: 'normal' },
  { id: 'possible-snow', category: 'overcast', variant: 'normal' },
  { id: 'signal-lost', category: 'unknown', variant: 'normal' },
  { id: 'station-mismatch', category: 'unknown', variant: 'normal' },
];

const SAMPLE_OBS: Record<SceneCategory, Partial<HourlyObs>> = {
  snow: { weatherCode: 24, temperatureC: 0.3, windSpeedMs: 3, windGustMs: 7, visibilityM: 1800 },
  'sleet-hail': { weatherCode: 18, temperatureC: 1.6, windSpeedMs: 5, windGustMs: 11, visibilityM: 6000 },
  thunder: { weatherCode: 30, temperatureC: 17.2, windSpeedMs: 6, windGustMs: 16, visibilityM: 8000 },
  'heavy-rain': { weatherCode: 15, temperatureC: 9.4, windSpeedMs: 6, windGustMs: 13, visibilityM: 5000, precipMm: 6.2 },
  'light-rain': { weatherCode: 12, temperatureC: 11.0, windSpeedMs: 3, windGustMs: 8, visibilityM: 12000, precipMm: 0.6 },
  fog: { weatherCode: 6, temperatureC: 4.1, windSpeedMs: 1, windGustMs: 2, visibilityM: 300 },
  wind: { weatherCode: 7, temperatureC: 12.5, windSpeedMs: 11, windGustMs: 21, visibilityM: 25000 },
  overcast: { weatherCode: 8, temperatureC: 10.3, windSpeedMs: 3, windGustMs: 6, visibilityM: 18000 },
  'partly-cloudy': { weatherCode: 3, temperatureC: 15.8, windSpeedMs: 3, windGustMs: 7, visibilityM: 30000 },
  sunny: { weatherCode: 1, temperatureC: 19.6, windSpeedMs: 2, windGustMs: 5, visibilityM: 40000 },
  unknown: { weatherCode: null, temperatureC: 9.0, windSpeedMs: null, windGustMs: null, visibilityM: null },
};

/** Builds an in-memory sample snapshot. Never fetched from, or written to, data/. */
export function previewSnapshot(id: string, now: Date): { snapshot: LatestSnapshot; category: SceneCategory; variant: SceneVariant } | null {
  const p = PREVIEW_SCENES.find((s) => s.id === id);
  if (!p) return null;
  const today = ukDateOf(now);
  const temp = p.variant === 'hot' ? 28.4 : p.variant === 'cold-bright' ? 2.1 : undefined;
  const obs: HourlyObs = {
    time: new Date(Math.floor(now.getTime() / 3600000) * 3600000).toISOString(),
    weatherCode: null,
    temperatureC: null,
    visibilityM: null,
    windSpeedMs: null,
    windGustMs: null,
    windDirection: 'SW',
    humidityPct: 80,
    mslpHpa: 1010,
    precipMm: 0,
    sources: ['datahub', 'aws'],
    ...SAMPLE_OBS[p.category],
    ...(temp !== undefined ? { temperatureC: temp } : {}),
    ...(id === 'hail' ? { weatherCode: 20 } : {}),
  };
  const verdict: Verdict =
    id === 'snow' ? 'SNOW' : id === 'sleet' ? 'SLEET' : id === 'unconfirmed' || id === 'possible-snow' ? 'UNCONFIRMED' : id === 'signal-lost' ? 'NO_DATA' : 'NO_SNOW';
  const scene = { category: p.category, variant: p.variant, label: categoryLabel(p.category, p.variant), basis: 'Preview sample data.' };
  const rule = {
    verdict, triggers: [], hailSeen: id === 'hail', sleetSeen: id === 'sleet', possibleSnow: id === 'possible-snow',
    possibleSnowHours: [], relevantMissingCodeHours: [], unexpectedCodes: [], reasons: ['Preview sample data.'],
    confirmedBy: (id === 'snow' || id === 'sleet' ? 'nearby' : null) as SnowRuleResult['confirmedBy'],
    nearbySnowHours: id === 'unconfirmed' ? [new Date(Math.floor(now.getTime() / 3600000) * 3600000).toISOString()] : [],
    nearbyCoverageHours: 12,
  };
  const snapshot: LatestSnapshot = {
    schema: 1,
    generatedAt: now.toISOString(),
    status: id === 'signal-lost' ? 'SIGNAL_LOST' : id === 'station-mismatch' ? 'STATION_MISMATCH' : 'OK',
    statusMessage: id === 'station-mismatch' ? 'Preview: nearest station is not St James\'s Park.' : 'Preview sample data. Not real weather.',
    station: {
      name: config.station.name, wmoId: config.station.wmoId, datahubGeohash: null, datahubArea: 'Preview',
      awsName: null, verified: { datahub: false, aws: false },
    },
    latestObservation: id === 'signal-lost' ? null : obs,
    today: {
      date: today, verdict, rule, scene, minTemperatureC: (obs.temperatureC ?? 0) - 2, maxTemperatureC: (obs.temperatureC ?? 0) + 1,
      totalPrecipMm: 1.2, completeness: { hoursExpected: 12, hoursReceived: 12, hoursWithCode: 12 }, sources: ['datahub', 'aws'],
    },
    yesterday: {
      date: addDays(today, -1), verdict, possibleSnow: id === 'possible-snow', hailSeen: id === 'hail', scene,
      confirmedBy: rule.confirmedBy, nearbySnow: id === 'unconfirmed',
      dayFile: '',
    },
    snowDaysRecorded: id === 'snow' ? 1 : 0,
  };
  return { snapshot, category: p.category, variant: p.variant };
}

export function previewParam(): string | null {
  return new URLSearchParams(location.search).get('preview');
}
