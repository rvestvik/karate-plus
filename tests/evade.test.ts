import { describe, expect, it } from 'vitest';
import { GROUND_Y } from '../src/config';
import { evasion, jumpClears } from '../src/ai/evade';
import { MOVES, totalFrames } from '../src/fighter/moves';
import { overlaps, worldHurt, type Body } from '../src/fighter/Hitbox';
import { HazardField, HOOK_PERIOD, HOOK_PIVOT_Y, type HazardObj } from '../src/scroller/hazards';

const at = (x: number, facing: 1 | -1 = -1): Body => ({ x, y: GROUND_Y, facing, pose: 'stance' });
const hazard = (kind: HazardObj['kind'], x: number, y = GROUND_Y): HazardObj => ({
  id: 1,
  kind,
  x,
  y,
  t: 0,
  armed: kind !== 'tile',
  dead: false,
  hit: new Set(),
});
const never = () => false;

describe('hazard evasion', () => {
  it('jumps crabs and boulders at a moment the jump clears them', () => {
    const jump = MOVES.jump;
    const total = totalFrames(jump);
    for (const kind of ['crab', 'boulder'] as const) {
      // Facing away from it, and facing it (the hazard comes in from the right).
      for (const facing of [-1, 1] as const) {
        const body = at(100, facing);
        const label = `${kind} facing ${facing}`;
        expect(evasion(body, [hazard(kind, 220)], never)).toBeNull();
        let x = 220;
        while (x > 100 && !evasion(body, [hazard(kind, x)], never)) x--;
        expect(evasion(body, [hazard(kind, x)], never)?.cmd, label).toBe('jump');
        expect(x - 100, label).toBeGreaterThan(10);
        // Fly the real jump arc, starting the frame after the decision as in the game.
        const h = hazard(kind, x);
        HazardField.advance(h);
        for (let f = 1; f <= total + 20; f++) {
          HazardField.advance(h);
          const inAir = f < total;
          const air = inAir ? jump.air! * Math.sin((Math.PI * f) / total) : 0;
          const b: Body = { ...body, y: GROUND_Y - air, pose: inAir ? 'jump' : 'stance' };
          expect(overlaps(HazardField.rect(h)!, worldHurt(b)), `${label} frame ${f}`).toBe(false);
        }
        expect(jumpClears(body, hazard(kind, 101))).toBe(false);
      }
    }
  });

  it('ignores hazards moving away and ones that already hit', () => {
    expect(evasion(at(100), [hazard('crab', 60)], never)).toBeNull();
    expect(evasion(at(100), [hazard('crab', 108)], () => true)).toBeNull();
  });

  it('ducks the hook just before it swings through, and ducking clears it', () => {
    const hook = hazard('hook', 100, HOOK_PIVOT_Y);
    hook.t = Math.round(HOOK_PERIOD / 2) - 4; // a few frames before the bottom of the swing
    const e = evasion(at(100), [hook], never);
    expect(e?.cmd).toBe('crouchPunch');
    for (let t = 0; t < HOOK_PERIOD; t++) {
      HazardField.advance(hook);
      const r = HazardField.rect(hook)!;
      expect(overlaps(r, worldHurt({ ...at(100), pose: 'crouch' }))).toBe(false);
    }
  });

  it('steps out from under a falling tile', () => {
    const tile = hazard('tile', 104, 40);
    expect(evasion(at(100, 1), [tile], never)?.cmd).toBe('walkB');
    expect(evasion(at(100, -1), [tile], never)?.cmd).toBe('walkF');
    // Backed against the left edge: cross under it instead.
    expect(evasion(at(100, 1), [tile], never, { minX: 95, maxX: 400 })?.cmd).toBe('walkF');
  });
});
