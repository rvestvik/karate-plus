import Phaser from 'phaser';
import type { FighterId } from '../config';
import { pixelText, type PixelText } from '../art/font';
import { BELTS, LABEL } from '../art/palette';
import type { MatchRules } from './MatchRules';

const SLOTS = 6;
const ORDER: FighterId[] = ['white', 'blue', 'red'];

/** Scores as yin-yang marks (half and full), the round clock and totals. */
export class Hud {
  private readonly icons = new Map<FighterId, Phaser.GameObjects.Image[]>();
  private readonly clock: PixelText;
  private readonly score: PixelText;
  private lastSeconds = -1;

  constructor(scene: Phaser.Scene, rules: MatchRules, round: number, playerBelt: number) {
    ORDER.forEach((id, i) => {
      const c = rules.get(id);
      const x = 6 + i * 108;
      pixelText(scene, x, 3, `${id}`, { color: LABEL[id] });
      const beltColor = Phaser.Display.Color.HexStringToColor(BELTS[c.belt].color).color;
      scene.add.rectangle(x + id.length * 6 + 3, 4, 14, 6, 0x101010).setOrigin(0).setDepth(50);
      scene.add.rectangle(x + id.length * 6 + 4, 5, 12, 4, beltColor).setOrigin(0).setDepth(50);
      const row: Phaser.GameObjects.Image[] = [];
      for (let s = 0; s < SLOTS; s++) {
        row.push(scene.add.image(x + 4 + s * 11, 17, 'yy_empty').setDepth(50));
      }
      this.icons.set(id, row);
    });
    this.clock = pixelText(scene, 160, 26, '', { scale: 2, align: 0.5, color: 0xffe070 });
    pixelText(scene, 314, 191, `ROUND ${round}`, { align: 1, color: 0xffffff });
    pixelText(scene, 160, 191, `${BELTS[playerBelt].name} BELT`, { align: 0.5, color: 0xc8c8c8 });
    this.score = pixelText(scene, 6, 191, '', { color: 0xffffff });
    this.update(rules, 0);
  }

  update(rules: MatchRules, totalScore: number): void {
    for (const c of rules.competitors) {
      const full = Math.floor(c.halves / 2);
      this.icons.get(c.id)!.forEach((img, s) => {
        img.setTexture(s < full ? 'yy_full' : s === full && c.halves % 2 ? 'yy_half' : 'yy_empty');
      });
    }
    if (rules.secondsLeft !== this.lastSeconds) {
      this.lastSeconds = rules.secondsLeft;
      this.clock.setText(String(rules.secondsLeft).padStart(2, '0'));
      this.clock.setColor(rules.secondsLeft <= 5 ? 0xff5040 : 0xffe070);
    }
    this.score.setText(`SCORE ${String(totalScore).padStart(6, '0')}`);
  }
}
