import Phaser from 'phaser';
import { GROUND_Y } from '../config';
import { BG_KEY } from '../art/background';
import { fighterKey } from '../art/bakeFrames';
import { pixelText } from '../art/font';
import { POSE_NAMES } from '../art/poses';
import { toggleMute } from '../audio/sfx';
import { Fighter } from '../fighter/Fighter';
import { strike, worldHurt } from '../fighter/Hitbox';
import { NO_INPUT } from '../fighter/input';
import { PlayerInput } from '../fighter/PlayerInput';
import { STEP_MS } from '../config';

/**
 * Developer view: every baked pose at half size, plus a training dojo with a
 * passive dummy that shows hurtboxes and what each strike would score.
 * Open with ?poses in the URL, or P on the title screen.
 */
export class PoseDebugScene extends Phaser.Scene {
  private player!: Fighter;
  private dummy!: Fighter;
  private input1!: PlayerInput;
  private gfx!: Phaser.GameObjects.Graphics;
  private info!: ReturnType<typeof pixelText>;
  private acc = 0;
  private dummyMode = 0;
  private lastResult = '';

  constructor() {
    super('poses');
  }

  create(): void {
    this.add.image(0, 0, BG_KEY).setOrigin(0).setAlpha(0.5);
    const cols = 12;
    POSE_NAMES.forEach((name, i) => {
      const x = 14 + (i % cols) * 26;
      const y = 32 + Math.floor(i / cols) * 34;
      this.add.image(x, y, fighterKey('white', 0), name).setScale(0.5).setOrigin(0.5, 56 / 60);
    });

    this.player = new Fighter(this, 'white', 0, true);
    this.dummy = new Fighter(this, 'red', 1, false);
    this.player.place(120, 1);
    this.dummy.place(150, -1);
    this.input1 = new PlayerInput(this);
    this.gfx = this.add.graphics().setDepth(60);
    this.info = pixelText(this, 4, 191, '');
    pixelText(this, 316, 136, 'D DUMMY POSE  ESC BACK', { align: 1, color: 0x9090a0 });
    this.input.keyboard!.on('keydown-D', () => (this.dummyMode = (this.dummyMode + 1) % 3));
    this.input.keyboard!.on('keydown-M', () => toggleMute());
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('title'));
  }

  update(_t: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.player.step(this.input1.read(), [this.dummy]);
      if (this.dummy.down) this.dummy.place(this.dummy.x, this.dummy.facing);
      this.dummy.step(this.dummyMode === 1 ? { x: 0, y: 1, fire: false } : this.dummyMode === 2 ? { x: 0, y: 0, fire: true } : NO_INPUT, [this.player]);
      const eff = this.player.activeEffectors;
      if (eff) {
        const r = strike(this.player.body, eff, this.dummy.body);
        if (r) {
          this.player.hasHit = true;
          this.lastResult = r.halves === 2 ? 'FULL' : 'HALF';
        }
      }
    }
    this.player.sync();
    this.dummy.sync();

    this.gfx.clear();
    for (const f of [this.player, this.dummy]) {
      const r = worldHurt(f.body);
      this.gfx.lineStyle(1, 0x00ff80, 0.8).strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
    }
    this.gfx.lineStyle(1, 0xffffff, 0.3).lineBetween(0, GROUND_Y + 0.5, 320, GROUND_Y + 0.5);
    const move = this.player.move?.name ?? this.player.mode.toUpperCase();
    const dist = Math.round(Math.abs(this.dummy.x - this.player.x));
    this.info.setText(`${move}  DIST ${dist}  LAST ${this.lastResult || '-'}`);
  }
}
