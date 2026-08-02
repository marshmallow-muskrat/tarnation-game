import { describe, expect, it } from 'vitest';
import { createEmptyGrid } from '../src/sim/farm';
import {
  calculateEnclosedTiles,
  canTraverseGridStep,
  fixtureObstacleTiles,
  fixtureTiles,
  footprintTiles,
  normalizeOrientation,
  occupiedPlacedTiles,
  orientedFootprint,
  placedCenter,
  placedOrigin,
  placementStatus,
  tileIsEnclosed,
  tileKey,
} from '../src/sim/placement';
import { assetDefinition } from '../src/content/purchasables';

describe('placement footprints, reservations, gates, demolition, and enclosures', () => {
  it('normalizes quarter-turns and legacy radians to the four supported orientations', () => {
    expect(normalizeOrientation(0)).toBe(0);
    expect(normalizeOrientation(1)).toBe(1);
    expect(normalizeOrientation(3)).toBe(3);
    expect(normalizeOrientation(Math.PI / 2)).toBe(1);
    expect(normalizeOrientation(-Math.PI / 2)).toBe(3);
    expect(normalizeOrientation(Number.NaN)).toBe(0);
  });

  it('swaps a rectangular footprint on odd rotations and round-trips a placed center to its origin', () => {
    const fence = assetDefinition('fence')!;
    const origin = { tx: 20, ty: 20 };

    expect(orientedFootprint(fence, 0)).toEqual({ width: 4, height: 1 });
    expect(orientedFootprint(fence, 1)).toEqual({ width: 1, height: 4 });
    expect(footprintTiles(fence, origin, 1)).toHaveLength(4);
    const center = placedCenter(origin, 0, fence);
    expect(placedOrigin({ x: center.x, z: center.z }, 0, fence)).toEqual(origin);
  });

  it('reserves the whole merchant camp while leaving open camp ground physically walkable', () => {
    const reservations = fixtureTiles();
    const obstacles = fixtureObstacleTiles();

    expect(reservations.has(tileKey(120, 120))).toBe(true);
    expect(obstacles.has(tileKey(120, 120))).toBe(false);
    expect(obstacles.has(tileKey(117, 118))).toBe(true);
  });

  it('accepts clear grass and identifies each player-visible placement rejection reason', () => {
    const fence = assetDefinition('fence')!;
    const well = assetDefinition('well')!;
    const grass = createEmptyGrid();
    const base = { asset: fence, rotation: 0, tiles: grass, placed: [] as { id: string; x: number; z: number; rotation: number }[] };

    expect(placementStatus({ ...base, origin: { tx: 20, ty: 20 } })).toMatchObject({ valid: true, reason: 'Ready to place' });
    expect(placementStatus({ ...base, origin: { tx: -1, ty: 20 } }).reason).toContain('leave the map');
    expect(placementStatus({ ...base, origin: { tx: 120, ty: 120 } }).reason).toContain('encampment');

    grass[20]![20]!.state = 'tilled';
    expect(placementStatus({ ...base, origin: { tx: 20, ty: 20 } }).reason).toContain('clear grass');
    grass[20]![20]!.state = 'grass';
    expect(
      placementStatus({ ...base, origin: { tx: 20, ty: 20 }, playerTile: { tx: 20, ty: 20 } }).reason,
    ).toContain('Move off');
    expect(
      placementStatus({ ...base, asset: well, origin: { tx: 20, ty: 20 }, terrainAllowed: () => false }).reason,
    ).toContain('suitable');
  });

  it('preserves functional silo and water-tower footprints as physical placement obstacles', () => {
    const grass = createEmptyGrid();
    for (const id of ['silo', 'water_tower'] as const) {
      const asset = assetDefinition(id)!;
      expect(asset).toMatchObject({ blocksMovement: true, blocksEnclosure: true, useType: 'place' });
      expect(footprintTiles(asset, { tx: 20, ty: 20 }, 0)).toHaveLength(9);
      expect(
        placementStatus({ asset, origin: { tx: 20, ty: 20 }, rotation: 0, tiles: grass, placed: [] }).valid,
      ).toBe(true);
    }
  });

  it('rejects overlapping placed assets and preserves the overlap contract after a building is demolished', () => {
    const well = assetDefinition('well')!;
    const grass = createEmptyGrid();
    const placed = [{ id: 'well', x: 20.5, z: 20.5, rotation: 0 }];

    const occupied = occupiedPlacedTiles(placed);
    expect(occupied.has(tileKey(20, 20))).toBe(true);
    expect(
      placementStatus({ asset: well, origin: { tx: 20, ty: 20 }, rotation: 0, tiles: grass, placed }).reason,
    ).toContain('overlaps');
    expect(
      placementStatus({ asset: well, origin: { tx: 20, ty: 20 }, rotation: 0, tiles: grass, placed: [] }).valid,
    ).toBe(true);
  });

  it('treats a closed gate as an obstacle and an open gate as a walkable hole', () => {
    const closed = occupiedPlacedTiles([{ id: 'gate', x: 60.5, z: 60.5, rotation: 0, gateOpen: false }]);
    const open = occupiedPlacedTiles([{ id: 'gate', x: 60.5, z: 60.5, rotation: 0, gateOpen: true }]);

    expect(closed.has(tileKey(60, 60))).toBe(true);
    expect(open.has(tileKey(60, 60))).toBe(false);
  });

  it('marks the inside of a closed eight-neighbor fence as enclosed and an open gate as exposed', () => {
    const boundary = new Set<string>();
    for (let x = 1; x <= 5; x++) {
      boundary.add(tileKey(x, 1));
      boundary.add(tileKey(x, 5));
    }
    for (let y = 2; y < 5; y++) {
      boundary.add(tileKey(1, y));
      boundary.add(tileKey(5, y));
    }

    const closed = calculateEnclosedTiles(boundary, 7, 7);
    expect(tileIsEnclosed(closed, 3, 3, 7)).toBe(true);
    expect(tileIsEnclosed(closed, 0, 0, 7)).toBe(false);
    expect(tileIsEnclosed(closed, 1, 1, 7)).toBe(false);

    boundary.delete(tileKey(3, 1));
    const open = calculateEnclosedTiles(boundary, 7, 7);
    expect(tileIsEnclosed(open, 3, 3, 7)).toBe(false);
  });

  it('uses the same no-corner-cutting rule for enclosure flood fill and actor navigation', () => {
    const blocked = new Set<string>();
    for (let x = 1; x <= 5; x++) {
      blocked.add(tileKey(x, 1));
      blocked.add(tileKey(x, 5));
    }
    for (let y = 2; y < 5; y++) {
      blocked.add(tileKey(1, y));
      blocked.add(tileKey(5, y));
    }
    blocked.delete(tileKey(1, 1));

    expect(canTraverseGridStep(1, 1, 2, 2, blocked, 7, 7)).toBe(false);
    const enclosed = calculateEnclosedTiles(blocked, 7, 7);
    expect(tileIsEnclosed(enclosed, 3, 3, 7)).toBe(true);
  });
});
