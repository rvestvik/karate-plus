import { describe, expect, it } from 'vitest';
import { WIDTH } from '../src/config';
import { GI, MAX_BELT } from '../src/art/palette';
import { LEVELS } from '../src/scroller/levels';

describe('levels', () => {
  it.each(LEVELS.map((l) => [l.name, l] as const))('%s is well formed', (_, l) => {
    let prev = 0;
    for (const w of l.waves) {
      expect(w.atX).toBeGreaterThan(prev);
      expect(w.enemies.length).toBeGreaterThan(0);
      prev = w.atX + WIDTH / 2;
    }
    expect(prev).toBeLessThanOrEqual(l.length - WIDTH);
    const all = [...l.waves.flatMap((w) => w.enemies), l.boss];
    for (const e of all) {
      expect(GI[e.gi]).toBeDefined();
      expect(e.gi).not.toBe('white');
      expect(e.belt).toBeGreaterThanOrEqual(0);
      expect(e.belt).toBeLessThanOrEqual(MAX_BELT);
      expect(e.hp).toBeGreaterThan(0);
    }
    const waveBelts = l.waves.flatMap((w) => w.enemies.map((e) => e.belt));
    expect(l.boss.belt).toBeGreaterThanOrEqual(Math.max(...waveBelts));
  });

  it('gets harder level by level', () => {
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].boss.belt).toBeGreaterThan(LEVELS[i - 1].boss.belt);
  });
});
