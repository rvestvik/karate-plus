import { overlaps, worldHurt, type Body } from '../fighter/Hitbox';
import { HazardField, type HazardObj } from '../scroller/hazards';
import type { Command } from '../fighter/input';
import { MOVES, totalFrames } from '../fighter/moves';

// Hazard avoidance for scroller enemies: run each hazard forward on a copy
// and see whether, and when, it would touch a fighter standing where it is.

/** How far ahead (frames) to look; long enough to see a tile's shadow. */
export const LOOKAHEAD = 90;
/** Duck the hook just before it swings through. */
export const DUCK_WINDOW: [number, number] = [1, 7];

/** How far to get from a falling tile's landing spot. */
const TILE_CLEARANCE = 16;

export interface Evasion {
  /** Which hazard, and which pass of it, so the brain decides once per threat. */
  key: string;
  cmd: Command;
}

/** Frames until `o` first touches a fighter staying in `body`'s place, or null if it won't soon. */
export function contactIn(body: Body, o: HazardObj, horizon = LOOKAHEAD): number | null {
  const hurt = worldHurt(body);
  const sim: HazardObj = { ...o, hit: new Set() };
  for (let t = 1; t <= horizon; t++) {
    HazardField.advance(sim);
    if (sim.dead) return null;
    const r = HazardField.rect(sim);
    if (r && overlaps(r, hurt)) return t;
  }
  return null;
}

/** Whether a jump started next frame (when the brain's input lands) would sail over `o`. */
export function jumpClears(body: Body, o: HazardObj): boolean {
  const jump = MOVES.jump;
  const total = totalFrames(jump);
  const sim: HazardObj = { ...o, hit: new Set() };
  HazardField.advance(sim);
  const landed = worldHurt(body);
  const tucked = worldHurt({ ...body, pose: 'jump' });
  const behind = Math.min(landed.x0, tucked.x0);
  for (let f = 1; f <= total + LOOKAHEAD; f++) {
    HazardField.advance(sim);
    if (sim.dead) return true;
    const inAir = f < total;
    const air = inAir ? jump.air! * Math.sin((Math.PI * f) / total) : 0;
    const r = HazardField.rect(sim);
    if (!r) continue;
    if (overlaps(r, inAir ? { ...tucked, y0: tucked.y0 - air, y1: tucked.y1 - air } : landed)) return false;
    // Hazards travel left: once it's wholly past the body, the jump cleared it.
    if (r.x1 < behind) return true;
    // Landed with it still ahead: jumped too early.
    if (!inAir) return false;
  }
  return false;
}

/** The dodge for the most urgent hazard heading for this fighter, if it's time to act. */
export function evasion(
  body: Body,
  hazards: HazardObj[],
  alreadyHit: (o: HazardObj) => boolean,
  bounds: { minX: number; maxX: number } = { minX: -Infinity, maxX: Infinity },
): Evasion | null {
  let best: { o: HazardObj; t: number } | null = null;
  for (const o of hazards) {
    if (alreadyHit(o)) continue;
    const t = contactIn(body, o);
    if (t !== null && (!best || t < best.t)) best = { o, t };
  }
  if (!best) return null;
  const { o, t } = best;
  switch (o.kind) {
    case 'crab':
    case 'boulder':
      // Jump at the first moment the jump would carry clean over it.
      return jumpClears(body, o) ? { key: `${o.id}`, cmd: 'jump' } : null;
    case 'hook':
      // The hook keeps swinging, so each pass is a separate threat.
      return t >= DUCK_WINDOW[0] && t <= DUCK_WINDOW[1]
        ? { key: `${o.id}:${Math.floor((o.t + t) / 75)}`, cmd: 'crouchPunch' }
        : null;
    case 'tile': {
      // Step out from under the shadow, away from where it will land,
      // unless backed against the screen edge: then cross under it instead.
      let away = body.x >= o.x ? 1 : -1;
      const room = away > 0 ? bounds.maxX - body.x : body.x - bounds.minX;
      if (room < TILE_CLEARANCE) away = -away;
      return { key: `${o.id}`, cmd: away * body.facing > 0 ? 'walkF' : 'walkB' };
    }
  }
}
