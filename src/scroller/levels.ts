import type { EnemyKind } from '../ai/archetypes';
import type { GiColor } from '../art/palette';

export type Theme = 'beach' | 'harbour' | 'temple' | 'mountain';

export interface EnemyDef {
  gi: GiColor;
  belt: number;
  /** Hits to KO, in half points. */
  hp: number;
  /** Which edge of the screen they walk on from. */
  from: 'left' | 'right';
  /** Fighting style; plain karateka if left out. */
  kind?: EnemyKind;
}

export interface WaveDef {
  /** Camera scroll x at which the screen locks and the wave walks on. */
  atX: number;
  enemies: EnemyDef[];
}

export type PropKind = 'crate' | 'barrel' | 'urn';
export type PickupKind = 'rice' | 'sushi' | 'coin' | 'scroll' | 'life';
export type HazardKind = 'crab' | 'hook' | 'tile' | 'boulder';

/** A breakable that stands on the ground at world `x` and may hold a pickup. */
export interface PropDef {
  kind: PropKind;
  x: number;
  drop: PickupKind | null;
}

/** A stretch of the level where a hazard is active while it is on screen. */
export interface HazardDef {
  kind: HazardKind;
  x0: number;
  x1: number;
}

export interface LevelDef {
  name: string;
  theme: Theme;
  /** World width in pixels. */
  length: number;
  waves: WaveDef[];
  /** Fought alone at the far end of the level. */
  boss: EnemyDef;
  props: PropDef[];
  hazards: HazardDef[];
}

const e = (gi: GiColor, belt: number, hp: number, from: 'left' | 'right' = 'right', kind?: EnemyKind): EnemyDef => ({
  gi,
  belt,
  hp,
  from,
  ...(kind ? { kind } : {}),
});
const props = (kind: PropKind, list: [number, PickupKind | null][]): PropDef[] => list.map(([x, drop]) => ({ kind, x, drop }));

export const LEVELS: LevelDef[] = [
  {
    name: 'THE BEACH',
    theme: 'beach',
    length: 1600,
    waves: [
      { atX: 220, enemies: [e('red', 0, 3)] },
      { atX: 600, enemies: [e('blue', 0, 3), e('red', 1, 3)] },
      { atX: 1000, enemies: [e('blue', 1, 3, 'right', 'rusher'), e('red', 1, 3), e('green', 2, 3, 'left')] },
    ],
    boss: e('green', 5, 14, 'right', 'rusher'),
    props: props('crate', [
      [170, 'coin'],
      [470, 'rice'],
      [820, null],
      [900, 'scroll'],
      [1200, 'sushi'],
    ]),
    hazards: [
      { kind: 'crab', x0: 380, x1: 580 },
      { kind: 'crab', x0: 760, x1: 980 },
    ],
  },
  {
    name: 'THE HARBOUR',
    theme: 'harbour',
    length: 2000,
    waves: [
      { atX: 240, enemies: [e('yellow', 2, 4, 'right', 'rusher'), e('yellow', 2, 4, 'right', 'rusher')] },
      { atX: 640, enemies: [e('blue', 3, 4), e('red', 3, 4, 'left')] },
      { atX: 1040, enemies: [e('yellow', 3, 4, 'right', 'rusher'), e('green', 4, 4), e('blue', 3, 4)] },
      {
        atX: 1400,
        enemies: [e('red', 4, 4), e('yellow', 4, 4, 'left', 'rusher'), e('green', 4, 5, 'right', 'brute')],
      },
    ],
    boss: e('purple', 8, 16, 'right', 'brute'),
    props: props('barrel', [
      [200, 'rice'],
      [560, 'coin'],
      [960, null],
      [1300, 'sushi'],
      [1620, 'rice'],
    ]),
    hazards: [
      { kind: 'hook', x0: 440, x1: 520 },
      { kind: 'hook', x0: 1220, x1: 1300 },
    ],
  },
  {
    name: 'THE TEMPLE',
    theme: 'temple',
    length: 2200,
    waves: [
      { atX: 240, enemies: [e('purple', 5, 4), e('green', 5, 4, 'left')] },
      { atX: 640, enemies: [e('purple', 5, 6, 'right', 'brute'), e('yellow', 6, 4), e('red', 6, 4)] },
      { atX: 1080, enemies: [e('blue', 6, 5), e('purple', 6, 5, 'left', 'leaper'), e('green', 7, 5)] },
      {
        atX: 1500,
        enemies: [
          e('red', 7, 5),
          e('purple', 7, 6, 'right', 'brute'),
          e('yellow', 7, 5, 'left', 'rusher'),
          e('blue', 7, 5),
        ],
      },
    ],
    boss: e('black', 11, 18, 'right', 'leaper'),
    props: props('urn', [
      [200, 'scroll'],
      [560, 'rice'],
      [900, 'coin'],
      [1380, 'sushi'],
      [1800, 'life'],
    ]),
    hazards: [
      { kind: 'tile', x0: 420, x1: 620 },
      { kind: 'tile', x0: 1250, x1: 1480 },
    ],
  },
  {
    name: 'THE MOUNTAIN',
    theme: 'mountain',
    length: 2400,
    waves: [
      { atX: 240, enemies: [e('black', 7, 6, 'right', 'brute'), e('purple', 8, 5, 'left')] },
      { atX: 680, enemies: [e('black', 8, 5), e('red', 8, 5), e('blue', 9, 5, 'right', 'leaper')] },
      {
        atX: 1120,
        enemies: [e('black', 9, 5), e('green', 9, 5, 'left', 'leaper'), e('purple', 9, 6, 'right', 'brute')],
      },
      {
        atX: 1560,
        enemies: [
          e('black', 10, 6),
          e('black', 10, 6, 'left', 'rusher'),
          e('yellow', 10, 6, 'right', 'leaper'),
          e('red', 10, 6, 'right', 'brute'),
        ],
      },
    ],
    boss: e('black', 15, 24),
    props: props('crate', [
      [200, 'rice'],
      [600, 'coin'],
      [1000, 'sushi'],
      [1480, 'scroll'],
      [1980, 'sushi'],
    ]),
    hazards: [
      { kind: 'boulder', x0: 400, x1: 660 },
      { kind: 'boulder', x0: 1300, x1: 1540 },
    ],
  },
];
