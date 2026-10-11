import type { GiColor } from '../art/palette';

export type Theme = 'beach' | 'harbour' | 'temple' | 'mountain';

export interface EnemyDef {
  gi: GiColor;
  belt: number;
  /** Hits to KO, in half points. */
  hp: number;
  /** Which edge of the screen they walk on from. */
  from: 'left' | 'right';
}

export interface WaveDef {
  /** Camera scroll x at which the screen locks and the wave walks on. */
  atX: number;
  enemies: EnemyDef[];
}

export interface LevelDef {
  name: string;
  theme: Theme;
  /** World width in pixels. */
  length: number;
  waves: WaveDef[];
  /** Fought alone at the far end of the level. */
  boss: EnemyDef;
}

const e = (gi: GiColor, belt: number, hp: number, from: 'left' | 'right' = 'right'): EnemyDef => ({ gi, belt, hp, from });

export const LEVELS: LevelDef[] = [
  {
    name: 'THE BEACH',
    theme: 'beach',
    length: 1600,
    waves: [
      { atX: 220, enemies: [e('red', 0, 3)] },
      { atX: 600, enemies: [e('blue', 0, 3), e('red', 1, 3)] },
      { atX: 1000, enemies: [e('blue', 1, 3), e('red', 1, 3), e('green', 2, 3, 'left')] },
    ],
    boss: e('green', 5, 14),
  },
  {
    name: 'THE HARBOUR',
    theme: 'harbour',
    length: 2000,
    waves: [
      { atX: 240, enemies: [e('yellow', 2, 4), e('yellow', 2, 4)] },
      { atX: 640, enemies: [e('blue', 3, 4), e('red', 3, 4, 'left')] },
      { atX: 1040, enemies: [e('yellow', 3, 4), e('green', 4, 4), e('blue', 3, 4)] },
      { atX: 1400, enemies: [e('red', 4, 4), e('yellow', 4, 4, 'left'), e('green', 4, 4)] },
    ],
    boss: e('purple', 8, 16),
  },
  {
    name: 'THE TEMPLE',
    theme: 'temple',
    length: 2200,
    waves: [
      { atX: 240, enemies: [e('purple', 5, 4), e('green', 5, 4, 'left')] },
      { atX: 640, enemies: [e('purple', 5, 5), e('yellow', 6, 4), e('red', 6, 4)] },
      { atX: 1080, enemies: [e('blue', 6, 5), e('purple', 6, 5, 'left'), e('green', 7, 5)] },
      { atX: 1500, enemies: [e('red', 7, 5), e('purple', 7, 5), e('yellow', 7, 5, 'left'), e('blue', 7, 5)] },
    ],
    boss: e('black', 11, 18),
  },
  {
    name: 'THE MOUNTAIN',
    theme: 'mountain',
    length: 2400,
    waves: [
      { atX: 240, enemies: [e('black', 7, 5), e('purple', 8, 5, 'left')] },
      { atX: 680, enemies: [e('black', 8, 5), e('red', 8, 5), e('blue', 9, 5)] },
      { atX: 1120, enemies: [e('black', 9, 5), e('green', 9, 5, 'left'), e('purple', 9, 5)] },
      { atX: 1560, enemies: [e('black', 10, 6), e('black', 10, 6, 'left'), e('yellow', 10, 6), e('red', 10, 6)] },
    ],
    boss: e('black', 15, 24),
  },
];
