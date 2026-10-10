// Core tuning constants. Everything is in internal pixels (320x200) and 60 Hz frames.

export const WIDTH = 320;
export const HEIGHT = 200;
export const FPS = 60;
export const STEP_MS = 1000 / FPS;

/** Screen y of the fighters' feet. */
export const GROUND_Y = 184;
export const ARENA_MIN_X = 22;
export const ARENA_MAX_X = 298;

export const ROUND_SECONDS = 30;
/** A round ends early once someone has this many half points (6 full points). */
export const WIN_HALF_POINTS = 12;

export const WALK_FORWARD = 1.0;
export const WALK_BACK = 0.8;
/** Frames an opponent must stay behind a fighter before they turn around. */
export const AUTO_TURN_FRAMES = 14;

export type FighterId = 'white' | 'red' | 'blue';

export const START_POSITIONS: Record<FighterId, { x: number; facing: 1 | -1 }> = {
  white: { x: 70, facing: 1 },
  blue: { x: 165, facing: -1 },
  red: { x: 255, facing: -1 },
};

/** Sprite frame size used when baking poses; the origin sits between the feet. */
export const FRAME_W = 64;
export const FRAME_H = 60;
export const ORIGIN_X = 32;
export const ORIGIN_Y = 56;
