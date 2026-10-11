import Phaser from 'phaser';
import { HEIGHT, STEP_MS, WIDTH } from '../config';
import { pixelText } from '../art/font';
import { MAX_BELT } from '../art/palette';
import { createScrollBackground, LAYERS, layerKey } from '../art/scrollBackground';
import { sfx, toggleMute } from '../audio/sfx';
import { CpuBrain } from '../ai/CpuBrain';
import { findHit } from '../fighter/combat';
import { Fighter } from '../fighter/Fighter';
import type { StrikeResult } from '../fighter/Hitbox';
import { NO_INPUT } from '../fighter/input';
import { PlayerInput } from '../fighter/PlayerInput';
import { LEVELS } from '../scroller/levels';
import { ScrollerHud } from '../scroller/ScrollerHud';
import { ScrollerRules, START_LIVES } from '../scroller/ScrollerRules';
import { loadHiscore, saveHiscore } from './common';

type Phase = 'intro' | 'play' | 'hitstop' | 'clear' | 'won' | 'gameover';

const INTRO_FRAMES = 100;
const HITSTOP_FRAMES = 6;
const CLEAR_FRAMES = 240;
const END_FRAMES = 300;
/** How many enemies may close in on the player at once; the rest hang back. */
const ATTACK_SLOTS = 2;
const STANDOFF = 58;
/** The player is kept this far from the screen edges. */
const EDGE = 12;
/** Where the player sits on screen while the camera follows. */
const FOLLOW_X = 130;
/** Fastest the camera scrolls, in px per frame — quicker than a walk so it catches up after a wave without snapping. */
const CAM_SPEED = 2.5;
/** Standing enemies closer than this are nudged apart so they don't stack. */
const PERSONAL_SPACE = 16;

export interface ScrollerData {
  level: number;
  score: number;
  lives: number;
}

export const NEW_SCROLLER_RUN: ScrollerData = { level: 0, score: 0, lives: START_LIVES };

interface Foe {
  f: Fighter;
  brain: CpuBrain;
  uid: number;
  /** Has walked on from off-screen; from then on it is kept on screen. */
  onScreen: boolean;
}

/** Side-scrolling mode: walk right, beat each wave, then the boss. */
export class ScrollerScene extends Phaser.Scene {
  private run!: ScrollerData;
  private rules!: ScrollerRules;
  private hud!: ScrollerHud;
  private player!: Fighter;
  private input1!: PlayerInput;
  private foes: Foe[] = [];
  private layers: { sprite: Phaser.GameObjects.TileSprite; factor: number }[] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private camX = 0;
  private locked = false;
  private celebrated = false;
  private phase: Phase = 'intro';
  private phaseFrame = 0;
  private acc = 0;

  constructor() {
    super('scroller');
  }

  init(data: ScrollerData): void {
    this.run = data;
    this.foes = [];
    this.layers = [];
    this.camX = 0;
    this.locked = false;
    this.celebrated = false;
    this.acc = 0;
  }

  create(): void {
    const level = LEVELS[this.run.level];
    createScrollBackground(this, level.theme);
    this.layers = LAYERS.map(({ layer, factor }, i) => ({
      sprite: this.add.tileSprite(0, 0, WIDTH, HEIGHT, layerKey(level.theme, layer)).setOrigin(0).setScrollFactor(0).setDepth(i),
      factor,
    }));
    this.cameras.main.setBounds(0, 0, level.length, HEIGHT).setScroll(0, 0);

    this.rules = new ScrollerRules(level, this.run.lives, this.run.score);
    const belt = Math.min(MAX_BELT, this.run.level * 3);
    this.player = new Fighter(this, 'white', belt, true);
    this.player.staggerGrace = 24;
    this.player.place(60, 1);
    this.player.bow(50);
    this.bars = this.add.graphics().setDepth(40);

    this.hud = new ScrollerHud(this, this.run.level + 1, level.name, belt);
    this.hud.showBanner([`STAGE ${this.run.level + 1}`, level.name]);
    this.input1 = new PlayerInput(this);
    this.input.keyboard!.on('keydown-M', () => toggleMute());
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('title'));

