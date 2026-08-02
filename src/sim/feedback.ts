/** The small, player-facing vocabulary used by transient action feedback. */
export const FEEDBACK_KINDS = [
  'placement-valid',
  'placement-invalid',
  'work-contact',
  'water',
  'reward',
  'damage',
  'threat',
  'discovery',
] as const;

export type FeedbackKind = typeof FEEDBACK_KINDS[number];

export type FeedbackProfile = Readonly<{
  color: number;
  particleCount: number;
  spread: number;
  lifetime: number;
  rise: number;
  gravity: number;
  scale: number;
}>;

/**
 * Feedback is intentionally semantic rather than per-call art direction.
 * These colors are also the contract used by the renderer pool, so a small
 * event cannot silently grow a new visual language at an individual call site.
 */
export const FEEDBACK_PROFILES = {
  'placement-valid': {
    color: 0x76d88a,
    particleCount: 6,
    spread: 0.24,
    lifetime: 0.42,
    rise: 0.72,
    gravity: 3.8,
    scale: 0.9,
  },
  'placement-invalid': {
    color: 0xe07060,
    particleCount: 4,
    spread: 0.16,
    lifetime: 0.3,
    rise: 0.42,
    gravity: 4.6,
    scale: 0.75,
  },
  'work-contact': {
    color: 0xc9854a,
    particleCount: 4,
    spread: 0.2,
    lifetime: 0.38,
    rise: 0.65,
    gravity: 4.2,
    scale: 0.75,
  },
  water: {
    color: 0x69b8dc,
    particleCount: 4,
    spread: 0.22,
    lifetime: 0.4,
    rise: 0.7,
    gravity: 3.7,
    scale: 0.8,
  },
  reward: {
    color: 0xf2c266,
    particleCount: 8,
    spread: 0.28,
    lifetime: 0.5,
    rise: 0.95,
    gravity: 3.8,
    scale: 0.9,
  },
  damage: {
    color: 0xffb45c,
    particleCount: 5,
    spread: 0.2,
    lifetime: 0.34,
    rise: 0.8,
    gravity: 4.6,
    scale: 0.8,
  },
  threat: {
    color: 0xef7561,
    particleCount: 8,
    spread: 0.3,
    lifetime: 0.48,
    rise: 0.9,
    gravity: 4.3,
    scale: 0.9,
  },
  discovery: {
    color: 0xb78cff,
    particleCount: 7,
    spread: 0.28,
    lifetime: 0.52,
    rise: 1,
    gravity: 3.4,
    scale: 0.9,
  },
} as const satisfies Readonly<Record<FeedbackKind, FeedbackProfile>>;

export function feedbackProfile(kind: FeedbackKind): FeedbackProfile {
  return FEEDBACK_PROFILES[kind];
}

/** Reduced motion removes transient particles rather than merely shrinking them. */
export function shouldRenderFeedback(reducedMotion: boolean): boolean {
  return !reducedMotion;
}
