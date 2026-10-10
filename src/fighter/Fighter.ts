import Phaser from 'phaser';
import {
  ARENA_MAX_X,
  ARENA_MIN_X,
  AUTO_TURN_FRAMES,
  GROUND_Y,
  WALK_BACK,
  WALK_FORWARD,
  type FighterId,
} from '../config';
import { bakeFighter } from '../art/bakeFrames';
import type { PoseName } from '../art/poses';
import { sfx } from '../audio/sfx';
import { commandFor, type InputState } from './input';
import type { Body } from './Hitbox';
import { MOVES, moveHeight, stepAt, totalFrames, type Effector, type Height, type MoveDef } from './moves';

export type Mode = 'idle' | 'walk' | 'crouch' | 'block' | 'move' | 'hit' | 'bow' | 'win';

const HIT_REEL = 10;
const HIT_FALL = 22;

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

  private walkFrames = 0;
  private behindFrames = 0;
  private timer = 0;
  private pushDir = 0;
  readonly sprite: Phaser.GameObjects.Sprite;
  private readonly shadow: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    readonly id: FighterId,
    public belt: number,
    readonly isPlayer: boolean,
  ) {
    const key = bakeFighter(scene, id, belt);
    this.shadow = scene.add.image(0, GROUND_Y, 'shadow').setDepth(5);
    this.sprite = scene.add.sprite(0, GROUND_Y, key, 'stance').setOrigin(0.5, 56 / 60);
  }

  /** True when the fighter can take a new command. */
  get actionable(): boolean {
    return this.mode === 'idle' || this.mode === 'walk' || this.mode === 'crouch' || this.mode === 'block';
  }

  get down(): boolean {
    return this.mode === 'hit';
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

  takeHit(fromX: number): void {
    this.facing = fromX >= this.x ? 1 : -1;
    this.pushDir = -this.facing;
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
    switch (this.mode) {
      case 'move':
        this.advanceMove();
        break;
      case 'hit':
        this.timer++;
        this.pose = this.timer < HIT_REEL ? 'hit' : this.timer < HIT_FALL ? 'falling' : 'down';
        if (this.timer < HIT_FALL) this.x += this.pushDir * 1.1;
        if (this.timer === HIT_FALL) sfx.thud();
        break;
      case 'bow':
        this.pose = 'bow';
        if (--this.timer <= 0) this.mode = 'idle';
        break;
      case 'win':
        this.pose = 'win';
        break;
      default:
        this.control(input, others);
    }
    this.clamp();
  }

  private control(input: InputState, others: Fighter[]): void {
    const cmd = commandFor(input, this.facing);
    this.mode = 'idle';
    this.pose = 'stance';
    switch (cmd) {
      case 'idle':
        break;
      case 'walkF':
      case 'walkB':
        this.mode = 'walk';
        this.x += cmd === 'walkF' ? WALK_FORWARD * this.facing : -WALK_BACK * this.facing;
        this.walkFrames++;
        this.pose = Math.floor(this.walkFrames / 8) % 2 ? 'walk1' : 'walk2';
        break;
      case 'crouch':
        this.mode = 'crouch';
        this.pose = 'crouch';
        break;
      case 'block':
        this.mode = 'block';
        this.pose = 'block';
        break;
      default:
        this.startMove(MOVES[cmd]);
        return;
    }
    this.autoTurn(others);
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
    this.pose = m.steps[0].pose;
  }

  private advanceMove(): void {
    const m = this.move!;
    this.moveFrame++;
    const total = totalFrames(m);
    if (this.moveFrame >= total) {
      if (m.turn) this.facing = this.facing === 1 ? -1 : 1;
      this.mode = 'idle';
      this.move = null;
      this.air = 0;
      this.pose = 'stance';
      return;
    }
    const { step, start } = stepAt(m, this.moveFrame);
    if (step.active && this.moveFrame === start) sfx.whoosh();
    this.pose = step.pose;
    this.x += (m.dx ?? 0) * this.facing;
    this.air = m.air ? m.air * Math.sin((Math.PI * this.moveFrame) / total) : 0;
  }

  private clamp(): void {
    this.x = Phaser.Math.Clamp(this.x, ARENA_MIN_X, ARENA_MAX_X);
  }

  /** Copies the logical state onto the sprite. */
  sync(): void {
    this.sprite
      .setPosition(Math.round(this.x), Math.round(GROUND_Y - this.air))
      .setFrame(this.pose)
      .setFlipX(this.facing < 0)
      .setDepth(10 + (this.mode === 'move' ? 2 : 0) + (this.isPlayer ? 1 : 0));
    const s = Math.max(0.5, 1 - this.air / 50);
    this.shadow.setPosition(Math.round(this.x), GROUND_Y).setScale(this.mode === 'hit' && this.pose === 'down' ? 1.6 : s, 1);
  }

  destroy(): void {
    this.sprite.destroy();
    this.shadow.destroy();
  }
}
