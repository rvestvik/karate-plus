import { describe, expect, it } from 'vitest';
import { CONTROLS, commandFor, inputFor, toRelative, type Command, type RelDir } from '../src/fighter/input';
import { MOVES } from '../src/fighter/moves';

describe('input', () => {
  it('maps directions relative to facing', () => {
    expect(toRelative({ x: 1, y: 0, fire: false }, 1)).toBe('F');
    expect(toRelative({ x: 1, y: 0, fire: false }, -1)).toBe('B');
    expect(toRelative({ x: -1, y: -1, fire: false }, -1)).toBe('UF');
    expect(toRelative({ x: 0, y: 1, fire: true }, 1)).toBe('D');
    expect(toRelative({ x: 0, y: 0, fire: false }, -1)).toBe('none');
  });

  it('gives 16 distinct moves across directions and fire', () => {
    const dirs = Object.keys(CONTROLS.plain).filter((d) => d !== 'none') as RelDir[];
    const all = [...dirs.map((d) => CONTROLS.plain[d]), ...dirs.map((d) => CONTROLS.fire[d])];
    expect(new Set(all).size).toBe(16);
  });

  it('maps every move id to a defined move', () => {
    const nonMoves: Command[] = ['idle', 'walkF', 'walkB', 'crouch', 'block'];
    for (const table of Object.values(CONTROLS)) {
      for (const cmd of Object.values(table)) {
        if (!nonMoves.includes(cmd)) expect(MOVES).toHaveProperty(cmd);
      }
    }
  });

  it('round-trips commands through inputFor for both facings', () => {
    for (const table of Object.values(CONTROLS)) {
      for (const cmd of Object.values(table)) {
        for (const facing of [1, -1] as const) {
          expect(commandFor(inputFor(cmd, facing), facing)).toBe(cmd);
        }
      }
    }
  });
});
