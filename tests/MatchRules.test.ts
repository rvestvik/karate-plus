import { describe, expect, it } from 'vitest';
import { MatchRules, advanceCampaign, newCampaign, FIRST_PLACE_BONUS, POINTS_PER_HALF } from '../src/match/MatchRules';
import { FPS, ROUND_SECONDS } from '../src/config';
import { MAX_BELT } from '../src/art/palette';

const entrants = () => [
  { id: 'white' as const, belt: 0, isPlayer: true },
  { id: 'blue' as const, belt: 0, isPlayer: false },
  { id: 'red' as const, belt: 1, isPlayer: false },
];

describe('MatchRules', () => {
  it('runs a 30 second clock', () => {
    const m = new MatchRules(entrants());
    expect(m.secondsLeft).toBe(ROUND_SECONDS);
    for (let i = 0; i < ROUND_SECONDS * FPS - 1; i++) m.tick();
    expect(m.isOver()).toBe(false);
    m.tick();
    expect(m.isOver()).toBe(true);
  });

  it('ends early at six full points', () => {
    const m = new MatchRules(entrants());
    for (let i = 0; i < 5; i++) m.award('red', 2);
    m.award('red', 1);
    expect(m.isOver()).toBe(false);
    m.award('red', 1);
    expect(m.isOver()).toBe(true);
    m.award('red', 2);
    expect(m.get('red').halves).toBe(12);
  });

  it('ranks by score and eliminates last place', () => {
    const m = new MatchRules(entrants());
    m.award('white', 2);
    m.award('red', 1);
    expect(m.ranking().map((c) => c.id)).toEqual(['white', 'red', 'blue']);
    expect(m.loser().id).toBe('blue');
    expect(m.leader()?.id).toBe('white');
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
    const out = advanceCampaign(c, m.ranking());
    expect(out.gameOver).toBe(false);
    expect(out.promoted).toBe(true);
    expect(out.eliminated).toBe('blue');
    expect(out.campaign.playerBelt).toBe(1);
    expect(out.campaign.round).toBe(2);
    expect(out.campaign.cpus.find((x) => x.id === 'blue')?.belt).toBe(2);
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
