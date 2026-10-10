import Phaser from 'phaser';
import { bakeFighter } from '../art/bakeFrames';
import { pixelText, type PixelText } from '../art/font';
import type { PoseName } from '../art/poses';
import { sfx } from '../audio/sfx';

/** The referee who stands at the back and calls every point. */
export class Referee {
  private readonly sprite: Phaser.GameObjects.Sprite;
  private readonly bubble: Phaser.GameObjects.Graphics;
  private readonly label: PixelText;
  private timer = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
  ) {
    this.sprite = scene.add
      .sprite(x, y, bakeFighter(scene, 'ref', null), 'refStand')
      .setOrigin(0.5, 56 / 60)
      .setDepth(4);
    this.bubble = scene.add.graphics().setDepth(40);
    this.label = pixelText(scene, x, 0, '', { color: 0x101010, align: 0.5, shadow: false, depth: 41 });
  }

  /**
   * Shows a speech bubble for `frames`. `toward` makes the referee point at
   * that x position; 'both' raises both arms.
   */
  say(text: string, frames: number, toward?: number | 'both'): void {
    this.timer = frames;
    let pose: PoseName = 'refStand';
    if (toward === 'both') pose = 'refBoth';
    else if (toward !== undefined) {
      pose = 'refPoint';
      this.sprite.setFlipX(toward < this.x);
    }
    this.sprite.setFrame(pose);

    const w = text.length * 6 + 7;
    const h = 13;
    const bx = Math.round(this.x - w / 2);
    const by = this.y - 66;
    this.bubble.clear();
    this.bubble.fillStyle(0x101010).fillRect(bx - 1, by - 1, w + 2, h + 2);
    this.bubble.fillStyle(0xffffff).fillRect(bx, by, w, h);
    this.bubble.fillStyle(0x101010).fillRect(this.x - 2, by + h + 1, 4, 1).fillRect(this.x - 1, by + h + 2, 2, 2);
    this.bubble.fillStyle(0xffffff).fillRect(this.x - 1, by + h, 2, 2);
    this.label.setText(text).setPosition(0, 0);
    this.label.list.forEach((o) => (o as Phaser.GameObjects.BitmapText).setPosition(this.x, by + 3));
    this.bubble.setVisible(true);
    this.label.setVisible(true);
    sfx.speak(text);
  }

  step(): void {
    if (this.timer > 0 && --this.timer === 0) {
      this.bubble.setVisible(false);
      this.label.setVisible(false);
      this.sprite.setFrame('refStand');
    }
  }
}
