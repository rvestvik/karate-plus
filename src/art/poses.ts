import { computeJoints, hurtRect, type Joints, type Pose, type Rect } from './skeleton';

// Keyframe poses for every animation. Angles follow the convention in
// skeleton.ts: limbs 0 = down, 90 = forward, 180 = up; torso + = lean forward.

const GUARD_ARMS = { fa: [55, 140] as [number, number], ba: [20, 110] as [number, number] };

export const POSES = {
  stance: { torso: 8, fl: [20, -5], bl: [-25, -15], ...GUARD_ARMS },
  walk1: { torso: 8, fl: [30, 8], bl: [-15, -25], ...GUARD_ARMS },
  walk2: { torso: 8, fl: [6, -12], bl: [-32, -8], ...GUARD_ARMS },
  crouch: { torso: 30, fl: [82, 0], bl: [25, -95], fa: [70, 150], ba: [40, 120] },
  block: { torso: 2, fl: [20, -5], bl: [-25, -15], fa: [100, 172], ba: [20, 110] },
  jump: { torso: 10, fl: [100, 10], bl: [70, -25], fa: [60, 140], ba: [30, 120] },

  fkickChamber: { torso: -5, fl: [92, 0], bl: [-5, -5], fa: [50, 140], ba: [10, 100] },
  fkick: { torso: -15, fl: [88, 88], bl: [-8, -5], fa: [40, 130], ba: [-20, 60] },
  hkickChamber: { torso: -10, fl: [122, 25], bl: [-5, -5], fa: [50, 140], ba: [10, 100] },
  hkick: { torso: -30, fl: [136, 134], bl: [-5, -5], fa: [30, 120], ba: [-40, 20] },
  lkickChamber: { torso: 0, fl: [62, 0], bl: [-10, -10], ...GUARD_ARMS },
  lkick: { torso: -5, fl: [64, 64], bl: [-12, -8], fa: [50, 140], ba: [10, 100] },
  flykick: { torso: -20, fl: [95, 95], bl: [30, -80], fa: [60, 140], ba: [-30, 30] },

  punchChamber: { torso: 5, fl: [30, 0], bl: [-30, -20], fa: [40, 130], ba: [10, 100] },
  punchMid: { torso: 18, fl: [40, 5], bl: [-40, -35], fa: [80, 84], ba: [15, 120] },
  punchHigh: { torso: 12, fl: [35, 5], bl: [-38, -30], fa: [114, 114], ba: [15, 120] },
  headbuttChamber: { torso: -15, fl: [20, -5], bl: [-25, -15], fa: [10, 30], ba: [-10, 20] },
  headbutt: { torso: 52, fl: [40, 5], bl: [-40, -35], fa: [-20, 10], ba: [-40, -10] },

  sweepChamber: { torso: 30, fl: [70, -20], bl: [10, -100], fa: [60, 30], ba: [30, 20] },
  sweep: { torso: 35, fl: [86, 88], bl: [10, -100], fa: [40, 5], ba: [-30, -10] },

  tuck: { torso: 40, fl: [140, 20], bl: [130, 10], fa: [80, 40], ba: [60, 30] },
  inverted: { torso: 180, fl: [172, 165], bl: [190, 200], fa: [10, 0], ba: [-10, 0] },
  splits: { torso: 0, fl: [92, 92], bl: [-92, -92], fa: [150, 170], ba: [-150, -170] },

  backkickChamber: { torso: 30, fl: [5, -5], bl: [-60, 30], fa: [60, 140], ba: [20, 110] },
  backkick: { torso: 50, fl: [10, -5], bl: [-95, -95], fa: [70, 140], ba: [30, 110] },
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

export type PoseName = keyof typeof POSES;
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
