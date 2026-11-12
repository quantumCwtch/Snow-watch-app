// "Pigeons at Dusk": an original, looping lo-fi chiptune for the background.
// Synthesised live with the Web Audio API (no audio files), so it is tiny and
// licence-free. Four voices play together: a warm triangle chord pad, a soft
// square-wave lead, a round bass and lightly swung drums, all through a gentle
// low-pass filter with tape "wow" and a quiet vinyl crackle for the lo-fi feel.
//
// It only plays while SOUND is ON. Browsers block audio until the visitor
// interacts with the page, so it starts on the first click, tap or key press.
import { getAudioContext, onDuck } from './audio';

const BPM = 76;
const STEP = 60 / BPM / 4; // one sixteenth note, in seconds
const SWING = 0.18; // delay for off-beat eighths, as a fraction of an eighth
const MASTER = 0.22;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// Eight-bar progression: Fmaj7 Em7 Dm7 Cmaj7 | Bbmaj7 Am7 Dm7 G7sus
const CHORDS: number[][] = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
  [46, 50, 53, 57],
  [45, 48, 52, 55],
  [50, 53, 57, 60],
  [43, 48, 50, 53],
];
const BASS = [41, 40, 38, 36, 34, 33, 38, 31];

// Lead melody, eight eighth-notes per bar (0 = rest). Original tune.
const LEAD: number[][] = [
  [72, 0, 69, 72, 76, 0, 74, 72],
  [71, 0, 67, 0, 74, 72, 71, 0],
  [69, 0, 72, 69, 65, 0, 67, 69],
  [67, 0, 0, 64, 67, 0, 0, 0],
  [69, 0, 70, 72, 74, 0, 72, 70],
  [72, 0, 69, 67, 64, 0, 67, 69],
  [65, 0, 69, 72, 74, 72, 69, 0],
  [67, 0, 72, 0, 74, 0, 0, 0],
];

// Drum pattern over 16 sixteenths: k = kick, s = snare, h = hat.
const DRUMS = {
  k: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  s: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  h: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
};

interface Rig {
  ac: AudioContext;
  out: GainNode;
  duck: GainNode;
  filter: BiquadFilterNode;
  wow: OscillatorNode;
  wowDepth: GainNode;
  noise: AudioBuffer;
  crackle: AudioBufferSourceNode;
}

let rig: Rig | null = null;
let timer: number | null = null;
let step = 0;
let nextTime = 0;
let playing = false;

function noiseBuffer(ac: AudioContext, seconds: number, crackle = false): AudioBuffer {
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    if (crackle) d[i] = Math.random() < 0.0006 ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.015;
    else d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function build(): Rig {
  const ac = getAudioContext();
  const out = ac.createGain();
  out.gain.value = 0;
  const duck = ac.createGain();
  duck.gain.value = 1;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3200;
  filter.Q.value = 0.4;
  filter.connect(duck).connect(out).connect(ac.destination);

  // Tape wow: a slow wobble applied to pitched voices' detune.
  const wow = ac.createOscillator();
  wow.frequency.value = 0.35;
  const wowDepth = ac.createGain();
  wowDepth.gain.value = 9; // cents
  wow.connect(wowDepth);
  wow.start();

  // Vinyl crackle loop.
  const crackle = ac.createBufferSource();
  crackle.buffer = noiseBuffer(ac, 4, true);
  crackle.loop = true;
  const cg = ac.createGain();
  cg.gain.value = 0.35;
  crackle.connect(cg).connect(filter);
  crackle.start();

  return { ac, out, duck, filter, wow, wowDepth, noise: noiseBuffer(ac, 1), crackle };
}

function voice(r: Rig, type: OscillatorType, freq: number, t: number, dur: number, vol: number, attack = 0.01, release = 0.08) {
  const o = r.ac.createOscillator();
  const g = r.ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  r.wowDepth.connect(o.detune);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g).connect(r.filter);
  o.start(t);
  o.stop(t + dur + 0.05);
  o.onended = () => {
    try {
      r.wowDepth.disconnect(o.detune);
    } catch {
      /* already disconnected */
    }
  };
}

