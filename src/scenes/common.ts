import Phaser from 'phaser';
import { unlockAudio } from '../audio/sfx';

const HISCORE_KEY = 'karate-plus-hiscore';

export function loadHiscore(): number {
  try {
    return Number(localStorage.getItem(HISCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveHiscore(score: number): void {
  try {
    localStorage.setItem(HISCORE_KEY, String(score));
  } catch {
    // Storage blocked: the hiscore just won't persist.
  }
}

/** Calls `fn` once on Space, J, Enter, a pointer press or a gamepad (non d-pad) button. */
export function onFire(scene: Phaser.Scene, fn: () => void): void {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    unlockAudio();
    fn();
  };
  const kb = scene.input.keyboard!;
  ['keydown-SPACE', 'keydown-J', 'keydown-ENTER'].forEach((e) => kb.once(e, go));
  scene.input.once('pointerdown', go);
  // The d-pad (buttons 12-15) is for menus, not fire.
  scene.input.gamepad?.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
    if (button.index < 12 || button.index > 15) go();
  });
}
