import { describe, expect, it } from 'vitest';
import { POINTS_PER_HALF } from '../src/match/MatchRules';
import { LEVELS } from '../src/scroller/levels';
import { BOSS_BONUS, HP_BONUS, KO_BONUS, PLAYER_HP, ScrollerRules, START_LIVES } from '../src/scroller/ScrollerRules';

const level = LEVELS[0];

describe('ScrollerRules', () => {
  it('staggers on a half point and knocks down on a full point', () => {
    const r = new ScrollerRules(level);
    const [e] = r.startWave();
    e.hp = 10;
    expect(r.hitEnemy(e.uid, 1)).toEqual({ knockdown: false, ko: false });
    expect(r.hitEnemy(e.uid, 2)).toEqual({ knockdown: true, ko: false });
    expect(e.hp).toBe(7);
    expect(r.score).toBe(3 * POINTS_PER_HALF);
  });

  it('knocks down and KOs on the finishing blow, with a bonus', () => {
    const r = new ScrollerRules(level);
    const [e] = r.startWave();
    e.hp = 1;
    expect(r.hitEnemy(e.uid, 1)).toEqual({ knockdown: true, ko: true });
    expect(r.score).toBe(POINTS_PER_HALF + KO_BONUS);
    expect(r.waveActive).toBe(false);
    expect(r.hitEnemy(e.uid, 2)).toEqual({ knockdown: false, ko: false });
  });

  it('costs a life and refills health when the player runs out, then ends the game', () => {
    const r = new ScrollerRules(level);
    for (let i = 0; i < PLAYER_HP / 2 - 1; i++) expect(r.hitPlayer(2).lifeLost).toBe(false);
    const last = r.hitPlayer(1);
    expect(last).toEqual({ knockdown: false, lifeLost: false, gameOver: false });
    expect(r.hitPlayer(1)).toEqual({ knockdown: true, lifeLost: true, gameOver: false });
    expect(r.lives).toBe(START_LIVES - 1);
    expect(r.hp).toBe(PLAYER_HP);
    r.lives = 1;
    r.hp = 1;
    expect(r.hitPlayer(1)).toEqual({ knockdown: true, lifeLost: true, gameOver: true });
    expect(r.hp).toBe(0);
  });

  it('runs every wave, then the boss, before the level is cleared', () => {
    const r = new ScrollerRules(level);
    expect(r.waves).toHaveLength(level.waves.length + 1);
    for (let w = 0; w < r.waves.length; w++) {
      expect(r.levelCleared).toBe(false);
      const isBoss = w === r.waves.length - 1;
      const enemies = r.startWave();
      expect(enemies.every((e) => e.boss === isBoss)).toBe(true);
      expect(r.waveActive).toBe(true);
      for (const e of enemies) while (e.hp > 0) r.hitEnemy(e.uid, 2);
      expect(r.waveActive).toBe(false);
    }
    expect(r.nextWave).toBeNull();
    expect(r.levelCleared).toBe(true);
    expect(r.boss?.hp).toBe(0);
    expect(r.score).toBeGreaterThanOrEqual(BOSS_BONUS);
  });

  it('pays a bonus for health left at the end', () => {
    const r = new ScrollerRules(level, 2, 500);
    r.hp = 5;
    expect(r.clearBonus()).toBe(5 * HP_BONUS);
    expect(r.score).toBe(500 + 5 * HP_BONUS);
  });
});
