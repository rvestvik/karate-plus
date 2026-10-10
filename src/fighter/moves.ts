import { jointsOf, hurtOf, type PoseName } from '../art/poses';

/** Body parts that can land a strike. */
export type Effector = 'ff' | 'bf' | 'fh' | 'bh' | 'head';

export interface MoveStep {
  pose: PoseName;
  frames: number;
  /** Effectors that can hit during this step. */
  active?: Effector[];
}

export type MoveId =
  | 'jump'
  | 'flyingKick'
  | 'frontKick'
  | 'sweep'
  | 'somersault'
  | 'highPunch'
  | 'highKick'
  | 'midPunch'
  | 'lowKick'
  | 'splits'
  | 'backKick'
  | 'backRoundhouse'
  | 'headbutt';

export type Height = 'high' | 'mid' | 'low';

export interface MoveDef {
  id: MoveId;
  name: string;
  steps: MoveStep[];
  /** Horizontal travel per frame, positive = forward. */
  dx?: number;
  /** Peak height of a jump arc spanning the whole move. */
  air?: number;
  /** The fighter ends the move facing the other way. */
  turn?: boolean;
}

export const MOVES: Record<MoveId, MoveDef> = {
  jump: { id: 'jump', name: 'JUMP', steps: [{ pose: 'jump', frames: 34 }], air: 30 },
  flyingKick: {
    id: 'flyingKick',
    name: 'FLYING KICK',
    steps: [
      { pose: 'jump', frames: 8 },
      { pose: 'flykick', frames: 14, active: ['ff'] },
      { pose: 'jump', frames: 10 },
    ],
    air: 22,
    dx: 1.6,
  },
  frontKick: {
    id: 'frontKick',
    name: 'FRONT KICK',
    steps: [
      { pose: 'fkickChamber', frames: 7 },
      { pose: 'fkick', frames: 10, active: ['ff'] },
      { pose: 'fkickChamber', frames: 8 },
    ],
  },
  sweep: {
    id: 'sweep',
    name: 'FOOT SWEEP',
    steps: [
      { pose: 'sweepChamber', frames: 8 },
      { pose: 'sweep', frames: 12, active: ['ff'] },
      { pose: 'sweepChamber', frames: 9 },
    ],
  },
  somersault: {
    id: 'somersault',
    name: 'BACK SOMERSAULT',
    steps: [
      { pose: 'tuck', frames: 9 },
      { pose: 'inverted', frames: 12 },
      { pose: 'tuck', frames: 9 },
    ],
    air: 30,
    dx: -2.2,
  },
  highPunch: {
    id: 'highPunch',
    name: 'HIGH PUNCH',
    steps: [
      { pose: 'punchChamber', frames: 5 },
      { pose: 'punchHigh', frames: 9, active: ['fh'] },
      { pose: 'punchChamber', frames: 7 },
    ],
  },
  highKick: {
    id: 'highKick',
    name: 'HIGH KICK',
    steps: [
      { pose: 'hkickChamber', frames: 9 },
      { pose: 'hkick', frames: 10, active: ['ff'] },
      { pose: 'hkickChamber', frames: 9 },
    ],
  },
  midPunch: {
    id: 'midPunch',
    name: 'LUNGE PUNCH',
    steps: [
      { pose: 'punchChamber', frames: 5 },
      { pose: 'punchMid', frames: 9, active: ['fh'] },
      { pose: 'punchChamber', frames: 7 },
    ],
    dx: 0.3,
  },
  lowKick: {
    id: 'lowKick',
    name: 'LOW KICK',
    steps: [
      { pose: 'lkickChamber', frames: 6 },
      { pose: 'lkick', frames: 10, active: ['ff'] },
      { pose: 'lkickChamber', frames: 7 },
    ],
  },
  splits: {
    id: 'splits',
    name: 'SPLITS KICK',
    steps: [
      { pose: 'jump', frames: 7 },
      { pose: 'splits', frames: 14, active: ['ff', 'bf'] },
      { pose: 'jump', frames: 7 },
    ],
    air: 20,
  },
  backKick: {
    id: 'backKick',
    name: 'BACK KICK',
    steps: [
      { pose: 'backkickChamber', frames: 8 },
      { pose: 'backkick', frames: 10, active: ['bf'] },
      { pose: 'backkickChamber', frames: 8 },
    ],
  },
  backRoundhouse: {
    id: 'backRoundhouse',
    name: 'BACK ROUNDHOUSE',
    steps: [
      { pose: 'spinChamber', frames: 8 },
      { pose: 'backRoundhouse', frames: 10, active: ['bf'] },
      { pose: 'spinChamber', frames: 8 },
    ],
    turn: true,
  },
  headbutt: {
    id: 'headbutt',
    name: 'HEAD BUTT',
    steps: [
      { pose: 'headbuttChamber', frames: 8 },
      { pose: 'headbutt', frames: 8, active: ['head'] },
      { pose: 'headbuttChamber', frames: 8 },
    ],
    dx: 0.4,
  },
};

export function totalFrames(m: MoveDef): number {
  return m.steps.reduce((n, s) => n + s.frames, 0);
}

/** Returns the step active at frame `f` (0-based) and its starting frame. */
export function stepAt(m: MoveDef, f: number): { step: MoveStep; start: number } {
  let start = 0;
  for (const step of m.steps) {
    if (f < start + step.frames) return { step, start };
    start += step.frames;
  }
  const last = m.steps[m.steps.length - 1];
  return { step: last, start: start - last.frames };
}

/** Local (facing-right, grounded) position of an effector in a pose. */
export function effectorPoint(pose: PoseName, e: Effector): { x: number; y: number } {
  const j = jointsOf(pose);
  if (e === 'head') return { x: j.head.x + j.up.x * 2, y: j.head.y + j.up.y * 2 };
  return j[e];
}

export interface AttackInfo {
  move: MoveDef;
  /** Which side the strike lands on, relative to facing. */
  side: 1 | -1;
  height: Height;
  /** Fighter-to-fighter distance range where the strike lands cleanly. */
  range: [number, number];
}

/** Precomputed targeting data the CPU uses to pick attacks. */
export function attackInfo(m: MoveDef): AttackInfo | null {
  let start = 0;
  for (const step of m.steps) {
    if (step.active) {
      const e = step.active[0];
      const p = effectorPoint(step.pose, e);
      const air = m.air ? m.air * Math.sin((Math.PI * (start + step.frames / 2)) / totalFrames(m)) : 0;
      const tipY = p.y - air;
      const height: Height = tipY < -31 ? 'high' : tipY < -16 ? 'mid' : 'low';
      const side = p.x >= 0 ? 1 : -1;
      const travel = (m.dx ?? 0) * (start + 2);
      const reach = Math.abs(p.x) + travel * side;
      // A defender's near edge sits about 6px from their origin.
      const halfWidth = -hurtOf('stance').x0;
      return { move: m, side, height, range: [reach + halfWidth - 8, reach + halfWidth - 1] };
    }
    start += step.frames;
  }
  return null;
}

export const ATTACKS: AttackInfo[] = Object.values(MOVES)
  .map(attackInfo)
  .filter((a): a is AttackInfo => a !== null);

export function moveHeight(m: MoveDef): Height | null {
  return ATTACKS.find((a) => a.move === m)?.height ?? null;
}
