import { describe, it, expect } from 'vitest';
import { planScene, activitiesFor } from '../src/game/scene';
import { ACTIVITIES } from '../src/game/activities';
import { CAST } from '../src/game/cast';
import { CATEGORY_ORDER } from '../src/lib/classifier';

describe('seeded scene generator', () => {
  it('is deterministic for a given date and weather', () => {
    const a = planScene('2026-12-25', 'overcast');
    const b = planScene('2026-12-25', 'overcast');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('differs between days with identical weather', () => {
    const days = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'];
    const sigs = days.map((d) =>
      planScene(d, 'light-rain').characters.map((c) => `${c.member.id}:${c.activity.id}:${c.x},${c.y}`).join('|'),
    );
    expect(new Set(sigs).size).toBe(days.length);
  });

  it('places all seven millennials with distinct activities', () => {
    for (const cat of CATEGORY_ORDER) {
      const p = planScene('2026-11-11', cat);
      expect(p.characters).toHaveLength(7);
      expect(new Set(p.characters.map((c) => c.member.id)).size).toBe(7);
      expect(new Set(p.characters.map((c) => c.activity.id)).size).toBe(7);
    }
  });

  it('has at least 10 activities per weather category', () => {
    for (const cat of CATEGORY_ORDER) expect(ACTIVITIES[cat].length).toBeGreaterThanOrEqual(10);
    expect(activitiesFor('sunny', 'hot').length).toBeGreaterThan(ACTIVITIES.sunny.length);
  });

  it('uses the seven names, each once, rotating by one place per day', () => {
    const a = planScene('2026-12-01', 'overcast');
    const b = planScene('2026-12-02', 'overcast');
    expect(new Set(a.characters.map((c) => c.name))).toEqual(new Set(['Haydn', 'Sophie', 'Santi', 'Rachel', 'David', 'Sam', 'Div']));
    const nameFor = (p: typeof a, id: string) => p.characters.find((c) => c.member.id === id)!.name;
    expect(nameFor(a, 'saff')).not.toBe(nameFor(b, 'saff'));
    expect(nameFor(a, 'saff')).toBe(nameFor(planScene('2026-12-01', 'snow'), 'saff'));
    expect(a.characters.every((c) => c.text.startsWith(c.name))).toBe(true);
  });

  it('cast has seven distinct silhouettes', () => {
    expect(CAST).toHaveLength(7);
    expect(new Set(CAST.map((c) => c.hairStyle)).size).toBe(7);
  });
});
