import Phaser from 'phaser';
import { STEP_MS } from '../config';
import { BG_KEY } from '../art/background';
import { pixelText, type PixelText } from '../art/font';
import { sfx, toggleMute } from '../audio/sfx';
import { Fighter } from '../fighter/Fighter';
import { overlaps, strikeBox, worldHurt } from '../fighter/Hitbox';
import { NO_INPUT } from '../fighter/input';
import { PlayerInput } from '../fighter/PlayerInput';
import { BonusRules, PERFECT_BONUS } from '../match/BonusRules';
import type { MatchData } from './MatchScene';

type Phase = 'intro' | 'play' | 'end';

const INTRO_FRAMES = 120;
const END_FRAMES = 200;
const STRIKE_PAD = 5;

/** The IK+ bonus round: bat away the bouncing balls for points, then back to the tournament. */
export class BonusScene extends Phaser.Scene {
  private data0!: MatchData;
  private rules!: BonusRules;
  private player!: Fighter;
  private input1!: PlayerInput;
  private balls = new Map<number, Phaser.GameObjects.Image>();
  private time0!: PixelText;
  private score!: PixelText;
  private banner: PixelText[] = [];
  private phase: Phase = 'intro';
  private phaseFrame = 0;
  private acc = 0;

  constructor() {
    super('bonus');
  }

  init(data: MatchData): void {
    this.data0 = data;
    this.balls = new Map();
    this.banner = [];
    this.acc = 0;
  }

  create(): void {
    this.add.image(0, 0, BG_KEY).setOrigin(0);
    this.rules = new BonusRules();
    this.player = new Fighter(this, 'white', this.data0.campaign.playerBelt, true);
    this.player.place(160, 1);
    this.player.bow(60);
    this.input1 = new PlayerInput(this);
    this.input.keyboard!.on('keydown-M', () => toggleMute());

    pixelText(this, 6, 3, 'BONUS');
    this.score = pixelText(this, 6, 13, '0000');
    this.time0 = pixelText(this, 314, 3, '', { align: 1 });
    this.showBanner(['BONUS ROUND', 'DEFLECT THE BALLS']);
    sfx.gong();
    this.phase = 'intro';
    this.phaseFrame = 0;
    this.sync();
  }

  private showBanner(lines: string[]): void {
    this.banner.forEach((t) => t.destroy());
    this.banner = lines.map((l, i) =>
      pixelText(this, 160, 60 + i * 20, l, { align: 0.5, scale: i === 0 ? 2 : 1, color: i === 0 ? 0xffe070 : 0xffffff }),
    );
  }

  update(_time: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
    this.sync();
  }

  private step(): void {
    this.phaseFrame++;
    switch (this.phase) {
      case 'intro':
        this.player.step(NO_INPUT, []);
        if (this.phaseFrame >= INTRO_FRAMES) {
          this.showBanner([]);
          this.phase = 'play';
          this.phaseFrame = 0;
        }
        break;
      case 'play':
        this.player.step(this.input1.read(), []);
        this.rules.step();
        this.collide();
        if (this.rules.over) this.finish();
        break;
      case 'end':
        this.player.step(NO_INPUT, []);
        if (this.phaseFrame >= END_FRAMES) {
          const c = this.data0.campaign;
          this.scene.start('match', { campaign: { ...c, totalScore: c.totalScore + this.rules.total } } satisfies MatchData);
        }
        break;
    }
  }

  private collide(): void {
    const p = this.player;
    const eff = p.activeEffectors;
    const hurt = worldHurt(p.body);
    for (const b of this.rules.balls) {
      if (b.state !== 'live') continue;
      const rect = BonusRules.rect(b);
      // Strikes get a generous reach: the ball only has to be near the fist or foot.
      const reach = { x0: rect.x0 - STRIKE_PAD, x1: rect.x1 + STRIKE_PAD, y0: rect.y0 - STRIKE_PAD, y1: rect.y1 + STRIKE_PAD };
      const r = eff ? strikeBox(p.body, eff, reach) : null;
      if (r) {
        this.rules.deflect(b, b.x >= p.x ? 1 : -1);
        sfx.hit(r.halves === 2);
        const s = this.add.image(Math.round(r.tipX), Math.round(r.tipY), 'spark').setDepth(30).setScale(1.5);
        this.tweens.add({ targets: s, scale: 0.4, alpha: 0, duration: 220, onComplete: () => s.destroy() });
      } else if (overlaps(rect, hurt)) {
        this.rules.touch(b);
        sfx.bounce();
      }
    }
  }

  private finish(): void {
    this.phase = 'end';
    this.phaseFrame = 0;
    this.player.celebrate();
    sfx.gong();
    const lines = ['TIME UP', `${this.rules.deflected} BALLS  ${this.rules.score} POINTS`];
    if (this.rules.perfect) lines.push(`PERFECT! +${PERFECT_BONUS}`);
    this.showBanner(lines);
  }

  private sync(): void {
    this.player.sync();
    this.time0.setText(this.phase === 'intro' ? '' : `TIME ${this.rules.timeLeft}`);
    this.score.setText(String(this.phase === 'end' ? this.rules.total : this.rules.score).padStart(4, '0'));
    const live = new Set<number>();
    for (const b of this.rules.balls) {
      live.add(b.id);
      let s = this.balls.get(b.id);
      if (!s) {
        s = this.add.image(0, 0, 'ball').setDepth(14);
        this.balls.set(b.id, s);
      }
      s.setPosition(Math.round(b.x), Math.round(b.y)).setRotation(b.x / 4);
      s.setAlpha(b.state === 'touched' ? 0.5 : 1);
    }
    for (const [id, s] of this.balls) {
      if (live.has(id)) continue;
      s.destroy();
      this.balls.delete(id);
    }
  }
}
