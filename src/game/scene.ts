// Deterministic scene planner: the same date (and weather) always produces the same
// arrangement of characters, activities, positions and background extras.
import type { SceneCategory, SceneVariant } from '../lib/types';
import { createRng, hashString } from '../lib/rng';
import { CAST, NAMES, type CastMember } from './cast';
import { ACTIVITIES, VARIANT_EXTRAS, type Activity, type Zone } from './activities';

export const W = 320;
export const H = 200;

/** Feet-position rectangles for each zone: [x0, x1, y0, y1]. */
export const ZONES: Record<Zone, Array<[number, number, number, number]>> = {
  steps: [[30, 125, 104, 109], [195, 290, 104, 109]],
  portico: [[134, 186, 99, 102]],
  'fountain-left': [[44, 96, 150, 153]],
  'fountain-right': [[224, 276, 150, 153]],
  lions: [[118, 128, 147, 151], [192, 202, 147, 151]],
  plaza: [[20, 130, 116, 134], [190, 300, 116, 134]],
  'plaza-front': [[16, 304, 157, 168]],
  column: [[138, 182, 152, 155]],
};

export interface PlacedCharacter {
  member: CastMember;
  /** Today's name for this character (names rotate daily). */
  name: string;
  activity: Activity;
  text: string;
  x: number;
  y: number;
  dir: 1 | -1;
  /** Animation phase offset in seconds so characters are not in lock-step. */
  phase: number;
  /** For walking/jogging: horizontal range to pace within. */
  range: [number, number];
  /** Seconds between speech bubbles, and offset. */
  bubbleEvery: number;
  bubbleOffset: number;
}

export interface ScenePlan {
  date: string;
  category: SceneCategory;
  variant: SceneVariant;
  characters: PlacedCharacter[];
  pigeons: Array<{ x: number; y: number; phase: number }>;
  bus: { period: number; offset: number; direction: 1 | -1; route: number };
  clouds: Array<{ x: number; y: number; w: number; speed: number }>;
  extras: { busker: boolean; balloon: boolean; balloonX: number };
}

export function activitiesFor(category: SceneCategory, variant: SceneVariant): Activity[] {
  return [...ACTIVITIES[category], ...(category === 'sunny' ? VARIANT_EXTRAS[variant] ?? [] : [])];
}

export function planScene(date: string, category: SceneCategory, variant: SceneVariant = 'normal'): ScenePlan {
  const rng = createRng(`snow-watch:${date}:${category}:${variant}`);
  const table = rng.shuffle(activitiesFor(category, variant));
  const order = rng.shuffle(CAST);
  // Names rotate by one place each day, keyed on the date alone.
  const shift = dayNumber(date);
  const nameOf = (m: CastMember) => NAMES[(CAST.indexOf(m) + shift) % NAMES.length];
  const placed: PlacedCharacter[] = [];

  order.forEach((member, i) => {
    const activity = table[i % table.length];
    const rects = ZONES[activity.zone];
    let x = 0;
    let y = 0;
    let rect = rects[0];
    for (let attempt = 0; attempt < 12; attempt++) {
      rect = rng.pick(rects);
      x = rng.int(rect[0], rect[1] + 1);
      y = rng.int(rect[2], rect[3] + 1);
      if (placed.every((p) => Math.abs(p.x - x) > 14 || Math.abs(p.y - y) > 6)) break;
    }
    placed.push({
      member,
      name: nameOf(member),
      activity,
      text: activity.text.replace('{n}', nameOf(member)),
      x,
      y,
      dir: rng.chance(0.5) ? 1 : -1,
      phase: rng.next() * 4,
      range: [rect[0], rect[1]],
      bubbleEvery: 6 + rng.int(0, 6),
      bubbleOffset: rng.next() * 10,
    });
  });

  const pigeons = Array.from({ length: 3 + rng.int(0, 6) }, () => ({
    x: rng.int(20, 300),
    y: rng.int(114, 170),
    phase: rng.next() * 6,
  }));
  const clouds = Array.from({ length: 2 + rng.int(0, 4) }, () => ({
    x: rng.int(-40, 320),
    y: rng.int(14, 44),
    w: rng.int(20, 50),
    speed: 1 + rng.next() * 3,
  }));

  return {
    date,
    category,
    variant,
    characters: placed.sort((a, b) => a.y - b.y),
    pigeons,
    bus: {
      period: 18 + rng.int(0, 14),
      offset: rng.next() * 10,
      direction: rng.chance(0.5) ? 1 : -1,
      route: rng.pick([3, 6, 9, 12, 13, 15, 23, 24, 29, 87, 88, 91, 139, 159, 176, 453]),
    },
    clouds,
    extras: { busker: rng.chance(0.35), balloon: rng.chance(0.2), balloonX: rng.int(30, 290) },
  };
}

/** Days since 1970-01-01 for a YYYY-MM-DD date (falls back to a hash if malformed). */
function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const n = Math.round(Date.UTC(y, m - 1, d) / 86400000);
  return Number.isFinite(n) ? ((n % NAMES.length) + NAMES.length) % NAMES.length : hashString(date) % NAMES.length;
}

/** Plain-English description of a plan, for screen readers and the page text. */
export function describePlan(plan: ScenePlan): string[] {
  return plan.characters.map((c) => `${c.text}.`);
}
