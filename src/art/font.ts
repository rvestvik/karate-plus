import Phaser from 'phaser';

// A 5x7 pixel font drawn in code, registered as a Phaser RetroFont so text
// stays crisp at the game's native resolution. Glyphs are white and tinted.

const G: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|#..#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '####.|....#|....#|.###.|....#|....#|####.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|....#|.###.',
  ' ': '.....|.....|.....|.....|.....|.....|.....',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  ',': '.....|.....|.....|.....|.##..|..#..|.#...',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..',
  '?': '.###.|#...#|....#|...#.|..#..|.....|..#..',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....',
  '-': '.....|.....|.....|.###.|.....|.....|.....',
  '+': '.....|..#..|..#..|#####|..#..|..#..|.....',
  "'": '..#..|..#..|.#...|.....|.....|.....|.....',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....',
  '>': '.#...|..#..|...#.|....#|...#.|..#..|.#...',
  '<': '...#.|..#..|.#...|#....|.#...|..#..|...#.',
};

export const FONT_KEY = 'font';
const CELL_W = 6;
const CELL_H = 8;
const CHARS = Object.keys(G).join('');

export function createFont(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas(FONT_KEY + '_img', CHARS.length * CELL_W, CELL_H);
  if (!tex) throw new Error('could not create font canvas');
  const ctx = tex.getContext();
  ctx.fillStyle = '#ffffff';
  [...CHARS].forEach((ch, i) => {
    G[ch].split('|').forEach((row, y) => {
      [...row].forEach((c, x) => {
        if (c === '#') ctx.fillRect(i * CELL_W + x, y, 1, 1);
      });
    });
  });
  tex.refresh();
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: FONT_KEY + '_img',
    width: CELL_W,
    height: CELL_H,
    chars: CHARS,
    charsPerRow: CHARS.length,
    'spacing.x': 0,
    'spacing.y': 0,
    'offset.x': 0,
    'offset.y': 0,
    lineSpacing: 2,
  });
  scene.cache.bitmapFont.add(FONT_KEY, data);
}

export interface TextOpts {
  color?: number;
  scale?: number;
  /** 0 = left, 0.5 = centered, 1 = right. */
  align?: number;
  shadow?: boolean;
  depth?: number;
}

/** Pixel text with a one-pixel drop shadow. Returns a container. */
export function pixelText(scene: Phaser.Scene, x: number, y: number, text: string, opts: TextOpts = {}) {
  const { color = 0xffffff, scale = 1, align = 0, shadow = true, depth = 50 } = opts;
  const c = scene.add.container(0, 0).setDepth(depth);
  const make = (dx: number, dy: number, tint: number) =>
    scene.add
      .bitmapText(Math.round(x) + dx, Math.round(y) + dy, FONT_KEY, text.toUpperCase())
      .setScale(scale)
      .setOrigin(align, 0)
      .setTint(tint);
  if (shadow) c.add(make(scale, scale, 0x000000));
  const main = make(0, 0, color);
  c.add(main);
  return Object.assign(c, {
    setText(t: string) {
      c.list.forEach((o) => (o as Phaser.GameObjects.BitmapText).setText(t.toUpperCase()));
      return c;
    },
    setColor(tint: number) {
      main.setTint(tint);
      return c;
    },
  });
}

export type PixelText = ReturnType<typeof pixelText>;
