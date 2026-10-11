import Phaser from 'phaser';
import {
  ARENA_MAX_X,
  ARENA_MIN_X,
  AUTO_TURN_FRAMES,
  DOWN_FRAMES,
  GRACE_FRAMES,
  GROUND_Y,
  WALK_BACK,
  WALK_FORWARD,
  type FighterId,
} from '../config';
import { bakeFighter } from '../art/bakeFrames';
import type { GiColor } from '../art/palette';
import type { PoseName } from '../art/poses';
import { sfx } from '../audio/sfx';
import { commandFor, NO_INPUT, type Command, type InputState } from './input';
import type { Body } from './Hitbox';
import { MOVES, moveHeight, moveTiming, stepAt, totalFrames, type Effector, type Height, type MoveDef } from './moves';

export type Mode = 'idle' | 'walk' | 'block' | 'move' | 'hit' | 'bow' | 'win';

const HIT_REEL = 10;
const HIT_FALL = 22;
/** How close an attacker in front must be for walking back to become a block. */
const BLOCK_RANGE = 44;

/** One karateka: fixed-step state machine plus its sprite and shadow. */
export class Fighter {
  x = 0;
  facing: 1 | -1 = 1;
  /** Height above the ground while airborne. */
  air = 0;
  mode: Mode = 'idle';
  pose: PoseName = 'stance';
  move: MoveDef | null = null;
  moveFrame = 0;
  /** Increments every time a move starts, so observers can tell moves apart. */
  moveSerial = 0;
  hasHit = false;
  /** Out of lives: stays down instead of getting up. */
  out = false;
  /** Frames left in which this fighter can't be hit, after getting up. */
  grace = 0;
  /** How far this fighter can walk; the scroller moves these with the camera. */
  minX = ARENA_MIN_X;
  maxX = ARENA_MAX_X;
  /** Frames spent on the ground after a knockdown. */
  downFrames = DOWN_FRAMES;
  /** Invulnerable frames after getting up from a knockdown, and after a stagger. */
  graceFrames = GRACE_FRAMES;
  staggerGrace = 0;

