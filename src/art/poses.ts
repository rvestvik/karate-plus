import { computeJoints, hurtRect, RADIUS, SEG, type Joints, type Pose, type Rect } from './skeleton';

// Keyframe poses for every animation. Angles follow the convention in
// skeleton.ts: limbs 0 = down, 90 = forward, 180 = up; torso + = lean forward.

const GUARD_ARMS = { fa: [55, 140] as [number, number], ba: [20, 110] as [number, number] };

const JUMP: Pose = { torso: 10, fl: [100, 10], bl: [70, -25], fa: [60, 140], ba: [30, 120] };
/** Airborne poses pin the hip where the jump pose has it, so switching poses mid-air doesn't jolt the body. */
const AIR_HIP = computeJoints(JUMP).hip;
const TUCK: Pose = { torso: 40, fl: [140, 20], bl: [130, 10], fa: [80, 40], ba: [60, 30] };

const BASE_POSES = {
  stance: { torso: 8, fl: [20, -5], bl: [-25, -15], ...GUARD_ARMS },
  crouch: { torso: 30, fl: [82, 0], bl: [25, -95], fa: [70, 150], ba: [40, 120] },
  crouchPunch: { torso: 34, fl: [82, 0], bl: [25, -95], fa: [92, 92], ba: [40, 120] },
  block: { torso: 2, fl: [20, -5], bl: [-25, -15], fa: [100, 172], ba: [20, 110] },
  jump: JUMP,

  fkickChamber: { torso: -5, fl: [92, 0], bl: [-5, -5], fa: [50, 140], ba: [10, 100] },
  fkick: { torso: -15, fl: [88, 88], bl: [-8, -5], fa: [40, 130], ba: [-20, 60] },
  hkickChamber: { torso: -10, fl: [122, 25], bl: [-5, -5], fa: [50, 140], ba: [10, 100] },
  hkick: { torso: -30, fl: [136, 134], bl: [-5, -5], fa: [30, 120], ba: [-40, 20] },
  lkickChamber: { torso: 0, fl: [62, 0], bl: [-10, -10], ...GUARD_ARMS },
  lkick: { torso: -5, fl: [64, 64], bl: [-12, -8], fa: [50, 140], ba: [10, 100] },
  flykick: { torso: -20, fl: [95, 95], bl: [30, -80], fa: [60, 140], ba: [-30, 30] },

  punchChamber: { torso: 5, fl: [30, 0], bl: [-30, -20], fa: [40, 130], ba: [10, 100] },
  punchHigh: { torso: 12, fl: [35, 5], bl: [-38, -30], fa: [114, 114], ba: [15, 120] },
  headbuttChamber: { torso: -15, fl: [20, -5], bl: [-25, -15], fa: [10, 30], ba: [-10, 20] },
  headbutt: { torso: 52, fl: [40, 5], bl: [-40, -35], fa: [-20, 10], ba: [-40, -10] },

  sweepChamber: { torso: 30, fl: [70, -20], bl: [10, -100], fa: [60, 30], ba: [30, 20] },
  sweep: { torso: 35, fl: [86, 88], bl: [10, -100], fa: [40, 5], ba: [-30, -10] },

  splits: { torso: 0, fl: [90, 90], bl: [-90, -90], fa: [125, 115], ba: [-125, -115], hip: AIR_HIP },

  revPunchChamber: { torso: 5, fl: [22, -5], bl: [-22, -12], fa: [40, 110], ba: [70, 160] },
  revPunch: { torso: -12, fl: [28, 0], bl: [-30, -20], fa: [50, 130], ba: [-104, -104] },
  revSweepChamber: { torso: 30, fl: [75, -30], bl: [-40, -100], fa: [70, 30], ba: [50, 20] },
  revSweep: { torso: 40, fl: [80, -40], bl: [-86, -88], fa: [70, 10], ba: [50, 0] },
  spinChamber: { torso: 10, fl: [0, -5], bl: [-75, 10], fa: [40, 100], ba: [-20, 60] },
  backRoundhouse: { torso: 35, fl: [8, 0], bl: [-128, -128], fa: [60, 120], ba: [10, 60] },

  hit: { torso: -25, fl: [25, 10], bl: [-20, -10], fa: [-30, -70], ba: [-60, -100] },
  falling: { torso: -60, fl: [45, 45], bl: [30, 30], fa: [-100, -120], ba: [-80, -90], lift: 5 },
  down: { torso: -90, fl: [95, 90], bl: [80, 95], fa: [-120, -100], ba: [-90, -80] },
  win: { torso: 0, fl: [10, 0], bl: [-10, 0], fa: [168, 176], ba: [20, 100] },
  bow: { torso: 45, fl: [5, 0], bl: [-5, 0], fa: [20, 10], ba: [15, 5] },

  refStand: { torso: 4, fl: [16, 4], bl: [-16, -4], fa: [35, 70], ba: [-30, 40] },
  refPoint: { torso: 4, fl: [16, 4], bl: [-16, -4], fa: [125, 128], ba: [-30, 40] },
  refBoth: { torso: 0, fl: [16, 4], bl: [-16, -4], fa: [150, 165], ba: [-150, -165] },
} satisfies Record<string, Pose>;

