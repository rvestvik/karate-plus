import { describe, expect, it } from 'vitest';
import { GROUND_Y, WIDTH } from '../src/config';
import { worldHurt } from '../src/fighter/Hitbox';
import { overlaps } from '../src/fighter/Hitbox';
import { HazardField, HOOK_PERIOD, TILE_WARN } from '../src/scroller/hazards';

const standing = worldHurt({ x: 0, y: GROUND_Y, facing: 1, pose: 'stance' });
const crouching = worldHurt({ x: 0, y: GROUND_Y, facing: 1, pose: 'crouch' });

describe('HazardField', () => {
  it('only spawns while its span is on screen', () => {
    const h = new HazardField([{ kind: 'crab', x0: 1000, x1: 1200 }], () => 0);
    for (let i = 0; i < 300; i++) h.step(0, 100, false);
    expect(h.objects).toHaveLength(0);
    for (let i = 0; i < 300; i++) h.step(900, 1000, false);
    expect(h.objects.length).toBeGreaterThan(0);
    expect(h.objects.every((o) => o.kind === 'crab')).toBe(true);
  });

  it('stops spawning while paused', () => {
    const h = new HazardField([{ kind: 'boulder', x0: 0, x1: WIDTH }], () => 0);
    for (let i = 0; i < 400; i++) h.step(0, 100, true);
    expect(h.objects).toHaveLength(0);
  });

  it('rolls boulders in from the right and drops them once off the left edge', () => {
    const h = new HazardField([{ kind: 'boulder', x0: 0, x1: 2000 }], () => 0);
    for (let i = 0; i < 60; i++) h.step(0, 100, false);
    const b = h.objects[0];
    expect(b.x).toBeGreaterThan(100);
    const x = b.x;
    h.step(0, 100, false);
    expect(b.x).toBeLessThan(x);
  });

  it('shows a falling tile before it can hurt', () => {
    const h = new HazardField([{ kind: 'tile', x0: 0, x1: WIDTH }], () => 0.5);
    for (let i = 0; i < 60; i++) h.step(0, 150, false);
    const t = h.objects[0];
    expect(t.x).toBe(150);
    expect(HazardField.rect(t)).toBeNull();
    for (let i = 0; i < TILE_WARN; i++) h.step(0, 150, false);
    expect(HazardField.rect(t)).not.toBeNull();
  });

  it('swings the hook through standing height but over a crouch', () => {
    const h = new HazardField([{ kind: 'hook', x0: 0, x1: 0 }]);
    const hook = h.objects[0];
    let hitStanding = false;
    let hitCrouching = false;
    for (let i = 0; i < HOOK_PERIOD; i++) {
      h.step(-100, 0, false);
      const r = HazardField.rect(hook)!;
      hitStanding ||= overlaps(r, standing);
      hitCrouching ||= overlaps(r, crouching);
    }
    expect(hitStanding).toBe(true);
    expect(hitCrouching).toBe(false);
  });
});
