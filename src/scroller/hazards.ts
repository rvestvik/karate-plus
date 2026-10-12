import { GROUND_Y, WIDTH } from '../config';
import type { Rect } from '../art/skeleton';
import type { HazardDef, HazardKind } from './levels';

// Stage hazards as pure state machines: each frame they move and expose a
// world rect that hurts whoever it touches. Rendering lives in the scene.

export const CRAB_SPEED = 1.2;
export const BOULDER_SPEED = 1.6;
/** Frames a falling tile's shadow shows before it drops. */
export const TILE_WARN = 50;
export const TILE_FALL_FROM = 40;
/** The crane hook hangs from above the screen and swings through head height. */
export const HOOK_PIVOT_Y = -40;
export const HOOK_LENGTH = 189;
export const HOOK_SWING = 0.4;
export const HOOK_PERIOD = 150;

export interface HazardObj {
  id: number;
  kind: HazardKind;
  x: number;
  y: number;
  /** Phase counter: walk-cycle, swing angle or fall timer. */
  t: number;
  /** A falling tile is only dangerous once it starts to drop. */
  armed: boolean;
  dead: boolean;
  /** Things already hit, so one hazard hurts each victim only once. */
  readonly hit: Set<unknown>;
}

const SPAWN: Record<Exclude<HazardKind, 'hook'>, [number, number]> = {
  crab: [300, 480],
  tile: [90, 160],
  boulder: [170, 260],
};

export class HazardField {
  objects: HazardObj[] = [];
  private uid = 0;
  private timers: number[];

  constructor(
    readonly defs: HazardDef[],
    private readonly rng: () => number = Math.random,
  ) {
    this.timers = defs.map(() => 60);
    defs.forEach((d) => {
      if (d.kind === 'hook') this.add('hook', (d.x0 + d.x1) / 2, HOOK_PIVOT_Y);
    });
  }

  private add(kind: HazardKind, x: number, y: number): HazardObj {
    const o: HazardObj = { id: this.uid++, kind, x, y, t: 0, armed: kind !== 'tile', dead: false, hit: new Set() };
    this.objects.push(o);
    return o;
  }

  /** A hazard span is live while any of it is on screen, unless paused (the boss fight). */
  isLive(d: HazardDef, camX: number): boolean {
    return d.x1 > camX && d.x0 < camX + WIDTH;
  }

  /**
   * Advances every hazard one frame. New ones only appear in live spans;
   * `targetX` is where falling tiles aim (the player).
   */
  step(camX: number, targetX: number, paused: boolean): void {
    this.defs.forEach((d, i) => {
      if (d.kind === 'hook' || paused || !this.isLive(d, camX)) return;
      if (--this.timers[i] > 0) return;
      const [lo, hi] = SPAWN[d.kind];
      this.timers[i] = lo + Math.floor(this.rng() * (hi - lo));
      const right = camX + WIDTH + 12;
      if (d.kind === 'crab' || d.kind === 'boulder') {
        this.add(d.kind, right, GROUND_Y);
      } else {
        const x = Math.min(d.x1, Math.max(d.x0, targetX + (this.rng() - 0.5) * 40));
        this.add('tile', x, TILE_FALL_FROM);
      }
    });

    for (const o of this.objects) {
      HazardField.advance(o);
      if (o.x < camX - 24) o.dead = true;
    }
    this.objects = this.objects.filter((o) => !o.dead);
  }

  /** Moves one hazard a frame. Static so the AI can look ahead on a copy. */
  static advance(o: HazardObj): void {
    o.t++;
    switch (o.kind) {
      case 'crab':
        o.x -= CRAB_SPEED;
        break;
      case 'boulder':
        o.x -= BOULDER_SPEED;
        // Small hops as it rolls over the rough ground.
        o.y = GROUND_Y - Math.abs(Math.sin(o.t / 9)) * 3;
        break;
      case 'tile':
        if (o.t > TILE_WARN) {
          o.armed = true;
          const f = o.t - TILE_WARN;
          o.y = TILE_FALL_FROM + 0.12 * f * f;
          if (o.y >= GROUND_Y) o.dead = true;
        }
        break;
      case 'hook':
        // It can hit again on its next pass, so forget victims at each end of the swing.
        if (o.t % (HOOK_PERIOD / 2) === Math.round(HOOK_PERIOD / 4)) o.hit.clear();
        break;
    }
  }

  /** The hook's angle from vertical, in radians. */
  static hookAngle(t: number): number {
    return HOOK_SWING * Math.sin((2 * Math.PI * t) / HOOK_PERIOD);
  }

  /** Where the hook's tip is (world space). */
  static hookTip(o: HazardObj): { x: number; y: number } {
    const a = HazardField.hookAngle(o.t);
    return { x: o.x + HOOK_LENGTH * Math.sin(a), y: o.y + HOOK_LENGTH * Math.cos(a) };
  }

  /** The world rect that hurts, or null if the hazard can't hurt right now. */
  static rect(o: HazardObj): Rect | null {
    if (!o.armed || o.dead) return null;
    switch (o.kind) {
      case 'crab':
        return { x0: o.x - 5, x1: o.x + 5, y0: o.y - 7, y1: o.y };
      case 'boulder':
        return { x0: o.x - 6, x1: o.x + 6, y0: o.y - 13, y1: o.y };
      case 'tile':
        return { x0: o.x - 5, x1: o.x + 5, y0: o.y - 5, y1: o.y };
      case 'hook': {
        const tip = HazardField.hookTip(o);
        return { x0: tip.x - 4, x1: tip.x + 4, y0: tip.y - 9, y1: tip.y };
      }
    }
  }

  /** Crabs can be kicked away; the rest can't be stopped. */
  static breakable(o: HazardObj): boolean {
    return o.kind === 'crab';
  }
}
