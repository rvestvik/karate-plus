import Phaser from 'phaser';
import { GROUND_Y } from '../config';
import { BG_KEY } from '../art/background';
import { fighterKey } from '../art/bakeFrames';
import { pixelText } from '../art/font';
import type { PoseName } from '../art/poses';
import { sfx, toggleMute } from '../audio/sfx';
import { newCampaign } from '../match/MatchRules';
import { loadHiscore, onFire } from './common';

const DEMO: PoseName[][] = [
  ['stance', 'fkickChamber', 'fkick', 'fkickChamber'],
  ['stance', 'hkickChamber', 'hkick', 'hkickChamber'],
  ['stance', 'punchChamber', 'punchHigh', 'punchChamber'],
];

export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    this.add.image(0, 0, BG_KEY).setOrigin(0);
    this.add.rectangle(0, 0, 320, 200, 0x000000, 0.35).setOrigin(0);

    pixelText(this, 160, 22, 'KARATE +', { scale: 4, align: 0.5, color: 0xffe070 });
    pixelText(this, 160, 58, 'A TRIBUTE TO A 1987 CLASSIC', { align: 0.5, color: 0xd0c0ff });
    pixelText(this, 160, 72, `HI-SCORE ${String(loadHiscore()).padStart(6, '0')}`, { align: 0.5 });

    const help = [
      'ARROWS / WASD  MOVE',
      'SPACE / J  FIRE',
      '8 DIRECTIONS X FIRE = 16 MOVES',
      'FIRE ALONE  BLOCK',
    ];
    help.forEach((l, i) => pixelText(this, 160, 92 + i * 10, l, { align: 0.5, color: 0xc8c8c8 }));

    const blink = pixelText(this, 160, 136, 'PRESS FIRE TO BEGIN', { align: 0.5, color: 0xffffff });
    this.time.addEvent({ delay: 450, loop: true, callback: () => blink.setVisible(!blink.visible) });
    pixelText(this, 314, 191, 'M MUTE  P POSES', { align: 1, color: 0x9090a0 });

    const ids = ['white', 'blue', 'red'] as const;
    const sprites = ids.map((id, i) =>
      this.add
        .sprite(70 + i * 90, GROUND_Y, fighterKey(id, id === 'red' ? 1 : 0), 'stance')
        .setOrigin(0.5, 56 / 60)
        .setFlipX(i === 2)
        .setDepth(10),
    );
    let frame = 0;
    this.time.addEvent({
      delay: 220,
      loop: true,
      callback: () => {
        frame++;
        sprites.forEach((s, i) => {
          const seq = DEMO[(i + Math.floor(frame / 8)) % DEMO.length];
          s.setFrame(seq[(frame + i * 2) % seq.length]);
        });
      },
    });

    this.input.keyboard!.on('keydown-M', () => toggleMute());
    this.input.keyboard!.once('keydown-P', () => this.scene.start('poses'));
    onFire(this, () => {
      sfx.select();
      this.scene.start('match', { campaign: newCampaign() });
    });
  }
}
