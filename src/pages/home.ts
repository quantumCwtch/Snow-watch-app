import { Stage } from '../game/stage';
import { planScene, describePlan } from '../game/scene';
import { decideIntro, type Intro } from '../game/flow';
import { playFanfare, playNearMiss, soundEnabled } from '../game/audio';
import { isNight } from '../lib/sun';
import { config } from '../lib/config';
import { ukDateOf, ukTimeOf } from '../lib/ukTime';
import { codeLabel } from '../lib/config';
import type { LatestSnapshot, SceneCategory, SceneVariant } from '../lib/types';
import {
  loadLatest, prefersReducedMotion, setupSoundToggle, fmtTemp, fmtWind, fmtObsTime, verdictLabel,
  previewParam, previewSnapshot, PREVIEW_SCENES, BASE,
} from './shared';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const canvas = $<HTMLCanvasElement>('screen');
const stage = new Stage(canvas, $<HTMLButtonElement>('start'), prefersReducedMotion());
const soundBtn = $<HTMLButtonElement>('sound');
setupSoundToggle(soundBtn);

let currentScreen: string | null = null;
soundBtn.addEventListener('click', () => {
  if (!soundEnabled()) return;
  if (currentScreen === 'snow-day') playFanfare();
  else if (currentScreen === 'sleet' || currentScreen === 'hail') playNearMiss();
});

async function main() {
  const now = new Date();
  const params = new URLSearchParams(location.search);
  const previewId = previewParam();
  let latest: LatestSnapshot | null = null;
  let category: SceneCategory = 'unknown';
  let variant: SceneVariant = 'normal';
  const preview = previewId !== null;

  if (preview) {
    const p = previewSnapshot(previewId!, now);
    $('preview-banner').hidden = false;
    if (!p) {
      $('preview-banner').textContent = `Unknown preview "${previewId}". Try one of: ${PREVIEW_SCENES.map((s) => s.id).join(', ')}.`;
      return;
    }
    latest = p.snapshot;
    category = p.category;
    variant = p.variant;
  } else {
    try {
      latest = await loadLatest();
      category = latest.today?.scene.category ?? 'unknown';
      variant = latest.today?.scene.variant ?? 'normal';
    } catch {
      latest = null;
    }
  }

  fillPanels(latest, preview);

  const intro: Intro = latest
    ? decideIntro(latest)
    : { screen: 'signal-lost', date: '', blocking: true, snowScene: false };
  if (intro.snowScene) {
    category = 'snow';
    variant = 'normal';
  }

  const date = latest?.today?.date ?? ukDateOf(now);
  const plan = planScene(date, category, variant);
  const nightParam = params.get('night');
  const night = nightParam !== null ? nightParam !== '0' : isNight(now, config.site.latitude, config.site.longitude);
  const obs = latest?.latestObservation ?? null;
  const hud = obs
    ? {
        temperature: fmtTemp(obs.temperatureC),
        condition: latest?.today?.scene.label ?? '',
        time: ukTimeOf(new Date(obs.time)),
      }
    : null;

  $('scene-summary').textContent =
    `${night ? 'Night-time' : 'Daytime'} scene for ${date}: ${latest?.today?.scene.label ?? 'conditions unknown'}. ` +
    'The seven millennials are:';
  const list = $('scene-list');
  list.replaceChildren(...describePlan(plan).map((t) => Object.assign(document.createElement('li'), { textContent: t })));
  canvas.setAttribute(
    'aria-label',
    `Pixel-art Trafalgar Square, ${night ? 'at night' : 'by day'}, showing ${latest?.today?.scene.label.toLowerCase() ?? 'unknown weather'}. Details are listed below.`,
  );

  const showScene = () => {
    currentScreen = null;
    stage.showScene(plan, night, hud, preview);
  };

  const dismissKey = `snow-watch:dismissed:${intro.screen}:${intro.date}`;
  let dismissed = false;
  try {
    dismissed = !preview && sessionStorage.getItem(dismissKey) === '1';
  } catch {
    /* ignore */
  }

  if (intro.screen && !dismissed) {
    currentScreen = intro.screen;
    stage.showSpecial(
      intro.screen,
      {
        date: intro.date,
        snowCount: latest?.snowDaysRecorded ?? 0,
        message: latest?.statusMessage,
        preview,
      },
      intro.blocking
        ? null
        : () => {
            try {
              if (!preview) sessionStorage.setItem(dismissKey, '1');
            } catch {
              /* ignore */
            }
            showScene();
          },
    );
    if (intro.screen === 'snow-day') playFanfare();
    $('v-detail').textContent = screenAnnouncement(intro);
  } else {
    showScene();
  }
}

