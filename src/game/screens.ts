// Full-screen special states. Flashing is kept to at most 2 colour changes per
// second (well under the 3-flashes-per-second photosensitivity limit), and every
// screen has a static version for prefers-reduced-motion.
import { P } from './palette';
import { drawText, textWidth } from './font';
import { px } from './props';
import { drawPerson } from './renderer';
import { CAST } from './cast';
import { W, H } from './scene';
import { createRng } from '../lib/rng';

type Ctx = CanvasRenderingContext2D;

export type SpecialScreen = 'snow-day' | 'sleet' | 'unconfirmed' | 'possible-snow' | 'hail' | 'signal-lost' | 'station-mismatch';

export interface ScreenOptions {
  t: number;
  reducedMotion: boolean;
  date: string;
  snowCount: number;
  message?: string;
  /** Short extra line, e.g. where snow was confirmed. */
  note?: string;
  preview?: boolean;
}

const CYCLE = [P.white, P.cyan, P.yellow, P.pink, P.lime, P.orange];

function cycleColour(t: number, reduced: boolean, offset = 0): string {
  if (reduced) return CYCLE[offset % CYCLE.length];
  return CYCLE[(Math.floor(t * 2) + offset) % CYCLE.length]; // 2 changes per second
}

function snowfall(ctx: Ctx, t: number, n: number, reduced: boolean) {
  const r = createRng('alert-snow');
  for (let i = 0; i < n; i++) {
    const sx = r.int(0, W);
    const sp = 18 + r.int(0, 30);
    const s = r.chance(0.3) ? 2 : 1;
    const y = reduced ? r.int(0, H) : (r.int(0, H) + t * sp) % H;
    const x = reduced ? sx : (sx + Math.sin(t + i) * 5 + W) % W;
    px(ctx, x, y, s, s, P.white);
  }
}

function bigWord(ctx: Ctx, text: string, y: number, scale: number, colour: string, shadow: string = P.ink) {
  drawText(ctx, text, W / 2, y, colour, scale, { align: 'centre', shadow });
}

function cast(ctx: Ctx, t: number, reduced: boolean, panic: boolean, y = 176, anim: 'react' | 'shiver' | 'idle' = 'react') {
  CAST.forEach((m, i) => {
    const x = 40 + i * 40;
    const frame = reduced ? 0 : Math.floor((t + i * 0.3) * 6) % 4;
    drawPerson(ctx, m, x, y, anim, frame, i % 2 ? -1 : 1, panic ? 'none' : m.signatureProp, t, panic && !reduced);
  });
}

function pressStart(ctx: Ctx, t: number, reduced: boolean, y: number, label = 'PRESS START') {
  if (reduced || Math.floor(t * 1.5) % 2 === 0) drawText(ctx, label, W / 2, y, P.white, 1, { align: 'centre', shadow: P.black });
}

export function renderSnowDay(ctx: Ctx, o: ScreenOptions) {
  const r = o.reducedMotion;
  const shakeX = r ? 0 : Math.round(Math.sin(o.t * 37) * 2);
  const shakeY = r ? 0 : Math.round(Math.cos(o.t * 29) * 2);
  ctx.save();
  ctx.translate(shakeX, shakeY);
  px(ctx, -4, -4, W + 8, H + 8, P.navy);
  // checker floor
  for (let y = 150; y < H + 4; y += 6) for (let x = -4 + ((y / 6) % 2) * 6; x < W + 4; x += 12) px(ctx, x, y, 6, 6, P.blue);
  snowfall(ctx, o.t, 160, r);
  bigWord(ctx, 'SNOW DAY', 14, 4, cycleColour(o.t, r, 0));
  bigWord(ctx, 'SNOW DAY', 50, 4, cycleColour(o.t, r, 2));
  bigWord(ctx, 'SNOW DAY!', 86, 4, cycleColour(o.t, r, 4));
  // HIGH SCORE banner
  px(ctx, 40, 122, 240, 22, P.black);
  px(ctx, 40, 122, 240, 1, P.gold);
  px(ctx, 40, 143, 240, 1, P.gold);
  drawText(ctx, `HIGH SCORE  ${o.date}`, W / 2, 125, P.gold, 1, { align: 'centre' });
  drawText(ctx, `SNOW DAYS RECORDED: ${String(o.snowCount).padStart(3, '0')}`, W / 2, 135, P.white, 1, { align: 'centre' });
  if (o.note) drawText(ctx, o.note.toUpperCase(), W / 2, 148, P.cyan, 1, { align: 'centre', shadow: P.black });
  cast(ctx, o.t, r, true, 178);
  pressStart(ctx, o.t, r, 188);
  ctx.restore();
  if (o.preview) drawText(ctx, 'PREVIEW', W - 4, 4, P.red, 2, { align: 'right', shadow: P.black });
}

