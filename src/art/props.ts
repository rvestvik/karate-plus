import Phaser from 'phaser';

// Small pixel sprites for breakables, pickups, hazards and the bonus-round
// ball. Each is drawn from a character grid; '.' is transparent.

type Colors = Record<string, string>;

function sprite(scene: Phaser.Scene, key: string, rows: string[], colors: Colors): void {
  if (scene.textures.exists(key)) return;
  const w = Math.max(...rows.map((r) => r.length));
  const tex = scene.textures.createCanvas(key, w, rows.length)!;
  const ctx = tex.getContext();
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  tex.refresh();
}

const K = '#101010';

export function createProps(scene: Phaser.Scene): void {
  const wood = { k: K, a: '#c88a48', b: '#9a6430', c: '#6a4020', d: '#e0b070' };
  sprite(
    scene,
    'crate',
    [
      'kkkkkkkkkkkkkkkk',
      'kdddddddddddddak',
      'kdbbbbbbbbbbbbck',
      'kdbaaaaaaaaaabck',
      'kdbabaaaaaaabbck',
      'kdbaabaaaaabaack',
      'kdbaaabaaabaaack',
      'kdbaaaabababaack',
      'kdbaaaababaaaack',
      'kdbaaabaaabaaack',
      'kdbaabaaaaabaack',
      'kdbabaaaaaaabbck',
      'kdbaaaaaaaaaabck',
      'kdbbbbbbbbbbbbck',
      'kaccccccccccccck',
      'kkkkkkkkkkkkkkkk',
    ],
    wood,
  );
  sprite(
    scene,
    'barrel',
    [
      '..kkkkkkkk..',
      '.kddaaaaabck',
      '.kmmmmmmmmmk',
      'kdaaaaaaaabck',
      'kdaaaaaaaabck',
      'kdaaaaaaaabck',
      'kmmmmmmmmmmk',
      'kdaaaaaaaabck',
      'kdaaaaaaaabck',
      'kdaaaaaaaabck',
      'kmmmmmmmmmmk',
      'kdaaaaaaaabck',
      'kdaaaaaaaabck',
      '.kmmmmmmmmmk',
      '.kdaaaaaabck',
      '..kkkkkkkk..',
    ],
    { ...wood, m: '#585868' },
  );
  sprite(
    scene,
    'urn',
    [
      '...kkkkkk...',
      '...kddaak...',
      '....kaak....',
      '...kdaaak...',
      '..kdaaaabk..',
      '.kdaaaaaabk.',
      '.kwwwwwwwwk.',
      'kdabwabwabck',
      'kdaaaaaaabck',
      'kwwwwwwwwwwk',
      'kdaaaaaaabck',
      '.kdaaaaabck.',
      '.kdaaaaabck.',
      '..kaaaabck..',
      '..kcccccck..',
      '...kkkkkk...',
    ],
    { k: K, a: '#3868b0', b: '#284c88', c: '#1a3060', d: '#70a0e0', w: '#e8e0c8' },
  );
  sprite(scene, 'chip_wood', ['kak', 'abk', 'kk.'], wood);
  sprite(scene, 'chip_urn', ['kak', 'kbk', '.k.'], { k: K, a: '#70a0e0', b: '#3868b0' });

  // Pickups.
  sprite(
    scene,
    'rice',
    ['..kkkk..', '.kwwwwk.', 'kwwwwwwk', 'kwwwwwwk', 'kgggggk.', 'kgggggk.', '.kkkkk..'].map((r) => r.padEnd(8, '.')),
    { k: K, w: '#f8f8f0', g: '#205030' },
  );
  sprite(
    scene,
    'sushi',
    [
      '..kkk..kkk..',
      '.kooOkkooOk.',
      '.kwwwkkwwwk.',
      'kkkkkkkkkkkk',
      'kppppppppppk',
      '.kccccccccc.',
      '..kkkkkkkk..',
    ],
    { k: K, o: '#f08050', O: '#ffc0a0', w: '#f8f8f0', p: '#d03028', c: '#901810' },
  );
  sprite(scene, 'coin', ['.kkkkk.', 'kyyyyok', 'kyokyok', 'kyokyok', 'kyokyok', 'kyyyyok', '.kkkkk.'], {
    k: K,
    y: '#ffe070',
    o: '#c09020',
  });
  sprite(
    scene,
    'scroll',
    ['kk......kk', 'krkkkkkkrk', 'krppppppnk', 'krpnnnnpnk', 'krppppppnk', 'krkkkkkkrk', 'kk......kk'],
    { k: K, r: '#a02018', p: '#f0e0b0', n: '#605030' },
  );

  // Hazards.
  sprite(
    scene,
    'crab0',
    ['k..........k', 'rk...kk...kr', '.rk.krrk.kr.', '..krrrrrrk..', '.krrwrrwrrk.', 'krrrrrrrrrrk', 'k.k.k..k.k.k', '.k.k....k.k.'],
    { k: K, r: '#e04828', w: '#ffffff' },
  );
  sprite(
    scene,
    'crab1',
    ['.k........k.', 'kr...kk...rk', '.rk.krrk.kr.', '..krrrrrrk..', '.krrwrrwrrk.', 'krrrrrrrrrrk', '.k.k.kk.k.k.', 'k.k......k.k'],
    { k: K, r: '#e04828', w: '#ffffff' },
  );
  sprite(
    scene,
    'boulder',
    [
      '.....kkkkkk.....',
      '...kkaaaaaakk...',
      '..kaaddaaaaabk..',
      '.kaddaaaaaaabbk.',
      '.kadaaaabaaabbk.',
      'kaaaaaaabbaaabbk',
      'kaaaaaaaaaaaabbk',
      'kaabaaaaaaaaabbk',
      'kaaabbaaaaaaabbk',
      'kaaaaaaaaabaabbk',
      'kaaaaaaaaaaabbbk',
      '.kaaaaaaaaabbbk.',
      '.kbaaaaaaabbbbk.',
      '..kbbbbbbbbbbk..',
      '...kkbbbbbbkk...',
      '.....kkkkkk.....',
    ],
    { k: K, a: '#8a8478', b: '#5c574e', d: '#b8b2a4' },
  );
  sprite(
    scene,
    'hook',
    ['...kmk...', '..kmmmk..', '..kmmmk..', 'kkkmmmkkk', 'kmmmmmmmk', 'kkkkmkkkk', '....mk...', '....mk...', 'k...mk...', 'mk..mk...', 'mk..mk...', '.mmmmk...', '..kkk....'],
    { k: K, m: '#a8a8b8' },
  );
  sprite(scene, 'tile', ['.kkkkkkkk.', 'kddaaaaabk', 'kaaaaaaabk', 'kbbbbbbbbk', '.kkkkkkkk.'], {
    k: K,
    a: '#b04030',
    b: '#7a2820',
    d: '#e07060',
  });

  // Bonus-round ball.
  sprite(scene, 'ball', ['..kkkk..', '.kwwrrk.', 'kwwwrrrk', 'kwwrrrrk', 'krrrrwwk', 'krrrwwwk', '.krrwwk.', '..kkkk..'], {
    k: K,
    w: '#f8f8f0',
    r: '#e03028',
  });
}
