import { describe, expect, it } from 'vitest';
import {
  FARM_REGION_MAX_X,
  FARM_REGION_MAX_Z,
  FARM_REGION_MIN_X,
  FARM_REGION_MIN_Z,
  HOMESTEAD_SPAWN_X,
  HOMESTEAD_SPAWN_Z,
  HOMESTEAD_FOOTPRINT,
  STARTER_PLOT,
} from '../src/content';
import { isCampTile } from '../src/content/mapData';
import { isFarmableTile, isHomesteadFootprintTile, isStarterPlotTile } from '../src/sim/farmBoundary';

describe('homestead farm boundary', () => {
  it('allows new soil on the inclusive lower edge and inside the authored homestead', () => {
    expect(isFarmableTile(FARM_REGION_MIN_X, FARM_REGION_MIN_Z)).toBe(true);
    expect(isFarmableTile(FARM_REGION_MAX_X - 1, FARM_REGION_MAX_Z - 1)).toBe(true);
  });

  it('rejects decorative wilderness immediately outside every homestead edge', () => {
    expect(isFarmableTile(FARM_REGION_MIN_X - 1, FARM_REGION_MIN_Z)).toBe(false);
    expect(isFarmableTile(FARM_REGION_MAX_X, FARM_REGION_MIN_Z)).toBe(false);
    expect(isFarmableTile(FARM_REGION_MIN_X, FARM_REGION_MIN_Z - 1)).toBe(false);
    expect(isFarmableTile(FARM_REGION_MIN_X, FARM_REGION_MAX_Z)).toBe(false);
  });

  it('rejects non-grid coordinates so world-space callers cannot widen the farm by accident', () => {
    expect(isFarmableTile(FARM_REGION_MIN_X + 0.5, FARM_REGION_MIN_Z)).toBe(false);
    expect(isFarmableTile(FARM_REGION_MIN_X, FARM_REGION_MIN_Z + 0.25)).toBe(false);
  });

  it('keeps the guided first plot wholly inside the bounded homestead', () => {
    expect(isStarterPlotTile(STARTER_PLOT.minX, STARTER_PLOT.minZ)).toBe(true);
    expect(
      isStarterPlotTile(
        STARTER_PLOT.minX + STARTER_PLOT.width - 1,
        STARTER_PLOT.minZ + STARTER_PLOT.height - 1,
      ),
    ).toBe(true);
    expect(isStarterPlotTile(STARTER_PLOT.minX - 1, STARTER_PLOT.minZ)).toBe(false);
  });

  it('places the fresh-run spawn inside the homestead and outside the merchant camp reservation', () => {
    expect(isFarmableTile(Math.floor(HOMESTEAD_SPAWN_X), Math.floor(HOMESTEAD_SPAWN_Z))).toBe(true);
    expect(isCampTile(Math.floor(HOMESTEAD_SPAWN_X), Math.floor(HOMESTEAD_SPAWN_Z))).toBe(false);
  });

  it('keeps the visible homestead building footprint solid while leaving the guided plot outside it', () => {
    expect(isHomesteadFootprintTile(HOMESTEAD_FOOTPRINT.minX, HOMESTEAD_FOOTPRINT.minZ)).toBe(true);
    expect(isHomesteadFootprintTile(STARTER_PLOT.minX, STARTER_PLOT.minZ)).toBe(false);
  });
});
