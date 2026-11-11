// Draws the 320 x 200 Trafalgar Square scene. Original pixel art, drawn procedurally.
import { P, SKIES } from './palette';
import { drawText, textWidth, wrapText } from './font';
import { drawPropBehind, drawPropFront, px, type PropId, type PropContext } from './props';
import type { CastMember } from './cast';
import type { Anim } from './activities';
import type { ScenePlan, PlacedCharacter } from './scene';
import { W, H } from './scene';
import { createRng } from '../lib/rng';

export interface HudInfo {
  temperature: string;
  condition: string;
  time: string;
}

export interface RenderOptions {
  plan: ScenePlan;
  t: number;
  night: boolean;
  reducedMotion: boolean;
  hud: HudInfo | null;
  preview: boolean;
  panic?: boolean;
  /** Hide the ticker (e.g. for archive thumbnails). */
  ticker?: boolean;
}

type Ctx = CanvasRenderingContext2D;

const HORIZON = 70;
const PLAZA_TOP = 112;
const ROAD_TOP = 172;
const ROAD_BOTTOM = 187;

// ------------------------------------------------------------------ helpers

function skyKey(plan: ScenePlan, night: boolean): string {
  const c = plan.category;
  if (night) return c === 'sunny' || c === 'partly-cloudy' ? 'night' : 'nightCloud';
  switch (c) {
    case 'sunny':
      return plan.variant === 'hot' ? 'hot' : plan.variant === 'cold-bright' ? 'cold' : 'sunny';
    case 'partly-cloudy':
      return 'partly';
    case 'overcast':
    case 'wind':
      return 'overcast';
    case 'light-rain':
    case 'heavy-rain':
      return 'rain';
    case 'thunder':
      return 'storm';
    case 'fog':
      return 'fog';
    case 'snow':
    case 'sleet-hail':
      return 'snow';
    default:
      return 'unknown';
  }
}

function dither(ctx: Ctx, x: number, y: number, w: number, h: number, c: string, phase = 0) {
  ctx.fillStyle = c;
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x + ((yy + phase) % 2); xx < x + w; xx += 2) ctx.fillRect(xx, yy, 1, 1);
  }
}

function drawSky(ctx: Ctx, bands: string[]) {
  const bh = Math.ceil(HORIZON / bands.length);
  bands.forEach((c, i) => px(ctx, 0, i * bh, W, bh, c));
  for (let i = 1; i < bands.length; i++) dither(ctx, 0, i * bh - 1, W, 2, bands[i - 1], i);
}

function drawCloud(ctx: Ctx, x: number, y: number, w: number, c: string, shade: string) {
  const r = Math.max(4, Math.floor(w / 5));
  px(ctx, x, y + r, w, r, c);
  px(ctx, x + r, y + Math.floor(r / 2), w - 2 * r, r, c);
  px(ctx, x + 2 * r, y, Math.max(2, w - 4 * r), r, c);
  px(ctx, x, y + 2 * r - 1, w, 1, shade);
}

// ------------------------------------------------------------------ scenery

function drawGallery(ctx: Ctx, night: boolean, snowy: boolean, t: number) {
  const top = 60;
  const base = 98;
  // wings
  px(ctx, 0, top, W, base - top, P.stone);
  px(ctx, 0, top - 2, W, 2, P.stoneShade);
  px(ctx, 0, top + 8, W, 1, P.stoneShade);
  // end pavilions
  px(ctx, 0, top - 6, 34, 6, P.stone);
  px(ctx, 286, top - 6, 34, 6, P.stone);
  px(ctx, 0, top - 7, 34, 1, P.stoneShade);
  px(ctx, 286, top - 7, 34, 1, P.stoneShade);
  // windows
  const lit = createRng('windows');
  for (let x = 6; x < 314; x += 12) {
    if (x > 122 && x < 194) continue;
    for (const wy of [72, 84]) {
      const on = night && lit.chance(0.55);
      px(ctx, x, wy, 5, 8, on ? P.yellow : P.dark);
      px(ctx, x, wy - 1, 5, 1, P.stoneShade);
      if (on && Math.floor(t / 3 + x) % 17 === 0) px(ctx, x + 1, wy + 2, 3, 3, P.orange);
    }
  }
  // pilasters
  for (let x = 3; x < 318; x += 12) if (x < 124 || x > 192) px(ctx, x, top + 9, 1, base - top - 9, P.stoneShade);
  // dome and lantern
  const dx = 160;
  for (let i = 0; i < 9; i++) {
    const half = Math.round(Math.sqrt(81 - i * i) * 1.4);
    px(ctx, dx - half, top - 8 - i, half * 2, 1, i < 3 ? P.slate : P.grey);
  }
  px(ctx, dx - 3, top - 22, 6, 5, P.stoneShade);
  px(ctx, dx - 1, top - 25, 2, 3, P.slate);
  px(ctx, dx - 14, top - 8, 28, 2, P.stoneShade);
  // portico: pediment, entablature, columns
  for (let i = 0; i < 10; i++) px(ctx, 128 + i * 3, top - i + 4, 64 - i * 6, 1, i === 0 ? P.stoneShade : P.stone);
  px(ctx, 126, top + 4, 68, 2, P.stoneShade);
  px(ctx, 126, top + 6, 68, 1, P.stone);
  px(ctx, 128, top + 7, 64, base - top - 7, P.stoneDark);
  for (let x = 130; x <= 188; x += 8) {
    px(ctx, x, top + 7, 4, base - top - 7, P.stone);
    px(ctx, x + 3, top + 7, 1, base - top - 7, P.stoneShade);
    px(ctx, x - 1, top + 7, 6, 1, P.stoneShade);
  }
  // doors
  px(ctx, 155, 84, 10, 14, night ? P.orange : P.brown);
  if (snowy) {
    px(ctx, 0, top - 3, W, 1, P.white);
    px(ctx, 126, top + 3, 68, 1, P.white);
    px(ctx, 0, top - 8, 34, 1, P.white);
    px(ctx, 286, top - 8, 34, 1, P.white);
  }
}

