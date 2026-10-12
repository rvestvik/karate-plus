import Phaser from 'phaser';
import { GROUND_Y, HEIGHT, STEP_MS, WIDTH } from '../config';
import { pixelText } from '../art/font';
import { MAX_BELT } from '../art/palette';
import { createScrollBackground, LAYERS, layerKey } from '../art/scrollBackground';
import { sfx, toggleMute } from '../audio/sfx';
import { ARCHETYPES } from '../ai/archetypes';
import { CpuBrain } from '../ai/CpuBrain';
import { findHit } from '../fighter/combat';
import { Fighter } from '../fighter/Fighter';
import { overlaps, strikeBox, worldHurt, type StrikeResult } from '../fighter/Hitbox';
import { NO_INPUT } from '../fighter/input';
import { PlayerInput } from '../fighter/PlayerInput';
import type { Rect } from '../art/skeleton';
import { HazardField, type HazardObj } from '../scroller/hazards';
import { evasion } from '../ai/evade';
import { LEVELS, type PickupKind, type PropDef } from '../scroller/levels';
import { ScrollerHud } from '../scroller/ScrollerHud';
import { CRAB_POINTS, DROP_CHANCE, ScrollerRules, START_LIVES } from '../scroller/ScrollerRules';
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
/** Points for smashing a breakable. */
const SMASH_POINTS = 50;
/** Frames a pickup lies around before vanishing; it blinks for the last two seconds. */
const PICKUP_LIFE = 480;
const PICKUP_REACH = 10;
const PROP_REACH = 36;
const CRAB_KICK_REACH = 12;
const REGULAR_DROPS: PickupKind[] = ['rice', 'rice', 'coin', 'scroll'];
/** Half points each hazard deals. */
const HAZARD_DAMAGE: Record<HazardObj['kind'], 1 | 2> = { crab: 1, tile: 1, hook: 2, boulder: 2 };

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

interface Prop {
  def: PropDef;
  sprite: Phaser.GameObjects.Image;
  broken: boolean;
}

interface Pickup {
  kind: PickupKind;
  x: number;
  y: number;
  vy: number;
  age: number;
  sprite: Phaser.GameObjects.Image;
}

