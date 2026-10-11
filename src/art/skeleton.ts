// A karateka is a stick skeleton posed with absolute joint angles, then
// rasterized into chunky outlined pixel art. This module has no Phaser
// dependency so poses and hit geometry can be unit-tested.

/**
 * Limb angles are in degrees measured from "pointing straight down", rotating
 * toward the direction the fighter faces: 0 = down, 90 = forward,
 * 180 = up, -90 = backward. The torso angle is measured from upright, and a
 * positive value leans forward.
 */
export interface Pose {
  torso: number;
  /** Front leg: thigh, shin. */
  fl: [number, number];
  /** Back leg: thigh, shin. */
  bl: [number, number];
  /** Front arm: upper arm, forearm. */
  fa: [number, number];
  /** Back arm: upper arm, forearm. */
  ba: [number, number];
  /** Extra clearance between the lowest body part and the ground. */
  lift?: number;
  /** Fixed hip position for airborne poses, instead of resting on the ground. */
  hip?: Pt;
}

export interface Pt {
  x: number;
  y: number;
}

export interface Joints {
  hip: Pt;
  neck: Pt;
  shoulder: Pt;
  head: Pt;
  /** Unit vector from hip toward neck. */
  up: Pt;
  fk: Pt; // front knee
  ff: Pt; // front foot
  bk: Pt;
  bf: Pt;
  fe: Pt; // front elbow
  fh: Pt; // front hand
  be: Pt;
  bh: Pt;
}

export const SEG = { thigh: 11, shin: 11, torso: 14, upper: 7.5, fore: 7.5, neck: 4.5 };
export const RADIUS = {
  hip: 3.2,
  knee: 2.6,
  foot: 2.2,
  torsoLow: 3.6,
  torsoHigh: 4.2,
  shoulder: 2,
  elbow: 1.8,
  hand: 1.8,
  head: 3.6,
};

function limb(a: number): Pt {
  const r = (a * Math.PI) / 180;
  return { x: Math.sin(r), y: Math.cos(r) };
}

function add(p: Pt, d: Pt, len: number): Pt {
  return { x: p.x + d.x * len, y: p.y + d.y * len };
}

/**
 * Computes joint positions relative to the fighter origin (between the feet
 * on the ground), facing right. Positions are grounded automatically: the
 * lowest body part rests on y = 0 (minus `lift`), unless `hip` pins the body.
 */
