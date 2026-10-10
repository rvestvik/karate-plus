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

type Phase = 'intro' | 'fight' | 'hitstop' | 'point' | 'end';

const INTRO_FRAMES = 80;
const HITSTOP_FRAMES = 7;
const POINT_FRAMES = 100;
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
        if (this.phase !== 'fight') break;
        this.rules.tick();
        this.updateHud();
        if (this.rules.isOver()) this.endRound();
        break;
      case 'hitstop':
        if (this.phaseFrame >= HITSTOP_FRAMES) this.setPhase('point');
        break;
      case 'point':
        this.stepFighters(false);
        if (this.phaseFrame >= POINT_FRAMES) {
          if (this.rules.isOver()) this.endRound();
          else {
            this.resetPositions();
            this.setPhase('intro', 25);
          }
        }
        break;
      case 'end':
        this.stepFighters(false);
        if (this.phaseFrame >= END_FRAMES) {
          const data: ResultData = { campaign: this.campaign, ranking: this.rules.ranking() };
          this.scene.start('result', data);
        }
        break;
    }
  }

  private stepFighters(live: boolean): void {
    const leader = this.rules.leader()?.id ?? null;
    const inputs = this.fighters.map((f) => {
      if (!live) return NO_INPUT;
      if (f === this.player) return this.input1.read();
      const others = this.fighters.filter((o) => o !== f);
      return this.brains.get(f.id)!.think(others, leader);
    });
    this.fighters.forEach((f, i) =>
      f.step(
        inputs[i],
        this.fighters.filter((o) => o !== f),
      ),
    );
  }

  /** Checks every active strike; at most one point is scored per frame. */
  private resolveHits(): void {
    const attackers = Phaser.Utils.Array.Shuffle([...this.fighters]);
    for (const a of attackers) {
      const effectors = a.activeEffectors;
      if (!effectors) continue;
      for (const d of this.fighters) {
        if (d === a || d.down) continue;
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

  private scorePoint(a: Fighter, d: Fighter, r: StrikeResult): void {
    const full = r.halves === 2;
    this.rules.award(a.id, r.halves);
    d.takeHit(a.x);
    sfx.hit(full);
    this.spark(r);
    if (full) this.cameras.main.shake(140, 0.012);
    this.referee.say(full ? 'FULL POINT!' : 'HALF POINT', POINT_FRAMES - 10, a.x);
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

  private endRound(): void {
    const ranking = this.rules.ranking();
    const winner = ranking[0];
    const tied = ranking[1].halves === winner.halves;
    for (const f of this.fighters) {
      if (f.down) continue;
      if (f.id === winner.id && !tied) f.celebrate();
      else f.place(f.x, f.facing);
    }
    const winnerFighter = this.fighters.find((f) => f.id === winner.id)!;
    this.referee.say(tied ? 'DRAW' : `${winner.id} WINS`, END_FRAMES, tied ? 'both' : winnerFighter.x);
    sfx.gong();
    this.setPhase('end');
  }
}
