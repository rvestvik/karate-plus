import Phaser from 'phaser';
import { HEIGHT, WIDTH } from '../config';
import type { Theme } from '../scroller/levels';
import { rng } from './background';

// Scrolling backdrops for the scroller levels: three layers per theme, each a
// 320-wide canvas that tiles horizontally. Far layers scroll slower than the
// ground for parallax. Same hard bands and dithering as the beach.

export type Layer = 'far' | 'mid' | 'ground';
export const LAYERS: { layer: Layer; factor: number }[] = [
  { layer: 'far', factor: 0.2 },
  { layer: 'mid', factor: 0.5 },
  { layer: 'ground', factor: 1 },
];
/** Top of the ground layer; everything above it belongs to the backdrop. */
const GROUND_TOP = 150;

export function layerKey(theme: Theme, layer: Layer): string {
  return `scroll_${theme}_${layer}`;
}

type Ctx = CanvasRenderingContext2D;

function painter(ctx: Ctx) {
  /** A rect that wraps around the tile's right edge. */
  const rect = (c: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = c;
    const x0 = ((Math.round(x) % WIDTH) + WIDTH) % WIDTH;
    ctx.fillRect(x0, Math.round(y), w, h);
    if (x0 + w > WIDTH) ctx.fillRect(x0 - WIDTH, Math.round(y), w, h);
  };
  /** Fills a band in `a` with a 50% checker dither of `b` across its top rows. */
  const band = (a: string, b: string, y0: number, y1: number, dither = 2) => {
    ctx.fillStyle = a;
    ctx.fillRect(0, y0, WIDTH, y1 - y0);
    ctx.fillStyle = b;
    for (let y = y0; y < y0 + dither; y++) {
      for (let x = y & 1; x < WIDTH; x += 2) ctx.fillRect(x, y, 1, 1);
    }
  };
  const sky = (colors: string[], bottom: number) => {
    const h = bottom / colors.length;
    colors.forEach((c, i) => band(c, colors[i - 1] ?? c, Math.round(i * h), Math.round((i + 1) * h)));
  };
  /** A silhouette whose top edge is `top(x)`, filled down to `bottom`. */
  const ridge = (c: string, bottom: number, top: (x: number) => number) => {
    for (let x = 0; x < WIDTH; x++) rect(c, x, top(x), 1, bottom - top(x));
  };
  /** Waves of period WIDTH/n, so silhouettes tile seamlessly. */
  const wave = (x: number, n: number, phase = 0) => Math.sin((2 * Math.PI * n * x) / WIDTH + phase);
  const speckle = (rand: () => number, colors: string[], n: number, y0: number, y1: number, w = 1, h = 1) => {
    for (let i = 0; i < n; i++) rect(colors[Math.floor(rand() * colors.length)], rand() * WIDTH, y0 + rand() * (y1 - y0), w, h);
  };
  return { rect, band, sky, ridge, wave, speckle };
}

type Paint = (p: ReturnType<typeof painter>, rand: () => number) => void;

