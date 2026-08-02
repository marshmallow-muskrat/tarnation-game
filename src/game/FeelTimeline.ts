import type { FeedbackKind } from '../sim/feedback';
import type { AudioEvent } from './audioCatalog';

/** Presentation events are emitted at the fixed action contact/fire boundary. */
export type FeelEvent =
  | 'placement-rejected'
  | 'placement-confirmed'
  | 'upgrade-reward'
  | 'breeding-bed'
  | 'hybrid-reward'
  | 'hybrid-discovery'
  | 'water-contact'
  | 'soil-contact'
  | 'wood-contact'
  | 'metal-contact'
  | 'harvest-complete'
  | 'codex-discovery'
  | 'tree-felled'
  | 'shotgun-fire'
  | 'bow-fire'
  | 'projectile-impact'
  | 'melee-impact'
  | 'trap-set'
  | 'fox-trapped'
  | 'fox-threat'
  | 'fox-telegraph'
  | 'fox-structure-hit'
  | 'fox-defeat'
  | 'gate-open'
  | 'settlement-reward';

export type ShakeCue = Readonly<{
  duration: number;
  amplitude: number;
}>;

export type FeelTimeline = Readonly<{
  event: FeelEvent;
  /** A semantic burst, or null when the existing UI/audio cue is sufficient. */
  feedback: FeedbackKind | null;
  audio: AudioEvent | null;
  shake: ShakeCue | null;
  hitPause: number;
  /** Fixed-step refractory period for the complete presentation bundle. */
  minInterval: number;
}>;

/** The fixed-step contact/fire boundary is the shared presentation impact moment. */
export const ACTION_IMPACT_PHASES = {
  tool: 'contact',
  ranged: 'fire',
  interact: 'contact',
} as const;

type FeelOverrides = Partial<Omit<FeelTimeline, 'event'>>;

const cue = (
  event: FeelEvent,
  feedback: FeedbackKind | null,
  audio: AudioEvent | null,
  overrides: FeelOverrides = {},
): FeelTimeline => ({
  event,
  feedback,
  audio,
  shake: null,
  hitPause: 0,
  minInterval: 0.08,
  ...overrides,
});

/**
 * One restrained presentation bundle per player-visible event. The action
 * state machine owns animation start; its fixed contact/fire event selects the
 * corresponding bundle here so audio, VFX, camera, and hit pause stay aligned.
 */
export const FEEL_TIMELINES = {
  'placement-rejected': cue('placement-rejected', 'placement-invalid', null),
  'placement-confirmed': cue('placement-confirmed', 'placement-valid', 'building', { minInterval: 0.12 }),
  'upgrade-reward': cue('upgrade-reward', 'reward', 'building', { minInterval: 0.18 }),
  'breeding-bed': cue('breeding-bed', 'work-contact', 'building', { minInterval: 0.12 }),
  'hybrid-reward': cue('hybrid-reward', 'reward', 'reward', { minInterval: 0.14 }),
  'hybrid-discovery': cue('hybrid-discovery', 'discovery', 'reward', { minInterval: 0.14 }),
  'water-contact': cue('water-contact', 'water', 'water', { minInterval: 0.16 }),
  'soil-contact': cue('soil-contact', 'work-contact', 'tool-soil', { minInterval: 0.08 }),
  'wood-contact': cue('wood-contact', 'work-contact', 'tool-wood', { minInterval: 0.08 }),
  'metal-contact': cue('metal-contact', 'damage', 'tool-metal', { minInterval: 0.12 }),
  'harvest-complete': cue('harvest-complete', 'reward', 'crop-harvest', { minInterval: 0.14 }),
  'codex-discovery': cue('codex-discovery', 'discovery', 'crop-harvest', { minInterval: 0.14 }),
  'tree-felled': cue('tree-felled', 'reward', 'reward', {
    minInterval: 0.18,
    shake: { duration: 0.14, amplitude: 0.12 },
  }),
  'shotgun-fire': cue('shotgun-fire', 'damage', 'shot', {
    minInterval: 0.16,
    shake: { duration: 0.06, amplitude: 0.05 },
  }),
  'bow-fire': cue('bow-fire', 'damage', 'shot', {
    minInterval: 0.16,
    shake: { duration: 0.025, amplitude: 0.02 },
  }),
  'projectile-impact': cue('projectile-impact', 'damage', 'fox-hit', { minInterval: 0.05 }),
  'melee-impact': cue('melee-impact', 'damage', 'fox-hit', {
    minInterval: 0.05,
    shake: { duration: 0.08, amplitude: 0.07 },
    hitPause: 0.04,
  }),
  'trap-set': cue('trap-set', 'work-contact', 'fox-trap', { minInterval: 0.18 }),
  'fox-trapped': cue('fox-trapped', 'damage', 'fox-trap', { minInterval: 0.18 }),
  'fox-threat': cue('fox-threat', 'threat', 'fox-threat', { minInterval: 0.45 }),
  'fox-telegraph': cue('fox-telegraph', 'threat', null, { minInterval: 0.45 }),
  'fox-structure-hit': cue('fox-structure-hit', 'threat', 'building', { minInterval: 0.18 }),
  'fox-defeat': cue('fox-defeat', 'threat', 'defeat', {
    minInterval: 0.1,
    shake: { duration: 0.09, amplitude: 0.08 },
    hitPause: 0.05,
  }),
  'gate-open': cue('gate-open', null, 'building', { minInterval: 0.12 }),
  'settlement-reward': cue('settlement-reward', 'reward', 'reward', { minInterval: 0.18 }),
} as const satisfies Readonly<Record<FeelEvent, FeelTimeline>>;

export function feelTimelineFor(event: FeelEvent): FeelTimeline {
  return FEEL_TIMELINES[event];
}

/**
 * Fixed-step gating for the complete bundle. Audio has its own voice policy,
 * but keeping VFX and camera on the same refractory boundary prevents a held
 * input or dense raid from producing redundant presentation spam.
 */
export class PresentationTimeline {
  private readonly cooldowns = new Map<FeelEvent, number>();

  get activeCount(): number {
    return this.cooldowns.size;
  }

  trigger(event: FeelEvent): FeelTimeline | null {
    const remaining = this.cooldowns.get(event) ?? 0;
    if (remaining > 0) return null;
    const timeline = feelTimelineFor(event);
    this.cooldowns.set(event, timeline.minInterval);
    return timeline;
  }

  advance(dt: number): void {
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;
    if (step <= 0) return;
    for (const [event, remaining] of this.cooldowns) {
      const next = remaining - step;
      if (next <= 0) this.cooldowns.delete(event);
      else this.cooldowns.set(event, next);
    }
  }

  clear(): void {
    this.cooldowns.clear();
  }
}
