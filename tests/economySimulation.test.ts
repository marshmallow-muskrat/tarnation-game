import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIRST_SESSION_DAYS,
  DEFAULT_ECONOMY_SIMULATION_DAYS,
  DEFAULT_ECONOMY_SIMULATION_SEEDS,
  simulateEconomy,
  simulateEconomyAcrossSeeds,
} from '../src/sim/economySimulation';

describe('deterministic economy simulation diagnostics', () => {
  it('repeats the same seeded crop, sale, and purchase outcomes exactly', () => {
    const first = simulateEconomy(0x0ec0_0301);
    const second = simulateEconomy(0x0ec0_0301);

    expect(first).toEqual(second);
    expect(first.days).toBe(DEFAULT_ECONOMY_SIMULATION_DAYS);
    expect(first.plantedCrops).toBe(DEFAULT_ECONOMY_SIMULATION_DAYS);
    expect(Number.isFinite(first.endingDuckettes)).toBe(true);
    expect(first.malformedPurchases).toEqual([]);
    expect(first.deadPurchases).toEqual([]);
    expect(first.purchaseObservations.length).toBeGreaterThan(0);
  });

  it('uses the seed to vary resource production while keeping the same policy', () => {
    const first = simulateEconomy(0x0ec0_0302);
    const second = simulateEconomy(0x0ec0_0303);

    expect(first.seed).not.toBe(second.seed);
    expect(
      first.producedWood !== second.producedWood ||
        first.harvestedCropUnits !== second.harvestedCropUnits ||
        first.endingDuckettes !== second.endingDuckettes,
    ).toBe(true);
    expect(first.purchaseObservations.map((purchase) => purchase.id)).toEqual(
      second.purchaseObservations.map((purchase) => purchase.id),
    );
  });

  it('reports starvation and runaway growth while keeping every released purchase live', () => {
    const report = simulateEconomyAcrossSeeds();

    expect(report.seeds).toEqual([...DEFAULT_ECONOMY_SIMULATION_SEEDS]);
    expect(report.reports).toHaveLength(DEFAULT_ECONOMY_SIMULATION_SEEDS.length);
    expect(report.starvationRuns).toBeGreaterThanOrEqual(0);
    expect(report.runawayRuns).toBeGreaterThanOrEqual(0);
    expect(report.totalSales).toBeGreaterThan(0);
    expect(report.maximumEndingDuckettes).toBeGreaterThanOrEqual(
      report.minimumEndingDuckettes,
    );
    expect(report.reports.every((run) => run.malformedPurchases.length === 0)).toBe(true);
    expect(report.reports.every((run) => run.deadPurchases.length === 0)).toBe(true);
    expect(Object.keys(report.deadPurchaseCounts).every((id) => id.length > 0)).toBe(true);
  });

  it('reaches the first capability upgrade within the five-day target across the cohort', () => {
    const report = simulateEconomyAcrossSeeds(DEFAULT_ECONOMY_SIMULATION_SEEDS, {
      days: DEFAULT_FIRST_SESSION_DAYS,
    });

    expect(report.firstSessionUpgradeRuns).toBe(DEFAULT_ECONOMY_SIMULATION_SEEDS.length);
    expect(report.firstMeaningfulUpgradeDays.every((day) => day <= DEFAULT_FIRST_SESSION_DAYS)).toBe(true);
    expect(report.firstMeaningfulUpgradeDays).toEqual(
      expect.arrayContaining([3, 4, 5]),
    );
    expect(report.reports.every((run) => run.firstCropSaleDay === 3)).toBe(true);
  });
});
