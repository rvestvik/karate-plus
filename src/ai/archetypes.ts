import type { MoveId } from '../fighter/moves';

export type EnemyKind = 'karateka' | 'rusher' | 'brute' | 'leaper';

/** How a kind of enemy fights; the plain karateka is the baseline every tournament CPU uses. */
export interface Archetype {
  /** Walk speed multiplier. */
  speed: number;
  /** Half points don't stagger, only full points and finishing blows knock down. */
  armor: boolean;
  /** Relative weight of each attack when several are in range (default 1). */
  moveBias: Partial<Record<MoveId, number>>;
  /** Distance it likes to keep from its target. */
  range: number;
  /** Multiplies the chance of attacking when a shot is on. */
  aggression: number;
  /** Multiplies the chance of reacting to an incoming attack. */
  defence: number;
  /** Drawn bigger, purely visual. */
  scale: number;
}

export const ARCHETYPES: Record<EnemyKind, Archetype> = {
  karateka: { speed: 1, armor: false, moveBias: {}, range: 24, aggression: 1, defence: 1, scale: 1 },
  rusher: {
    speed: 1.6,
    armor: false,
    moveBias: { highPunch: 4, reversePunch: 3, frontKick: 3, crouchPunch: 2 },
    range: 18,
    aggression: 1.4,
    defence: 0.6,
    scale: 1,
  },
  brute: {
    speed: 0.7,
    armor: true,
    moveBias: { headbutt: 5, highKick: 2, frontKick: 2 },
    range: 22,
    aggression: 0.9,
    defence: 0.4,
    scale: 1.15,
  },
  leaper: {
    speed: 1.2,
    armor: false,
    moveBias: { flyingKick: 6, highKick: 2 },
    range: 40,
    aggression: 1.1,
    defence: 1.2,
    scale: 1,
  },
};

/** Picks one of `options` with probability proportional to its weight. */
export function weightedPick<T>(options: T[], weight: (o: T) => number, rng: () => number): T {
  const total = options.reduce((s, o) => s + weight(o), 0);
  let r = rng() * total;
  for (const o of options) {
    r -= weight(o);
    if (r < 0) return o;
  }
  return options[options.length - 1];
}
