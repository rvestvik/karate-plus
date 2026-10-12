import Phaser from 'phaser';
import { BG_KEY } from '../art/background';
import { pixelText } from '../art/font';
import { BELTS, LABEL } from '../art/palette';
import { sfx } from '../audio/sfx';
import { formatPoints } from '../match/Hud';
import { bonusAfter } from '../match/BonusRules';
import { advanceCampaign } from '../match/MatchRules';
import { loadHiscore, onFire, saveHiscore } from './common';
import type { ResultData } from './MatchScene';

const PLACES = ['1ST', '2ND', '3RD'];

/** Between rounds: final standings, elimination, belt promotion or game over. */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('result');
  }

  create(data: ResultData): void {
    const out = advanceCampaign(data.campaign, data.ranking);
    this.add.image(0, 0, BG_KEY).setOrigin(0);
    this.add.rectangle(0, 0, 320, 200, 0x000000, 0.6).setOrigin(0);

    pixelText(this, 160, 14, `ROUND ${data.campaign.round} RESULT`, { scale: 2, align: 0.5, color: 0xffe070 });
    data.ranking.forEach((c, i) => {
      const y = 44 + i * 14;
      const pts = formatPoints(c.halves);
      pixelText(this, 60, y, PLACES[i], { color: 0xc8c8c8 });
      pixelText(this, 96, y, c.id + (c.isPlayer ? ' (YOU)' : ''), { color: LABEL[c.id] });
      pixelText(this, 260, y, pts, { align: 1 });
    });

    const elim = out.eliminated === 'white' ? 'YOU ARE' : `${out.eliminated} IS`;
    pixelText(this, 160, 96, `${elim} ELIMINATED`, { align: 0.5, color: 0xff6a50 });

    if (out.gameOver) {
      const score = out.campaign.totalScore;
      const best = loadHiscore();
      if (score > best) saveHiscore(score);
      pixelText(this, 160, 116, 'GAME OVER', { scale: 2, align: 0.5, color: 0xffffff });
      pixelText(this, 160, 140, `FINAL SCORE ${String(score).padStart(6, '0')}`, { align: 0.5 });
      if (score > best) pixelText(this, 160, 152, 'NEW HI-SCORE!', { align: 0.5, color: 0xffe070 });
      pixelText(this, 160, 176, `YOU REACHED ${BELTS[out.campaign.playerBelt].name} BELT`, {
        align: 0.5,
        color: 0xc8c8c8,
      });
    } else {
      pixelText(this, 160, 112, `+${out.earned} POINTS`, { align: 0.5, color: 0xffffff });
      const belt = BELTS[out.campaign.playerBelt].name;
      const line = out.promoted ? `PROMOTED TO ${belt} BELT!` : `YOU KEEP YOUR ${belt} BELT`;
      pixelText(this, 160, 128, line, { align: 0.5, color: out.promoted ? 0xffe070 : 0xc8c8c8 });
      const newcomer = out.campaign.cpus.find((c) => c.id === out.eliminated)!;
      pixelText(this, 160, 148, `A NEW ${out.eliminated} CHALLENGER: ${BELTS[newcomer.belt].name}`, {
        align: 0.5,
        color: LABEL[newcomer.id],
      });
      const survivor = out.campaign.cpus.find((c) => c.id !== out.eliminated)!;
      const before = data.campaign.cpus.find((c) => c.id === survivor.id)!;
      if (survivor.belt > before.belt) {
        pixelText(this, 160, 160, `${survivor.id} MOVES UP TO ${BELTS[survivor.belt].name}`, {
          align: 0.5,
          color: LABEL[survivor.id],
        });
      }
    }

    if (!out.gameOver && bonusAfter(data.campaign.round)) {
      pixelText(this, 160, 172, 'BONUS ROUND NEXT', { align: 0.5, color: 0x80ff80 });
    }
    const prompt = pixelText(this, 160, 186, 'PRESS FIRE', { align: 0.5 });
    this.time.addEvent({ delay: 450, loop: true, callback: () => prompt.setVisible(!prompt.visible) });

    // A short delay so a held fire button from the fight doesn't skip this screen.
    this.time.delayedCall(700, () =>
      onFire(this, () => {
        sfx.select();
        if (out.gameOver) this.scene.start('title');
        else this.scene.start(bonusAfter(data.campaign.round) ? 'bonus' : 'match', { campaign: out.campaign });
      }),
    );
  }
}