/** Side-scrolling mode: walk right, beat each wave, then the boss. */
export class ScrollerScene extends Phaser.Scene {
  private run!: ScrollerData;
  private rules!: ScrollerRules;
  private hud!: ScrollerHud;
  private player!: Fighter;
  private input1!: PlayerInput;
  private foes: Foe[] = [];
  private props: Prop[] = [];
  private pickups: Pickup[] = [];
  private hazards!: HazardField;
  private hazardSprites = new Map<number, Phaser.GameObjects.Image>();
  private hazardGfx!: Phaser.GameObjects.Graphics;
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
    this.props = [];
    this.pickups = [];
    this.hazardSprites = new Map();
    this.layers = [];
    this.camX = 0;
    this.locked = false;
    this.celebrated = false;
    this.acc = 0;
  }

  create(): void {
    const level = LEVELS[this.run.level];
    createScrollBackground(this, level.theme);
    this.layers = LAYERS.map(({ layer, factor, front }, i) => ({
      sprite: this.add
        .tileSprite(0, 0, WIDTH, HEIGHT, layerKey(level.theme, layer))
        .setOrigin(0)
        .setScrollFactor(0)
        .setDepth(front ? 20 : i),
      factor,
    }));
    this.cameras.main.setBounds(0, 0, level.length, HEIGHT).setScroll(0, 0);

    this.props = level.props.map((def) => ({
      def,
      broken: false,
      sprite: this.add.image(def.x, GROUND_Y + 1, def.kind).setOrigin(0.5, 1).setDepth(8),
    }));
    this.hazards = new HazardField(level.hazards);
    this.hazardGfx = this.add.graphics().setDepth(9);

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
        if (this.phase === 'play') this.stepWorld();
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
    if (live) {
      this.assignSlots(standing);
      this.evadeHazards(standing);
    }
    const playerInput = live && !this.player.out ? this.input1.read() : NO_INPUT;
    const inputs = this.foes.map((x) => (live && !x.f.out ? x.brain.think([this.player], null) : NO_INPUT));
    this.updateBounds();
    this.player.step(playerInput, standing.map((x) => x.f));
    this.foes.forEach((x, i) => x.f.step(inputs[i], [this.player]));
    this.keepApart(standing.map((x) => x.f));
  }

  /** Enemies see hazards coming and jump, duck or step aside. */
  private evadeHazards(standing: Foe[]): void {
    for (const x of standing) {
      if (!x.onScreen || !x.f.actionable) continue;
      const e = evasion(x.f.body, this.hazards.objects, (o) => o.hit.has(x.f), x.f);
      if (e) x.brain.evade(e);
    }
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
      const profile = ARCHETYPES[e.def.kind ?? 'karateka'];
      const f = new Fighter(this, fromRight ? 'red' : 'blue', e.def.belt, false, e.def.gi);
      f.place(x, fromRight ? -1 : 1);
      f.downFrames = boss ? 40 : 30;
      f.graceFrames = boss ? 30 : 20;
      f.speedScale = profile.speed;
      f.sprite.setScale(profile.scale);
      this.foes.push({ f, brain: new CpuBrain(f, e.def.belt, Math.random, profile), uid: e.uid, onScreen: false });
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
      if (this.hurtPlayer(a.x, r.halves)) return;
    } else {
      const foe = this.foes.find((x) => x.f === d)!;
      const before = this.rules.score;
      this.hurtFoe(foe, a.x, this.rules.hitEnemy(foe.uid, r.halves));
      this.popScore(d.x, this.rules.score - before);
    }
    this.setPhase('hitstop');
  }

  /** Applies damage to the player; returns true when that ends the game. */
  private hurtPlayer(fromX: number, halves: 1 | 2): boolean {
    const out = this.rules.hitPlayer(halves);
    this.player.takeHit(fromX, out.knockdown);
    if (!out.gameOver) return false;
    this.player.out = true;
    this.saveScore();
    this.hud.showBanner(['GAME OVER', `SCORE ${this.rules.score}`]);
    this.setPhase('gameover');
    return true;
  }

  private hurtFoe(foe: Foe, fromX: number, out: { knockdown: boolean; ko: boolean; shrug: boolean }): void {
    const d = foe.f;
    if (out.shrug) {
      // Armour: the hit counts but the brute doesn't flinch.
      d.sprite.setTintFill(0xffffff);
      this.time.delayedCall(60, () => d.sprite.clearTint());
    } else {
      d.takeHit(fromX, out.knockdown);
    }
    if (!out.ko) return;
    d.out = true;
    this.dropFrom(foe);
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

  /** Bosses always leave a feast; others sometimes drop something. */
  private dropFrom(foe: Foe): void {
    const boss = this.rules.enemies.find((e) => e.uid === foe.uid)?.boss;
    if (boss) this.spawnPickup('sushi', foe.f.x, 150);
    else if (Math.random() < DROP_CHANCE) {
      this.spawnPickup(REGULAR_DROPS[Math.floor(Math.random() * REGULAR_DROPS.length)], foe.f.x, 150);
    }
  }

  /** Props, pickups and hazards: everything in the level that isn't a fighter. */
  private stepWorld(): void {
    this.breakProps();
    this.stepPickups();
    this.stepHazards();
  }

  /** Breakables count hits up to waist height, so mid kicks and punches smash them too. */
  private propRect(p: Prop): Rect {
    const w = p.sprite.width;
    return { x0: p.def.x - w / 2, x1: p.def.x + w / 2, y0: GROUND_Y - Math.max(p.sprite.height, PROP_REACH), y1: GROUND_Y };
  }

  private breakProps(): void {
    const eff = this.player.activeEffectors;
    if (!eff) return;
    for (const p of this.props) {
      if (p.broken) continue;
      const r = strikeBox(this.player.body, eff, this.propRect(p));
      if (!r) continue;
      this.player.hasHit = true;
      this.smash(p, r);
      return;
    }
  }

  private smash(p: Prop, r: StrikeResult): void {
    p.broken = true;
    sfx.smash();
    this.spark(r);
    this.rules.addScore(SMASH_POINTS);
    this.popScore(p.def.x, SMASH_POINTS);
    const chip = p.def.kind === 'urn' ? 'chip_urn' : 'chip_wood';
    for (let i = 0; i < 6; i++) {
      const c = this.add.image(p.def.x + (i - 2.5) * 2, GROUND_Y - 8, chip).setDepth(9);
      const dx = (i - 2.5) * 8 + (Math.random() - 0.5) * 6;
      this.tweens.add({ targets: c, x: c.x + dx, angle: dx * 20, duration: 500 });
      this.tweens.add({ targets: c, y: c.y - 14 - Math.random() * 10, duration: 220, ease: 'Quad.easeOut', yoyo: true });
      this.tweens.add({ targets: c, alpha: 0, delay: 500, duration: 300, onComplete: () => c.destroy() });
    }
    p.sprite.destroy();
    if (p.def.drop) this.spawnPickup(p.def.drop, p.def.x, GROUND_Y - 12);
  }

  private spawnPickup(kind: PickupKind, x: number, y: number): void {
    const cx = Phaser.Math.Clamp(x, this.camX + EDGE, this.camX + WIDTH - EDGE);
    const sprite = this.add.image(cx, y, kind === 'life' ? 'yy_full' : kind).setOrigin(0.5, 1).setDepth(9);
    this.pickups.push({ kind, x: cx, y, vy: -2.4, age: 0, sprite });
  }

  private stepPickups(): void {
    const p1 = this.player;
    for (const p of this.pickups) {
      p.age++;
      if (p.y < GROUND_Y || p.vy < 0) {
        p.vy += 0.2;
        p.y = Math.min(GROUND_Y, p.y + p.vy);
      }
      const landed = p.y >= GROUND_Y;
      if (landed && !p1.down && p1.air < 4 && Math.abs(p.x - p1.x) < PICKUP_REACH) {
        this.collect(p);
        p.age = Infinity;
      }
      if (p.age > PICKUP_LIFE) p.sprite.destroy();
    }
    this.pickups = this.pickups.filter((p) => p.age <= PICKUP_LIFE);
  }

  private collect(p: Pickup): void {
    const got = this.rules.collect(p.kind);
    if (got.life) {
      sfx.oneUp();
      this.popText(p.x, '1UP', 0x80ff80);
    } else {
      sfx.pickup();
      if (got.healed > 0) this.popText(p.x, 'HEALTH UP', 0x80ff80);
    }
    if (got.points > 0) this.popScore(p.x, got.points);
  }

  private stepHazards(): void {
    const bossFight = this.locked && !!this.rules.boss;
    this.hazards.step(this.camX, this.player.x, bossFight);
    const eff = this.player.activeEffectors;
    const victims = [this.player, ...this.foes.filter((x) => !x.f.out).map((x) => x.f)];
    for (const o of this.hazards.objects) {
      const rect = HazardField.rect(o);
      if (!rect) continue;
      if (eff && HazardField.breakable(o)) {
        // Low kicks and sweeps pass a little above a crab's shell; count those as hits.
        const r = strikeBox(this.player.body, eff, { ...rect, y0: rect.y0 - CRAB_KICK_REACH });
        if (r) {
          this.player.hasHit = true;
          this.kickAway(o, r);
          continue;
        }
      }
      for (const f of victims) {
        if (!f.hittable || o.hit.has(f) || !overlaps(rect, worldHurt(f.body))) continue;
        o.hit.add(f);
        this.hazardHit(f, o);
        if (this.phase !== 'play') return;
        if (o.kind === 'crab' || o.kind === 'tile') {
          if (o.kind === 'tile') this.shatterTile(o);
          o.dead = true;
          break;
        }
      }
    }
  }

  private hazardHit(f: Fighter, o: HazardObj): void {
    const halves = HAZARD_DAMAGE[o.kind];
    sfx.thud();
    this.cameras.main.shake(100, 0.008);
    if (f === this.player) {
      this.hurtPlayer(o.x, halves);
      return;
    }
    const foe = this.foes.find((x) => x.f === f)!;
    const before = this.rules.score;
    this.hurtFoe(foe, o.x, this.rules.hazardEnemy(foe.uid, halves));
    if (this.rules.score > before) this.popScore(f.x, this.rules.score - before);
  }

  /** A kicked crab tumbles off screen. */
  private kickAway(o: HazardObj, r: StrikeResult): void {
    o.dead = true;
    sfx.hit(false);
    this.spark(r);
    this.rules.addScore(CRAB_POINTS);
    this.popScore(o.x, CRAB_POINTS);
    const dir = o.x >= this.player.x ? 1 : -1;
    const c = this.add.image(o.x, o.y, 'crab0').setOrigin(0.5, 1).setDepth(14).setFlipY(true);
    this.tweens.add({ targets: c, x: o.x + dir * 120, angle: dir * 540, duration: 700 });
    this.tweens.add({ targets: c, y: o.y - 50, duration: 350, ease: 'Quad.easeOut', yoyo: true, onComplete: () => c.destroy() });
  }

  private shatterTile(o: HazardObj): void {
    for (let i = 0; i < 4; i++) {
      const c = this.add.image(o.x, o.y - 3, 'chip_urn').setDepth(14).setTint(0xb04030);
      this.tweens.add({ targets: c, x: o.x + (i - 1.5) * 10, y: o.y - 10 - i * 3, alpha: 0, duration: 400, onComplete: () => c.destroy() });
    }
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
    this.popText(x, String(points), 0xffe070);
  }

  private popText(x: number, text: string, color: number): void {
    const t = pixelText(this, x, 120, text, { align: 0.5, color, depth: 45 });
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
    for (const p of this.pickups) {
      p.sprite.setPosition(Math.round(p.x), Math.round(p.y));
      p.sprite.setVisible(p.age < PICKUP_LIFE - 120 || p.age % 8 < 4);
    }
    this.syncHazards();
  }

  private syncHazards(): void {
    const g = this.hazardGfx.clear();
    const live = new Set<number>();
    for (const o of this.hazards.objects) {
      live.add(o.id);
      let s = this.hazardSprites.get(o.id);
      if (!s) {
        s = this.add.image(0, 0, o.kind === 'crab' ? 'crab0' : o.kind);
        if (o.kind === 'boulder') s.setOrigin(0.5).setDepth(9);
        else if (o.kind === 'crab') s.setOrigin(0.5, 1).setDepth(9);
        else s.setOrigin(0.5, 1).setDepth(14);
        this.hazardSprites.set(o.id, s);
      }
      switch (o.kind) {
        case 'crab':
          s.setTexture(Math.floor(o.t / 8) % 2 ? 'crab1' : 'crab0').setPosition(Math.round(o.x), Math.round(o.y));
          break;
        case 'boulder':
          s.setPosition(Math.round(o.x), Math.round(o.y - 8)).setRotation(-o.t * 0.25);
          break;
        case 'tile': {
          s.setPosition(Math.round(o.x), Math.round(o.y)).setVisible(o.armed);
          // The shadow grows as the tile gets close.
          const k = o.armed ? Math.min(1, (o.y - 40) / (GROUND_Y - 40)) : Math.min(1, o.t / 50) * 0.4;
          g.fillStyle(0x000000, 0.2 + 0.3 * k).fillEllipse(Math.round(o.x), GROUND_Y, 6 + 8 * k, 3);
          break;
        }
        case 'hook': {
          const tip = HazardField.hookTip(o);
          const a = HazardField.hookAngle(o.t);
          const top = { x: tip.x - 12 * Math.sin(a), y: tip.y - 12 * Math.cos(a) };
          g.lineStyle(1, 0x303038).lineBetween(Math.round(o.x), o.y, Math.round(top.x), Math.round(top.y));
          s.setPosition(Math.round(tip.x), Math.round(tip.y)).setRotation(-a);
          break;
        }
      }
    }
    for (const [id, s] of this.hazardSprites) {
      if (live.has(id)) continue;
      s.destroy();
      this.hazardSprites.delete(id);
    }
  }
}
