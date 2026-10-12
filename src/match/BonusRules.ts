import { GROUND_Y, WIDTH } from '../config';
import type { Rect } from '../art/skeleton';

// The IK+ bonus round, without rendering: bouncing balls come in from both
// sides and the player bats them away. Pure logic so it can be tested.

export const BONUS_FRAMES = 20 * 60;
/** After time is up, balls still in play get this long to clear. */
export const BONUS_OVERTIME = 180;
export const BALL_R = 4;
export const GRAVITY = 0.12;
export const DEFLECT_POINTS = 100;
export const PERFECT_BONUS = 1000;

/** True after the rounds that earn a bonus round before the next one. */
export function bonusAfter(round: number): boolean {
  return round % 2 === 0;
}

export type BallState = 'live' | 'deflected' | 'touched';

export interface Ball {
  id: number;
  x: number;
  /** Centre of the ball. */
  y: number;
  vx: number;
  vy: number;
  /** Upward speed each bounce restores, so every ball keeps its own arc. */
  bounce: number;
  state: BallState;
}

export class BonusRules {
  frame = 0;
  score = 0;
  deflected = 0;
  touched = 0;
  balls: Ball[] = [];
  private uid = 0;
  private nextSpawn = 40;

  constructor(private readonly rng: () => number = Math.random) {}

  /** 0 at the start, 1 when time runs out: balls come faster and more often. */
  get pressure(): number {
    return Math.min(1, this.frame / BONUS_FRAMES);
  }

  get timeLeft(): number {
    return Math.max(0, Math.ceil((BONUS_FRAMES - this.frame) / 60));
  }

  get over(): boolean {
    if (this.frame < BONUS_FRAMES) return false;
    return this.frame >= BONUS_FRAMES + BONUS_OVERTIME || !this.balls.some((b) => b.state === 'live');
  }

  get perfect(): boolean {
    return this.touched === 0 && this.deflected > 0;
  }

  /** Total points, perfect bonus included. */
  get total(): number {
    return this.score + (this.perfect ? PERFECT_BONUS : 0);
  }

  step(): void {
    this.frame++;
    if (this.frame < BONUS_FRAMES && --this.nextSpawn <= 0) {
      this.spawn();
      const p = this.pressure;
      this.nextSpawn = Math.round(100 - 55 * p + this.rng() * 30);
    }
    for (const b of this.balls) {
      b.vy += GRAVITY;
      b.x += b.vx;
      b.y += b.vy;
      if (b.y >= GROUND_Y - BALL_R && b.vy > 0) {
        b.y = GROUND_Y - BALL_R;
        b.vy = b.state === 'live' ? -b.bounce : -b.vy * 0.5;
      }
    }
    this.balls = this.balls.filter((b) => b.x > -20 && b.x < WIDTH + 20);
  }

  /** A new ball enters from a random side at a height that makes it hit high, middle or low. */
  spawn(): Ball {
    const fromLeft = this.rng() < 0.5;
    const speed = 0.9 + 0.8 * this.pressure + this.rng() * 0.3;
    // Bounce apex 22–56 px above the ground: from the shins to the head.
    const apex = 22 + this.rng() * 34;
    const ball: Ball = {
      id: this.uid++,
      x: fromLeft ? -8 : WIDTH + 8,
      y: GROUND_Y - BALL_R - apex,
      vx: fromLeft ? speed : -speed,
      vy: 0,
      bounce: Math.sqrt(2 * GRAVITY * apex),
      state: 'live',
    };
    this.balls.push(ball);
    return ball;
  }

  static rect(b: Ball): Rect {
    return { x0: b.x - BALL_R, x1: b.x + BALL_R, y0: b.y - BALL_R, y1: b.y + BALL_R };
  }

  /** Struck away by a punch or kick; `dir` is which way it flies. */
  deflect(b: Ball, dir: 1 | -1): void {
    if (b.state !== 'live') return;
    b.state = 'deflected';
    b.vx = dir * 3.2;
    b.vy = -3;
    this.deflected++;
    this.score += DEFLECT_POINTS;
  }

  /** Hit the player: no penalty except losing the perfect bonus. */
  touch(b: Ball): void {
    if (b.state !== 'live') return;
    b.state = 'touched';
    b.vx *= -0.8;
    b.vy = -1;
    this.touched++;
  }
}
