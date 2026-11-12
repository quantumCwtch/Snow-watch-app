import { describe, it, expect } from 'vitest';
import { decideIntro, screenForVerdict } from '../src/game/flow';
import { previewSnapshot, PREVIEW_SCENES } from '../src/pages/shared';

const now = new Date('2026-01-15T12:00:00Z');
const snap = (id: string) => previewSnapshot(id, now)!.snapshot;

describe('intro screen selection', () => {
  it('maps verdicts to screens', () => {
    expect(screenForVerdict({ verdict: 'SNOW', possibleSnow: false, hailSeen: false })).toBe('snow-day');
    expect(screenForVerdict({ verdict: 'SLEET', possibleSnow: false, hailSeen: false })).toBe('sleet');
    expect(screenForVerdict({ verdict: 'UNCONFIRMED', possibleSnow: true, hailSeen: false })).toBe('possible-snow');
    expect(screenForVerdict({ verdict: 'NO_SNOW', possibleSnow: false, hailSeen: true })).toBe('hail');
    expect(screenForVerdict({ verdict: 'NO_SNOW', possibleSnow: false, hailSeen: false })).toBeNull();
  });

  it('SNOW DAY alert leads to the snow scene and says where snow was confirmed', () => {
    expect(decideIntro(snap('snow'))).toMatchObject({ screen: 'snow-day', snowScene: true, blocking: false, note: 'CONFIRMED BY NEARBY SNOW SENSOR' });
  });

  it('unconfirmed with snow seen nearby gets a note', () => {
    expect(decideIntro(snap('unconfirmed'))).toMatchObject({ screen: 'unconfirmed', note: 'SNOW SEEN NEARBY' });
  });

  it('station mismatch blocks everything', () => {
    expect(decideIntro(snap('station-mismatch'))).toMatchObject({ screen: 'station-mismatch', blocking: true });
  });

  it('signal lost when data is stale', () => {
    expect(decideIntro(snap('signal-lost')).screen).toBe('signal-lost');
  });

  it('every preview id builds sample data', () => {
    for (const p of PREVIEW_SCENES) expect(previewSnapshot(p.id, now)).not.toBeNull();
    expect(previewSnapshot('nope', now)).toBeNull();
  });
});