const THEMES: Record<Theme, Record<Layer, Paint>> = {
  beach: {
    far: (p, rand) => {
      p.sky(['#18184a', '#25246a', '#3a2e86', '#5a3a96', '#86468e', '#b45682', '#de6c6c', '#f48c58', '#fbb050'], 98);
      p.speckle(rand, ['#ffffff', '#9a9ad8'], 30, 0, 26);
      for (let y = 76; y < 98; y++) {
        const half = Math.sqrt(22 * 22 - (y - 98) ** 2);
        if (y > 86 && (98 - y) % 4 === 1) continue;
        p.rect(y < 84 ? '#ffe070' : '#ffc040', 214 - half, y, Math.round(half * 2), 1);
      }
      p.ridge('#4a2a5a', 99, (x) => 98 - Math.max(0, Math.round(9 * p.wave(x, 3) + 3 * p.wave(x, 7, 1))));
      ['#2a3a8a', '#24327a', '#1e2a6a', '#1a245c', '#16204e'].forEach((c, i, a) => p.band(c, a[i - 1] ?? c, 98 + i * 11, 98 + (i + 1) * 11 + 1));
      p.speckle(rand, ['#4a62b8', '#3a4ea2'], 140, 100, 150, 4, 1);
    },
    mid: (p, rand) => {
      p.ridge('#d0e0f0', 146, (x) => 142 + Math.round(p.wave(x, 4)));
      p.band('#e8d4a0', '#d0e0f0', 144, 152, 1);
      for (const tx of [40, 210]) {
        for (let i = 0; i < 64; i++) {
          const t = i / 64;
          p.rect(i % 4 < 2 ? '#6a4628' : '#52361e', tx - 2 - 18 * t * t, 148 - i * 1.4, 4, 2);
        }
        const cx = tx - 18,
          cy = 148 - 90;
        [0.3, 0.9, 1.6, 2.3, 2.9, -0.2, 3.4].forEach((a, k) => {
          const len = 22 + (k % 3) * 5;
          for (let i = 0; i < len; i++) {
            const t = i / len;
            p.rect('#1e4a2a', cx + Math.cos(a) * i, cy - Math.sin(a) * i + 16 * t * t, 2, Math.max(1, Math.round(4 * (1 - t))) + 1);
          }
        });
        p.rect('#3a2a18', cx - 3, cy - 2, 6, 5);
      }
      p.speckle(rand, ['#c8b080'], 30, 146, 152);
    },
    ground: (p, rand) => {
      p.band('#d8b878', '#e8d4a0', GROUND_TOP, 172, 2);
      p.band('#caa666', '#d8b878', 172, HEIGHT, 2);
      p.speckle(rand, ['#b89458', '#e6cc90'], 220, GROUND_TOP + 2, HEIGHT);
      for (let i = 0; i < 8; i++) {
        const x = rand() * WIDTH,
          y = 160 + rand() * 36;
        p.rect('#8a7454', x, y, 3, 2);
        p.rect('#a89070', x, y, 2, 1);
      }
    },
  },
  harbour: {
    far: (p, rand) => {
      p.sky(['#2a2440', '#3c2c4e', '#5a3858', '#80465a', '#a85a58', '#d07a50', '#e89a50'], 112);
      p.ridge('#3a2c44', 113, (x) => 112 - Math.max(0, Math.round(6 + 6 * p.wave(x, 2) + 2 * p.wave(x, 9))));
      ['#1e3a4a', '#1a3242', '#162a38', '#12222e'].forEach((c, i, a) => p.band(c, a[i - 1] ?? c, 112 + i * 10, 112 + (i + 1) * 10 + 1));
      p.speckle(rand, ['#3a6070', '#e89a50'], 90, 114, 150, 3, 1);
    },
    mid: (p, rand) => {
      // Warehouses and cranes along the far quay.
      for (let x = 0; x < WIDTH; x += 64) {
        const h = 24 + Math.floor(rand() * 16);
        p.rect('#2a2030', x + 2, 136 - h, 52, h + 14);
        p.rect('#3a2c3a', x + 2, 136 - h, 52, 2);
        for (let wx = x + 8; wx < x + 50; wx += 10) p.rect(rand() > 0.6 ? '#f0c060' : '#1a141e', wx, 136 - h + 8, 4, 4);
      }
      for (const cx of [60, 220]) {
        p.rect('#4a3040', cx, 70, 3, 72);
        p.rect('#4a3040', cx - 30, 70, 58, 3);
        p.rect('#4a3040', cx - 28, 73, 1, 22);
        p.rect('#4a3040', cx - 31, 95, 7, 5);
      }
      // A moored boat.
      p.rect('#6a2a24', 150, 136, 48, 8);
      p.rect('#e8e0d0', 162, 128, 20, 8);
      p.rect('#4a3040', 172, 108, 2, 20);
      p.band('#3a3036', '#4a4046', 144, 152, 1);
    },
    ground: (p, rand) => {
      p.band('#7a5434', '#946a44', GROUND_TOP, HEIGHT, 1);
      for (let y = GROUND_TOP + 6; y < HEIGHT; y += 8) p.rect('#4a3020', 0, y, WIDTH, 1);
      for (let y = GROUND_TOP; y < HEIGHT; y += 8) {
        for (let x = (y / 8) % 2 ? 0 : 24; x < WIDTH; x += 48) p.rect('#4a3020', x, y, 1, 7);
      }
      p.speckle(rand, ['#5e4028', '#8a6040'], 120, GROUND_TOP, HEIGHT, 2, 1);
      for (const bx of [80, 240]) {
        p.rect('#2a2a30', bx, GROUND_TOP - 6, 8, 10);
        p.rect('#4a4a52', bx, GROUND_TOP - 6, 8, 2);
      }
    },
  },
  temple: {
    far: (p, rand) => {
      p.sky(['#4a78d8', '#5a88e0', '#6c98e6', '#80aaec', '#98bcf0', '#b4d0f4'], 120);
      for (let i = 0; i < 5; i++) {
        const x = rand() * WIDTH,
          y = 14 + rand() * 50,
          w = 24 + rand() * 30;
        p.rect('#f4f8ff', x, y, w, 4);
        p.rect('#f4f8ff', x + 6, y - 3, w - 14, 3);
        p.rect('#d8e4f8', x + 2, y + 4, w - 4, 1);
      }
      // A snow-capped peak.
      p.ridge('#6a7ab0', 121, (x) => {
        const d = Math.min(Math.abs(x - 160), WIDTH - Math.abs(x - 160));
        return Math.round(52 + d * 0.5 + 2 * p.wave(x, 11));
      });
      for (let x = 136; x < 184; x++) {
        const top = Math.round(52 + Math.abs(x - 160) * 0.5);
        p.rect('#f0f4ff', x, top, 1, Math.max(0, 14 - Math.abs(x - 160) * 0.3 + p.wave(x, 40) * 2));
      }
      p.band('#5a8a4a', '#6a7ab0', 120, 150, 2);
    },
    mid: (p, rand) => {
      // A pagoda, a gate and cherry trees behind the courtyard wall.
      const px = 100;
      [0, 1, 2].forEach((k) => {
        const y = 76 + k * 22,
          w = 44 + k * 12;
        p.rect('#8a2a24', px - w / 2 + 6, y + 4, w - 12, 18);
        p.rect('#2a2a34', px - w / 2, y, w, 4);
        p.rect('#2a2a34', px - w / 2 - 3, y + 2, 3, 2);
        p.rect('#2a2a34', px + w / 2, y + 2, 3, 2);
      });
      p.rect('#2a2a34', px - 1, 64, 2, 12);
      const gx = 240;
      p.rect('#c83a2a', gx - 22, 104, 4, 40);
      p.rect('#c83a2a', gx + 18, 104, 4, 40);
      p.rect('#2a2a34', gx - 30, 98, 60, 4);
      p.rect('#c83a2a', gx - 26, 108, 52, 3);
      for (const tx of [20, 170, 300]) {
        p.rect('#4a2a20', tx - 1, 112, 3, 34);
        for (let i = 0; i < 70; i++) {
          const a = rand() * Math.PI * 2,
            r = rand() * 16;
          p.rect(rand() > 0.4 ? '#f0a0c0' : '#d07898', tx + Math.cos(a) * r * 1.4, 108 + Math.sin(a) * r * 0.8, 2, 2);
        }
      }
      p.band('#9a9488', '#b0aa9c', 138, 152, 1);
      for (let x = 0; x < WIDTH; x += 20) p.rect('#7a766c', x, 138, 1, 14);
      p.rect('#3a3a44', 0, 136, WIDTH, 2);
    },
    ground: (p, rand) => {
      p.band('#a8a49a', '#bab6aa', GROUND_TOP, HEIGHT, 1);
      for (let y = GROUND_TOP + 10; y < HEIGHT; y += 12) p.rect('#86827a', 0, y, WIDTH, 1);
      for (let y = GROUND_TOP; y < HEIGHT; y += 12) {
        for (let x = (y / 12) % 2 ? 0 : 20; x < WIDTH; x += 40) p.rect('#86827a', x, y, 1, 11);
      }
      p.speckle(rand, ['#94908a', '#c4c0b4'], 140, GROUND_TOP, HEIGHT);
      p.speckle(rand, ['#f0a0c0'], 16, GROUND_TOP + 4, HEIGHT, 2, 1);
    },
  },
  mountain: {
    far: (p, rand) => {
      p.sky(['#06061a', '#0a0c24', '#10142e', '#161c3a', '#1e2648', '#283258'], 130);
      p.speckle(rand, ['#ffffff', '#8a8ac8', '#c0c0f0'], 70, 0, 90);
      for (let y = -14; y <= 14; y++) {
        const half = Math.sqrt(14 * 14 - y * y);
        p.rect('#f0ecd0', 230 - half, 34 + y, Math.round(half * 2), 1);
      }
      p.rect('#d0ccb0', 226, 30, 4, 3);
      p.rect('#d0ccb0', 236, 40, 3, 3);
      p.ridge('#2a3050', 131, (x) => Math.round(76 + 16 * p.wave(x, 2) + 8 * p.wave(x, 5, 2)));
      p.band('#1a2038', '#2a3050', 130, 150, 2);
    },
    mid: (p, rand) => {
      const top = (x: number) => Math.round(98 + 14 * p.wave(x, 3, 1) + 6 * p.wave(x, 7));
      p.ridge('#3a4466', 152, top);
      for (let x = 0; x < WIDTH; x++) p.rect('#d8e0f0', x, top(x), 1, Math.max(1, 4 + Math.round(2 * p.wave(x, 13))));
      for (let i = 0; i < 18; i++) {
        const x = rand() * WIDTH,
          h = 14 + rand() * 12,
          base = 150;
        for (let k = 0; k < h; k++) p.rect('#0e1a1e', x - (h - k) * 0.25, base - k, Math.max(1, (h - k) * 0.5), 1);
      }
    },
    ground: (p, rand) => {
      p.band('#4a4a5a', '#5a5a6c', GROUND_TOP, HEIGHT, 2);
      p.speckle(rand, ['#3a3a48', '#606074'], 200, GROUND_TOP, HEIGHT, 2, 1);
      for (let i = 0; i < 9; i++) {
        const x = rand() * WIDTH,
          y = GROUND_TOP + rand() * 46,
          w = 10 + rand() * 20;
        p.rect('#d8e0f0', x, y, w, 2);
        p.rect('#b0b8cc', x + 2, y + 2, w - 4, 1);
      }
    },
  },
};

/** Bakes the three layers for a theme, once. */
export function createScrollBackground(scene: Phaser.Scene, theme: Theme): void {
  LAYERS.forEach(({ layer }, i) => {
    const key = layerKey(theme, layer);
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, WIDTH, HEIGHT);
    if (!tex) throw new Error(`could not create ${key}`);
    THEMES[theme][layer](painter(tex.getContext()), rng(1987 + i * 31 + theme.length * 7));
    tex.refresh();
  });
}
