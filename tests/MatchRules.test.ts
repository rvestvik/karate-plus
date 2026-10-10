import { describe, expect, it } from 'vitest';
import { MatchRules, advanceCampaign, newCampaign, FIRST_PLACE_BONUS, POINTS_PER_HALF } from '../src/match/MatchRules';
import { LIVES } from '../src/config';
import { MAX_BELT } from '../src/art/palette';

const entrants = () => [
  { id: 'white' as const, belt: 0, isPlayer: true },
  { id: 'blue' as const, belt: 0, isPlayer: false },
  { id: 'red' as const, belt: 1, isPlayer: false },
];

describe('MatchRules', () => {
  const knockOut = (m: MatchRules, id: 'white' | 'blue' | 'red') => {
    for (let i = 0; i < LIVES; i++) m.knockDown(id);
  };

  it('costs a life per knockdown and puts a fighter out on the last one', () => {
    const m = new MatchRules(entrants());
    for (let i = 0; i < LIVES - 1; i++) expect(m.knockDown('blue')).toBe(false);
    expect(m.get('blue').out).toBe(false);
    expect(m.knockDown('blue')).toBe(true);
    expect(m.get('blue').out).toBe(true);
    expect(m.knockDown('blue')).toBe(false);
    expect(m.get('blue').lives).toBe(0);
  });

  it('only ends when one fighter is left standing', () => {
    const m = new MatchRules(entrants());
    for (let i = 0; i < 50; i++) m.award('red', 2);
    expect(m.isOver()).toBe(false);
    knockOut(m, 'blue');
    expect(m.isOver()).toBe(false);
    knockOut(m, 'white');
    expect(m.isOver()).toBe(true);
    expect(m.standings().map((c) => c.id)).toEqual(['red', 'white', 'blue']);
  });

  it('ranks by lives, then points', () => {
    const m = new MatchRules(entrants());
    m.award('blue', 2);
    m.award('red', 1);
    m.knockDown('blue');
    expect(m.ranking().map((c) => c.id)).toEqual(['red', 'white', 'blue']);
    expect(m.leader()?.id).toBe('red');
  });

  it('breaks ties in favour of the player, then the higher belt', () => {
    const m = new MatchRules(entrants());
    expect(m.ranking().map((c) => c.id)).toEqual(['white', 'red', 'blue']);
    expect(m.leader()).toBeNull();
  });
});

describe('campaign', () => {
  it('promotes the player for first place and replaces the eliminated CPU', () => {
    const c = newCampaign();
    const m = new MatchRules(entrants());
    m.award('white', 2);
    m.award('red', 1);
    const out = advanceCampaign(c, m.standings());
    expect(out.gameOver).toBe(false);
    expect(out.promoted).toBe(true);
    expect(out.eliminated).toBe('blue');
    expect(out.campaign.playerBelt).toBe(1);
    expect(out.campaign.round).toBe(2);
    expect(out.campaign.cpus.find((x) => x.id === 'blue')?.belt).toBe(2);
    expect(out.campaign.cpus.find((x) => x.id === 'red')?.belt).toBe(2);
    expect(out.earned).toBe(2 * POINTS_PER_HALF + FIRST_PLACE_BONUS);
  });

  it('keeps the belt for second place', () => {
    const m = new MatchRules(entrants());
    m.award('red', 2);
    m.award('white', 1);
    const out = advanceCampaign(newCampaign(), m.ranking());
    expect(out.promoted).toBe(false);
    expect(out.gameOver).toBe(false);
    expect(out.campaign.playerBelt).toBe(0);
  });

  it('ends the game when the player places last', () => {
    const m = new MatchRules(entrants());
    m.award('red', 2);
    m.award('blue', 1);
    const out = advanceCampaign(newCampaign(), m.ranking());
    expect(out.gameOver).toBe(true);
    expect(out.eliminated).toBe('white');
  });

  it('caps the belt ladder', () => {
    const c = { ...newCampaign(), playerBelt: MAX_BELT, round: 40 };
    const m = new MatchRules(entrants());
    m.award('white', 2);
    const out = advanceCampaign(c, m.ranking());
    expect(out.campaign.playerBelt).toBe(MAX_BELT);
    expect(out.campaign.cpus.every((x) => x.belt <= MAX_BELT)).toBe(true);
  });
});
