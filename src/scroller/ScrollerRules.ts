import { WIDTH } from '../config';
import { POINTS_PER_HALF } from '../match/MatchRules';
import { ARCHETYPES } from '../ai/archetypes';
import type { EnemyDef, LevelDef, PickupKind } from './levels';

export const PLAYER_HP = 12;
export const START_LIVES = 3;
export const KO_BONUS = 300;
export const BOSS_BONUS = 2000;
/** Points per remaining half point of health when a level is cleared. */
export const HP_BONUS = 100;
export const MAX_LIVES = 5;
/** Points for kicking a crab off the beach. */
export const CRAB_POINTS = 200;
/** Chance a regular enemy drops something when KO'd. */
export const DROP_CHANCE = 0.15;

export interface PickupDef {
  /** Half points of health restored. */
  heal?: number;
  score?: number;
  life?: boolean;
}

export const PICKUPS: Record<PickupKind, PickupDef> = {
  rice: { heal: 3 },
  sushi: { heal: 8 },
  coin: { score: 500 },
  scroll: { score: 1000 },
  life: { life: true },
};

/** What a pickup actually did, after caps. */
export interface Collected {
  healed: number;
  points: number;
  life: boolean;
}

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
  /** Armoured enemies shrug off half points without staggering. */
  shrug: boolean;
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
    return this.damageEnemy(uid, halves, true);
  }

  /** A hazard hurts an enemy: no points for the hit itself, but a KO still pays. */
  hazardEnemy(uid: number, halves: 1 | 2): EnemyHit {
    return this.damageEnemy(uid, halves, false);
  }

  private damageEnemy(uid: number, halves: 1 | 2, scored: boolean): EnemyHit {
    const e = this.enemies.find((x) => x.uid === uid);
    if (!e || e.hp <= 0) return { knockdown: false, ko: false, shrug: false };
    e.hp = Math.max(0, e.hp - halves);
    if (scored) this.score += halves * POINTS_PER_HALF;
    const ko = e.hp === 0;
    if (ko) this.score += e.boss ? BOSS_BONUS : KO_BONUS;
    const knockdown = halves === 2 || ko;
    const shrug = !knockdown && ARCHETYPES[e.def.kind ?? 'karateka'].armor;
    return { knockdown, ko, shrug };
  }

  collect(kind: PickupKind): Collected {
    const p = PICKUPS[kind];
    const before = this.hp;
    this.hp = Math.min(PLAYER_HP, this.hp + (p.heal ?? 0));
    let points = p.score ?? 0;
    let life = false;
    if (p.life) {
      // A full set of lives turns the extra one into points.
      if (this.lives < MAX_LIVES) {
        this.lives++;
        life = true;
      } else points += 2000;
    }
    this.score += points;
    return { healed: this.hp - before, points, life };
  }

  addScore(points: number): void {
    this.score += points;
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