export function renderSleet(ctx: Ctx, o: ScreenOptions) {
  const r = o.reducedMotion;
  px(ctx, 0, 0, W, H, '#4a5262');
  const rng = createRng('sleet');
  for (let i = 0; i < 90; i++) {
    const x = rng.int(0, W);
    const y = r ? rng.int(0, H) : (rng.int(0, H) + o.t * (60 + rng.int(0, 40))) % H;
    px(ctx, x - y * 0.1 + 20, y, 1, 3, i % 3 ? P.pale : P.white);
  }
  px(ctx, 0, 150, W, 50, '#7c8494');
  for (let i = 0; i < 12; i++) px(ctx, rng.int(0, W), rng.int(152, 198), rng.int(6, 20), 2, '#9aa2b0');
  bigWord(ctx, 'SO CLOSE.', 28, 4, P.white);
  bigWord(ctx, 'IT WAS SLEET.', 70, 2, P.cyan);
  drawText(ctx, 'NEAR MISS RECORDED. NO SNOW DAY.', W / 2, 96, P.yellow, 1, { align: 'centre' });
  drawText(ctx, o.date, W / 2, 108, P.pale, 1, { align: 'centre' });
  cast(ctx, o.t, r, false, 176, 'shiver');
  pressStart(ctx, o.t, r, 188, 'PRESS START TO SULK');
  if (o.preview) drawText(ctx, 'PREVIEW', W - 4, 4, P.red, 2, { align: 'right', shadow: P.black });
}

export function renderHail(ctx: Ctx, o: ScreenOptions) {
  const r = o.reducedMotion;
  px(ctx, 0, 0, W, H, P.dark);
  const rng = createRng('hail');
  for (let i = 0; i < 70; i++) {
    const x = rng.int(0, W);
    const sp = 120 + rng.int(0, 60);
    let y = r ? rng.int(0, 150) : (rng.int(0, 200) + o.t * sp) % 200;
    if (y > 150) y = 150 - (y - 150) * 0.6; // bounce
    px(ctx, x, y, 2, 2, P.white);
  }
  px(ctx, 0, 152, W, 48, P.slate);
  bigWord(ctx, 'HAIL IS', 24, 3, P.white);
  bigWord(ctx, 'NOT SNOW', 52, 3, P.orange);
  drawText(ctx, 'NICE TRY, SKY.', W / 2, 86, P.cyan, 1, { align: 'centre' });
  drawText(ctx, `${o.date}: HAIL REPORTED. NO SNOW DAY.`, W / 2, 100, P.pale, 1, { align: 'centre' });
  cast(ctx, o.t, r, false, 176, 'shiver');
  pressStart(ctx, o.t, r, 188, 'PRESS START (OUCH)');
  if (o.preview) drawText(ctx, 'PREVIEW', W - 4, 4, P.red, 2, { align: 'right', shadow: P.black });
}

