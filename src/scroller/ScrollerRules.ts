import { WIDTH } from '../config';
import { POINTS_PER_HALF } from '../match/MatchRules';
import type { EnemyDef, LevelDef } from './levels';

export const PLAYER_HP = 12;
export const START_LIVES = 3;
export const KO_BONUS = 300;
export const BOSS_BONUS = 2000;
/** Points per remaining half point of health when a level is cleared. */
export const HP_BONUS = 100;

export interface Enemy {
  uid: number;
  def: EnemyDef;
  hp: number;
  boss: boolean;
}

interface Wave {
  atX: number;
  enemies: EnemyDef[];
  boss: boolean;
}

export interface EnemyHit {
  knockdown: boolean;
  ko: boolean;
}

export interface PlayerHit {
  knockdown: boolean;
  lifeLost: boolean;
  gameOver: boolean;
}

/**
 * Scroller rules, with no rendering: player health and lives, enemy health,
 * score and wave progress through one level. Half points stagger, full
 * points and finishing blows knock down.
 */
export class ScrollerRules {
  hp = PLAYER_HP;
  readonly waves: Wave[];
  /** The current (or last) wave's enemies, KO'd ones included. */
  enemies: Enemy[] = [];
  private next = 0;
  private uid = 0;

  constructor(
    readonly level: LevelDef,
    public lives = START_LIVES,
    public score = 0,
  ) {
    this.waves = [
      ...level.waves.map((w) => ({ ...w, boss: false })),
      { atX: level.length - WIDTH, enemies: [level.boss], boss: true },
    ];
  }

  get nextWave(): Wave | null {
    return this.waves[this.next] ?? null;
  }

  /** Enemies of the current wave are still standing. */
  get waveActive(): boolean {
    return this.enemies.some((e) => e.hp > 0);
  }

  get levelCleared(): boolean {
    return this.next >= this.waves.length && !this.waveActive;
  }

  get gameOver(): boolean {
    return this.lives <= 0;
  }

  get boss(): Enemy | null {
    return this.enemies.find((e) => e.boss) ?? null;
  }

  startWave(): Enemy[] {
    const w = this.waves[this.next++];
    if (!w) throw new Error('no wave left');
    this.enemies = w.enemies.map((def) => ({ uid: this.uid++, def, hp: def.hp, boss: w.boss }));
    return this.enemies;
  }

  hitEnemy(uid: number, halves: 1 | 2): EnemyHit {
    const e = this.enemies.find((x) => x.uid === uid);
    if (!e || e.hp <= 0) return { knockdown: false, ko: false };
    e.hp = Math.max(0, e.hp - halves);
    this.score += halves * POINTS_PER_HALF;
    const ko = e.hp === 0;
    if (ko) this.score += e.boss ? BOSS_BONUS : KO_BONUS;
    return { knockdown: halves === 2 || ko, ko };
  }

  /** Losing all health costs a life and refills it; the last life ends the game. */
  hitPlayer(halves: 1 | 2): PlayerHit {
    if (this.gameOver) return { knockdown: true, lifeLost: false, gameOver: true };
    this.hp -= halves;
    let lifeLost = false;
    if (this.hp <= 0) {
      lifeLost = true;
      this.lives--;
      this.hp = this.lives > 0 ? PLAYER_HP : 0;
    }
    return { knockdown: halves === 2 || lifeLost, lifeLost, gameOver: this.gameOver };
  }

  /** Adds and returns the bonus for health left at the end of a level. */
  clearBonus(): number {
    const bonus = this.hp * HP_BONUS;
    this.score += bonus;
    return bonus;
  }
}
