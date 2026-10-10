import Phaser from 'phaser';
import { START_POSITIONS, STEP_MS, type FighterId } from '../config';
import { BG_KEY } from '../art/background';
import { sfx, toggleMute } from '../audio/sfx';
import { CpuBrain } from '../ai/CpuBrain';
import { Fighter } from '../fighter/Fighter';
import { strike, type StrikeResult } from '../fighter/Hitbox';
import { NO_INPUT } from '../fighter/input';
import { moveHeight } from '../fighter/moves';
import { PlayerInput } from '../fighter/PlayerInput';
import { Hud } from '../match/Hud';
import { MatchRules, POINTS_PER_HALF, type Campaign, type Competitor } from '../match/MatchRules';
import { Referee } from '../match/Referee';

type Phase = 'intro' | 'fight' | 'hitstop' | 'end';

const INTRO_FRAMES = 80;
const HITSTOP_FRAMES = 7;
const CALL_FRAMES = 70;
/** Frames between the last knockdown and the winner being called. */
const LAST_FALL_FRAMES = 60;
const END_FRAMES = 190;

export interface MatchData {
  campaign: Campaign;
}

export interface ResultData {
  campaign: Campaign;
  ranking: Competitor[];
}

export class MatchScene extends Phaser.Scene {
  private campaign!: Campaign;
  private rules!: MatchRules;
  private fighters: Fighter[] = [];
  private brains = new Map<FighterId, CpuBrain>();
  private player!: Fighter;
  private input1!: PlayerInput;
  private referee!: Referee;
  private hud!: Hud;
  private phase: Phase = 'intro';
  private phaseFrame = 0;
  private acc = 0;

  constructor() {
    super('match');
  }

  init(data: MatchData): void {
    this.campaign = data.campaign;
    this.fighters = [];
    this.brains.clear();
    this.acc = 0;
  }

  create(): void {
    this.add.image(0, 0, BG_KEY).setOrigin(0);
    this.referee = new Referee(this, 160, 146);

    this.player = new Fighter(this, 'white', this.campaign.playerBelt, true);
    this.fighters.push(this.player);
    for (const cpu of this.campaign.cpus) {
      const f = new Fighter(this, cpu.id, cpu.belt, false);
      this.fighters.push(f);
      this.brains.set(cpu.id, new CpuBrain(f, cpu.belt));
    }
    this.rules = new MatchRules(this.fighters.map((f) => ({ id: f.id, belt: f.belt, isPlayer: f.isPlayer })));
    this.hud = new Hud(this, this.rules, this.campaign.round, this.campaign.playerBelt);
    this.input1 = new PlayerInput(this);
    this.input.keyboard!.on('keydown-M', () => toggleMute());

    this.resetPositions();
    this.setPhase('intro');
    this.fighters.forEach((f) => f.sync());
  }

  private setPhase(p: Phase, frame = 0): void {
    this.phase = p;
    this.phaseFrame = frame;
  }

  private resetPositions(): void {
    for (const f of this.fighters) {
      const s = START_POSITIONS[f.id];
      f.place(s.x, s.facing);
      f.bow(40);
    }
  }

  update(_time: number, delta: number): void {
    this.acc += Math.min(delta, 100);
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.step();
    }
    this.fighters.forEach((f) => f.sync());
  }

  private step(): void {
    this.phaseFrame++;
    this.referee.step();
    switch (this.phase) {
      case 'intro':
        this.stepFighters(false);
        if (this.phaseFrame === 45) {
          this.referee.say('BEGIN', 40, 'both');
          sfx.gong();
        }
        if (this.phaseFrame >= INTRO_FRAMES) this.setPhase('fight');
        break;
      case 'fight':
        this.stepFighters(true);
        this.resolveHits();
        this.updateHud();
        if (this.phase === 'fight' && this.rules.isOver() && this.phaseFrame >= LAST_FALL_FRAMES) this.endRound();
        break;
      case 'hitstop':
        if (this.phaseFrame >= HITSTOP_FRAMES) this.setPhase('fight');
        break;
      case 'end':
        this.stepFighters(false);
        if (this.phaseFrame >= END_FRAMES) {
          const data: ResultData = { campaign: this.campaign, ranking: this.rules.standings() };
          this.scene.start('result', data);
        }
        break;
    }
  }

  private stepFighters(live: boolean): void {
    const leader = this.rules.leader()?.id ?? null;
    const opponents = (f: Fighter) => this.fighters.filter((o) => o !== f && !o.out);
    const inputs = this.fighters.map((f) => {
      if (!live || f.out) return NO_INPUT;
      if (f === this.player) return this.input1.read();
      return this.brains.get(f.id)!.think(opponents(f), leader);
    });
    this.fighters.forEach((f, i) => f.step(inputs[i], opponents(f)));
  }

  /** Checks every active strike; at most one point is scored per frame. */
  private resolveHits(): void {
    const attackers = Phaser.Utils.Array.Shuffle([...this.fighters]);
    for (const a of attackers) {
      if (a.out) continue;
      const effectors = a.activeEffectors;
      if (!effectors) continue;
      for (const d of this.fighters) {
        if (d === a || !d.hittable) continue;
        const r = strike(a.body, effectors, d.body);
        if (!r) continue;
        a.hasHit = true;
        const fromFront = (a.x - d.x) * d.facing > 0;
        if (d.mode === 'block' && fromFront && moveHeight(a.move!) !== 'low') {
          sfx.block();
          this.spark(r);
          d.knockBack(3);
          break;
        }
        this.scorePoint(a, d, r);
        return;
      }
    }
  }

  /** A scoring hit knocks the defender down and costs them a life; the fight carries on. */
  private scorePoint(a: Fighter, d: Fighter, r: StrikeResult): void {
    const full = r.halves === 2;
    this.rules.award(a.id, r.halves);
    d.takeHit(a.x);
    sfx.hit(full);
    this.spark(r);
    if (full) this.cameras.main.shake(140, 0.012);
    if (this.rules.knockDown(d.id)) {
      d.out = true;
      this.brains.delete(d.id);
      this.referee.say(`${d.id} IS OUT`, CALL_FRAMES + 30, d.x);
      this.tweens.add({ targets: [d.sprite, d.shadow], alpha: 0, delay: 900, duration: 700 });
    } else {
      this.referee.say(full ? 'FULL POINT!' : 'HALF POINT', CALL_FRAMES, a.x);
    }
    this.updateHud();
    this.setPhase('hitstop');
  }

  private spark(r: StrikeResult): void {
    const s = this.add.image(Math.round(r.tipX), Math.round(r.tipY), 'spark').setDepth(30).setScale(2);
    this.tweens.add({ targets: s, scale: 0.5, alpha: 0, duration: 260, onComplete: () => s.destroy() });
  }

  private updateHud(): void {
    const live = this.rules.get('white').halves * POINTS_PER_HALF;
    this.hud.update(this.rules, this.campaign.totalScore + live);
  }

  /** Only one fighter is left standing. */
  private endRound(): void {
    const winner = this.fighters.find((f) => !f.out)!;
    if (!winner.down) winner.celebrate();
    this.referee.say(`${winner.id} WINS`, END_FRAMES, winner.x);
    sfx.gong();
    this.setPhase('end');
  }
}
