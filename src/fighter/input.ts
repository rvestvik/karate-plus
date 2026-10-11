import type { MoveId } from './moves';

/** A joystick reading in screen terms: x -1 = left, y -1 = up. */
export interface InputState {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
  fire: boolean;
}

export const NO_INPUT: InputState = { x: 0, y: 0, fire: false };

/** Direction relative to where the fighter faces. */
export type RelDir = 'none' | 'U' | 'UF' | 'F' | 'DF' | 'D' | 'DB' | 'B' | 'UB';

export type Command = MoveId | 'idle' | 'walkF' | 'walkB';

export function toRelative(input: InputState, facing: 1 | -1): RelDir {
  const fx = input.x * facing; // +1 = forward
  const { y } = input;
  if (y < 0) return fx > 0 ? 'UF' : fx < 0 ? 'UB' : 'U';
  if (y > 0) return fx > 0 ? 'DF' : fx < 0 ? 'DB' : 'D';
  return fx > 0 ? 'F' : fx < 0 ? 'B' : 'none';
}

/**
 * The control layout from the IK+ manual: 8 directions with and without
 * fire. Walking back blocks when attacked from the front. Change this table
 * to remap moves.
 */
export const CONTROLS: Record<'plain' | 'fire', Record<RelDir, Command>> = {
  plain: {
    none: 'idle',
    U: 'jump',
    UF: 'highPunch',
    F: 'walkF',
    DF: 'lowKick',
    D: 'sweep',
    DB: 'crouchPunch',
    B: 'walkB',
    UB: 'reversePunch',
  },
  fire: {
    none: 'idle',
    U: 'flyingKick',
    UF: 'headbutt',
    F: 'frontKick',
    DF: 'highKick',
    D: 'reverseSweep',
    DB: 'backRoundhouse',
    B: 'somersault',
    UB: 'splits',
  },
};

export function commandFor(input: InputState, facing: 1 | -1): Command {
  return CONTROLS[input.fire ? 'fire' : 'plain'][toRelative(input, facing)];
}

/** Builds the joystick reading that issues `cmd` for a fighter facing `facing`. */
export function inputFor(cmd: Command, facing: 1 | -1): InputState {
  for (const mode of ['plain', 'fire'] as const) {
    for (const [dir, c] of Object.entries(CONTROLS[mode]) as [RelDir, Command][]) {
      if (c !== cmd) continue;
      const fwd = dir.includes('F') ? 1 : dir.includes('B') ? -1 : 0;
      const y = dir.startsWith('U') ? -1 : dir.startsWith('D') ? 1 : 0;
      return { x: ((fwd * facing) || 0) as -1 | 0 | 1, y, fire: mode === 'fire' };
    }
  }
  return NO_INPUT;
}