function drawSteps(ctx: Ctx, wet: boolean, snowy: boolean) {
  for (let y = 98; y < PLAZA_TOP; y += 2) {
    px(ctx, 0, y, W, 1, snowy ? P.white : P.stone);
    px(ctx, 0, y + 1, W, 1, snowy ? P.pale : wet ? P.stoneDark : P.stoneShade);
  }
  // terrace balustrade
  px(ctx, 0, 97, W, 1, P.stoneDark);
}

function drawPlaza(ctx: Ctx, plan: ScenePlan, t: number) {
  const c = plan.category;
  const snowy = c === 'snow';
  const wet = c === 'light-rain' || c === 'heavy-rain' || c === 'thunder' || c === 'sleet-hail';
  const base = snowy ? P.white : wet ? '#8d8a80' : '#b8ad92';
  const line = snowy ? P.pale : wet ? '#76736a' : '#a19679';
  px(ctx, 0, PLAZA_TOP, W, ROAD_TOP - PLAZA_TOP, base);
  for (let y = PLAZA_TOP + 6; y < ROAD_TOP; y += 8) px(ctx, 0, y, W, 1, line);
  for (let y = PLAZA_TOP; y < ROAD_TOP; y += 8) {
    const off = ((y - PLAZA_TOP) / 8) % 2 ? 8 : 0;
    for (let x = off; x < W; x += 16) px(ctx, x, y, 1, 7, line);
  }
  if (snowy) {
    const r = createRng('snowdrifts');
    for (let i = 0; i < 40; i++) px(ctx, r.int(0, W), r.int(PLAZA_TOP, ROAD_TOP), r.int(3, 9), 1, P.pale);
  }
  if (wet) {
    const r = createRng('puddles:' + plan.date);
    for (let i = 0; i < 9; i++) {
      const x = r.int(10, 300);
      const y = r.int(PLAZA_TOP + 4, ROAD_TOP - 4);
      const w = r.int(8, 22);
      px(ctx, x, y, w, 2, '#6f7f8f');
      if (Math.floor(t * 3 + i) % 4 === 0) px(ctx, x + r.int(1, w - 1), y, 1, 1, P.cyan);
    }
  }
  // kerb and road
  px(ctx, 0, ROAD_TOP - 1, W, 1, P.grey);
  px(ctx, 0, ROAD_TOP, W, ROAD_BOTTOM - ROAD_TOP, wet ? '#2c3040' : P.dark);
  for (let x = (Math.floor(t * 0) % 20); x < W; x += 20) px(ctx, x, 179, 10, 1, snowy ? P.pale : P.white);
  if (snowy) dither(ctx, 0, ROAD_TOP, W, 2, P.white);
}

function drawFountain(ctx: Ctx, cx: number, plan: ScenePlan, t: number, frozenStill: boolean) {
  const snowy = plan.category === 'snow';
  px(ctx, cx - 25, 138, 50, 8, P.stoneShade);
  px(ctx, cx - 24, 137, 48, 1, snowy ? P.white : P.stone);
  px(ctx, cx - 22, 139, 44, 4, snowy ? P.pale : P.blue);
  px(ctx, cx - 22, 139, 44, 1, snowy ? P.white : P.sky);
  px(ctx, cx - 2, 124, 4, 15, P.stoneShade);
  px(ctx, cx - 8, 126, 16, 2, P.stone);
  px(ctx, cx - 6, 128, 12, 1, P.stoneShade);
  px(ctx, cx - 1, 118, 2, 6, P.stone);
  if (frozenStill) return;
  // water jets
  const windy = plan.category === 'wind' ? 6 : 0;
  for (let i = 0; i < 6; i++) {
    const ph = (t * 1.6 + i / 6) % 1;
    const side = i % 2 ? 1 : -1;
    const x = cx + side * (ph * 9) + windy * ph;
    const y = 117 + (ph - 0.35) * (ph - 0.35) * 70 - 8;
    px(ctx, x, y, 1, 1, P.cyan);
  }
  const ph = Math.floor(t * 4) % 2;
  px(ctx, cx - 1 + ph, 115, 1, 3, P.cyan);
}

