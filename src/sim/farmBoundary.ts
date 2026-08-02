import {
  FARM_REGION_MAX_X,
  FARM_REGION_MAX_Z,
  FARM_REGION_MIN_X,
  FARM_REGION_MIN_Z,
  HOMESTEAD_FOOTPRINT,
  STARTER_PLOT,
} from '../content';
import type { Tile } from './farm';

export type FarmRegion = {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
};

export const HOMESTEAD_FARM_REGION: FarmRegion = {
  minX: FARM_REGION_MIN_X,
  minZ: FARM_REGION_MIN_Z,
  maxX: FARM_REGION_MAX_X,
  maxZ: FARM_REGION_MAX_Z,
};

/** New soil may only be authored inside the bounded homestead region. */
export function isFarmableTile(tx: number, ty: number, region = HOMESTEAD_FARM_REGION): boolean {
  return (
    Number.isInteger(tx) &&
    Number.isInteger(ty) &&
    tx >= region.minX &&
    tx < region.maxX &&
    ty >= region.minZ &&
    ty < region.maxZ
  );
}

export function isStarterPlotTile(tx: number, ty: number): boolean {
  return (
    Number.isInteger(tx) &&
    Number.isInteger(ty) &&
    tx >= STARTER_PLOT.minX &&
    tx < STARTER_PLOT.minX + STARTER_PLOT.width &&
    ty >= STARTER_PLOT.minZ &&
    ty < STARTER_PLOT.minZ + STARTER_PLOT.height
  );
}

export function isHomesteadFootprintTile(tx: number, ty: number): boolean {
  return (
    Number.isInteger(tx) &&
    Number.isInteger(ty) &&
    tx >= HOMESTEAD_FOOTPRINT.minX &&
    tx < HOMESTEAD_FOOTPRINT.minX + HOMESTEAD_FOOTPRINT.width &&
    ty >= HOMESTEAD_FOOTPRINT.minZ &&
    ty < HOMESTEAD_FOOTPRINT.minZ + HOMESTEAD_FOOTPRINT.height
  );
}

export type FirstPlotStage = 'till' | 'plant' | 'water' | 'grow' | 'harvest' | 'sell' | 'complete';

/**
 * Derive the short first-plot prompt from existing tile and progression state.
 * This is intentionally not saved: the guide is onboarding, not a second quest system.
 */
export function firstPlotStage(
  tiles: Tile[][],
  cropsHarvested: number,
  duckettes: number,
): FirstPlotStage {
  if (cropsHarvested > 0) return duckettes > 0 ? 'complete' : 'sell';

  let hasWorkedGround = false;
  let hasPlanted = false;
  let hasThirstyCrop = false;
  let hasGrowingCrop = false;
  let hasMatureCrop = false;

  for (let ty = STARTER_PLOT.minZ; ty < STARTER_PLOT.minZ + STARTER_PLOT.height; ty++) {
    for (let tx = STARTER_PLOT.minX; tx < STARTER_PLOT.minX + STARTER_PLOT.width; tx++) {
      const tile = tiles[ty]?.[tx];
      if (!tile || tile.state === 'grass') continue;
      hasWorkedGround = true;
      if (tile.state === 'mature') {
        hasMatureCrop = true;
      } else if (tile.state === 'planted') {
        hasPlanted = true;
        if (tile.watered) hasGrowingCrop = true;
        else hasThirstyCrop = true;
      }
    }
  }

  if (hasMatureCrop) return 'harvest';
  if (hasThirstyCrop) return 'water';
  if (hasGrowingCrop) return 'grow';
  if (hasPlanted) return 'grow';
  if (hasWorkedGround) return 'plant';
  return 'till';
}

export function firstPlotHint(stage: FirstPlotStage, seedName = 'a seed'): string {
  switch (stage) {
    case 'till':
      return 'First plot · move with WASD, choose 2 shovel, then till a highlighted tile';
    case 'plant':
      return `First plot · select ${seedName} with [ ] and click the tilled plot`;
    case 'water':
      return 'First plot · use 6 bucket at water, then water the thirsty crop';
    case 'grow':
      return 'First plot · the crop is growing — protect it, then harvest when ready';
    case 'harvest':
      return 'First plot · choose 2 shovel and click the mature crop';
    case 'sell':
      return 'First plot · take the harvest to the Market stall and sell it';
    case 'complete':
      return 'First plot complete · visit the Traveling Merchant for homestead permits or irrigation';
  }
}
