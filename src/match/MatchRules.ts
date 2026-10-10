import { LIVES, type FighterId } from '../config';
import { MAX_BELT } from '../art/palette';

export interface Competitor {
  id: FighterId;
  belt: number;
  isPlayer: boolean;
  /** Score in half points. */
  halves: number;
  /** Knockdowns left before this fighter is out. */
  lives: number;
  /** Out of lives and off the mat. */
  out: boolean;
}

/**
 * Scoring and lives for a single round. Every knockdown costs a life, and the
 * round only ends when one fighter is left standing. Pure logic, no rendering.
 */
export class MatchRules {
  readonly competitors: Competitor[];
  /** Knocked-out competitors, first out first. */
  readonly eliminated: Competitor[] = [];

  constructor(entrants: Omit<Competitor, 'halves' | 'lives' | 'out'>[], lives = LIVES) {
    this.competitors = entrants.map((e) => ({ ...e, halves: 0, lives, out: false }));
  }

  get(id: FighterId): Competitor {
    const c = this.competitors.find((c) => c.id === id);
    if (!c) throw new Error(`unknown competitor ${id}`);
    return c;
  }

  /** Competitors still in the round. */
  get active(): Competitor[] {
    return this.competitors.filter((c) => !c.out);
  }

  award(id: FighterId, halves: 1 | 2): void {
    this.get(id).halves += halves;
  }

  /** Takes a life. Returns true when that was the last one and the fighter is out. */
  knockDown(id: FighterId): boolean {
    const c = this.get(id);
    if (c.out) return false;
    c.lives--;
    if (c.lives > 0) return false;
    c.out = true;
    this.eliminated.push(c);
    return true;
  }

  /** One fighter left standing: the round is done. */
  isOver(): boolean {
    return this.active.length <= 1;
  }

  /**
   * Fighters still in, best first: most lives, then most points. Remaining
   * ties go to the player, then to the higher belt.
   */
  ranking(): Competitor[] {
    return this.active.sort(
      (a, b) =>
        b.lives - a.lives ||
        b.halves - a.halves ||
        Number(b.isPlayer) - Number(a.isPlayer) ||
        b.belt - a.belt,
    );
  }

  /** The unique leader, or null when the top is tied on lives and points. */
  leader(): Competitor | null {
    const [a, b] = this.ranking();
    if (!a) return null;
    return !b || a.lives > b.lives || (a.lives === b.lives && a.halves > b.halves) ? a : null;
  }

  /** Final order for the round: still standing first, then the knocked out, last out first. */
  standings(): Competitor[] {
    return [...this.ranking(), ...[...this.eliminated].reverse()];
  }
}

export interface CpuSlot {
  id: 'red' | 'blue';
  belt: number;
}

export interface Campaign {
  round: number;
  playerBelt: number;
  totalScore: number;
  cpus: CpuSlot[];
}

export function newCampaign(): Campaign {
  return {
    round: 1,
    playerBelt: 0,
    totalScore: 0,
    cpus: [
      { id: 'blue', belt: 0 },
      { id: 'red', belt: 1 },
    ],
  };
}

export const POINTS_PER_HALF = 100;
export const FIRST_PLACE_BONUS = 1000;

export interface RoundOutcome {
  campaign: Campaign;
  eliminated: FighterId;
  promoted: boolean;
  gameOver: boolean;
  /** Points the player earned this round. */
  earned: number;
}

/**
 * Applies a finished round, given the final standings (last one standing
 * first). If the player was the first out the game is over; otherwise a
 * stronger CPU takes that spot and the player is promoted one belt for being
 * the last one standing.
 */
export function advanceCampaign(c: Campaign, ranking: Competitor[]): RoundOutcome {
  const player = ranking.find((r) => r.isPlayer);
  if (!player) throw new Error('ranking has no player');
  const loser = ranking[ranking.length - 1];
  const first = ranking[0].isPlayer;
  const earned = player.halves * POINTS_PER_HALF + (first ? FIRST_PLACE_BONUS : 0);
  const gameOver = loser.isPlayer;
  const promoted = !gameOver && first && c.playerBelt < MAX_BELT;
  const next: Campaign = {
    round: c.round + 1,
    playerBelt: promoted ? c.playerBelt + 1 : c.playerBelt,
    totalScore: c.totalScore + earned,
    cpus: c.cpus.map((cpu) =>
      cpu.id === loser.id ? { id: cpu.id, belt: Math.min(MAX_BELT, c.round + 1) } : { ...cpu },
    ),
  };
  return { campaign: next, eliminated: loser.id, promoted, gameOver, earned };
}