function drawLion(ctx: Ctx, x: number, facing: 1 | -1, snowy: boolean) {
  // pedestal
  px(ctx, x - 12, 140, 24, 7, P.stone);
  px(ctx, x - 12, 146, 24, 1, P.stoneShade);
  // recumbent lion, original simplified form
  const b = P.bronze;
  px(ctx, x - 9, 135, 16, 5, b);
  px(ctx, x - 10, 138, 3, 2, b);
  const hx = x + facing * 6;
  px(ctx, hx - 3, 131, 7, 7, '#4a4a3a');
  px(ctx, hx - 2, 132, 5, 5, b);
  px(ctx, hx + facing * 2, 134, 1, 1, P.black);
  px(ctx, x + facing * 9, 138, 4, 2, b);
  px(ctx, x - facing * 10, 136, 2, 1, b);
  if (snowy) {
    px(ctx, x - 9, 134, 16, 1, P.white);
    px(ctx, hx - 3, 130, 7, 1, P.white);
    px(ctx, x - 12, 139, 24, 1, P.white);
  }
}

function drawColumn(ctx: Ctx, snowy: boolean) {
  // plinth
  px(ctx, 144, 120, 32, 27, P.stone);
  px(ctx, 144, 120, 32, 2, P.stoneShade);
  px(ctx, 172, 122, 4, 25, P.stoneShade);
  px(ctx, 148, 128, 20, 12, P.bronze);
  px(ctx, 150, 130, 16, 8, '#6a6a56');
  px(ctx, 142, 145, 36, 2, P.stoneShade);
  // shaft with flutes
  px(ctx, 156, 24, 8, 96, P.stone);
  for (let y = 26; y < 120; y += 3) px(ctx, 158, y, 1, 2, P.stoneShade);
  px(ctx, 162, 24, 2, 96, P.stoneShade);
  px(ctx, 154, 116, 12, 4, P.stone);
  // capital
  px(ctx, 153, 20, 14, 4, P.bronze);
  px(ctx, 155, 18, 10, 2, P.bronze);
  // admiral statue (generic figure with a bicorne hat)
  px(ctx, 158, 10, 4, 8, P.stoneShade);
  px(ctx, 157, 12, 1, 4, P.stoneShade);
  px(ctx, 158, 7, 4, 3, P.stoneShade);
  px(ctx, 156, 6, 8, 1, P.stoneDark);
  if (snowy) {
    px(ctx, 156, 5, 8, 1, P.white);
    px(ctx, 153, 19, 14, 1, P.white);
    px(ctx, 144, 119, 32, 1, P.white);
  }
}

function drawBus(ctx: Ctx, plan: ScenePlan, t: number, night: boolean) {
  const { period, offset, direction, route } = plan.bus;
  const cyc = ((t + offset) % period) / 8; // 8 seconds to cross
  if (cyc > 1) return;
  const x = direction === 1 ? -50 + cyc * 420 : 370 - cyc * 420;
  const y = ROAD_BOTTOM - 1;
  const left = Math.round(x);
  px(ctx, left, y - 28, 46, 26, P.red);
  px(ctx, left, y - 14, 46, 1, P.darkRed);
  const label = String(route);
  const boxW = textWidth(label) + 4;
  const boxX = direction === 1 ? left + 44 - boxW : left + 2;
  for (let i = 0; i < 5; i++) {
    const wx = left + 3 + i * 9;
    if (wx + 7 < boxX || wx > boxX + boxW) px(ctx, wx, y - 25, 7, 6, night ? P.yellow : P.navy);
    px(ctx, wx, y - 12, 7, 5, night ? P.yellow : P.navy);
  }
  px(ctx, boxX, y - 27, boxW, 10, P.black);
  drawText(ctx, label, boxX + 2, y - 26, P.yellow);
  const front = direction === 1 ? left + 41 : left + 1;
  const wf = Math.floor(t * 8) % 2;
  for (const wx of [left + 9, left + 36]) {
    px(ctx, wx - 3, y - 3, 7, 3, P.black);
    px(ctx, wx - wf, y - 2, 1, 1, P.grey);
  }
  if (night) px(ctx, front, y - 6, 4, 2, P.white);
}

