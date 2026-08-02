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

export type FirstPlotControls = {
  shovel: string;
  bucket: string;
  previousSeed: string;
  nextSeed: string;
  primary: string;
};

const DEFAULT_FIRST_PLOT_CONTROLS: FirstPlotControls = {
  shovel: '2',
  bucket: '6',
  previousSeed: '[',
  nextSeed: ']',
  primary: 'Enter',
};

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

export function firstPlotHint(
  stage: FirstPlotStage,
  seedName = 'a seed',
  controls = DEFAULT_FIRST_PLOT_CONTROLS,
): string {
  switch (stage) {
    case 'till':
      return `First plot · move with WASD, choose ${controls.shovel} shovel, then ${controls.primary} or click to till a highlighted tile`;
    case 'plant':
      return `First plot · select ${seedName} with ${controls.previousSeed} ${controls.nextSeed}, then ${controls.primary} or click the tilled plot`;
    case 'water':
      return `First plot · use ${controls.bucket} bucket at water, then ${controls.primary} or click to water the thirsty crop`;
    case 'grow':
      return 'First plot · the crop is growing — protect it, then harvest when ready';
    case 'harvest':
      return `First plot · choose ${controls.shovel} shovel and ${controls.primary} or click the mature crop`;
    case 'sell':
      return 'First plot · take the harvest to the Market stall and sell it';
    case 'complete':
      return 'First plot complete · choose storage, crop strategy, or defense at the Traveling Merchant';
  }
}
