import Phaser from 'phaser';
import { FRAME_H, FRAME_W, ORIGIN_X, ORIGIN_Y } from '../config';
import { BELTS, GI, HAIR, OUTLINE, SKIN, type GiColor } from './palette';
import { POSE_NAMES, POSES } from './poses';
import { rasterize, type Pose } from './skeleton';

export function fighterKey(gi: GiColor, belt: number | null): string {
  return `fighter_${gi}_${belt ?? 'none'}`;
}

/** Frames per row of the baked sheet, keeping it well inside GPU texture limits. */
const SHEET_COLS = 16;

/**
 * Renders every pose for one gi/belt combination into a sheet texture whose
 * frames are named after the poses. Results are cached in the texture manager.
 */
export function bakeFighter(scene: Phaser.Scene, gi: GiColor, belt: number | null): string {
  const key = fighterKey(gi, belt);
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, FRAME_W * SHEET_COLS, FRAME_H * Math.ceil(POSE_NAMES.length / SHEET_COLS));
  if (!tex) throw new Error(`could not create texture ${key}`);
  const ctx = tex.getContext();
  const colors = {
    base: GI[gi].base,
    shade: GI[gi].shade,
    skin: SKIN.base,
    skinShade: SKIN.shade,
    hair: gi === 'ref' ? '#9a9a9a' : HAIR,
    belt: belt === null ? null : BELTS[belt].color,
    outline: OUTLINE,
  };
  POSE_NAMES.forEach((name, i) => {
    const rgba = rasterize(POSES[name] as Pose, colors, FRAME_W, FRAME_H, ORIGIN_X, ORIGIN_Y);
    const x = (i % SHEET_COLS) * FRAME_W;
    const y = Math.floor(i / SHEET_COLS) * FRAME_H;
    ctx.putImageData(new ImageData(rgba, FRAME_W, FRAME_H), x, y);
    tex.add(name, 0, x, y, FRAME_W, FRAME_H);
  });
  tex.refresh();
  return key;
}
