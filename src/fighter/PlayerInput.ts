import Phaser from 'phaser';
import type { InputState } from './input';

/** Reads arrows/WASD + Space/J, or the first gamepad, as a joystick. */
export class PlayerInput {
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;

  constructor(private readonly scene: Phaser.Scene) {
    this.keys = scene.input.keyboard!.addKeys({
      up: 'UP',
      down: 'DOWN',
      left: 'LEFT',
      right: 'RIGHT',
      w: 'W',
      a: 'A',
      s: 'S',
      d: 'D',
      fire: 'SPACE',
      fire2: 'J',
    }) as Record<string, Phaser.Input.Keyboard.Key>;
  }

  read(): InputState {
    const k = this.keys;
    let x = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    let y = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    let fire = k.fire.isDown || k.fire2.isDown;
    const pad = this.scene.input.gamepad?.pad1;
    if (pad) {
      const sx = pad.leftStick.x;
      const sy = pad.leftStick.y;
      x ||= pad.left ? -1 : pad.right ? 1 : Math.abs(sx) > 0.4 ? Math.sign(sx) : 0;
      y ||= pad.up ? -1 : pad.down ? 1 : Math.abs(sy) > 0.4 ? Math.sign(sy) : 0;
      fire ||= pad.A || pad.B || pad.X;
    }
    return { x: x as -1 | 0 | 1, y: y as -1 | 0 | 1, fire };
  }
}
