import Phaser from 'phaser';
import type { Fighter } from './Fighter';
import { strike, type StrikeResult } from './Hitbox';
import { moveHeight } from './moves';

export interface Hit {
  a: Fighter;
  d: Fighter;
  r: StrikeResult;
}

/**
 * Checks every active strike in random order. Blocked strikes are reported
 * through `onBlock` and the search carries on; the first strike that lands is
 * returned, so at most one scores per frame.
 */
export function findHit(
  fighters: Fighter[],
  onBlock: (hit: Hit) => void,
  canHit: (a: Fighter, d: Fighter) => boolean = () => true,
): Hit | null {
  const attackers = Phaser.Utils.Array.Shuffle([...fighters]);
  for (const a of attackers) {
    if (a.out) continue;
    const effectors = a.activeEffectors;
    if (!effectors) continue;
    for (const d of fighters) {
      if (d === a || !d.hittable || !canHit(a, d)) continue;
      const r = strike(a.body, effectors, d.body);
      if (!r) continue;
      a.hasHit = true;
      const fromFront = (a.x - d.x) * d.facing > 0;
      if (d.mode === 'block' && fromFront && moveHeight(a.move!) !== 'low') {
        onBlock({ a, d, r });
        break;
      }
      return { a, d, r };
    }
  }
  return null;
}
