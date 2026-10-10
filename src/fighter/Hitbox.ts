import { hurtOf, jointsOf, type PoseName } from '../art/poses';
import type { Rect } from '../art/skeleton';
import { effectorPoint, type Effector } from './moves';

/** The minimal body state needed for hit geometry, in world space. */
export interface Body {
  x: number;
  /** World y of the origin (ground minus jump height). */
  y: number;
  facing: 1 | -1;
  pose: PoseName;
}

export function worldHurt(b: Body): Rect {
  const r = hurtOf(b.pose);
  const xa = b.x + r.x0 * b.facing;
  const xb = b.x + r.x1 * b.facing;
  return { x0: Math.min(xa, xb), x1: Math.max(xa, xb), y0: b.y + r.y0, y1: b.y + r.y1 };
}

function inside(r: Rect, x: number, y: number, pad = 1): boolean {
  return x >= r.x0 - pad && x <= r.x1 + pad && y >= r.y0 - pad && y <= r.y1 + pad;
}

/** The joint a striking limb extends from, so the outer half of the limb can be sampled. */
const ROOT: Record<Effector, 'fk' | 'bk' | 'fe' | 'be' | null> = {
  ff: 'fk',
  bf: 'bk',
  fh: 'fe',
  bh: 'be',
  head: null,
};

/** How deep (in px) the tip may sink past the near edge for a clean full point. */
export const CLEAN_DEPTH = 9;

export interface StrikeResult {
  /** 2 half points for a clean, fully extended strike, else 1. */
  halves: 1 | 2;
  /** World y of the striking tip, for effects. */
  tipX: number;
  tipY: number;
}

/**
 * Tests a strike against a defender. The outer half of the striking limb has
 * to touch the defender's hurtbox. It is a full point when the very tip lands
 * just inside the near edge (perfect range), and a half point when the
 * attacker is jammed too close or only clips with the shin or forearm.
 */
export function strike(att: Body, effectors: Effector[], def: Body): StrikeResult | null {
  const box = worldHurt(def);
  const j = jointsOf(att.pose);
  for (const e of effectors) {
    const tipL = effectorPoint(att.pose, e);
    const root = ROOT[e];
    const rootL = root ? j[root] : tipL;
    const toWorld = (p: { x: number; y: number }) => ({ x: att.x + p.x * att.facing, y: att.y + p.y });
    const tip = toWorld(tipL);
    const base = toWorld(rootL);
    let touched = false;
    for (let i = 0; i <= 4 && !touched; i++) {
      const t = 0.5 + i * 0.125;
      touched = inside(box, base.x + (tip.x - base.x) * t, base.y + (tip.y - base.y) * t);
    }
    if (!touched) continue;
    const hip = att.x + j.hip.x * att.facing;
    const dir = tip.x >= hip ? 1 : -1;
    const depth = dir > 0 ? tip.x - box.x0 : box.x1 - tip.x;
    const clean = inside(box, tip.x, tip.y) && depth <= CLEAN_DEPTH;
    return { halves: clean ? 2 : 1, tipX: tip.x, tipY: tip.y };
  }
  return null;
}
