import Phaser from 'phaser';
import { createBackground } from '../art/background';
import { bakeFighter } from '../art/bakeFrames';
import { createFont } from '../art/font';
import { createProps } from '../art/props';

/** Generates every texture in code, then moves on to the title screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    createFont(this);
    createBackground(this);
    this.createIcons();
    createProps(this);
    bakeFighter(this, 'white', 0);
    bakeFighter(this, 'blue', 0);
    bakeFighter(this, 'red', 1);
    bakeFighter(this, 'ref', null);
    const debug = new URLSearchParams(location.search).has('poses');
    this.scene.start(debug ? 'poses' : 'title');
  }

  /** Yin-yang score marks, the ground shadow and the hit spark. */
  private createIcons(): void {
    const yinYang = (key: string, half: boolean, empty: boolean) => {
      const S = 9;
      const tex = this.textures.createCanvas(key, S, S)!;
      const ctx = tex.getContext();
      const c = (S - 1) / 2;
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          const dx = x - c,
            dy = y - c;
          const d = Math.hypot(dx, dy);
          if (d > 4.4) continue;
          let col: string;
          if (d > 3.5) col = '#101010';
          else if (empty) col = '#3a3a44';
          else if (half && dx > 0) col = '#3a3a44';
          else {
            const top = Math.hypot(dx, dy + 1.75) <= 1.75;
            const bottom = Math.hypot(dx, dy - 1.75) <= 1.75;
            const white = top ? true : bottom ? false : dx < 0;
            col = white ? '#f8f0e0' : '#c02818';
            if (Math.hypot(dx, dy + 1.75) < 0.7) col = '#c02818';
            if (Math.hypot(dx, dy - 1.75) < 0.7) col = '#f8f0e0';
          }
          ctx.fillStyle = col;
          ctx.fillRect(x, y, 1, 1);
        }
      }
      tex.refresh();
    };
    yinYang('yy_full', false, false);
    yinYang('yy_half', true, false);
    yinYang('yy_empty', false, true);

    const g = this.make.graphics({}, false);
    g.fillStyle(0x000000, 0.35).fillEllipse(12, 3, 24, 5);
    g.generateTexture('shadow', 24, 6);
    g.clear();
    g.fillStyle(0xffffff).fillRect(3, 0, 1, 7).fillRect(0, 3, 7, 1);
    g.fillStyle(0xffe070).fillRect(2, 2, 3, 3);
    g.generateTexture('spark', 7, 7);
    g.destroy();
  }
}
