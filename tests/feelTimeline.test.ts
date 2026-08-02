import { describe, expect, it } from 'vitest';
import {
  ACTION_IMPACT_PHASES,
  FEEL_TIMELINES,
  PresentationTimeline,
  type FeelEvent,
} from '../src/game/FeelTimeline';

const EVENTS = Object.keys(FEEL_TIMELINES) as FeelEvent[];

describe('cohesive presentation timelines', () => {
  it('gives each player-visible impact one bounded audio, VFX, camera, or pause bundle', () => {
    for (const event of EVENTS) {
      const timeline = FEEL_TIMELINES[event];
      expect(timeline.event, `${event} event identity`).toBe(event);
      expect(timeline.minInterval, `${event} repetition bound`).toBeGreaterThan(0);
      expect(timeline.hitPause, `${event} hit pause`).toBeGreaterThanOrEqual(0);
      expect(
        timeline.feedback !== null || timeline.audio !== null || timeline.shake !== null || timeline.hitPause > 0,
        `${event} has a player-facing presentation channel`,
      ).toBe(true);
      if (timeline.shake) {
        expect(timeline.shake.duration, `${event} shake duration`).toBeGreaterThan(0);
        expect(timeline.shake.amplitude, `${event} shake amplitude`).toBeGreaterThan(0);
      }
    }
  });

  it('keeps action animation start separate from the fixed contact or fire impact moment', () => {
    expect(ACTION_IMPACT_PHASES).toEqual({
      tool: 'contact',
      ranged: 'fire',
      interact: 'contact',
    });
    expect(FEEL_TIMELINES['melee-impact'].hitPause).toBe(0.04);
    expect(FEEL_TIMELINES['shotgun-fire'].shake).toEqual({ duration: 0.06, amplitude: 0.05 });
  });

  it('coalesces repeated presentation bundles without suppressing the first readable cue', () => {
    const timeline = new PresentationTimeline();
    expect(timeline.trigger('wood-contact')?.event).toBe('wood-contact');
    expect(timeline.trigger('wood-contact')).toBeNull();
    timeline.advance(0.08);
    expect(timeline.trigger('wood-contact')?.event).toBe('wood-contact');
    expect(timeline.activeCount).toBe(1);
  });

  it('keeps a deterministic normal-speed one-hour presentation soak bounded', () => {
    const run = (): { emitted: number; peakActive: number } => {
      const timeline = new PresentationTimeline();
      let emitted = 0;
      let peakActive = 0;
      for (let step = 0; step < 60 * 60 * 60; step++) {
        timeline.advance(1 / 60);
        if (timeline.trigger(EVENTS[step % EVENTS.length]!)) emitted++;
        peakActive = Math.max(peakActive, timeline.activeCount);
      }
      return { emitted, peakActive };
    };

    const first = run();
    expect(first.emitted).toBeGreaterThan(0);
    expect(first.peakActive).toBeLessThanOrEqual(EVENTS.length);
    expect(run()).toEqual(first);
  });
});
