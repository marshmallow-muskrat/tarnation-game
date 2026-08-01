/**
 * Local-only outcome counters used to characterize the player-visible economy
 * loop. This module is intentionally renderer-independent and is never saved
 * or sent over the network.
 */

export const OUTCOME_KINDS = [
  'plant',
  'harvest',
  'sale',
  'purchase',
  'building',
  'fox_defense',
  'settlement_goal',
] as const;

export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

export const OUTCOME_STATUSES = [
  'attempted',
  'rejected',
  'cancelled',
  'completed',
] as const;

export type OutcomeStatus = (typeof OUTCOME_STATUSES)[number];

export type OutcomeCount = Record<OutcomeStatus, number> & {
  firstCompletedInGameSeconds: number | null;
};

export type OutcomeMetrics = Record<OutcomeKind, OutcomeCount>;

function emptyOutcomeCount(): OutcomeCount {
  return {
    attempted: 0,
    rejected: 0,
    cancelled: 0,
    completed: 0,
    firstCompletedInGameSeconds: null,
  };
}

export function createOutcomeMetrics(): OutcomeMetrics {
  return Object.fromEntries(
    OUTCOME_KINDS.map((kind) => [kind, emptyOutcomeCount()]),
  ) as OutcomeMetrics;
}

/** Record one outcome without depending on wall-clock time or runtime state. */
export function recordOutcomeMetric(
  metrics: OutcomeMetrics,
  kind: OutcomeKind,
  status: OutcomeStatus,
  inGameSeconds: number,
): void {
  const count = metrics[kind];
  count[status] += 1;
  if (
    status === 'completed' &&
    count.firstCompletedInGameSeconds === null
  ) {
    count.firstCompletedInGameSeconds = inGameSeconds;
  }
}

export function cloneOutcomeMetrics(metrics: OutcomeMetrics): OutcomeMetrics {
  return Object.fromEntries(
    OUTCOME_KINDS.map((kind) => [kind, { ...metrics[kind] }]),
  ) as OutcomeMetrics;
}

export function firstOutcomeCompletionTimes(
  metrics: OutcomeMetrics,
): Record<OutcomeKind, number | null> {
  return Object.fromEntries(
    OUTCOME_KINDS.map((kind) => [
      kind,
      metrics[kind].firstCompletedInGameSeconds,
    ]),
  ) as Record<OutcomeKind, number | null>;
}
