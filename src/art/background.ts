import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';

// The beach at sunset, drawn once onto a canvas texture. Original art, in
// the spirit of the 8/16-bit era: hard color bands, dithering, no gradients.

export const BG_KEY = 'background';
const HORIZON = 98;
const SHORE = 142;

export function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

export function createBackground(scene: Phaser.Scene): void {
  if (scene.textures.exists(BG_KEY)) return;
  const tex = scene.textures.createCanvas(BG_KEY, WIDTH, HEIGHT);
  if (!tex) throw new Error('could not create background');
  const ctx = tex.getContext();
  const rand = rng(1987);
  const rect = (c: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  /** Fills a band in `a` with a 50% checker dither of `b` across its top rows. */
  const band = (a: string, b: string, y0: number, y1: number, dither = 2) => {
    rect(a, 0, y0, WIDTH, y1 - y0);
    ctx.fillStyle = b;
    for (let y = y0; y < y0 + dither; y++) {
      for (let x = (y & 1); x < WIDTH; x += 2) ctx.fillRect(x, y, 1, 1);
    }
  };

  // Sky: deep blue down to a burning horizon.
  const sky = ['#18184a', '#25246a', '#3a2e86', '#5a3a96', '#86468e', '#b45682', '#de6c6c', '#f48c58', '#fbb050'];
  const bandH = HORIZON / sky.length;
  sky.forEach((c, i) => band(c, sky[i - 1] ?? c, Math.round(i * bandH), Math.round((i + 1) * bandH)));

  // Stars in the upper sky.
  for (let i = 0; i < 40; i++) rect(rand() > 0.7 ? '#ffffff' : '#9a9ad8', Math.floor(rand() * WIDTH), Math.floor(rand() * 26), 1, 1);

  // Sun sinking into the sea, with horizontal slots cut through it.
  const sx = 214,
    sy = HORIZON,
    sr = 22;
  for (let y = sy - sr; y < sy; y++) {
    const half = Math.sqrt(sr * sr - (y - sy) ** 2);
    const slot = y > sy - 12 && (sy - y) % 4 === 1;
    if (slot) continue;
    rect(y < sy - 14 ? '#ffe070' : '#ffc040', Math.round(sx - half), y, Math.round(half * 2), 1);
  }

  // Distant islands.
  ctx.fillStyle = '#4a2a5a';
  const island = (x0: number, w: number, h: number) => {
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const hh = Math.round(h * Math.sin(Math.PI * t) * (0.8 + 0.2 * Math.sin(t * 9)));
      ctx.fillRect(x0 + x, HORIZON - hh, 1, hh);
    }
  };
  island(70, 70, 10);
  island(120, 40, 6);
  island(270, 50, 7);

  // Sea with wave dashes and the sun's reflection.
  const sea = ['#2a3a8a', '#24327a', '#1e2a6a', '#1a245c'];
  sea.forEach((c, i) => band(c, sea[i - 1] ?? c, HORIZON + i * 11, HORIZON + (i + 1) * 11 + 1));
  for (let i = 0; i < 160; i++) {
    const y = HORIZON + 2 + Math.floor(rand() * (SHORE - HORIZON - 4));
    const depth = (y - HORIZON) / (SHORE - HORIZON);
    const w = 2 + Math.floor(rand() * (3 + depth * 6));
    rect(rand() > 0.5 ? '#4a62b8' : '#3a4ea2', Math.floor(rand() * WIDTH), y, w, 1);
  }
  for (let y = HORIZON + 1; y < SHORE - 2; y += 2) {
    const spread = 6 + (y - HORIZON) * 0.5;
    const w = Math.round(spread * (0.5 + rand() * 0.6));
    rect(y % 4 === 1 ? '#ffb848' : '#e88848', Math.round(sx - w / 2 + (rand() - 0.5) * 6), y, w, 1);
  }

  // Surf line and beach.
  band('#e8d4a0', '#d0e0f0', SHORE, SHORE + 3, 1);
  band('#d8b878', '#e8d4a0', SHORE + 3, SHORE + 20, 2);
  band('#caa666', '#d8b878', SHORE + 20, HEIGHT, 2);
  for (let i = 0; i < 260; i++) {
    const y = SHORE + 4 + Math.floor(rand() * (HEIGHT - SHORE - 4));
    rect(rand() > 0.5 ? '#b89458' : '#e6cc90', Math.floor(rand() * WIDTH), y, 1, 1);
  }
  // A few pebbles.
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rand() * WIDTH),
      y = SHORE + 26 + Math.floor(rand() * 30);
    rect('#8a7454', x, y, 3, 2);
    rect('#a89070', x, y, 2, 1);
  }

  // Rocky cliff on the left.
  const cliffTop = (y: number) => 30 + Math.round(10 * Math.sin(y / 9) + (y - 40) * 0.12);
  for (let y = 42; y < SHORE + 8; y++) {
    const w = Math.max(0, cliffTop(y));
    rect('#3a2a30', 0, y, w, 1);
    rect('#5a4040', Math.max(0, w - 4), y, Math.min(4, w), 1);
    if (y % 7 === 0) rect('#2a1e24', 4 + (y % 13), y, 8, 1);
  }

  // Palm tree on the right.
  const trunkBase = { x: 296, y: SHORE + 6 };
  for (let i = 0; i < 70; i++) {
    const t = i / 70;
    const x = Math.round(trunkBase.x - 22 * t * t);
    const y = trunkBase.y - i * 1.4;
    rect(i % 4 < 2 ? '#6a4628' : '#52361e', x - 2, Math.round(y), 5, 2);
  }
  const crown = { x: 274, y: trunkBase.y - 98 };
  const frond = (angle: number, len: number) => {
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = crown.x + Math.cos(angle) * i;
      const y = crown.y - Math.sin(angle) * i + 18 * t * t;
      const w = Math.max(1, Math.round(4 * (1 - t)));
      rect('#1e4a2a', Math.round(x), Math.round(y), 2, w + 1);
      rect('#2e6a38', Math.round(x), Math.round(y), 1, w);
    }
  };
  [0.3, 0.9, 1.6, 2.3, 2.9, -0.2, 3.4].forEach((a, i) => frond(a, 26 + (i % 3) * 6));
  rect('#3a2a18', crown.x - 3, crown.y - 2, 6, 5);

  // The raised sand dune the referee stands on.
  for (let x = 120; x < 200; x++) {
    const h = Math.round(5 * Math.sin((Math.PI * (x - 120)) / 80));
    rect('#e2c488', x, SHORE + 12 - h, 1, h);
  }

  tex.refresh();
}
