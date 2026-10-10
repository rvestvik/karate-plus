import { describe, expect, it } from 'vitest';
import { ATTACKS, MOVES, stepAt, totalFrames } from '../src/fighter/moves';
import { POSES } from '../src/art/poses';
import { strike } from '../src/fighter/Hitbox';
import { GROUND_Y } from '../src/config';

describe('moves', () => {
  it('only uses defined poses', () => {
    for (const m of Object.values(MOVES)) {
      for (const s of m.steps) expect(POSES).toHaveProperty(s.pose);
      expect(totalFrames(m)).toBeGreaterThan(0);
    }
  });

  it('finds steps by frame', () => {
    const m = MOVES.frontKick;
    expect(stepAt(m, 0).step.pose).toBe('fkickChamber');
    expect(stepAt(m, 7).step.active).toEqual(['ff']);
    expect(stepAt(m, 999).step.pose).toBe('fkickChamber');
  });

  it('classifies attack heights', () => {
    const h = Object.fromEntries(ATTACKS.map((a) => [a.move.id, a.height]));
    expect(h.highKick).toBe('high');
    expect(h.sweep).toBe('low');
    expect(h.lowKick).toBe('low');
    expect(h.frontKick).toBe('mid');
  });

  it('back attacks strike behind', () => {
    const side = Object.fromEntries(ATTACKS.map((a) => [a.move.id, a.side]));
    expect(side.backKick).toBe(-1);
    expect(side.backRoundhouse).toBe(-1);
    expect(side.frontKick).toBe(1);
  });
});

describe('strike geometry', () => {
  const at = (x: number, facing: 1 | -1, pose: keyof typeof POSES) => ({ x, y: GROUND_Y, facing, pose });

  it('front kick scores a full point at its ideal range', () => {
    const info = ATTACKS.find((a) => a.move.id === 'frontKick')!;
    const d = (info.range[0] + info.range[1]) / 2;
    const r = strike(at(100, 1, 'fkick'), ['ff'], at(100 + d, -1, 'stance'));
    expect(r?.halves).toBe(2);
  });

  it('a jammed kick only scores half', () => {
    const r = strike(at(100, 1, 'fkick'), ['ff'], at(112, -1, 'stance'));
    expect(r?.halves).toBe(1);
  });

  it('misses out of range', () => {
    expect(strike(at(100, 1, 'fkick'), ['ff'], at(160, -1, 'stance'))).toBeNull();
  });

  it('crouching ducks a high kick', () => {
    const info = ATTACKS.find((a) => a.move.id === 'highKick')!;
    const d = (info.range[0] + info.range[1]) / 2;
    expect(strike(at(100, 1, 'hkick'), ['ff'], at(100 + d, -1, 'stance'))).not.toBeNull();
    expect(strike(at(100, 1, 'hkick'), ['ff'], at(100 + d, -1, 'crouch'))).toBeNull();
  });

  it('jumping clears a sweep', () => {
    const info = ATTACKS.find((a) => a.move.id === 'sweep')!;
    const d = (info.range[0] + info.range[1]) / 2;
    expect(strike(at(100, 1, 'sweep'), ['ff'], at(100 + d, -1, 'stance'))).not.toBeNull();
    const airborne = { ...at(100 + d, -1, 'jump'), y: GROUND_Y - 20 };
    expect(strike(at(100, 1, 'sweep'), ['ff'], airborne)).toBeNull();
  });

  it('back kick hits an opponent behind', () => {
    const info = ATTACKS.find((a) => a.move.id === 'backKick')!;
    const d = (info.range[0] + info.range[1]) / 2;
    expect(strike(at(100, 1, 'backkick'), ['bf'], at(100 - d, 1, 'stance'))?.halves).toBe(2);
  });
});
