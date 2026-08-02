import { describe, expect, it } from 'vitest';
import { RuntimeMetrics } from '../src/game/RuntimeMetrics';

describe('runtime metrics', () => {
  it('keeps attempted, rejected, and completed outcomes separate while counting completed actions', () => {
    const metrics = new RuntimeMetrics(100);

    metrics.recordOutcome('building', 'attempted', 4);
    metrics.recordOutcome('building', 'rejected', 4);
    metrics.recordOutcome('building', 'completed', 12, 'build');

    const snapshot = metrics.snapshot(12, 2, 2100);
    expect(snapshot.outcomes.building).toMatchObject({ attempted: 1, rejected: 1, completed: 1 });
    expect(snapshot.actionKinds).toEqual({ build: 1 });
    expect(snapshot.actions).toBe(1);
    expect(snapshot.timeToFirst.building).toBe(12);
  });

  it('records the first upgrade time once and aggregates player-visible progression counters', () => {
    const metrics = new RuntimeMetrics(0);

    metrics.recordUpgrade(18);
    metrics.recordUpgrade(42);
    metrics.recordSale(7);
    metrics.recordSale(3);
    metrics.recordBuildingPlaced();
    metrics.recordCropPlanted();
    metrics.recordCropHarvested(4);
    metrics.recordTreeFelled();
    metrics.recordFoxFelled();
    metrics.setDaysReached(5);

    expect(metrics.snapshot(60, 5, 0)).toMatchObject({
      upgrades: 2,
      firstUpgradeInGameSeconds: 18,
      saleTransactions: 2,
      duckettesEarned: 10,
      buildingsPlaced: 1,
      cropsPlanted: 1,
      cropsHarvested: 4,
      treesFelled: 1,
      foxesFelled: 1,
      daysReached: 5,
      actionKinds: { upgrade: 2 },
    });
  });

  it('returns an isolated debug snapshot and computes session duration from supplied clock values', () => {
    const metrics = new RuntimeMetrics(1000);
    metrics.recordOutcome('plant', 'completed', 24);

    const snapshot = metrics.snapshot(24, 3, 3500);
    snapshot.actionKinds.plant = 99;
    snapshot.outcomes.plant.completed = 99;
    snapshot.timeToFirst.plant = 99;

    expect(snapshot.sessionSeconds).toBe(2.5);
    expect(metrics.snapshot(24, 3, 3500)).toMatchObject({
      actionKinds: { plant: 1 },
      outcomes: { plant: { completed: 1, firstCompletedInGameSeconds: 24 } },
      timeToFirst: { plant: 24 },
    });
  });

  it('exposes whether the settlement goal has completed without exposing mutable internal counters', () => {
    const metrics = new RuntimeMetrics(0);

    expect(metrics.hasCompleted('settlement_goal')).toBe(false);
    metrics.recordOutcome('settlement_goal', 'completed', 96);
    expect(metrics.hasCompleted('settlement_goal')).toBe(true);
  });
});
