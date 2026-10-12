import Phaser from 'phaser';
import { WIDTH } from '../config';
import { pixelText, type PixelText } from '../art/font';
import { BELTS } from '../art/palette';
import { MAX_LIVES, PLAYER_HP, START_LIVES, type ScrollerRules } from './ScrollerRules';

const BAR_W = 100;

/** Fixed to the screen: health, lives, score, the boss's health and banners. */
export class ScrollerHud {
  private readonly hpFill: Phaser.GameObjects.Rectangle;
  private readonly lives: Phaser.GameObjects.Image[] = [];
  private readonly score: PixelText;
  private readonly boss: { setVisible(v: boolean): unknown }[];
  private readonly bossFill: Phaser.GameObjects.Rectangle;
  private readonly go: PixelText;
  private banner: PixelText[] = [];
  private frame = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    stage: number,
    name: string,
    playerBelt: number,
  ) {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor>(o: T) => o.setScrollFactor(0);
    const text = (x: number, y: number, t: string, opts: Parameters<typeof pixelText>[4] = {}) =>
      pixelText(scene, x, y, t, opts).setScrollFactor(0, 0, true) as PixelText;
    const bar = (x: number, color: number) => {
      fixed(scene.add.rectangle(x, 12, BAR_W + 2, 6, 0x101010).setOrigin(0).setDepth(50));
      return fixed(scene.add.rectangle(x + 1, 13, BAR_W, 4, color).setOrigin(0).setDepth(50));
    };

    text(6, 3, 'YOU');
    const beltColor = Phaser.Display.Color.HexStringToColor(BELTS[playerBelt].color).color;
    fixed(scene.add.rectangle(27, 4, 14, 6, 0x101010).setOrigin(0).setDepth(50));
    fixed(scene.add.rectangle(28, 5, 12, 4, beltColor).setOrigin(0).setDepth(50));
    this.hpFill = bar(6, 0x50d050);
    for (let i = 0; i < MAX_LIVES; i++) this.lives.push(fixed(scene.add.image(50 + i * 11, 7, 'yy_full').setDepth(50)));

    const bossLabel = text(WIDTH - 6, 3, 'BOSS', { align: 1, color: 0xff6a50 });
    const bossBack = fixed(scene.add.rectangle(WIDTH - 8 - BAR_W, 12, BAR_W + 2, 6, 0x101010).setOrigin(0).setDepth(50));
    this.bossFill = fixed(scene.add.rectangle(WIDTH - 7 - BAR_W, 13, BAR_W, 4, 0xff6a50).setOrigin(0).setDepth(50));
    this.boss = [bossLabel, bossBack, this.bossFill];
    this.boss.forEach((o) => o.setVisible(false));

    this.score = text(6, 191, '');
    text(WIDTH - 6, 191, `STAGE ${stage} ${name}`, { align: 1, color: 0xc8c8c8 });
    this.go = text(WIDTH - 10, 84, 'GO >', { align: 1, scale: 2, color: 0xffe070 });
    this.go.setVisible(false);
  }

  update(rules: ScrollerRules, showGo: boolean): void {
    this.frame++;
    const hp = rules.hp / PLAYER_HP;
    this.hpFill.setSize(Math.round(BAR_W * hp), 4);
    this.hpFill.fillColor = hp > 0.5 ? 0x50d050 : hp > 0.25 ? 0xf0c030 : 0xe04030;
    this.lives.forEach((img, i) =>
      img.setTexture(i < rules.lives ? 'yy_full' : 'yy_empty').setVisible(i < Math.max(START_LIVES, rules.lives)),
    );
    this.score.setText(String(rules.score).padStart(6, '0'));
    const boss = rules.boss;
    this.boss.forEach((o) => o.setVisible(!!boss));
    if (boss) this.bossFill.setSize(Math.round((BAR_W * boss.hp) / boss.def.hp), 4);
    this.go.setVisible(showGo && this.frame % 40 < 26);
  }

  /** Big centred lines, replacing any banner already up. */
  showBanner(lines: string[]): void {
    this.hideBanner();
    this.banner = lines.map((l, i) =>
      pixelText(this.scene, WIDTH / 2, 60 + i * 22, l, {
        align: 0.5,
        scale: i === 0 ? 2 : 1,
        color: i === 0 ? 0xffe070 : 0xffffff,
      }).setScrollFactor(0, 0, true) as PixelText,
    );
  }

  hideBanner(): void {
    this.banner.forEach((b) => b.destroy());
    this.banner = [];
  }
}
