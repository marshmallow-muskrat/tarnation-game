import {
  CROP_DEFS,
  FARM_TREE_WOOD,
  FULL_DAY,
  INVENTORY_SLOTS,
  PLANT_GROW_TIME,
  type BaseCropId,
} from '../content';
import { shopAssets, type PurchasableAsset } from '../content/purchasables';
import { createEmptyGrid, harvestTile, plantTile, tillTile } from './farm';
import { makeSeed } from './genetics';
import { addItem, countItem, createInventory, occupiedSlots, removeItem } from './inventory';
import { cropItem, itemInfo, ITEM_WOOD } from './items';
import { purchaseAsset, type PurchaseState } from './economy';
import { mulberry32, randInt } from './rng';

/** Observation boundaries, not gameplay tuning values. */
export const ECONOMY_SIMULATION_LIMITS = {
  runawayDuckettes: 500,
  runawayWood: 200,
  runawayInventorySlots: INVENTORY_SLOTS - 1,
} as const;

export const DEFAULT_ECONOMY_SIMULATION_DAYS = 30;
export const DEFAULT_ECONOMY_SIMULATION_SEEDS = [
  0x0000_1001,
  0x0000_1002,
  0x0000_1003,
  0x0000_1004,
  0x0000_1005,
  0x0000_1006,
  0x0000_1007,
  0x0000_1008,
  0x0000_1009,
  0x0000_100a,
  0x0000_100b,
  0x0000_100c,
  0x0000_100d,
  0x0000_100e,
  0x0000_100f,
  0x0000_1010,
] as const;

const SIM_CROP_SPECIES = Object.keys(CROP_DEFS) as BaseCropId[];
const CROP_GROW_DAYS = Math.ceil(PLANT_GROW_TIME / FULL_DAY);
const SIM_CROP_TILES = 4;

export type EconomySimulationOptions = {
  readonly days?: number;
};

export type PurchaseObservation = {
  id: string;
  attempted: number;
  rejected: number;
  completed: number;
  lastRejection: string | null;
};

export type EconomySimulationReport = {
  seed: number;
  days: number;
  producedWood: number;
  plantedCrops: number;
  harvestedCropUnits: number;
  seedPacketsReturned: number;
  sales: number;
  duckettesEarned: number;
  endingDuckettes: number;
  endingWood: number;
  peakDuckettes: number;
  peakWood: number;
  purchaseAttempts: number;
  rejectedPurchases: number;
  completedPurchases: number;
  resourceStarvationDays: number;
  runawayGrowthDays: number;
  malformedPurchases: string[];
  deadPurchases: string[];
  purchaseObservations: PurchaseObservation[];
};

export type EconomySimulationAggregate = {
  seeds: number[];
  reports: EconomySimulationReport[];
  starvationRuns: number;
  runawayRuns: number;
  deadPurchaseCounts: Record<string, number>;
  totalSales: number;
  totalCompletedPurchases: number;
  minimumEndingDuckettes: number;
  maximumEndingDuckettes: number;
};

type CropLot = {
  tx: number;
  ty: number;
  readyDay: number;
};

type MutablePurchaseObservation = PurchaseObservation;

function purchaseObservation(asset: PurchasableAsset): MutablePurchaseObservation {
  return {
    id: asset.id,
    attempted: 0,
    rejected: 0,
    completed: 0,
    lastRejection: null,
  };
}

function sellHarvest(
  state: PurchaseState,
  id: string,
  count: number,
): number {
  if (!removeItem(state.inventory, id, count)) return 0;
  const earned = itemInfo(id).price * count;
  state.duckettes += earned;
  return earned;
}

function hasResourceShortage(reasons: readonly string[]): boolean {
  return reasons.some((reason) => reason.startsWith('Need '));
}

/**
 * Run the current economy rules through a small, fixed farming policy.
 *
 * The policy fells a seeded number of trees, plants one seeded base crop per
 * day, sells ready harvest immediately, and attempts every current vendor row.
 * It is deliberately not a player simulator: its purpose is to make resource
 * starvation, runaway accumulation, and purchases that never become possible
 * visible before ECON-04 tuning.
 */