function kick(r: Rig, t: number) {
  const o = r.ac.createOscillator();
  const g = r.ac.createGain();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g).connect(r.filter);
  o.start(t);
  o.stop(t + 0.3);
}

function noiseHit(r: Rig, t: number, type: BiquadFilterType, freq: number, vol: number, dur: number) {
  const s = r.ac.createBufferSource();
  s.buffer = r.noise;
  const f = r.ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = r.ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f).connect(g).connect(r.filter);
  s.start(t);
  s.stop(t + dur + 0.02);
}

function scheduleStep(r: Rig, s: number, t: number) {
  const bar = Math.floor(s / 16) % CHORDS.length;
  const pos = s % 16;
  const bar32 = Math.floor(s / 16) % 32; // the drums drop out for 2 bars in every 32
  const swung = pos % 4 === 2 ? t + STEP * 2 * SWING : t;

  if (pos === 0) {
    // Pad: four-note chord across the whole bar (polyphony).
    for (const n of CHORDS[bar]) voice(r, 'triangle', midi(n + 12), t, STEP * 16, 0.035, 0.35, 0.5);
  }
  if (pos === 0 || pos === 10) voice(r, 'triangle', midi(BASS[bar]), t, STEP * (pos === 0 ? 7 : 5), 0.16, 0.01, 0.1);
  if (pos % 2 === 0) {
    const note = LEAD[bar][pos / 2];
    if (note) voice(r, 'square', midi(note), swung, STEP * 1.8, 0.03, 0.01, 0.12);
  }
  if (bar32 < 30) {
    if (DRUMS.k[pos]) kick(r, t);
    if (DRUMS.s[pos]) noiseHit(r, swung, 'bandpass', 1800, 0.12, 0.16);
    if (DRUMS.h[pos]) noiseHit(r, swung, 'highpass', 7000, pos % 4 === 0 ? 0.035 : 0.02, 0.05);
  }
}

function tick() {
  if (!rig) return;
  const ahead = rig.ac.currentTime + 0.15;
  while (nextTime < ahead) {
    scheduleStep(rig, step, nextTime);
    nextTime += STEP;
    step++;
  }
}

export function isMusicPlaying(): boolean {
  return playing;
}

export function startMusic() {
  if (playing) return;
  rig ??= build();
  const r = rig;
  void r.ac.resume();
  playing = true;
  step = 0;
  nextTime = r.ac.currentTime + 0.1;
  r.out.gain.cancelScheduledValues(r.ac.currentTime);
  r.out.gain.setValueAtTime(r.out.gain.value, r.ac.currentTime);
  r.out.gain.linearRampToValueAtTime(MASTER, r.ac.currentTime + 1.5);
  timer = window.setInterval(tick, 25);
  tick();
}

export function stopMusic() {
  if (!playing || !rig) return;
  playing = false;
  const r = rig;
  r.out.gain.cancelScheduledValues(r.ac.currentTime);
  r.out.gain.setValueAtTime(r.out.gain.value, r.ac.currentTime);
  r.out.gain.linearRampToValueAtTime(0, r.ac.currentTime + 0.4);
  if (timer !== null) window.clearInterval(timer);
  timer = null;
}

// Dip the music while the fanfare or near-miss jingle plays.
onDuck((seconds) => {
  if (!rig || !playing) return;
  const g = rig.duck.gain;
  const now = rig.ac.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0.25, now + 0.15);
  g.setValueAtTime(0.25, now + seconds);
  g.linearRampToValueAtTime(1, now + seconds + 1);
});

// Pause scheduling while the tab is hidden; resume when visible.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!rig) return;
    if (document.hidden) void rig.ac.suspend();
    else if (playing) {
      void rig.ac.resume();
      nextTime = Math.max(nextTime, rig.ac.currentTime + 0.05);
    }
  });
}
