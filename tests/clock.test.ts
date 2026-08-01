import { describe, expect, it } from 'vitest';
import { DAY_LENGTH, NIGHT_LENGTH } from '../src/content';
import {
  createClock,
  isDuskNear,
  nightTintAlpha,
  phaseLength,
  stepClock,
} from '../src/sim/clock';

describe('clock and day transitions', () => {
  it('starts a new clock on day one at the beginning of daylight', () => {
    expect(createClock()).toEqual({ day: 1, phase: 'day', elapsed: 0, t: 0 });
  });

  it('advances daylight without changing the day until the boundary', () => {
    const result = stepClock(createClock(2, 'day', DAY_LENGTH - 1), 0.5);

    expect(result.clock).toEqual({ day: 2, phase: 'day', elapsed: DAY_LENGTH - 0.5, t: (DAY_LENGTH - 0.5) / DAY_LENGTH });
    expect(result.phaseChanged).toBe(false);
    expect(result.becameNight).toBe(false);
    expect(result.becameDay).toBe(false);
  });

  it('transitions from daylight to night at the exact daylight boundary', () => {
    const result = stepClock(createClock(2, 'day', DAY_LENGTH - 1), 1);

    expect(result.clock).toEqual({ day: 2, phase: 'night', elapsed: 0, t: 0 });
    expect(result.previousPhase).toBe('day');
    expect(result.phaseChanged).toBe(true);
    expect(result.becameNight).toBe(true);
    expect(result.becameDay).toBe(false);
  });

  it('increments the day only when night ends', () => {
    const result = stepClock(createClock(2, 'night', NIGHT_LENGTH - 1), 1);

    expect(result.clock).toEqual({ day: 3, phase: 'day', elapsed: 0, t: 0 });
    expect(result.previousPhase).toBe('night');
    expect(result.becameDay).toBe(true);
    expect(result.becameNight).toBe(false);
  });

  it('uses the active phase length when calculating normalized time', () => {
    expect(phaseLength('day')).toBe(DAY_LENGTH);
    expect(phaseLength('night')).toBe(NIGHT_LENGTH);
    expect(createClock(1, 'night', NIGHT_LENGTH / 2).t).toBe(0.5);
  });

  it('marks dusk only during the final fifteen percent of daylight', () => {
    expect(isDuskNear(createClock(1, 'day', DAY_LENGTH * 0.849))).toBe(false);
    expect(isDuskNear(createClock(1, 'day', DAY_LENGTH * 0.85))).toBe(true);
    expect(isDuskNear(createClock(1, 'night', 0))).toBe(false);
  });

  it('ramps night tint at the phase edges and holds the night ceiling in the middle', () => {
    expect(nightTintAlpha(createClock(1, 'day', 0))).toBe(0);
    expect(nightTintAlpha(createClock(1, 'day', DAY_LENGTH * 0.96))).toBeCloseTo(0.1375);
    expect(nightTintAlpha(createClock(1, 'night', NIGHT_LENGTH * 0.05))).toBeCloseTo(0.275);
    expect(nightTintAlpha(createClock(1, 'night', NIGHT_LENGTH * 0.5))).toBe(0.55);
    expect(nightTintAlpha(createClock(1, 'night', NIGHT_LENGTH * 0.95))).toBeCloseTo(0.275);
  });
});
