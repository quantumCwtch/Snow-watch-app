// Original chiptune fanfare, synthesised with the Web Audio API (no audio files).
// Sound is OFF by default; the visible toggle stores the choice in localStorage.

const KEY = 'snow-watch:sound';
let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    /* storage unavailable: setting lasts for this page only */
  }
}

const NOTE = (n: string): number => {
  const names: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
  const m = /^([A-G])(#?)(\d)$/.exec(n)!;
  const semis = names[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (semis / 12);
};

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType, vol: number) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(vol, start + 0.01);
  g.gain.setValueAtTime(vol, start + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, start + dur);
  o.connect(g).connect(ac.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

/** "Snow Day Fanfare" - an original 13-note melody with a triangle bass line. */
export function playFanfare() {
  if (!soundEnabled()) return;
  ctx ??= new AudioContext();
  const ac = ctx;
  void ac.resume();
  const t0 = ac.currentTime + 0.05;
  const beat = 0.12;
  const melody: Array<[string, number]> = [
    ['G4', 1], ['C5', 1], ['E5', 1], ['G5', 2], ['E5', 1], ['G5', 3],
    ['A5', 1], ['G5', 1], ['F5', 1], ['E5', 1], ['D5', 1], ['C5', 2], ['G5', 1], ['C6', 4],
  ];
  let t = t0;
  for (const [n, len] of melody) {
    tone(ac, NOTE(n), t, beat * len * 0.95, 'square', 0.06);
    t += beat * len;
  }
  const bass: Array<[string, number]> = [['C3', 4], ['G3', 4], ['F3', 4], ['G3', 4], ['C3', 6]];
  let tb = t0;
  for (const [n, len] of bass) {
    tone(ac, NOTE(n), tb, beat * len * 0.9, 'triangle', 0.08);
    tb += beat * len;
  }
}

/** A short descending "womp" for near misses. */
export function playNearMiss() {
  if (!soundEnabled()) return;
  ctx ??= new AudioContext();
  const ac = ctx;
  void ac.resume();
  const t0 = ac.currentTime + 0.05;
  ['E4', 'D#4', 'D4', 'C#4'].forEach((n, i) => tone(ac, NOTE(n), t0 + i * 0.22, i === 3 ? 0.6 : 0.2, 'square', 0.05));
}