export function computeJoints(p: Pose): Joints {
  const hip = { x: 0, y: 0 };
  const t = (p.torso * Math.PI) / 180;
  const up = { x: Math.sin(t), y: -Math.cos(t) };
  const neck = add(hip, up, SEG.torso);
  const shoulder = add(neck, up, -1.5);
  const head = add(neck, up, SEG.neck);
  const fk = add(hip, limb(p.fl[0]), SEG.thigh);
  const ff = add(fk, limb(p.fl[1]), SEG.shin);
  const bk = add(hip, limb(p.bl[0]), SEG.thigh);
  const bf = add(bk, limb(p.bl[1]), SEG.shin);
  const fe = add(shoulder, limb(p.fa[0]), SEG.upper);
  const fh = add(fe, limb(p.fa[1]), SEG.fore);
  const be = add(shoulder, limb(p.ba[0]), SEG.upper);
  const bh = add(be, limb(p.ba[1]), SEG.fore);

  const lowest = Math.max(
    hip.y + RADIUS.torsoLow,
    neck.y + RADIUS.torsoHigh,
    head.y + RADIUS.head,
    fk.y + RADIUS.knee,
    ff.y + RADIUS.foot,
    bk.y + RADIUS.knee,
    bf.y + RADIUS.foot,
    fe.y + RADIUS.elbow,
    fh.y + RADIUS.hand,
    be.y + RADIUS.elbow,
    bh.y + RADIUS.hand,
  );
  const dx = p.hip ? p.hip.x : 0;
  const dy = p.hip ? p.hip.y : 0.5 - (p.lift ?? 0) - lowest;
  const shift = (q: Pt): Pt => ({ x: q.x + dx, y: q.y + dy });
  return {
    hip: shift(hip),
    neck: shift(neck),
    shoulder: shift(shoulder),
    head: shift(head),
    up,
    fk: shift(fk),
    ff: shift(ff),
    bk: shift(bk),
    bf: shift(bf),
    fe: shift(fe),
    fh: shift(fh),
    be: shift(be),
    bh: shift(bh),
  };
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The vulnerable area of a posed body, relative to the origin and facing
 * right. It covers the head, torso and thighs, so crouching drops under
 * high attacks and jumping lifts over low ones.
 */
export function hurtRect(j: Joints): Rect {
  const core = [j.hip, j.neck, j.head, j.fk, j.bk];
  const xs = core.map((q) => q.x);
  const ys = [j.head.y - 1.5, j.hip.y, j.fk.y, j.bk.y, j.ff.y, j.bf.y];
  return {
    x0: Math.min(...xs) - 4,
    x1: Math.max(...xs) + 4,
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

export interface BodyColors {
  base: string;
  shade: string;
  skin: string;
  skinShade: string;
  hair: string;
  /** Belt color, or null for no belt (the referee). */
  belt: string | null;
  outline: string;
}

/**
 * Rasterizes a pose into an RGBA buffer of size w x h with the origin at
 * (ox, oy). The result is crisp, outlined pixel art.
 */
export function rasterize(p: Pose, colors: BodyColors, w: number, h: number, ox: number, oy: number): Uint8ClampedArray {
  const j = computeJoints(p);
  const palette = [
    null,
    colors.base,
    colors.shade,
    colors.skin,
    colors.skinShade,
    colors.hair,
    colors.belt ?? colors.base,
    colors.outline,
  ];
  const BASE = 1,
    SHADE = 2,
    SKIN = 3,
    SKIN_SHADE = 4,
    HAIR_C = 5,
    BELT = 6,
    OUT = 7;
  const buf = new Uint8Array(w * h);

  const stamp = (cx: number, cy: number, r: number, c: number) => {
    const px = cx + ox;
    const py = cy + oy;
    for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
      if (y < 0 || y >= h) continue;
      for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
        if (x < 0 || x >= w) continue;
        const dx = x + 0.5 - px;
        const dy = y + 0.5 - py;
        if (dx * dx + dy * dy <= r * r) buf[y * w + x] = c;
      }
    }
  };
  /** Draws a tapered segment; `tipLen` pixels at the far end use `tipColor`. */
  const seg = (a: Pt, b: Pt, ra: number, rb: number, c: number, tipLen = 0, tipColor = c) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(len * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const inTip = len * (1 - t) < tipLen;
      stamp(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, ra + (rb - ra) * t, inTip ? tipColor : c);
    }
  };

  // Back limbs first, in the shaded tone.
  seg(j.shoulder, j.be, RADIUS.shoulder, RADIUS.elbow, SHADE);
  seg(j.be, j.bh, RADIUS.elbow, RADIUS.hand, SHADE, 2.5, SKIN_SHADE);
  seg(j.hip, j.bk, RADIUS.hip, RADIUS.knee, SHADE);
  seg(j.bk, j.bf, RADIUS.knee, RADIUS.foot, SHADE, 3, SKIN_SHADE);

  // Torso with belt, then head.
  seg(j.hip, j.neck, RADIUS.torsoLow, RADIUS.torsoHigh, BASE);
  if (colors.belt) {
    const beltTop = add(j.hip, j.up, 2.2);
    seg(add(j.hip, j.up, 0.4), beltTop, RADIUS.torsoLow + 0.3, RADIUS.torsoLow + 0.4, BELT);
  }
  stamp(j.head.x, j.head.y, RADIUS.head, SKIN);
  // Hair covers the top and back of the head.
  const fwd = { x: -j.up.y, y: j.up.x };
  const hairCenter = { x: j.head.x + j.up.x * 0.9 - fwd.x * 0.9, y: j.head.y + j.up.y * 0.9 - fwd.y * 0.9 };
  for (let y = Math.floor(j.head.y - 5); y <= Math.ceil(j.head.y + 5); y++) {
    for (let x = Math.floor(j.head.x - 5); x <= Math.ceil(j.head.x + 5); x++) {
      const bx = x + ox,
        by = y + oy;
      if (bx < 0 || by < 0 || bx >= w || by >= h || buf[by * w + bx] !== SKIN) continue;
      const dx = x + 0.5 - hairCenter.x;
      const dy = y + 0.5 - hairCenter.y;
      if (dx * dx + dy * dy <= 3.0 * 3.0) buf[by * w + bx] = HAIR_C;
    }
  }

  // Front limbs on top.
  seg(j.hip, j.fk, RADIUS.hip, RADIUS.knee, BASE);
  seg(j.fk, j.ff, RADIUS.knee, RADIUS.foot, BASE, 3, SKIN);
  seg(j.shoulder, j.fe, RADIUS.shoulder, RADIUS.elbow, BASE);
  seg(j.fe, j.fh, RADIUS.elbow, RADIUS.hand, BASE, 2.5, SKIN);

  // One-pixel outline around the whole figure.
  const out = new Uint8Array(buf);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (buf[y * w + x]) continue;
      const n =
        (x > 0 && buf[y * w + x - 1]) ||
        (x < w - 1 && buf[y * w + x + 1]) ||
        (y > 0 && buf[(y - 1) * w + x]) ||
        (y < h - 1 && buf[(y + 1) * w + x]);
      if (n) out[y * w + x] = OUT;
    }
  }

  const rgba = new Uint8ClampedArray(w * h * 4);
  const parsed = palette.map((c) => (c ? hexToRgb(c) : null));
  for (let i = 0; i < out.length; i++) {
    const c = parsed[out[i]];
    if (!c) continue;
    rgba[i * 4] = c[0];
    rgba[i * 4 + 1] = c[1];
    rgba[i * 4 + 2] = c[2];
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