function screenAnnouncement(intro: Intro): string {
  switch (intro.screen) {
    case 'snow-day':
      return `SNOW DAY SNOW DAY SNOW DAY! Snow was observed at St James's Park (${intro.date}).`;
    case 'sleet':
      return `So close. It was sleet (${intro.date}).`;
    case 'hail':
      return `Hail is not snow. Nice try, sky (${intro.date}).`;
    case 'unconfirmed':
      return `Unconfirmed (${intro.date}): weather codes were missing for hours where snow could not be ruled out. No snow day is declared without proof.`;
    case 'possible-snow':
      return `Possible snow, awaiting confirmation (${intro.date}): precipitation fell at 2 °C or below, but no weather code confirms snow.`;
    case 'signal-lost':
      return 'SIGNAL LOST: observations are late or missing. The page will not guess.';
    case 'station-mismatch':
      return 'WRONG STATION: the station identity check failed, so no verdict has been published.';
    default:
      return '';
  }
}

function fillPanels(latest: LatestSnapshot | null, preview: boolean) {
  if (!latest) {
    $('v-yesterday').textContent = 'Unknown: data could not be loaded.';
    $('v-today').textContent = 'Unknown: data could not be loaded.';
    $('h-status').textContent = 'SIGNAL LOST: data/latest.json could not be loaded.';
    return;
  }
  const y = latest.yesterday;
  const yd = $('v-yesterday');
  yd.replaceChildren();
  if (y) {
    const span = Object.assign(document.createElement('span'), {
      className: `verdict-${y.verdict}`,
      textContent: verdictLabel(y.verdict, y.possibleSnow, y.hailSeen),
    });
    yd.append(`${y.date}: `, span);
    if (y.dayFile && !preview) {
      yd.append(' ');
      yd.append(Object.assign(document.createElement('a'), { href: `${BASE}${y.dayFile}`, textContent: 'Raw observations (JSON)' }));
    }
  } else yd.textContent = 'Not yet finalised.';

  const t = latest.today;
  const td = $('v-today');
  td.replaceChildren();
  if (t) {
    const c = t.completeness;
    td.append(
      Object.assign(document.createElement('span'), {
        className: `verdict-${t.verdict}`,
        textContent: verdictLabel(t.verdict, t.rule.possibleSnow, t.rule.hailSeen),
      }),
      ` (${c.hoursReceived} of ${c.hoursExpected} hours received, ${c.hoursWithCode} with a weather code; provisional)`,
    );
  } else td.textContent = 'No observations yet today.';

  const o = latest.latestObservation;
  $('h-temp').textContent = o ? fmtTemp(o.temperatureC) : '--';
  $('h-wind').textContent = fmtWind(o);
  $('h-cond').textContent = o
    ? `${latest.today?.scene.label ?? '--'}${o.weatherCode !== null ? ` (latest code ${o.weatherCode}: ${codeLabel(o.weatherCode)})` : ' (no weather code reported)'}`
    : '--';
  $('h-station').textContent = `${latest.station.name} (WMO ${latest.station.wmoId}), about 600 m from Trafalgar Square`;
  $('h-time').textContent = fmtObsTime(o?.time);
  $('h-status').textContent = `${latest.status.replace('_', ' ')}: ${latest.statusMessage}`;
}

void main();
