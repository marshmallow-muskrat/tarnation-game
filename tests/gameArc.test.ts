import { describe, expect, it } from 'vitest';
import { DAY_LENGTH, NIGHT_LENGTH } from '../src/content';
import { createClock } from '../src/sim/clock';
import {
  dayTwoChoiceHint,
  hasFunctionalBuilding,
  multiDayArcHint,
  RAID_TELEGRAPH,
  shouldTelegraphRaid,
} from '../src/sim/gameArc';

describe('multi-day arc guidance', () => {
  it('names the Day 2 capacity, crop-strategy, watering, and defense choices', () => {
    const hint = dayTwoChoiceHint();
    expect(hint).toContain('Silo');
    expect(hint).toContain('Water Tower');
    expect(hint).toContain('crop strategy');
    expect(hint).toContain('defense');
  });

  it('telegraphs a raid during dusk, only once per day, before night begins', () => {
    expect(RAID_TELEGRAPH).toContain('raid tonight');
    expect(shouldTelegraphRaid(createClock(1, 'day', DAY_LENGTH * 0.84), -1)).toBe(false);
    expect(shouldTelegraphRaid(createClock(1, 'day', DAY_LENGTH * 0.85), -1)).toBe(true);
    expect(shouldTelegraphRaid(createClock(1, 'day', DAY_LENGTH * 0.9), 1)).toBe(false);
    expect(shouldTelegraphRaid(createClock(1, 'night', NIGHT_LENGTH * 0.1), -1)).toBe(false);
    expect(shouldTelegraphRaid(createClock(2, 'day', DAY_LENGTH * 0.85), 1)).toBe(true);
  });

  it('asks for the missing genetics or building pillar after the first sale', () => {
    const base = {
      day: 3,
      cropsHarvested: 1,
      codex: [{ seed: { hybrid: false } }],
      placedBuildings: [] as { id: string }[],
    };

    expect(multiDayArcHint({ ...base, day: 1 })).toBeNull();
    expect(multiDayArcHint(base)).toContain('crop strategy');

    const withBuilding = { ...base, placedBuildings: [{ id: 'silo' }] };
    expect(multiDayArcHint(withBuilding)).toContain('breed');

    const withHybrid = { ...base, codex: [{ seed: { hybrid: true } }] };
    expect(multiDayArcHint(withHybrid)).toContain('functional');
    expect(hasFunctionalBuilding({ placedBuildings: [{ id: 'gate' }] })).toBe(true);
    expect(multiDayArcHint({ ...withHybrid, placedBuildings: [{ id: 'gate' }] })).toBeNull();
  });
});