function drawPigeon(ctx: Ctx, x: number, y: number, t: number, phase: number, still: boolean) {
  const peck = still ? 0 : Math.floor(t * 2 + phase) % 3 === 0 ? 1 : 0;
  const dx = still ? 0 : Math.round(Math.sin((t + phase) * 0.4) * 6);
  px(ctx, x + dx, y - 3, 4, 2, P.grey);
  px(ctx, x + dx + 3, y - 4 + peck, 2, 2, P.slate);
  px(ctx, x + dx + 5, y - 3 + peck, 1, 1, P.orange);
  px(ctx, x + dx + 1, y - 1, 1, 1, P.pink);
  px(ctx, x + dx - 1, y - 3, 1, 1, P.slate);
}

// ------------------------------------------------------------------ people

interface Arms {
  left: 'down' | 'mid' | 'up' | 'out' | 'back' | 'cross';
  right: 'down' | 'mid' | 'up' | 'out' | 'back' | 'cross' | 'high';
}

function armFor(prop: PropId): Arms['right'] | null {
  switch (prop) {
    case 'phone-up':
    case 'umbrella':
    case 'umbrella-inside':
    case 'snowball':
      return 'up';
    case 'phone-high':
    case 'kite':
    case 'bin-bag':
      return 'high';
    case 'cup':
    case 'iced':
    case 'ice-cream':
    case 'fan':
    case 'torch':
      return 'mid';
    default:
      return null;
  }
}