export function simulateEconomy(
  seed: number,
  options: EconomySimulationOptions = {},
): EconomySimulationReport {
  const days = Math.max(1, Math.floor(options.days ?? DEFAULT_ECONOMY_SIMULATION_DAYS));
  const rng = mulberry32(seed);
  const state: PurchaseState = {
    duckettes: 0,
    inventory: createInventory(),
  };
  const tiles = createEmptyGrid();
  const planted: CropLot[] = [];
  const targets = shopAssets();
  const observations = targets.map(purchaseObservation);
  let producedWood = 0;
  let plantedCrops = 0;
  let harvestedCropUnits = 0;
  let seedPacketsReturned = 0;
  let sales = 0;
  let duckettesEarned = 0;
  let purchaseAttempts = 0;
  let rejectedPurchases = 0;
  let completedPurchases = 0;
  let resourceStarvationDays = 0;
  let runawayGrowthDays = 0;
  const malformedPurchases = new Set<string>();
  let peakDuckettes = state.duckettes;
  let peakWood = 0;

  for (let day = 1; day <= days; day++) {
    // A completed tree includes the current stump-clearing log bonus.
    const treeCount = randInt(rng, 1, 5);
    const woodToday = treeCount * (FARM_TREE_WOOD + 1);
    if (!addItem(state.inventory, ITEM_WOOD, woodToday)) {
      throw new Error('economy simulation could not add its wood stack');
    }
    producedWood += woodToday;

    for (let i = planted.length - 1; i >= 0; i--) {
      const lot = planted[i]!;
      if (lot.readyDay > day) continue;
      const tile = tiles[lot.ty]![lot.tx]!;
      tile.state = 'mature';
      const result = harvestTile(tiles, lot.tx, lot.ty);
      if (!result.ok || !result.seed) {
        throw new Error(`economy simulation lost planted crop at ${lot.tx},${lot.ty}`);
      }
      const itemId = cropItem(result.seed.displayName);
      if (!addItem(state.inventory, itemId, result.count)) {
        throw new Error('economy simulation could not add its harvest stack');
      }
      const earned = sellHarvest(state, itemId, result.count);
      if (earned <= 0) throw new Error(`economy simulation could not sell ${itemId}`);
      harvestedCropUnits += result.count;
      seedPacketsReturned += 1;
      sales += 1;
      duckettesEarned += earned;
      planted.splice(i, 1);
    }

    const cropSpecies = SIM_CROP_SPECIES[randInt(rng, 0, SIM_CROP_SPECIES.length)]!;
    const cropSeed = makeSeed(cropSpecies);
    const cropIndex = (day - 1) % SIM_CROP_TILES;
    const tx = 10 + cropIndex;
    const ty = 10;
    const tile = tiles[ty]![tx]!;
    const prepared = tile.state === 'tilled' || tillTile(tiles, tx, ty, day);
    if (!prepared || !plantTile(tiles, tx, ty, cropSeed)) {
      throw new Error(`economy simulation could not plant ${cropSpecies} at ${tx},${ty}`);
    }
    planted.push({ tx, ty, readyDay: day + CROP_GROW_DAYS });
    plantedCrops += 1;

    let dayHadResourceShortage = false;
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]!;
      const observation = observations[i]!;
      if (observation.completed > 0) continue;
      observation.attempted += 1;
      purchaseAttempts += 1;
      const hasMalformedCost =
        !Number.isFinite(target.price) ||
        Object.values(target.materialCost).some((cost) => !Number.isFinite(cost));
      if (hasMalformedCost) {
        observation.rejected += 1;
        rejectedPurchases += 1;
        observation.lastRejection = 'Catalog cost is not finite';
        malformedPurchases.add(target.id);
        continue;
      }
      const result = purchaseAsset(state, target, { allowFreePurchases: false });
      if (result.ok) {
        observation.completed += 1;
        completedPurchases += 1;
        continue;
      }
      observation.rejected += 1;
      rejectedPurchases += 1;
      observation.lastRejection = result.quote.reasons.join(' · ') || 'Rejected';
      if (hasResourceShortage(result.quote.reasons)) dayHadResourceShortage = true;
    }
    if (dayHadResourceShortage) resourceStarvationDays += 1;

    const wood = countItem(state.inventory, ITEM_WOOD);
    peakDuckettes = Math.max(peakDuckettes, state.duckettes);
    peakWood = Math.max(peakWood, wood);
    if (
      state.duckettes > ECONOMY_SIMULATION_LIMITS.runawayDuckettes ||
      wood > ECONOMY_SIMULATION_LIMITS.runawayWood ||
      occupiedSlots(state.inventory).length >= ECONOMY_SIMULATION_LIMITS.runawayInventorySlots
    ) {
      runawayGrowthDays += 1;
    }
  }

  const purchaseObservations = observations.map((observation) => ({ ...observation }));
  return {
    seed: seed >>> 0,
    days,
    producedWood,
    plantedCrops,
    harvestedCropUnits,
    seedPacketsReturned,
    sales,
    duckettesEarned,
    endingDuckettes: state.duckettes,
    endingWood: countItem(state.inventory, ITEM_WOOD),
    peakDuckettes,
    peakWood,
    purchaseAttempts,
    rejectedPurchases,
    completedPurchases,
    resourceStarvationDays,
    runawayGrowthDays,
    malformedPurchases: [...malformedPurchases].sort(),
    deadPurchases: purchaseObservations
      .filter((observation) => observation.attempted > 0 && observation.completed === 0)
      .map((observation) => observation.id),
    purchaseObservations,
  };
}

export function simulateEconomyAcrossSeeds(
  seeds: readonly number[] = DEFAULT_ECONOMY_SIMULATION_SEEDS,
  options: EconomySimulationOptions = {},
): EconomySimulationAggregate {
  const reports = seeds.map((seed) => simulateEconomy(seed, options));
  const deadPurchaseCounts: Record<string, number> = {};
  for (const report of reports) {
    for (const id of report.deadPurchases) {
      deadPurchaseCounts[id] = (deadPurchaseCounts[id] ?? 0) + 1;
    }
  }
  return {
    seeds: [...seeds],
    reports,
    starvationRuns: reports.filter((report) => report.resourceStarvationDays > 0).length,
    runawayRuns: reports.filter((report) => report.runawayGrowthDays > 0).length,
    deadPurchaseCounts,
    totalSales: reports.reduce((total, report) => total + report.sales, 0),
    totalCompletedPurchases: reports.reduce(
      (total, report) => total + report.completedPurchases,
      0,
    ),
    minimumEndingDuckettes: Math.min(...reports.map((report) => report.endingDuckettes)),
    maximumEndingDuckettes: Math.max(...reports.map((report) => report.endingDuckettes)),
  };
}
