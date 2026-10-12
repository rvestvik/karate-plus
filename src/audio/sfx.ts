// Tiny WebAudio synth for all sound effects. No samples are used.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function audio(): { ac: AudioContext; out: GainNode } | null {
  if (muted) return null;
  try {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { ac: ctx, out: master! };
  } catch {
    return null;
  }
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted(): boolean {
  return muted;
}

/** Call from a user gesture so later sounds are allowed to play. */
export function unlockAudio(): void {
  audio();
}

let noiseBuf: AudioBuffer | null = null;
function noise(ac: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noiseBurst(dur: number, freq: number, q: number, vol: number, sweepTo?: number, type: BiquadFilterType = 'bandpass') {
  const a = audio();
  if (!a) return;
  const { ac, out } = a;
  const t = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noise(ac);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur);
}

function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'square', slideTo?: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const { ac, out } = a;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  whoosh() {
    noiseBurst(0.16, 900, 1.2, 0.35, 2600);
  },
  hit(full: boolean) {
    tone(full ? 140 : 180, 0.18, 0.7, 'triangle', 50);
    noiseBurst(0.12, 1200, 0.8, full ? 0.9 : 0.6, 300, 'lowpass');
  },
  block() {
    tone(900, 0.05, 0.25, 'square', 600);
    noiseBurst(0.05, 3000, 2, 0.3);
  },
  /** A few syllables of square-wave "speech" for the referee. */
  speak(words: string) {
    const syllables = Math.min(6, Math.max(2, Math.round(words.length / 3)));
    for (let i = 0; i < syllables; i++) {
      const f = 220 + ((words.charCodeAt(i) * 37) % 160);
      tone(f, 0.09, 0.18, 'square', f * 0.85, i * 0.11);
    }
  },
  gong() {
    [110, 165, 220.5, 331].forEach((f, i) => tone(f, 1.6, 0.28 / (i + 1), 'sine', f * 0.98));
  },
  thud() {
    tone(90, 0.25, 0.6, 'sine', 40);
    noiseBurst(0.15, 400, 0.7, 0.4, 120, 'lowpass');
  },
  select() {
    tone(660, 0.06, 0.2, 'square');
    tone(990, 0.08, 0.2, 'square', undefined, 0.06);
  },
  /** A crate or pot breaking. */
  smash() {
    noiseBurst(0.22, 700, 0.6, 0.8, 200, 'lowpass');
    noiseBurst(0.1, 2400, 1.5, 0.4, 1200);
    tone(120, 0.12, 0.4, 'triangle', 60);
  },
  pickup() {
    tone(880, 0.07, 0.2, 'square');
    tone(1320, 0.1, 0.2, 'square', undefined, 0.07);
  },
  oneUp() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.1, 0.2, 'square', undefined, i * 0.08));
  },
  bounce() {
    tone(320, 0.08, 0.25, 'sine', 180);
  },
};
