import { describe, expect, it } from 'vitest';
import {
  LOCOMOTION_GAIT,
  LOCOMOTION_THRESHOLDS,
  approachHeading,
  locomotionClipFor,
  locomotionModeFor,
  locomotionTimeScale,
  shortestHeadingDelta,
} from '../src/game/Locomotion';

describe('locomotion policy', () => {
  it('does not start a locomotion clip until intentional motion clears the start boundary', () => {
    expect(locomotionModeFor(true, 0.05, 'idle', 1)).toBe('idle');
    expect(locomotionModeFor(true, LOCOMOTION_THRESHOLDS.start + 0.01, 'idle', 1)).toBe('walk');
  });

  it('keeps the current walk/run state stable across the hysteresis band', () => {
    expect(locomotionModeFor(true, 0.73, 'walk', 1)).toBe('run');
    expect(locomotionModeFor(true, 0.68, 'run', 1)).toBe('run');
    expect(locomotionModeFor(true, 0.61, 'run', 1)).toBe('walk');
  });

  it('lets residual velocity finish a walk before returning to idle after input release', () => {
    expect(locomotionModeFor(false, 0.05, 'walk', 1)).toBe('walk');
    expect(locomotionModeFor(false, 0.03, 'walk', 1)).toBe('idle');
  });

  it('maps empty hands and carried equipment to the authored locomotion clips', () => {
    expect(locomotionClipFor('idle', null)).toBe('idle');
    expect(locomotionClipFor('walk', null)).toBe('walk');
    expect(locomotionClipFor('run', null)).toBe('run');
    expect(locomotionClipFor('run', { runClip: 'runCarry' })).toBe('runCarry');
    expect(locomotionClipFor('run', { runClip: 'walkCarry' })).toBe('walkCarry');
  });

  it('normalizes in-place clip cadence to actual planar speed without a zero-speed crawl', () => {
    expect(locomotionTimeScale('walk', 0, 5.5)).toBe(0);
    expect(locomotionTimeScale('walk', 5.5 * LOCOMOTION_GAIT.walkSpeedRatio, 5.5)).toBeCloseTo(1);
    expect(locomotionTimeScale('run', 5.5, 5.5)).toBeCloseTo(1);
    expect(locomotionTimeScale('run', 20, 5.5)).toBe(LOCOMOTION_GAIT.maxTimeScale);
  });

  it('turns by a bounded angular step and uses the shortest path across wraparound', () => {
    expect(Math.abs(approachHeading(0, Math.PI, 0.5))).toBeCloseTo(0.5);
    const next = approachHeading(3.1, -3.1, 0.2);
    expect(Math.abs(shortestHeadingDelta(3.1, next))).toBeLessThanOrEqual(0.2 + 1e-9);
    expect(Math.abs(shortestHeadingDelta(next, -3.1))).toBeLessThan(0.001);
  });
});
