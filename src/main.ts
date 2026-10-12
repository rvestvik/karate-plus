import Phaser from 'phaser';
import { HEIGHT, WIDTH } from './config';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { MatchScene } from './scenes/MatchScene';
import { ResultScene } from './scenes/ResultScene';
import { PoseDebugScene } from './scenes/PoseDebugScene';
import { ScrollerScene } from './scenes/ScrollerScene';
import { BonusScene } from './scenes/BonusScene';

/** Largest whole-number zoom that fits the window, for crisp pixels. */
function fitZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT)));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  pixelArt: true,
  backgroundColor: '#000000',
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH, zoom: fitZoom() },
  input: { gamepad: true },
  scene: [BootScene, TitleScene, MatchScene, ResultScene, ScrollerScene, BonusScene, PoseDebugScene],
});

window.addEventListener('resize', () => game.scale.setZoom(fitZoom()));
