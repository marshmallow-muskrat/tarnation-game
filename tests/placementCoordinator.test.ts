import { describe, expect, it } from 'vitest';
import { createEmptyGrid } from '../src/sim/farm';
import { fixtureTiles, type GridTile } from '../src/sim/placement';
import { PlacementCoordinator, type PlacementContext } from '../src/game/PlacementCoordinator';

type PlacementFixture = {
  pointer: GridTile | null;
  playerX: number;
  playerZ: number;
  heading: number;
  playerTile: GridTile | null;
  fixtures: ReadonlySet<string>;
  wood: number;
  terrainAllowed: boolean;
};

type PlacementState = {
  tiles: ReturnType<typeof createEmptyGrid>;
  placedBuildings: { id: string; x: number; z: number; rotation: number }[];
};

function makePlacementFixture(): {
  coordinator: PlacementCoordinator;
  values: PlacementFixture;
  state: PlacementState;
} {
  const values: PlacementFixture = {
    pointer: { tx: 30, ty: 30 },
    playerX: 30.5,
    playerZ: 30.5,
    heading: 0,
    playerTile: null,
    fixtures: new Set<string>(),
    wood: 10,
    terrainAllowed: true,
  };
  const state: PlacementState = {
    tiles: createEmptyGrid(),
    placedBuildings: [] as { id: string; x: number; z: number; rotation: number }[],
  };
  const context: PlacementContext = {
    pointerTile: () => values.pointer,
    playerX: () => values.playerX,
    playerZ: () => values.playerZ,
    heading: () => values.heading,
    playerTile: () => values.playerTile,
    gameState: () => state,
    fixtureReservations: () => values.fixtures,
    terrainAllowed: () => values.terrainAllowed,
    woodCount: () => values.wood,
    homesteadX: () => 100,
    homesteadZ: () => 100,
  };
  return { coordinator: new PlacementCoordinator(context), values, state };
}

describe('placement coordinator', () => {
  it('previews the selected catalog building with the player heading as its orientation', () => {
    const { coordinator, values } = makePlacementFixture();
    values.heading = Math.PI / 2;

    expect(coordinator.select(1)).toBe(true);
    expect(coordinator.selectedAsset()?.id).toBe('fence2');
    expect(coordinator.status()).toMatchObject({
      valid: true,
      reason: 'Ready to place',
      rotation: 1,
    });
  });

  it('uses explicit deed rotation and retains the last quarter-turn after cancelling the deed preview', () => {
    const { coordinator } = makePlacementFixture();

    expect(coordinator.begin('fence')).toBe(true);
    coordinator.rotate();
    coordinator.rotate();
    expect(coordinator.status()).toMatchObject({ valid: true, rotation: 2 });

    coordinator.clear();
    expect(coordinator.activeDeedAssetId).toBeNull();
    expect(coordinator.currentRotation).toBe(2);
    expect(coordinator.begin('tool:shotgun')).toBe(false);
  });

  it('reports player-visible distance, reservation, terrain, and player-footprint rejection reasons', () => {
    const { coordinator, values } = makePlacementFixture();

    values.playerX = 0;
    values.playerZ = 0;
    expect(coordinator.status().reason).toBe('Move closer to place');

    values.playerX = 120.5;
    values.playerZ = 120.5;
    values.pointer = { tx: 120, ty: 120 };
    values.fixtures = fixtureTiles();
    expect(coordinator.status().reason).toBe('That ground is reserved for the encampment');

    values.pointer = { tx: 30, ty: 30 };
    values.playerX = 30.5;
    values.playerZ = 30.5;
    values.fixtures = new Set();
    values.playerTile = { tx: 30, ty: 30 };
    expect(coordinator.status().reason).toBe('Move off the footprint before placing');

    values.playerTile = null;
    values.terrainAllowed = false;
    expect(coordinator.status().reason).toBe('That terrain is not suitable for this asset');
  });

  it('rejects occupied footprints while preserving the clear-ground placement contract', () => {
    const { coordinator, state } = makePlacementFixture();
    expect(coordinator.status().valid).toBe(true);

    state.placedBuildings.push({ id: 'well', x: 30.5, z: 30.5, rotation: 0 });
    expect(coordinator.status().reason).toBe('That footprint overlaps another asset');
  });

  it('requires wood for legacy construction but treats a purchased deed as the payment authority', () => {
    const { coordinator, values } = makePlacementFixture();
    values.wood = 0;
    expect(coordinator.status().reason).toBe('Need 1 Wood for Fence Section');

    expect(coordinator.begin('fence')).toBe(true);
    expect(coordinator.status()).toMatchObject({ valid: true, reason: 'Ready to place' });
  });
});
