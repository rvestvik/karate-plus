export interface Shades {
  base: string;
  shade: string;
}

export type GiColor = 'white' | 'red' | 'blue' | 'ref';

export const GI: Record<GiColor, Shades> = {
  white: { base: '#eeeeea', shade: '#a2a6b8' },
  red: { base: '#d8402c', shade: '#8a2218' },
  blue: { base: '#3c5edc', shade: '#22348e' },
  ref: { base: '#e4dcc4', shade: '#6a6458' },
};

export const SKIN: Shades = { base: '#eaa878', shade: '#b07650' };
export const HAIR = '#2a1a10';
export const OUTLINE = '#120c0a';

/** Fighter label colors used in the HUD and text. */
export const LABEL: Record<'white' | 'red' | 'blue', number> = {
  white: 0xffffff,
  red: 0xff6a50,
  blue: 0x7a9aff,
};

export interface Belt {
  name: string;
  color: string;
}

/** The belt ladder: kyu grades, then ten dan grades of black belt. */
export const BELTS: Belt[] = [
  { name: 'WHITE', color: '#f4f4f4' },
  { name: 'YELLOW', color: '#f4d020' },
  { name: 'ORANGE', color: '#f08a20' },
  { name: 'GREEN', color: '#30a040' },
  { name: 'BLUE', color: '#2860e0' },
  { name: 'BROWN', color: '#7a4a20' },
  ...Array.from({ length: 10 }, (_, i) => ({ name: `BLACK ${i + 1}${ordinal(i + 1)} DAN`, color: '#1c1c1c' })),
];

function ordinal(n: number): string {
  if (n === 1) return 'ST';
  if (n === 2) return 'ND';
  if (n === 3) return 'RD';
  return 'TH';
}

export const MAX_BELT = BELTS.length - 1;
