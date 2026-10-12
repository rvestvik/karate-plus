import { describe, expect, it } from 'vitest';
import { BONUS_FRAMES, BonusRules, bonusAfter, DEFLECT_POINTS, PERFECT_BONUS } from '../src/match/BonusRules';

describe('BonusRules', () => {
  it('throws balls in over time and keeps them bouncing', () => {
    const r = new BonusRules(() => 0.5);
    for (let i = 0; i < 300; i++) r.step();
    expect(r.balls.length).toBeGreaterThan(0);
    expect(r.balls.every((b) => b.y <= 184)).toBe(true);
  });

  it('scores deflections and a perfect bonus when nothing touches the player', () => {
    const r = new BonusRules(() => 0.5);
    const a = r.spawn();
    const b = r.spawn();
    r.deflect(a, 1);
    r.deflect(a, 1);
    expect(r.score).toBe(DEFLECT_POINTS);
    expect(r.total).toBe(DEFLECT_POINTS + PERFECT_BONUS);
    r.touch(b);
    expect(r.perfect).toBe(false);
    expect(r.total).toBe(DEFLECT_POINTS);
  });

  it('ends after time runs out and the last ball is gone', () => {
    const r = new BonusRules(() => 0.5);
    for (let i = 0; i < BONUS_FRAMES - 1; i++) r.step();
    expect(r.over).toBe(false);
    for (let i = 0; i < 400 && !r.over; i++) r.step();
    expect(r.over).toBe(true);
    expect(r.timeLeft).toBe(0);
  });

  it('comes after every second round', () => {
    expect([1, 2, 3, 4].map(bonusAfter)).toEqual([false, true, false, true]);
  });
});