export const SPIN_FRAMES = 10;
type SpinName = `spin${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

/**
 * The back somersault: the tuck turned backward in even steps around its own
 * center, which stays at one height so the spin never touches the ground.
 */
function spinPoses(): Record<SpinName, Pose> {
  const rotate = (p: Pose, a: number): Pose => ({
    torso: p.torso + a,
    fl: [p.fl[0] - a, p.fl[1] - a],
    bl: [p.bl[0] - a, p.bl[1] - a],
    fa: [p.fa[0] - a, p.fa[1] - a],
    ba: [p.ba[0] - a, p.ba[1] - a],
  });
  const points = (j: Joints) => [j.hip, j.neck, j.head, j.fk, j.ff, j.bk, j.bf, j.fe, j.fh, j.be, j.bh];
  const origin = { x: 0, y: 0 };
  const frames = Array.from({ length: SPIN_FRAMES }, (_, k) => rotate(TUCK, (-360 * k) / SPIN_FRAMES));
  // Hip-relative center of each frame: the tuck's center turned with the body.
  const c0 = points(computeJoints({ ...TUCK, hip: origin }));
  const cx = c0.reduce((n, q) => n + q.x, 0) / c0.length;
  const cy = c0.reduce((n, q) => n + q.y, 0) / c0.length;
  const centers = frames.map((_, k) => {
    const r = (-2 * Math.PI * k) / SPIN_FRAMES;
    return { x: cx * Math.cos(r) - cy * Math.sin(r), y: cx * Math.sin(r) + cy * Math.cos(r) };
  });
  // Lowest reach below the center over the whole spin, padded like a grounded pose.
  const below = Math.max(
    ...frames.map((f, k) => Math.max(...points(computeJoints({ ...f, hip: origin })).map((q) => q.y - centers[k].y)) + 3.6),
  );
  const out = {} as Record<SpinName, Pose>;
  frames.forEach((f, k) => {
    out[`spin${k}` as SpinName] = { ...f, hip: { x: -centers[k].x, y: -below - centers[k].y } };
  });
  return out;
}

/** Frames in one walk cycle; the body moves one pixel per frame, so this is also the cycle's length in pixels. */
export const WALK_FRAMES = 18;
export type WalkName = `walk${number}`;

/**
 * A shuffle step: the front foot steps out while the back foot is planted,
 * then the back foot follows. Each planted foot slides back exactly one pixel
 * per frame against the hip, so it stays put while the body moves forward.
 * Leg angles come from two-bone IK; the hip dips as the stance widens.
 */
function walkPoses(): Record<WalkName, Pose> {
  const front = 3;
  const back = -7;
  const reach = WALK_FRAMES / 4;
  const footY = 0.5 - RADIUS.foot;
  const leg = (dx: number, dy: number): [number, number] => {
    const len = Math.min(Math.hypot(dx, dy), SEG.thigh + SEG.shin - 0.01);
    const a = (Math.atan2(dx, dy) * 180) / Math.PI;
    const b = (Math.acos(len / (SEG.thigh + SEG.shin)) * 180) / Math.PI;
    return [a + b, a - b];
  };
  /** Offset from the foot's rest spot and lift, half a cycle swinging forward then half planted. */
  const foot = (p: number): [number, number] =>
    p < 0.5 ? [reach * (4 * p - 1), 2.5 * Math.sin(2 * Math.PI * p)] : [reach * (3 - 4 * p), 0];
  const out = {} as Record<WalkName, Pose>;
  for (let k = 0; k < WALK_FRAMES; k++) {
    const p = k / WALK_FRAMES;
    const [fo, fLift] = foot(p);
    const [bo, bLift] = foot((p + 0.5) % 1);
    const fx = front + fo;
    const bx = back + bo;
    const hipY = footY - Math.min(20.8, Math.sqrt(21.6 ** 2 - Math.max(Math.abs(fx), Math.abs(bx)) ** 2));
    out[`walk${k}`] = {
      torso: 8,
      fl: leg(fx, footY - fLift - hipY),
      bl: leg(bx, footY - bLift - hipY),
      ...GUARD_ARMS,
      hip: { x: 0, y: hipY },
    };
  }
  return out;
}

export type PoseName = keyof typeof BASE_POSES | WalkName | SpinName;
export const POSES: Record<PoseName, Pose> = { ...BASE_POSES, ...walkPoses(), ...spinPoses() };

export const POSE_NAMES = Object.keys(POSES) as PoseName[];

const jointCache = new Map<PoseName, Joints>();
const hurtCache = new Map<PoseName, Rect>();

export function jointsOf(name: PoseName): Joints {
  let j = jointCache.get(name);
  if (!j) {
    j = computeJoints(POSES[name] as Pose);
    jointCache.set(name, j);
  }
  return j;
}

export function hurtOf(name: PoseName): Rect {
  let r = hurtCache.get(name);
  if (!r) {
    r = hurtRect(jointsOf(name));
    hurtCache.set(name, r);
  }
  return r;
}