export function drawPerson(
  ctx: Ctx,
  m: CastMember,
  x0: number,
  y0: number,
  anim: Anim,
  frame: number,
  dir0: 1 | -1,
  prop: PropId,
  t: number,
  panic = false,
) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  let dir = dir0;
  let bob = 0;
  let legs = 0;
  const arms: Arms = { left: 'down', right: 'down' };
  let pose: 'stand' | 'sit' | 'lie' = 'stand';
  const a: Anim = panic ? 'react' : anim;
  switch (a) {
    case 'idle':
      bob = frame % 4 === 3 ? 1 : 0;
      break;
    case 'walk':
      legs = frame % 4;
      break;
    case 'jog':
      legs = frame % 4;
      bob = frame % 2 ? -1 : 0;
      arms.left = frame % 2 ? 'mid' : 'down';
      arms.right = frame % 2 ? 'down' : 'mid';
      break;
    case 'activity':
      arms.right = frame % 2 ? 'up' : 'mid';
      break;
    case 'react':
      arms.left = 'up';
      arms.right = 'high';
      bob = frame % 2 ? -2 : 0;
      break;
    case 'sit':
      pose = 'sit';
      break;
    case 'lie':
      pose = 'lie';
      break;
    case 'shiver':
      x += frame % 2;
      arms.left = 'cross';
      arms.right = 'cross';
      break;
    case 'throw':
      arms.right = frame % 4 < 2 ? 'back' : 'up';
      break;
    case 'spin':
      dir = frame % 2 ? 1 : -1;
      arms.left = 'out';
      arms.right = 'out';
      bob = frame % 2 ? -1 : 0;
      break;
    case 'huddle':
      arms.left = 'cross';
      x += frame % 4 === 0 ? 1 : 0;
      break;
  }
  if (!panic) {
    const forced = armFor(prop);
    if (forced && pose === 'stand' && a !== 'react') arms.right = forced;
  }

  const ctxProp: PropContext = {
    x,
    y,
    dir,
    frame,
    t,
    hand: { x: x + dir * 5, y: y - 9 + bob },
    raisedHand: { x: x + dir * 4, y: y - 19 + bob },
  };
  if (arms.right === 'high') ctxProp.raisedHand = { x: x + dir * 4, y: y - 25 + bob };
  if (pose === 'sit') ctxProp.hand = { x: x + dir * 4, y: y - 5 };

  drawPropBehind(ctx, prop, ctxProp);

  const skin = P[m.skin];
  const hair = P[m.hair];
  const top = P[m.top];
  const leg = P[m.legs];
  const shoe = P[m.shoes];

  if (pose === 'lie') {
    // horizontal figure, head towards dir
    px(ctx, x - 9, y - 3, 6, 2, leg);
    px(ctx, x - 10, y - 3, 1, 2, shoe);
    px(ctx, x - 3, y - 4, 7, 3, top);
    px(ctx, x + 4, y - 5, 5, 4, skin);
    px(ctx, x + 8, y - 5, 2, 4, hair);
    px(ctx, x + 6, y - 4, 1, 1, P.black);
    const sweep = frame % 2;
    px(ctx, x - 2, y - 6 - sweep, 1, 2, top);
    px(ctx, x + 2, y - 6 - sweep, 1, 2, top);
    px(ctx, x - 2, y - 1 + sweep, 1, 2, top);
    px(ctx, x + 2, y - 1 + sweep, 1, 2, top);
    if (prop === 'sunglasses') px(ctx, x + 5, y - 4, 2, 1, P.black);
    return;
  }

  const sy = pose === 'sit' ? 5 : 0; // sitting lowers the body
  const by = y + bob + sy;

  // legs and shoes
  if (pose === 'sit') {
    px(ctx, x - 2, y - 3, 5, 2, leg);
    px(ctx, x + dir * 3 - (dir < 0 ? 2 : 0), y - 3, 3, 2, leg);
    px(ctx, x + dir * 5 - (dir < 0 ? 0 : 0), y - 2, 2, 2, shoe);
  } else {
    const lLift = legs === 1 ? 1 : 0;
    const rLift = legs === 3 ? 1 : 0;
    const spread = legs === 0 || legs === 2 ? 1 : 0;
    px(ctx, x - 2 - spread, by - 7, 2, 6 - lLift, leg);
    px(ctx, x + 1 + spread, by - 7, 2, 6 - rLift, leg);
    px(ctx, x - 2 - spread, by - 1 - lLift, 2, 1, shoe);
    px(ctx, x + 1 + spread, by - 1 - rLift, 2, 1, shoe);
  }

  // torso
  px(ctx, x - 3, by - 14, 7, 7, top);
  px(ctx, x - 3, by - 8, 7, 1, shade(m.top));

  // arms
  const drawArm = (side: 1 | -1, kind: string) => {
    const s = side * dir;
    const ax = x + (s > 0 ? 4 : -4);
    switch (kind) {
      case 'down':
        px(ctx, ax, by - 13, 1, 4, top);
        px(ctx, ax, by - 9, 1, 1, skin);
        break;
      case 'mid':
        px(ctx, ax, by - 13, 1, 2, top);
        px(ctx, ax + s, by - 11, 1, 1, top);
        px(ctx, ax + s * 2, by - 10, 1, 1, skin);
        break;
      case 'up':
        px(ctx, ax, by - 17, 1, 4, top);
        px(ctx, ax, by - 18, 1, 1, skin);
        break;
      case 'high':
        px(ctx, ax, by - 23, 1, 10, top);
        px(ctx, ax, by - 24, 1, 1, skin);
        break;
      case 'out':
        px(ctx, ax, by - 13, s > 0 ? 3 : -2, 1, top);
        px(ctx, ax + s * 3, by - 13, 1, 1, skin);
        break;
      case 'back':
        px(ctx, ax, by - 14, 1, 2, top);
        px(ctx, ax - s, by - 16, 1, 2, top);
        px(ctx, ax - s, by - 17, 1, 1, skin);
        break;
      case 'cross':
        px(ctx, x - 2, by - 11, 5, 1, shade(m.top));
        px(ctx, x + s * 2, by - 11, 1, 1, skin);
        break;
    }
  };
  drawArm(-1, arms.left);
  drawArm(1, arms.right);

  // head
  const hy = by - 20;
  px(ctx, x - 2, hy, 5, 5, skin);
  px(ctx, x - 1 + (dir > 0 ? 1 : 0), hy + 2, 1, 1, P.black);
  px(ctx, x + 1 + (dir > 0 ? 1 : 0) - 1, hy + 2, 1, 1, P.black);
  if (panic) px(ctx, x, hy + 4, 1, 1, P.black);
  if (m.glasses) {
    px(ctx, x - 2, hy + 2, 2, 1, P.black);
    px(ctx, x + 1, hy + 2, 2, 1, P.black);
  }
  if (m.beard) {
    px(ctx, x - 2, hy + 3, 5, 2, hair);
    px(ctx, x, hy + 3, 1, 1, skin);
  }
  // hair styles (distinct silhouettes)
  switch (m.hairStyle) {
    case 'bun':
      px(ctx, x - 2, hy - 1, 5, 2, hair);
      px(ctx, x - 1, hy - 4, 3, 3, hair);
      px(ctx, x - 3, hy, 1, 3, hair);
      break;
    case 'beanie':
      px(ctx, x - 3, hy - 2, 7, 3, P.red);
      px(ctx, x - 3, hy, 7, 1, P.darkRed);
      px(ctx, x, hy - 3, 1, 1, P.white);
      break;
    case 'cap':
      px(ctx, x - 2, hy - 2, 5, 2, P.navy);
      px(ctx, x + (dir > 0 ? 3 : -4), hy - 1, 2, 1, P.navy);
      break;
    case 'headphones':
      px(ctx, x - 2, hy - 1, 5, 2, hair);
      px(ctx, x - 3, hy, 1, 6, hair);
      px(ctx, x + 3, hy, 1, 6, hair);
      px(ctx, x - 2, hy - 2, 5, 1, P.black);
      px(ctx, x - 3, hy + 1, 1, 2, P.black);
      px(ctx, x + 3, hy + 1, 1, 2, P.black);
      break;
    case 'headband':
      px(ctx, x - 2, hy - 1, 5, 1, hair);
      px(ctx, x - 2, hy, 5, 1, P.red);
      break;
    case 'curls':
      px(ctx, x - 4, hy - 3, 9, 3, hair);
      px(ctx, x - 4, hy, 2, 5, hair);
      px(ctx, x + 3, hy, 2, 5, hair);
      px(ctx, x - 3, hy - 4, 2, 1, hair);
      px(ctx, x + 2, hy - 4, 2, 1, hair);
      break;
    case 'side-part':
      px(ctx, x - 2, hy - 1, 5, 1, hair);
      px(ctx, x - 3, hy - 1, 3, 2, hair);
      break;
  }

  drawPropFront(ctx, prop, ctxProp);

  if (panic && Math.floor(t * 2.5) % 2 === 0) drawText(ctx, '!', x - 2, hy - 12, P.red, 1);
}

