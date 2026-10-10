import Phaser from 'phaser';
import { LIVES, type FighterId } from '../config';
import { pixelText, type PixelText } from '../art/font';
import { BELTS, LABEL } from '../art/palette';
import type { MatchRules } from './MatchRules';

const ORDER: FighterId[] = ['white', 'blue', 'red'];

/** Points as text in half points, e.g. "3 1/2". */
export function formatPoints(halves: number): string {
  return (halves / 2).toString().replace('.5', ' 1/2');
}

/** Lives as yin-yang marks, points and the player's running total. */
export class Hud {
  private readonly icons = new Map<FighterId, Phaser.GameObjects.Image[]>();
  private readonly points = new Map<FighterId, PixelText>();
  /** Everything in a fighter's column, dimmed once they are out. */
  private readonly columns = new Map<FighterId, { setAlpha(a: number): unknown }[]>();
  private readonly score: PixelText;

  constructor(scene: Phaser.Scene, rules: MatchRules, round: number, playerBelt: number) {
    ORDER.forEach((id, i) => {
      const c = rules.get(id);
      const x = 6 + i * 108;
      const label = pixelText(scene, x, 3, `${id}`, { color: LABEL[id] });
      const beltColor = Phaser.Display.Color.HexStringToColor(BELTS[c.belt].color).color;
      const beltBack = scene.add.rectangle(x + id.length * 6 + 3, 4, 14, 6, 0x101010).setOrigin(0).setDepth(50);
      const belt = scene.add.rectangle(x + id.length * 6 + 4, 5, 12, 4, beltColor).setOrigin(0).setDepth(50);
      const row: Phaser.GameObjects.Image[] = [];
      for (let s = 0; s < LIVES; s++) {
        row.push(scene.add.image(x + 4 + s * 11, 17, 'yy_full').setDepth(50));
      }
      const pts = pixelText(scene, x + 4 + LIVES * 11, 13, '');
      this.icons.set(id, row);
      this.points.set(id, pts);
      this.columns.set(id, [label, beltBack, belt, pts, ...row]);
    });
    pixelText(scene, 314, 191, `ROUND ${round}`, { align: 1, color: 0xffffff });
    pixelText(scene, 160, 191, `${BELTS[playerBelt].name} BELT`, { align: 0.5, color: 0xc8c8c8 });
    this.score = pixelText(scene, 6, 191, '', { color: 0xffffff });
    this.update(rules, 0);
  }

  update(rules: MatchRules, totalScore: number): void {
    for (const c of rules.competitors) {
      this.columns.get(c.id)!.forEach((o) => o.setAlpha(c.out ? 0.3 : 1));
      this.icons.get(c.id)!.forEach((img, s) => img.setTexture(s < c.lives ? 'yy_full' : 'yy_empty'));
      this.points.get(c.id)!.setText(c.halves ? `${formatPoints(c.halves)} PTS` : '');
    }
    this.score.setText(`SCORE ${String(totalScore).padStart(6, '0')}`);
  }
}