export function renderUnconfirmed(ctx: Ctx, o: ScreenOptions, possible: boolean) {
  const r = o.reducedMotion;
  px(ctx, 0, 0, W, H, P.black);
  for (let y = 0; y < H; y += 2) px(ctx, 0, y, W, 1, '#10121e');
  if (possible) snowfall(ctx, o.t, 30, r);
  // coin slot
  px(ctx, 140, 96, 40, 34, P.dark);
  px(ctx, 142, 98, 36, 30, P.ink);
  px(ctx, 158, 104, 4, 16, P.black);
  px(ctx, 157, 103, 6, 1, P.grey);
  const glow = r || Math.floor(o.t * 1.5) % 2 === 0;
  drawText(ctx, '£1', 160, 122, glow ? P.yellow : P.gold, 1, { align: 'centre' });
  if (possible) {
    bigWord(ctx, 'POSSIBLE SNOW', 18, 2, P.white);
    bigWord(ctx, 'AWAITING', 42, 2, P.cyan);
    bigWord(ctx, 'CONFIRMATION', 60, 2, P.cyan);
    drawText(ctx, 'PRECIPITATION AT 2°C OR BELOW, BUT NO WEATHER CODE.', W / 2, 82, P.pale, 1, { align: 'centre' });
  } else {
    bigWord(ctx, 'UNCONFIRMED', 22, 3, P.yellow);
    if (o.note) {
      drawText(ctx, o.note.toUpperCase(), W / 2, 60, P.cyan, 1, { align: 'centre' });
      drawText(ctx, 'BUT NOT CONFIRMED IN CENTRAL LONDON.', W / 2, 72, P.pale, 1, { align: 'centre' });
    } else {
      drawText(ctx, 'SNOW COULD NOT BE RULED OUT.', W / 2, 60, P.pale, 1, { align: 'centre' });
      drawText(ctx, 'NO SNOW DAY DECLARED WITHOUT PROOF.', W / 2, 72, P.pale, 1, { align: 'centre' });
    }
  }
  drawText(ctx, o.date, W / 2, 140, P.grey, 1, { align: 'centre' });
  if (glow) drawText(ctx, 'INSERT COIN TO CONFIRM SNOW', W / 2, 154, P.white, 1, { align: 'centre' });
  cast(ctx, o.t, r, false, 186, 'idle');
  if (o.preview) drawText(ctx, 'PREVIEW', W - 4, 4, P.red, 2, { align: 'right', shadow: P.black });
}

export function renderSignalLost(ctx: Ctx, o: ScreenOptions, mismatch = false) {
  const r = o.reducedMotion;
  const rng = createRng(r ? 'static' : 'static' + Math.floor(o.t * 8));
  px(ctx, 0, 0, W, H, P.ink);
  for (let i = 0; i < 1800; i++) {
    const v = rng.int(0, 4);
    px(ctx, rng.int(0, W), rng.int(0, H), rng.int(1, 4), 1, [P.dark, P.slate, P.grey, P.ink][v]);
  }
  px(ctx, 30, 60, 260, 80, P.black);
  px(ctx, 30, 60, 260, 1, P.red);
  px(ctx, 30, 139, 260, 1, P.red);
  bigWord(ctx, mismatch ? 'WRONG STATION' : 'SIGNAL LOST', 70, 3, P.red, P.black);
  const msg = (o.message ?? (mismatch ? 'STATION CHECK FAILED. NO VERDICT PUBLISHED.' : 'OBSERVATIONS ARE LATE OR MISSING.')).toUpperCase();
  const words = msg.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (textWidth(line + ' ' + w) > 240 && line) {
      lines.push(line);
      line = w;
    } else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  lines.slice(0, 4).forEach((l, i) => drawText(ctx, l, W / 2, 100 + i * 9, P.white, 1, { align: 'centre' }));
  drawText(ctx, 'NO GUESSING. PLEASE STAND BY.', W / 2, 150, P.yellow, 1, { align: 'centre', shadow: P.black });
  if (o.preview) drawText(ctx, 'PREVIEW', W - 4, 4, P.red, 2, { align: 'right', shadow: P.black });
}

export function renderSpecial(ctx: Ctx, which: SpecialScreen, o: ScreenOptions) {
  switch (which) {
    case 'snow-day':
      return renderSnowDay(ctx, o);
    case 'sleet':
      return renderSleet(ctx, o);
    case 'hail':
      return renderHail(ctx, o);
    case 'unconfirmed':
      return renderUnconfirmed(ctx, o, false);
    case 'possible-snow':
      return renderUnconfirmed(ctx, o, true);
    case 'signal-lost':
      return renderSignalLost(ctx, o, false);
    case 'station-mismatch':
      return renderSignalLost(ctx, o, true);
  }
}