function shade(c: keyof typeof P): string {
  const map: Partial<Record<keyof typeof P, string>> = {
    pink: P.purple, darkGreen: P.ink, orange: P.brown, purple: P.navy, lime: P.green,
    yellow: P.gold, navy: P.ink, red: P.darkRed, blue: P.navy,
  };
  return map[c] ?? P.dark;
}

type Rect = [number, number, number, number];

/** Draws a speech bubble unless it would overlap one already on screen. */
function speechBubble(ctx: Ctx, text: string, x: number, y: number, taken: Rect[]) {
  const lines = wrapText(text, 96);
  const w = Math.max(...lines.map((l) => textWidth(l))) + 6;
  const h = lines.length * 9 + 4;
  const bx = Math.max(2, Math.min(W - w - 2, Math.round(x - w / 2)));
  const by = Math.max(15, y - h - 4);
  const r: Rect = [bx - 2, by - 2, bx + w + 2, by + h + 5];
  if (taken.some((o) => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) return;
  taken.push(r);
  px(ctx, bx, by, w, h, P.white);
  px(ctx, bx, by + h, w, 1, P.grey);
  px(ctx, Math.max(bx + 2, Math.min(bx + w - 3, x)), by + h, 2, 3, P.white);
  lines.forEach((l, i) => drawText(ctx, l, bx + 3, by + 3 + i * 9, P.ink));
}

function characterPosition(c: PlacedCharacter, t: number, still: boolean): { x: number; dir: 1 | -1 } {
  const anim = c.activity.anim;
  if (still || (anim !== 'walk' && anim !== 'jog')) return { x: c.x, dir: c.dir };
  const speed = anim === 'jog' ? 14 : 7;
  const lo = Math.max(c.range[0], c.x - 36);
  const hi = Math.min(c.range[1], c.x + 36);
  const span = Math.max(1, hi - lo);
  const d = (t + c.phase) * speed + (c.x - lo);
  const m = d % (2 * span);
  return m < span ? { x: lo + m, dir: 1 } : { x: hi - (m - span), dir: -1 };
}

// ------------------------------------------------------------------ weather

function drawWeather(ctx: Ctx, plan: ScenePlan, t: number, still: boolean) {
  const c = plan.category;
  const tt = still ? 3.7 : t;
  if (c === 'light-rain' || c === 'heavy-rain' || c === 'thunder' || c === 'sleet-hail') {
    const n = c === 'light-rain' ? 70 : 160;
    const r = createRng('rain');
    ctx.fillStyle = c === 'sleet-hail' ? P.pale : '#9fb4d8';
    for (let i = 0; i < n; i++) {
      const sx = r.int(0, W + 40);
      const sp = 140 + r.int(0, 80);
      const y = (r.int(0, H) + tt * sp) % (ROAD_BOTTOM + 10);
      const x = (sx - y * 0.25 + 400) % (W + 20) - 10;
      ctx.fillRect(Math.round(x), Math.round(y), 1, c === 'light-rain' ? 3 : 4);
    }
  }
  if (c === 'snow' || c === 'sleet-hail') {
    const n = c === 'snow' ? 140 : 40;
    const r = createRng('snow');
    for (let i = 0; i < n; i++) {
      const sx = r.int(0, W);
      const sp = 14 + r.int(0, 22);
      const size = r.chance(0.25) ? 2 : 1;
      const y = (r.int(0, H) + tt * sp) % (ROAD_BOTTOM + 4);
      const x = (sx + Math.sin(tt * 1.3 + i) * 4 + W) % W;
      px(ctx, x, y, size, size, P.white);
    }
  }
  if (c === 'wind') {
    const r = createRng('wind');
    for (let i = 0; i < 18; i++) {
      const y = r.int(10, 170);
      const len = r.int(8, 24);
      const x = (r.int(0, W) + tt * (180 + r.int(0, 120))) % (W + 60) - 30;
      px(ctx, x, y, len, 1, 'rgba(240,240,255,0.55)');
    }
    for (let i = 0; i < 6; i++) {
      const x = (r.int(0, W) + tt * 90) % (W + 20) - 10;
      const y = r.int(110, 170) + Math.sin(tt * 4 + i) * 4;
      px(ctx, x, y, 2, 1, i % 2 ? P.orange : P.gold);
    }
  }
  if (c === 'fog') {
    for (let i = 0; i < 6; i++) {
      const y = 40 + i * 24;
      const off = Math.round((tt * (4 + i)) % 40);
      ctx.fillStyle = 'rgba(214,216,220,0.38)';
      ctx.fillRect(0, y, W, 18);
      dither(ctx, 0, y - 2, W, 2, 'rgba(214,216,220,0.5)', off);
    }
  }
  if (c === 'sunny' && plan.variant === 'hot' && !still) {
    for (let y = PLAZA_TOP; y < ROAD_TOP; y += 6) {
      const off = Math.round(Math.sin(tt * 3 + y) * 1);
      if (off) px(ctx, 0, y, W, 1, 'rgba(255,230,180,0.18)');
    }
  }
}

function lightning(plan: ScenePlan, t: number, reduced: boolean): boolean {
  if (plan.category !== 'thunder') return false;
  if (reduced) return false;
  // at most one 150 ms flash every 6 seconds (well under 3 flashes per second)
  return (t + plan.bus.offset) % 6 < 0.15;
}

// ------------------------------------------------------------------ main entry

export function renderScene(ctx: Ctx, o: RenderOptions) {
  const { plan, night } = o;
  const still = o.reducedMotion;
  const t = still ? 0 : o.t;
  const snowy = plan.category === 'snow';
  const wet = ['light-rain', 'heavy-rain', 'thunder', 'sleet-hail'].includes(plan.category);

  drawSky(ctx, SKIES[skyKey(plan, night)]);
  if (night && (plan.category === 'sunny' || plan.category === 'partly-cloudy')) {
    const r = createRng('stars');
    for (let i = 0; i < 40; i++) px(ctx, r.int(0, W), r.int(0, 56), 1, 1, i % 7 === 0 ? P.yellow : P.white);
    px(ctx, 262, 16, 8, 8, P.pale);
    px(ctx, 265, 16, 5, 6, SKIES.night[1]);
  } else if (plan.category === 'sunny' && !night) {
    const sx = 226;
    px(ctx, sx - 5, 14, 10, 10, P.yellow);
    px(ctx, sx - 6, 16, 12, 6, P.yellow);
    px(ctx, sx - 3, 12, 6, 14, P.yellow);
    if (plan.variant === 'hot' && Math.floor(t * 2) % 2) px(ctx, sx - 9, 18, 18, 2, P.orange);
  }

  // clouds
  const cloudy: Record<string, [number, string, string]> = {
    'partly-cloudy': [1, P.white, P.pale],
    overcast: [3, P.pale, P.grey],
    wind: [2, P.pale, P.grey],
    'light-rain': [3, P.grey, P.slate],
    'heavy-rain': [4, P.slate, P.dark],
    thunder: [4, P.dark, P.ink],
    snow: [3, P.pale, P.grey],
    'sleet-hail': [3, P.grey, P.slate],
    unknown: [2, P.grey, P.slate],
    sunny: [plan.variant === 'cold-bright' ? 1 : 0, P.white, P.pale],
    fog: [0, P.pale, P.grey],
  };
  const [mult, cc, cs] = cloudy[plan.category] ?? [1, P.white, P.pale];
  for (let k = 0; k < mult; k++) {
    for (const cl of plan.clouds) {
      const speed = plan.category === 'wind' ? cl.speed * 6 : cl.speed;
      const x = ((cl.x + k * 90 + t * speed) % (W + 120)) - 60;
      drawCloud(ctx, Math.round(x), cl.y + k * 6, cl.w + k * 8, night ? P.dark : cc, night ? P.ink : cs);
    }
  }

  drawGallery(ctx, night, snowy, t);
  drawSteps(ctx, wet, snowy);
  drawPlaza(ctx, plan, t);

  // depth-sorted scenery and characters
  type Item = { y: number; draw: () => void };
  const items: Item[] = [
    { y: 146, draw: () => drawFountain(ctx, 70, plan, t, still) },
    { y: 146, draw: () => drawFountain(ctx, 250, plan, t, still) },
    { y: 146.5, draw: () => drawColumn(ctx, snowy) },
    { y: 147, draw: () => drawLion(ctx, 124, -1, snowy) },
    { y: 147, draw: () => drawLion(ctx, 196, 1, snowy) },
  ];
  for (const pg of plan.pigeons) items.push({ y: pg.y, draw: () => drawPigeon(ctx, pg.x, pg.y, t, pg.phase, still) });
  if (plan.extras.busker && !wet && plan.category !== 'thunder') {
    items.push({
      y: 101,
      draw: () => {
        px(ctx, 120, 92, 3, 7, P.purple);
        px(ctx, 120, 89, 3, 3, P.skin2);
        px(ctx, 123, 94, 4, 3, P.wood);
        if (!still && Math.floor(t * 2) % 2) drawText(ctx, '♥', 124, 80, P.pink);
      },
    });
  }
  const bubbles: Array<(taken: Rect[]) => void> = [];
  for (const c of plan.characters) {
    const pos = characterPosition(c, t, still);
    const fps = c.activity.anim === 'jog' ? 7 : o.panic ? 6 : 4;
    const frame = still ? 0 : Math.floor((t + c.phase) * fps) % 4;
    const prop: PropId = c.activity.prop ?? c.member.signatureProp;
    items.push({
      y: c.y,
      draw: () => drawPerson(ctx, c.member, pos.x, c.y, c.activity.anim, frame, pos.dir, prop, t + c.phase, o.panic),
    });
    const bt = (t + c.bubbleOffset) % c.bubbleEvery;
    if (!still && !o.panic && bt < 2.6 && c.activity.bubble) {
      const text = Math.floor((t + c.bubbleOffset) / c.bubbleEvery) % 3 === 2 ? c.member.catchphrases[Math.floor(t / 7) % c.member.catchphrases.length] : c.activity.bubble;
      bubbles.push((taken) => speechBubble(ctx, text, Math.round(pos.x), c.y - 26, taken));
    }
  }
  items.sort((a, b) => a.y - b.y).forEach((i) => i.draw());
  drawBus(ctx, plan, t, night);

  if (plan.extras.balloon && !still) {
    const by = 90 - ((t * 6) % 120);
    px(ctx, plan.extras.balloonX, by, 4, 5, P.red);
    px(ctx, plan.extras.balloonX + 2, by + 5, 1, 4, P.grey);
  }

  if (night) {
    ctx.fillStyle = 'rgba(8,10,40,0.45)';
    ctx.fillRect(0, 0, W, ROAD_BOTTOM);
    // street lamps
    for (const lx of [20, 110, 210, 300]) {
      px(ctx, lx, 150, 1, 20, P.ink);
      px(ctx, lx - 1, 148, 3, 2, P.yellow);
      ctx.fillStyle = 'rgba(255,205,117,0.18)';
      ctx.fillRect(lx - 8, 150, 17, 22);
    }
  }

  drawWeather(ctx, plan, t, still);
  if (lightning(plan, t, o.reducedMotion)) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(0, 0, W, ROAD_BOTTOM);
    const r = createRng('bolt' + Math.floor(t / 6));
    let bx = r.int(40, 280);
    for (let y = 0; y < 60; y += 6) {
      const nx = bx + r.int(-5, 6);
      px(ctx, Math.min(bx, nx), y, Math.abs(nx - bx) + 1, 6, P.yellow);
      bx = nx;
    }
  } else if (plan.category === 'thunder' && o.reducedMotion) {
    px(ctx, 230, 8, 2, 8, P.yellow);
    px(ctx, 228, 16, 3, 2, P.yellow);
    px(ctx, 227, 18, 2, 8, P.yellow);
  }

  const taken: Rect[] = [];
  bubbles.forEach((b) => b(taken));

  // HUD chip (top-left) and ticker (bottom)
  if (o.hud) {
    const s = `${o.hud.temperature}  ${o.hud.condition}  ${o.hud.time}`.toUpperCase();
    const w = textWidth(s) + 6;
    ctx.fillStyle = 'rgba(11,11,20,0.75)';
    ctx.fillRect(2, 2, w, 11);
    drawText(ctx, s, 5, 4, P.yellow);
  }
  if (o.ticker !== false) {
    px(ctx, 0, ROAD_BOTTOM, W, H - ROAD_BOTTOM, P.black);
    const msgs = plan.characters.map((c) => `${c.text}.`.toUpperCase());
    const idx = Math.floor(t / 6) % msgs.length;
    const msg = msgs[idx];
    const mw = textWidth(msg);
    const xx = mw <= W - 8 || still ? 4 : 4 - Math.min(mw - (W - 8), ((t % 6) / 6) * (mw - W + 60));
    drawText(ctx, msg, xx, ROAD_BOTTOM + 3, P.cyan);
  }

  if (o.preview) {
    drawText(ctx, 'PREVIEW', W - 4, 4, P.red, 2, { align: 'right', shadow: P.black });
    drawText(ctx, 'SAMPLE DATA - NOT REAL WEATHER', W / 2, 172, P.yellow, 1, { align: 'centre', shadow: P.black });
  }
}
