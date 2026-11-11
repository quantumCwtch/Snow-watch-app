import { Stage } from '../game/stage';
import { planScene, describePlan } from '../game/scene';
import { screenForVerdict } from '../game/flow';
import { playFanfare } from '../game/audio';
import { isValidDate, ukTimeOf } from '../lib/ukTime';
import type { DayRecord, Summary } from '../lib/types';
import { loadDay, loadSummary, prefersReducedMotion, setupSoundToggle, verdictLabel, fmtTemp, el, BASE } from './shared';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = new Stage($<HTMLCanvasElement>('screen'), $<HTMLButtonElement>('start'), prefersReducedMotion());
setupSoundToggle($<HTMLButtonElement>('sound'));
const input = $<HTMLInputElement>('date');
const msg = $('date-msg');
let summary: Summary | null = null;
const SHORT = { SNOW: 'SNOW!', SLEET: 'SLEET', UNCONFIRMED: 'UNCONFIRMED', NO_SNOW: 'NO SNOW', NO_DATA: 'NO DATA' } as const;

async function show(date: string) {
  if (!isValidDate(date)) return;
  history.replaceState(null, '', `?date=${date}`);
  input.value = date;
  let day: DayRecord;
  try {
    day = await loadDay(date);
  } catch {
    msg.textContent = `No finalised record for ${date}.`;
    stage.showSpecial('signal-lost', { date, snowCount: 0, message: `No record for ${date}.` }, null);
    $('day-report').replaceChildren(el('p', {}, `No finalised record for ${date}.`));
    return;
  }
  msg.textContent = `Loaded ${date}.`;
  const plan = planScene(date, day.scene.category, day.scene.variant);
  const screen = screenForVerdict({ verdict: day.verdict, possibleSnow: day.rule.possibleSnow, hailSeen: day.rule.hailSeen });
  const hud = { temperature: `${fmtTemp(day.minTemperatureC)}-${fmtTemp(day.maxTemperatureC)}`, condition: day.scene.label, time: date };
  const play = () => stage.showScene(plan, false, hud, false);
  if (screen) {
    const snowCount = summary ? summary.snowDays.filter((d) => d <= date).length : day.verdict === 'SNOW' ? 1 : 0;
    stage.showSpecial(screen, { date, snowCount, message: day.rule.reasons.join(' ') }, play);
    if (screen === 'snow-day') playFanfare();
  } else play();

  const c = day.completeness;
  const report = el(
    'div',
    {},
    el('dl', { className: 'stats' },
      el('dt', {}, 'Verdict'), el('dd', { className: `verdict-${day.verdict}` }, verdictLabel(day.verdict, day.rule.possibleSnow, day.rule.hailSeen)),
      el('dt', {}, 'Why'), el('dd', {}, day.rule.reasons.join(' ')),
      el('dt', {}, 'Triggering hours'), el('dd', {}, day.rule.triggers.length ? day.rule.triggers.map((t) => `${t.localTime} code ${t.code} (${t.label})`).join('; ') : 'None'),
      el('dt', {}, 'Scene'), el('dd', {}, `${day.scene.label}: ${day.scene.basis}`),
      el('dt', {}, 'Temperature'), el('dd', {}, `${fmtTemp(day.minTemperatureC)} to ${fmtTemp(day.maxTemperatureC)}`),
      el('dt', {}, 'Precipitation'), el('dd', {}, day.totalPrecipMm === null ? 'Not available' : `${day.totalPrecipMm} mm`),
      el('dt', {}, 'Completeness'), el('dd', {}, `${c.hoursReceived} of ${c.hoursExpected} hours; ${c.hoursWithCode} with a weather code`),
      el('dt', {}, 'Sources'), el('dd', {}, day.sources.join(' + ') || 'none'),
      el('dt', {}, 'Cross-check'), el('dd', {}, day.crossCheck ? `${day.crossCheck.comparedHours} hours compared, max difference ${day.crossCheck.maxTemperatureDifferenceC} °C${day.crossCheck.ok ? '' : ' (outside tolerance)'}` : 'Not possible (one source only)'),
      el('dt', {}, 'Retrieved'), el('dd', {}, `${ukTimeOf(new Date(day.retrievedAt))} UK time, ${day.retrievedAt.slice(0, 10)}`),
      el('dt', {}, 'Raw data'), el('dd', {}, el('a', { href: `${BASE}data/days/${date}.json` }, `data/days/${date}.json`)),
    ),
    el('p', {}, 'In the square that day:'),
    el('ul', {}, ...describePlan(plan).map((t) => el('li', {}, t))),
  );
  $('day-report').replaceChildren(report);
}

async function main() {
  try {
    summary = await loadSummary();
  } catch {
    summary = null;
  }
  const days = summary?.days ?? [];
  if (days.length) {
    input.min = days[0].date;
    input.max = days[days.length - 1].date;
  }
  $('levels').replaceChildren(
    ...days
      .slice()
      .reverse()
      .map((d, i) =>
        el('li', {}, Object.assign(el('button', { type: 'button', className: 'pixel-btn' }, `L${String(days.length - i).padStart(2, '0')} ${d.date} ${SHORT[d.verdict]}`), {
          onclick: () => void show(d.date),
        })),
      ),
  );
  if (!days.length) $('levels').replaceChildren(el('li', {}, 'No finalised days yet.'));
  input.addEventListener('change', () => void show(input.value));
  const q = new URLSearchParams(location.search).get('date');
  const start = q && isValidDate(q) ? q : days.at(-1)?.date;
  if (start) await show(start);
}

void main();
