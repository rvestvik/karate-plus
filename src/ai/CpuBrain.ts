import type { FighterId } from '../config';
import { MAX_BELT } from '../art/palette';
import type { Fighter } from '../fighter/Fighter';
import { inputFor, NO_INPUT, type Command, type InputState } from '../fighter/input';
import { ARCHETYPES, weightedPick, type Archetype } from './archetypes';
import { ATTACKS, MOVES, moveTiming, totalFrames, type AttackInfo, type MoveId } from '../fighter/moves';

/**
 * Drives a CPU fighter through the same virtual joystick as the player.
 * Belt rank sets skill: reaction speed, accuracy, aggression and how often
 * it defends.
 */
export class CpuBrain {
  private hold: InputState = NO_INPUT;
  private holdFrames = 0;
  private cooldown = 0;
  private target: Fighter | null = null;
  private retarget = 0;
  private skill = 0;
  private readonly reacted = new Map<FighterId, number>();
  /** When set, hang back at about this distance and don't attack (waiting a turn in a crowd). */
  standoff: number | null = null;

  constructor(
    private readonly me: Fighter,
    belt: number,
    private readonly rng: () => number = Math.random,
    private readonly profile: Archetype = ARCHETYPES.karateka,
  ) {
    this.setBelt(belt);
  }

  setBelt(belt: number): void {
    this.skill = 0.2 + (0.75 * belt) / MAX_BELT;
  }

  private press(cmd: Command, frames: number): InputState {
    this.hold = inputFor(cmd, this.me.facing);
    this.holdFrames = frames - 1;
    return this.hold;
  }

  /** Starts a move and holds the joystick until the strike lands. */
  private strike(id: MoveId): InputState {
    return this.press(id, moveTiming(MOVES[id]).windup + 1);
  }

  private reactionDelay(): number {
    return Math.round(34 - 26 * this.skill + this.rng() * 14 * (1 - this.skill));
  }

  think(others: Fighter[], leader: FighterId | null): InputState {
    const me = this.me;
    if (me.mode === 'move' && this.holdFrames > 0) {
      this.holdFrames--;
      return this.hold;
    }
    if (!me.actionable) {
      this.holdFrames = 0;
      return NO_INPUT;
    }
    const standing = others.filter((o) => !o.down);
    if (standing.length === 0) return NO_INPUT;

    const defence = this.defend(standing);
    if (defence) return defence;

    if (this.holdFrames > 0) {
      this.holdFrames--;
      return this.hold;
    }
    if (this.cooldown > 0) {
      this.cooldown--;
      return NO_INPUT;
    }

    if (--this.retarget <= 0 || !this.target || !standing.includes(this.target)) {
      this.target = this.pickTarget(standing, leader);
      this.retarget = 40 + Math.floor(this.rng() * 40);
    }
    const t = this.target!;
    const dist = Math.abs(t.x - me.x);
    const side: 1 | -1 = (t.x - me.x) * me.facing >= 0 ? 1 : -1;

    if (this.standoff !== null) return this.hangBack(dist, side, this.standoff);

    const attack = this.chooseAttack(t, dist, side);
    if (attack) {
      this.cooldown = this.reactionDelay();
      return this.strike(attack.move.id);
    }

    if (side < 0) {
      // Target is behind: wait for the auto-turn, or slip away if crowded.
      return dist < 14 ? this.press('walkF', 8) : NO_INPUT;
    }
    const preferred = this.profile.range + Math.round(this.rng() * 6);
    if (dist > preferred + 4) return this.press('walkF', 6 + Math.floor(this.rng() * 10));
    if (dist < 15) {
      if (this.rng() < 0.15 * this.skill) return this.press('somersault', 2);
      return this.press('walkB', 8);
    }
    // In range but no clean shot: feint or pause briefly.
    if (this.rng() < 0.3) return this.press(this.rng() < 0.5 ? 'walkF' : 'walkB', 4);
    this.cooldown = 4;
    return NO_INPUT;
  }

  private hangBack(dist: number, side: 1 | -1, standoff: number): InputState {
    if (side < 0) return NO_INPUT;
    if (dist > standoff + 8) return this.press('walkF', 6 + Math.floor(this.rng() * 8));
    if (dist < standoff - 8) return this.press('walkB', 6);
    this.cooldown = 6 + Math.floor(this.rng() * 10);
    return NO_INPUT;
  }

  /** Reacts once to each incoming attack, if skilled and quick enough. */
  private defend(standing: Fighter[]): InputState | null {
    const me = this.me;
    for (const o of standing) {
      const height = o.attackHeight;
      if (!height || !o.move) continue;
      const dist = Math.abs(o.x - me.x);
      const aimedAtMe = (me.x - o.x) * o.facing > 0 || o.move.id === 'splits';
      if (dist > 50 || !aimedAtMe) continue;
      if (this.reacted.get(o.id) === o.moveSerial) continue;
      const seenAt = Math.round(9 - 7 * this.skill);
      if (o.moveFrame < seenAt) continue;
      this.reacted.set(o.id, o.moveSerial);
      if (this.rng() > (0.15 + 0.7 * this.skill) * this.profile.defence) continue;
      const remaining = totalFrames(o.move) - o.moveFrame;
      const facingThem = (o.x - me.x) * me.facing > 0;
      if (height === 'low') return this.press('jump', 2);
      // Duck under high attacks with a counter punch; walking back blocks the rest.
      if (height === 'high') return this.strike('crouchPunch');
      return facingThem ? this.press('walkB', remaining) : this.press('somersault', 2);
    }
    return null;
  }

  private pickTarget(standing: Fighter[], leader: FighterId | null): Fighter {
    let best = standing[0];
    let bestScore = Infinity;
    for (const o of standing) {
      const score = Math.abs(o.x - this.me.x) - (o.id === leader ? 18 : 0) - (o.isPlayer ? 8 : 0) + this.rng() * 12;
      if (score < bestScore) {
        best = o;
        bestScore = score;
      }
    }
    return best;
  }

  private chooseAttack(t: Fighter, dist: number, side: 1 | -1): AttackInfo | null {
    if (this.rng() > (0.35 + 0.45 * this.skill) * this.profile.aggression) return null;
    const slop = 2 + (1 - this.skill) * 10;
    const options = ATTACKS.filter((a) => {
      if (a.side !== side) return false;
      if (dist < a.range[0] - slop || dist > a.range[1] + slop) return false;
      if (t.move?.id === 'crouchPunch' && a.height === 'high') return false;
      if (t.mode === 'block' && a.height !== 'low' && this.rng() < this.skill) return false;
      if (t.air > 6 && a.height === 'low') return false;
      return true;
    });
    if (options.length === 0) return null;
    return weightedPick(options, (a) => this.profile.moveBias[a.move.id] ?? 1, this.rng);
  }
}