  private walkFrames = 0;
  private behindFrames = 0;
  private timer = 0;
  private pushDir = 0;
  /** Reeling from a light hit: back on their feet without falling. */
  private staggered = false;
  /** Last frame's joystick, so chaining needs a fresh selection. */
  private lastInput: InputState = NO_INPUT;
  /** Just turned around: the held stick now means something else, so wait for a fresh input. */
  private turned = false;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    readonly id: FighterId,
    public belt: number,
    readonly isPlayer: boolean,
    gi: GiColor = id,
  ) {
    const key = bakeFighter(scene, gi, belt);
    this.shadow = scene.add.image(0, GROUND_Y, 'shadow').setDepth(5);
    this.sprite = scene.add.sprite(0, GROUND_Y, key, 'stance').setOrigin(0.5, 56 / 60);
  }

  /** True when the fighter can take a new command. */
  get actionable(): boolean {
    return this.mode === 'idle' || this.mode === 'walk' || this.mode === 'block';
  }

  get down(): boolean {
    return this.mode === 'hit';
  }

  /** Can take a hit right now. */
  get hittable(): boolean {
    return !this.down && !this.out && this.grace === 0;
  }

  get body(): Body {
    return { x: this.x, y: GROUND_Y - this.air, facing: this.facing, pose: this.pose };
  }

  /** Effectors that can land a strike this frame, if any. */
  get activeEffectors(): Effector[] | null {
    if (this.mode !== 'move' || !this.move || this.hasHit) return null;
    return stepAt(this.move, this.moveFrame).step.active ?? null;
  }

  get attackHeight(): Height | null {
    return this.mode === 'move' && this.move ? moveHeight(this.move) : null;
  }

  place(x: number, facing: 1 | -1): void {
    this.x = x;
    this.facing = facing;
    this.air = 0;
    this.mode = 'idle';
    this.pose = 'stance';
    this.move = null;
    this.behindFrames = 0;
  }

  bow(frames: number): void {
    this.mode = 'bow';
    this.timer = frames;
    this.move = null;
    this.air = 0;
  }

  celebrate(): void {
    this.mode = 'win';
    this.move = null;
    this.air = 0;
  }

  /** Knocked down, or with `knockdown` false only staggered back a step. */
  takeHit(fromX: number, knockdown = true): void {
    this.facing = fromX >= this.x ? 1 : -1;
    this.pushDir = -this.facing;
    this.staggered = !knockdown;
    this.mode = 'hit';
    this.move = null;
    this.air = 0;
    this.timer = 0;
  }

  /** Nudged back after blocking a strike. */
  knockBack(px: number): void {
    this.x -= this.facing * px;
    this.clamp();
  }

  step(input: InputState, others: Fighter[]): void {
    if (this.grace > 0) this.grace--;
    switch (this.mode) {
      case 'move':
        this.advanceMove(input);
        break;
      case 'hit':
        this.timer++;
        if (this.staggered) {
          this.pose = 'hit';
          this.x += this.pushDir * 1.1;
          if (this.timer >= HIT_REEL) {
            this.mode = 'idle';
            this.pose = 'stance';
            this.grace = this.staggerGrace;
          }
          break;
        }
        this.pose = this.timer < HIT_REEL ? 'hit' : this.timer < HIT_FALL ? 'falling' : 'down';
        if (this.timer < HIT_FALL) this.x += this.pushDir * 1.1;
        if (this.timer === HIT_FALL) sfx.thud();
        if (this.timer >= HIT_FALL + this.downFrames && !this.out) {
          this.mode = 'idle';
          this.pose = 'stance';
          this.grace = this.graceFrames;
        }
        break;
      case 'bow':
        this.pose = 'bow';
        if (--this.timer <= 0) this.mode = 'idle';
        break;
      case 'win':
        this.pose = 'win';
        break;
      default:
        if (this.turned && sameInput(input, this.lastInput)) {
          this.control('idle', others);
        } else {
          this.turned = false;
          this.control(commandFor(input, this.facing), others);
        }
    }
    this.lastInput = input;
    this.clamp();
  }

  private control(cmd: Command, others: Fighter[]): void {
    this.mode = 'idle';
    this.pose = 'stance';
    switch (cmd) {
      case 'idle':
        break;
      case 'walkB':
        if (this.threatened(others)) {
          this.mode = 'block';
          this.pose = 'block';
          break;
        }
      // falls through
      case 'walkF':
        this.mode = 'walk';
        this.x += cmd === 'walkF' ? WALK_FORWARD * this.facing : -WALK_BACK * this.facing;
        this.walkFrames++;
        this.pose = Math.floor(this.walkFrames / 8) % 2 ? 'walk1' : 'walk2';
        break;
      default:
        this.startMove(MOVES[cmd]);
        return;
    }
    this.autoTurn(others);
  }

  /** An opponent in front, facing this way, is mid-attack at close range. */
  private threatened(others: Fighter[]): boolean {
    return others.some((o) => {
      if (o.mode !== 'move' || !o.attackHeight) return false;
      const dx = o.x - this.x;
      return dx * this.facing > 0 && -dx * o.facing > 0 && Math.abs(dx) < BLOCK_RANGE;
    });
  }

  /** Turns to face the action once every standing opponent is behind. */
  private autoTurn(others: Fighter[]): void {
    const standing = others.filter((o) => !o.down);
    const allBehind = standing.length > 0 && standing.every((o) => (o.x - this.x) * this.facing < -2);
    this.behindFrames = allBehind ? this.behindFrames + 1 : 0;
    if (this.behindFrames >= AUTO_TURN_FRAMES) {
      this.facing = this.facing === 1 ? -1 : 1;
      this.behindFrames = 0;
    }
  }

  private startMove(m: MoveDef): void {
    this.mode = 'move';
    this.move = m;
    this.moveFrame = 0;
    this.moveSerial++;
    this.hasHit = false;
    this.turned = false;
    this.pose = m.steps[0].pose;
  }

  private advanceMove(input: InputState): void {
    const m = this.move!;
    this.moveFrame++;
    const total = totalFrames(m);
    const { windup, recovery } = moveTiming(m);
    // Letting go of the joystick before the strike lands cancels it, though a turn still happens.
    if (this.moveFrame >= total || (this.moveFrame < windup && commandFor(input, this.facing) !== m.id)) {
      this.endMove();
      return;
    }
    // A fresh selection during recovery chains straight into the next move.
    if (this.moveFrame >= recovery) {
      const facing = m.turn ? (this.facing === 1 ? -1 : 1) : this.facing;
      const cmd = commandFor(input, facing);
      if (!sameInput(input, this.lastInput) && cmd in MOVES) {
        this.endMove();
        this.startMove(MOVES[cmd as keyof typeof MOVES]);
        return;
      }
    }
    const { step, start } = stepAt(m, this.moveFrame);
    if (step.active && this.moveFrame === start) sfx.whoosh();
    this.pose = step.pose;
    this.x += (m.dx ?? 0) * this.facing;
    this.air = m.air ? m.air * Math.sin((Math.PI * this.moveFrame) / total) : 0;
  }

  private endMove(): void {
    if (this.move?.turn) {
      this.facing = this.facing === 1 ? -1 : 1;
      this.turned = true;
    }
    this.mode = 'idle';
    this.move = null;
    this.air = 0;
    this.pose = 'stance';
  }

  private clamp(): void {
    this.x = Phaser.Math.Clamp(this.x, this.minX, this.maxX);
  }

  /** Copies the logical state onto the sprite. */
  sync(): void {
    this.sprite
      .setPosition(Math.round(this.x), Math.round(GROUND_Y - this.air))
      .setFrame(this.pose)
      .setFlipX(this.facing < 0)
      .setDepth(10 + (this.mode === 'move' ? 2 : 0) + (this.isPlayer ? 1 : 0));
    if (!this.out) this.sprite.setAlpha(this.grace > 0 && this.grace % 8 < 4 ? 0.4 : 1);
    const s = Math.max(0.5, 1 - this.air / 50);
    this.shadow.setPosition(Math.round(this.x), GROUND_Y).setScale(this.mode === 'hit' && this.pose === 'down' ? 1.6 : s, 1);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}

function sameInput(a: InputState, b: InputState): boolean {
  return a.x === b.x && a.y === b.y && a.fire === b.fire;
}
