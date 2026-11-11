// Small hand-held and nearby props, drawn as tiny pixel art relative to a person.
import { P } from './palette';

export type PropId =
  | 'none'
  | 'phone-up'
  | 'phone-high'
  | 'cup'
  | 'iced'
  | 'bike'
  | 'tote'
  | 'watch'
  | 'umbrella'
  | 'umbrella-inside'
  | 'frisbee'
  | 'kite'
  | 'snowball'
  | 'tray'
  | 'hat-flying'
  | 'torch'
  | 'blanket'
  | 'sunglasses'
  | 'scarf'
  | 'laptop'
  | 'ice-cream'
  | 'bag-escaping'
  | 'fan'
  | 'bin-bag';

type Ctx = CanvasRenderingContext2D;

export function px(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

export function ring(ctx: Ctx, cx: number, cy: number, r: number, c: string) {
  ctx.fillStyle = c;
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    ctx.fillRect(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r), 1, 1);
  }
}

export interface PropContext {
  /** Feet position */
  x: number;
  y: number;
  /** 1 = facing right, -1 = facing left */
  dir: 1 | -1;
  frame: number;
  /** Hand positions */
  hand: { x: number; y: number };
  raisedHand: { x: number; y: number };
  t: number;
}

/** Props drawn BEHIND the person (bike, blanket, tray, kite string anchor). */
export function drawPropBehind(ctx: Ctx, id: PropId, c: PropContext) {
  const { x, y, dir } = c;
  switch (id) {
    case 'bike': {
      const bx = x + dir * 7;
      ring(ctx, bx - 5, y - 3, 3, P.black);
      ring(ctx, bx + 5, y - 3, 3, P.black);
      px(ctx, bx - 5, y - 7, 10, 1, P.cyan);
      px(ctx, bx - 4, y - 6, 1, 3, P.cyan);
      px(ctx, bx + 3, y - 6, 1, 3, P.cyan);
      px(ctx, bx + dir * 4, y - 9, 1, 2, P.black);
      px(ctx, bx - dir * 3, y - 8, 3, 1, P.black);
      break;
    }
    case 'blanket':
      for (let i = 0; i < 14; i++) px(ctx, x - 7 + i, y - 1, 1, 2, i % 2 ? P.red : P.white);
      break;
    case 'tray':
      px(ctx, x - 6, y - 1, 12, 2, P.red);
      px(ctx, x - 7, y - 2, 1, 2, P.red);
      break;
  }
}

