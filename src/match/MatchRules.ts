import { FPS, ROUND_SECONDS, WIN_HALF_POINTS, type FighterId } from '../config';
import { MAX_BELT } from '../art/palette';

export interface Competitor {
  id: FighterId;
  belt: number;
  isPlayer: boolean;
  /** Score in half points. */
  halves: number;
}

/** Scoring and timing for a single round. Pure logic, no rendering. */
export class MatchRules {
  readonly competitors: Competitor[];
  framesLeft: number;

  constructor(entrants: Omit<Competitor, 'halves'>[], seconds = ROUND_SECONDS) {
    this.competitors = entrants.map((e) => ({ ...e, halves: 0 }));
    this.framesLeft = seconds * FPS;
  }

  get(id: FighterId): Competitor {
    const c = this.competitors.find((c) => c.id === id);
    if (!c) throw new Error(`unknown competitor ${id}`);
    return c;
  }

  award(id: FighterId, halves: 1 | 2): void {
    const c = this.get(id);
    c.halves = Math.min(WIN_HALF_POINTS, c.halves + halves);
  }

  tick(): void {
    if (this.framesLeft > 0) this.framesLeft--;
  }

  get secondsLeft(): number {
    return Math.ceil(this.framesLeft / FPS);
  }

  isOver(): boolean {
    return this.framesLeft <= 0 || this.competitors.some((c) => c.halves >= WIN_HALF_POINTS);
  }

  /**
   * Best first. Ties go to the player, then to the higher belt, so a CPU is
   * never knocked out ahead of the player on a draw.
   */
  ranking(): Competitor[] {
    return [...this.competitors].sort(
      (a, b) => b.halves - a.halves || Number(b.isPlayer) - Number(a.isPlayer) || b.belt - a.belt,
    );
  }

  /** The unique leader, or null when the top is tied. */
  leader(): Competitor | null {
    const [a, b] = this.ranking();
    return a.halves > b.halves ? a : null;
  }

  loser(): Competitor {
    const r = this.ranking();
    return r[r.length - 1];
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
 * Applies a finished round: the last-placed fighter is eliminated. If that is
 * the player the game is over; otherwise a stronger CPU takes the empty spot
 * and the player is promoted one belt for winning the round outright.
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
