import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '../src/config';
import { strike, strikeBox, worldHurt, type Body } from '../src/fighter/Hitbox';

describe('strikeBox', () => {
  const att: Body = { x: 100, y: GROUND_Y, facing: 1, pose: 'punchHigh' };
  it('matches strike() against the same body', () => {
    for (let x = 105; x < 150; x += 3) {
      const def: Body = { x, y: GROUND_Y, facing: -1, pose: 'stance' };
      expect(strikeBox(att, ['fh'], worldHurt(def))).toEqual(strike(att, ['fh'], def));
    }
  });
  it('misses a rect out of reach', () => {
    expect(strikeBox(att, ['fh'], { x0: 200, x1: 210, y0: 0, y1: 200 })).toBeNull();
  });
});