/** Props drawn IN FRONT of the person. */
export function drawPropFront(ctx: Ctx, id: PropId, c: PropContext) {
  const { x, y, dir, frame, hand, raisedHand, t } = c;
  switch (id) {
    case 'phone-up':
      px(ctx, raisedHand.x - 1, raisedHand.y - 3, 2, 3, P.black);
      if (Math.floor(t * 2) % 2 === 0) px(ctx, raisedHand.x, raisedHand.y - 4, 1, 1, P.red);
      break;
    case 'phone-high': {
      px(ctx, raisedHand.x - 1, raisedHand.y - 4, 2, 3, P.black);
      const bars = Math.floor(t * 1.5) % 4;
      for (let i = 0; i < bars; i++) px(ctx, raisedHand.x + 2 + i * 2, raisedHand.y - 5 - i, 1, 1 + i, P.lime);
      break;
    }
    case 'cup':
      px(ctx, hand.x - 1, hand.y - 3, 3, 3, P.white);
      px(ctx, hand.x - 1, hand.y - 4, 3, 1, P.brown);
      if (frame % 2 === 0) px(ctx, hand.x, hand.y - 6, 1, 1, P.pale);
      break;
    case 'iced':
      px(ctx, hand.x - 1, hand.y - 4, 3, 4, P.cyan);
      px(ctx, hand.x - 1, hand.y - 2, 3, 2, P.wood);
      px(ctx, hand.x + 1, hand.y - 6, 1, 2, P.red);
      break;
    case 'tote':
      px(ctx, x - dir * 4 - 2, y - 11, 4, 5, P.sand);
      px(ctx, x - dir * 4 - 1, y - 14, 1, 3, P.wood);
      px(ctx, x - dir * 4, y - 15, 1, 4, P.gold);
      break;
    case 'watch':
      px(ctx, hand.x, hand.y - 1, 1, 1, P.lime);
      break;
    case 'umbrella':
    case 'umbrella-inside': {
      const ux = x + dir;
      const top = y - 26;
      px(ctx, ux, top, 1, 10, P.black);
      if (id === 'umbrella') {
        px(ctx, ux - 6, top, 13, 1, P.navy);
        px(ctx, ux - 5, top - 1, 11, 1, P.navy);
        px(ctx, ux - 3, top - 2, 7, 1, P.blue);
      } else {
        const f = frame % 2;
        px(ctx, ux - 6, top - 3 - f, 2, 2, P.navy);
        px(ctx, ux - 4, top - 1 - f, 2, 2, P.navy);
        px(ctx, ux - 2, top, 5, 1, P.blue);
        px(ctx, ux + 3, top - 1 + f, 2, 2, P.navy);
        px(ctx, ux + 5, top - 3 + f, 2, 2, P.navy);
      }
      break;
    }
    case 'frisbee': {
      const fx = x + dir * (8 + Math.round(Math.sin(t * 2) * 10));
      const fy = y - 18 - Math.round(Math.abs(Math.sin(t * 2)) * 6);
      px(ctx, fx - 2, fy, 5, 1, P.orange);
      px(ctx, fx - 1, fy - 1, 3, 1, P.yellow);
      break;
    }
    case 'kite': {
      const kx = x + dir * 10;
      const ky = y - 40 + (frame % 2) * 3 + Math.round(Math.sin(t) * 2);
      for (let i = 0; i < 8; i++) px(ctx, raisedHand.x + ((kx - raisedHand.x) * i) / 8, raisedHand.y + ((ky - raisedHand.y) * i) / 8, 1, 1, P.pale);
      px(ctx, kx - 1, ky - 3, 3, 1, P.red);
      px(ctx, kx - 2, ky - 2, 5, 2, P.yellow);
      px(ctx, kx - 1, ky, 3, 1, P.red);
      px(ctx, kx, ky + 1, 1, 3, P.white);
      break;
    }
    case 'snowball':
      px(ctx, raisedHand.x - 1, raisedHand.y - 2, 2, 2, P.white);
      if (frame % 4 >= 2) px(ctx, raisedHand.x + dir * (6 + (frame % 2) * 6), raisedHand.y - 4, 2, 2, P.white);
      break;
    case 'hat-flying': {
      const hx = x + dir * (6 + ((t * 20) % 40));
      const hy = y - 24 - Math.round(Math.sin(t * 4) * 3);
      px(ctx, hx - 2, hy, 5, 1, P.ink);
      px(ctx, hx - 1, hy - 2, 3, 2, P.ink);
      break;
    }
    case 'torch':
      ctx.fillStyle = 'rgba(255,240,180,0.35)';
      ctx.beginPath();
      ctx.moveTo(hand.x, hand.y - 1);
      ctx.lineTo(hand.x + dir * 22, hand.y - 9);
      ctx.lineTo(hand.x + dir * 22, hand.y + 5);
      ctx.fill();
      px(ctx, hand.x - 1, hand.y - 2, 2, 2, P.black);
      break;
    case 'sunglasses':
      px(ctx, x - 2, y - 18, 5, 1, P.black);
      break;
    case 'scarf':
      px(ctx, x - 2, y - 15, 5, 1, P.red);
      px(ctx, x + dir * 2, y - 14, 1, 3 + (frame % 2), P.red);
      break;
    case 'laptop':
      px(ctx, x + dir * 2 - 2, y - 5, 5, 1, P.grey);
      px(ctx, x + dir * 2 - 2, y - 9, 1, 4, P.grey);
      if (frame % 2) px(ctx, x + dir * 2 - 1, y - 8, 1, 2, P.cyan);
      break;
    case 'ice-cream':
      px(ctx, hand.x - 1, hand.y - 4, 3, 2, P.pink);
      px(ctx, hand.x, hand.y - 2, 1, 3, P.wood);
      break;
    case 'bag-escaping': {
      const bx = x - dir * (6 + ((t * 18) % 36));
      const by = y - 14 - Math.round(Math.abs(Math.sin(t * 3)) * 8);
      px(ctx, bx - 2, by, 4, 4, P.sand);
      px(ctx, bx - 1, by - 2, 1, 2, P.wood);
      break;
    }
    case 'fan':
      px(ctx, hand.x - 1, hand.y - 4, 3, 3, frame % 2 ? P.pink : P.cyan);
      break;
    case 'bin-bag':
      px(ctx, raisedHand.x - 3, raisedHand.y - 9, 7, 2, P.black);
      px(ctx, raisedHand.x, raisedHand.y - 7, 1, 7, P.black);
      break;
  }
}
