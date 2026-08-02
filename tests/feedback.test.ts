import { describe, expect, it } from 'vitest';
import {
  FEEDBACK_KINDS,
  FEEDBACK_PROFILES,
  feedbackProfile,
  shouldRenderFeedback,
} from '../src/sim/feedback';

describe('transient feedback vocabulary', () => {
  it('defines one bounded profile for every player-facing feedback state', () => {
    for (const kind of FEEDBACK_KINDS) {
      const profile = feedbackProfile(kind);
      expect(profile, `${kind} profile`).toBe(FEEDBACK_PROFILES[kind]);
      expect(profile.particleCount, `${kind} particle count`).toBeGreaterThan(0);
      expect(profile.particleCount, `${kind} pool capacity`).toBeLessThanOrEqual(8);
      expect(profile.lifetime, `${kind} lifetime`).toBeGreaterThan(0);
      expect(profile.spread, `${kind} spread`).toBeGreaterThan(0);
      expect(profile.color, `${kind} color`).toBeGreaterThanOrEqual(0);
      expect(profile.color, `${kind} color`).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('uses distinct colors so placement, work, water, reward, damage, threat, and discovery do not collapse into one cue', () => {
    const colors = FEEDBACK_KINDS.map((kind) => FEEDBACK_PROFILES[kind].color);
    expect(new Set(colors).size).toBe(FEEDBACK_KINDS.length);
    expect(FEEDBACK_PROFILES['placement-valid'].color).not.toBe(FEEDBACK_PROFILES['placement-invalid'].color);
    expect(FEEDBACK_PROFILES.water.color).not.toBe(FEEDBACK_PROFILES.reward.color);
  });

  it('keeps valid and invalid placement feedback aligned with the preview language', () => {
    expect(FEEDBACK_PROFILES['placement-valid'].color).toBe(0x76d88a);
    expect(FEEDBACK_PROFILES['placement-invalid'].color).toBe(0xe07060);
    expect(FEEDBACK_PROFILES['placement-valid'].particleCount).toBeGreaterThan(
      FEEDBACK_PROFILES['placement-invalid'].particleCount,
    );
  });

  it('suppresses transient particles when reduced motion is enabled', () => {
    expect(shouldRenderFeedback(false)).toBe(true);
    expect(shouldRenderFeedback(true)).toBe(false);
  });
});