    this.setPhase('intro');
    this.sync();
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseFrame = 0;
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
        this.stepFighters(false);
        if (this.phaseFrame >= INTRO_FRAMES) {
          this.hud.hideBanner();
          this.setPhase('play');
        }
        break;
      case 'play':
        this.stepFighters(true);
        this.resolveHits();
        if (this.phase === 'play') this.progress();
        break;
      case 'hitstop':
        if (this.phaseFrame >= HITSTOP_FRAMES) this.setPhase('play');
        break;
      case 'clear':
        this.stepFighters(false);
        this.celebrate();
        if (this.phaseFrame === 60) {
          const bonus = this.rules.clearBonus();
          this.hud.showBanner(['STAGE CLEAR', `HEALTH BONUS ${bonus}`]);
          sfx.gong();
        }
        if (this.phaseFrame >= CLEAR_FRAMES) {
          const next = this.run.level + 1;
          if (next < LEVELS.length) {
            this.scene.restart({ level: next, score: this.rules.score, lives: this.rules.lives } satisfies ScrollerData);
          } else {
            this.hud.showBanner(['YOU ARE THE MASTER', `FINAL SCORE ${this.rules.score}`]);
            this.saveScore();
            this.setPhase('won');
          }
        }
        break;
      case 'won':
      case 'gameover':
        this.stepFighters(false);
        if (this.phaseFrame >= END_FRAMES) this.scene.start('title');
        break;
    }
    this.hud.update(this.rules, this.phase === 'play' && !this.locked && !!this.rules.nextWave);
  }

  private stepFighters(live: boolean): void {
    const standing = this.foes.filter((x) => !x.f.out);
    if (live) this.assignSlots(standing);
    const playerInput = live && !this.player.out ? this.input1.read() : NO_INPUT;
    const inputs = this.foes.map((x) => (live && !x.f.out ? x.brain.think([this.player], null) : NO_INPUT));
    this.updateBounds();
    this.player.step(playerInput, standing.map((x) => x.f));
    this.foes.forEach((x, i) => x.f.step(inputs[i], [this.player]));
    this.keepApart(standing.map((x) => x.f));
  }

  /** The nearest enemies get to attack; the others wait their turn at a distance. */
  private assignSlots(standing: Foe[]): void {
    const near = standing
      .filter((x) => x.onScreen && !x.f.down)
      .sort((a, b) => Math.abs(a.f.x - this.player.x) - Math.abs(b.f.x - this.player.x));
    for (const x of standing) x.brain.standoff = near.indexOf(x) < 0 || near.indexOf(x) >= ATTACK_SLOTS ? STANDOFF : null;
  }

  /** Keeps the player on screen; enemies may walk on from beyond either edge. */
  private updateBounds(): void {
    const left = this.camX;
    this.player.minX = left + EDGE;
    this.player.maxX = left + WIDTH - EDGE;
    for (const x of this.foes) {
      if (!x.onScreen && x.f.x > left + EDGE && x.f.x < left + WIDTH - EDGE) x.onScreen = true;
      x.f.minX = x.onScreen ? left + EDGE : left - 200;
      x.f.maxX = x.onScreen ? left + WIDTH - EDGE : left + WIDTH + 200;
    }
  }

  private keepApart(fs: Fighter[]): void {
    const up = fs.filter((f) => !f.down && f.mode !== 'move');
    for (let i = 0; i < up.length; i++) {
      for (let j = i + 1; j < up.length; j++) {
        const d = up[j].x - up[i].x;
        if (Math.abs(d) >= PERSONAL_SPACE) continue;
        const dir = d > 0 || (d === 0 && i % 2 === 0) ? 1 : -1;
        const push = (PERSONAL_SPACE - Math.abs(d)) * 0.25;
        up[i].x -= dir * push;
        up[j].x += dir * push;
      }
    }
  }

  /** Scrolls with the player, locks the screen for each wave and spots the end of the level. */
  private progress(): void {
    if (this.locked) {
      if (this.rules.waveActive) return;
      this.locked = false;
      if (this.rules.levelCleared) {
        this.setPhase('clear');
        return;
      }
    }
    const maxX = this.rules.level.length - WIDTH;
    const target = Phaser.Math.Clamp(this.player.x - FOLLOW_X, 0, maxX);
    if (target > this.camX) this.camX = Math.min(target, this.camX + CAM_SPEED);
    const wave = this.rules.nextWave;
    if (wave && this.camX >= wave.atX) {
      this.camX = wave.atX;
      this.spawnWave();
    }
  }

  private spawnWave(): void {
    const enemies = this.rules.startWave();
    const boss = enemies.some((e) => e.boss);
    const queued = { left: 0, right: 0 };
    for (const e of enemies) {
      const fromRight = e.def.from === 'right';
      const k = queued[e.def.from]++;
      const x = fromRight ? this.camX + WIDTH + 20 + k * 40 : this.camX - 20 - k * 40;
      const f = new Fighter(this, fromRight ? 'red' : 'blue', e.def.belt, false, e.def.gi);
      f.place(x, fromRight ? -1 : 1);
      f.downFrames = boss ? 40 : 30;
      f.graceFrames = boss ? 30 : 20;
      this.foes.push({ f, brain: new CpuBrain(f, e.def.belt), uid: e.uid, onScreen: false });
    }
    this.locked = true;
    sfx.gong();
    if (boss) {
      this.hud.showBanner(['BOSS']);
      this.time.delayedCall(1200, () => this.hud.hideBanner());
    }
  }

  private resolveHits(): void {
    const hit = findHit(
      [this.player, ...this.foes.map((x) => x.f)],
      ({ d, r }) => {
        sfx.block();
        this.spark(r);
        d.knockBack(3);
      },
      (a, d) => a.isPlayer !== d.isPlayer,
    );
    if (!hit) return;
    const { a, d, r } = hit;
    const full = r.halves === 2;
    sfx.hit(full);
    this.spark(r);
    if (full) this.cameras.main.shake(140, 0.012);

    if (d === this.player) {
      const out = this.rules.hitPlayer(r.halves);
      d.takeHit(a.x, out.knockdown);
      if (out.gameOver) {
        d.out = true;
        this.saveScore();
        this.hud.showBanner(['GAME OVER', `SCORE ${this.rules.score}`]);
        this.setPhase('gameover');
        return;
      }
    } else {
      const foe = this.foes.find((x) => x.f === d)!;
      const before = this.rules.score;
      const out = this.rules.hitEnemy(foe.uid, r.halves);
      d.takeHit(a.x, out.knockdown);
      this.popScore(d.x, this.rules.score - before);
      if (out.ko) {
        d.out = true;
        this.tweens.add({
          targets: [d.sprite, d.shadow],
          alpha: 0,
          delay: 700,
          duration: 600,
          onComplete: () => {
            d.destroy();
            this.foes = this.foes.filter((x) => x !== foe);
          },
        });
      }
    }
    this.setPhase('hitstop');
  }

  private celebrate(): void {
    if (this.celebrated || !this.player.actionable) return;
    this.player.celebrate();
    this.celebrated = true;
  }

  private saveScore(): void {
    if (this.rules.score > loadHiscore()) saveHiscore(this.rules.score);
  }

  private spark(r: StrikeResult): void {
    const s = this.add.image(Math.round(r.tipX), Math.round(r.tipY), 'spark').setDepth(30).setScale(2);
    this.tweens.add({ targets: s, scale: 0.5, alpha: 0, duration: 260, onComplete: () => s.destroy() });
  }

  private popScore(x: number, points: number): void {
    const t = pixelText(this, x, 120, String(points), { align: 0.5, color: 0xffe070, depth: 45 });
    this.tweens.add({ targets: t, y: -16, alpha: 0, duration: 800, onComplete: () => t.destroy() });
  }

  /** Copies logical state onto sprites, the camera and the backdrop. */
  private sync(): void {
    const cx = Math.round(this.camX);
    this.cameras.main.setScroll(cx, 0);
    for (const l of this.layers) l.sprite.tilePositionX = Math.round(cx * l.factor);
    this.player.sync();
    this.bars.clear();
    for (const x of this.foes) {
      x.f.sync();
      const e = this.rules.enemies.find((en) => en.uid === x.uid);
      if (!e || e.boss || x.f.out || e.hp === e.def.hp) continue;
      const bx = Math.round(x.f.x) - 8;
      this.bars.fillStyle(0x101010).fillRect(bx - 1, 121, 18, 4);
      this.bars.fillStyle(0xff6a50).fillRect(bx, 122, Math.round((16 * e.hp) / e.def.hp), 2);
    }
  }
}
