import { describe, expect, it } from 'vitest';
import { STARTER_PLOT } from '../src/content';
import { emptyTile, createEmptyGrid } from '../src/sim/farm';
import { firstPlotHint, firstPlotStage } from '../src/sim/farmBoundary';

function tileAt(state: ReturnType<typeof emptyTile>['state'], watered = false) {
  return { ...emptyTile(), state, watered };
}

describe('first plot guide', () => {
  it('starts by directing a new player to till inside the marked plot', () => {
    expect(firstPlotStage(createEmptyGrid(), 0, 0)).toBe('till');
    expect(firstPlotHint('till')).toContain('till a highlighted tile');
  });

  it('moves from worked soil to planting without adding a second quest state', () => {
    const tiles = createEmptyGrid();
    tiles[STARTER_PLOT.minZ]![STARTER_PLOT.minX] = tileAt('tilled');

    expect(firstPlotStage(tiles, 0, 0)).toBe('plant');
    expect(firstPlotHint('plant', 'Beet')).toContain('Beet');
  });

  it('requires water before treating a planted crop as growing', () => {
    const tiles = createEmptyGrid();
    tiles[STARTER_PLOT.minZ]![STARTER_PLOT.minX] = tileAt('planted');
    expect(firstPlotStage(tiles, 0, 0)).toBe('water');

    tiles[STARTER_PLOT.minZ]![STARTER_PLOT.minX]!.watered = true;
    expect(firstPlotStage(tiles, 0, 0)).toBe('grow');
    expect(firstPlotHint('grow')).toContain('growing');
  });

  it('prioritizes harvest when the first plot has a mature crop', () => {
    const tiles = createEmptyGrid();
    tiles[STARTER_PLOT.minZ]![STARTER_PLOT.minX] = tileAt('mature', true);
    expect(firstPlotStage(tiles, 0, 0)).toBe('harvest');
    expect(firstPlotHint('harvest')).toContain('mature crop');
  });

  it('directs the first harvested crop to the market before calling the guide complete', () => {
    expect(firstPlotStage(createEmptyGrid(), 1, 0)).toBe('sell');
    expect(firstPlotHint('sell')).toContain('Market stall');
    expect(firstPlotStage(createEmptyGrid(), 1, 7)).toBe('complete');
  });

  it('ignores worked tiles outside the starter plot when deriving onboarding progress', () => {
    const tiles = createEmptyGrid();
    tiles[STARTER_PLOT.minZ - 1]![STARTER_PLOT.minX] = tileAt('tilled');
    expect(firstPlotStage(tiles, 0, 0)).toBe('till');
  });
});
