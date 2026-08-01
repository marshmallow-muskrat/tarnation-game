import { describe, expect, it } from 'vitest';
import {
  cloneOutcomeMetrics,
  createOutcomeMetrics,
  firstOutcomeCompletionTimes,
  OUTCOME_KINDS,
  recordOutcomeMetric,
} from '../src/sim/outcomes';

describe('local economy outcome instrumentation', () => {
  it('starts every player-visible economy outcome with four separate statuses', () => {
    const metrics = createOutcomeMetrics();

    for (const kind of OUTCOME_KINDS) {
      expect(metrics[kind]).toEqual({
        attempted: 0,
        rejected: 0,
        cancelled: 0,
        completed: 0,
        firstCompletedInGameSeconds: null,
      });
    }
  });

  it('records attempts, rejections, cancellations, and completion time without conflating them', () => {
    const metrics = createOutcomeMetrics();

    recordOutcomeMetric(metrics, 'purchase', 'attempted', 4);
    recordOutcomeMetric(metrics, 'purchase', 'rejected', 4);
    recordOutcomeMetric(metrics, 'purchase', 'attempted', 12);
    recordOutcomeMetric(metrics, 'purchase', 'cancelled', 12);
    recordOutcomeMetric(metrics, 'purchase', 'completed', 18);
    recordOutcomeMetric(metrics, 'purchase', 'completed', 30);

    expect(metrics.purchase).toEqual({
      attempted: 2,
      rejected: 1,
      cancelled: 1,
      completed: 2,
      firstCompletedInGameSeconds: 18,
    });
    expect(firstOutcomeCompletionTimes(metrics).purchase).toBe(18);
  });

  it('returns a deep copy so debug inspection cannot mutate the live counters', () => {
    const metrics = createOutcomeMetrics();
    recordOutcomeMetric(metrics, 'plant', 'completed', 42);
    const copy = cloneOutcomeMetrics(metrics);

    copy.plant.completed = 99;
    copy.plant.firstCompletedInGameSeconds = 99;

    expect(metrics.plant.completed).toBe(1);
    expect(metrics.plant.firstCompletedInGameSeconds).toBe(42);
  });
});
