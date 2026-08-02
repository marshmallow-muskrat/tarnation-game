import { describe, expect, it } from 'vitest';
import {
  seedPacketCapacity,
  SILO_SEED_PACKET_BONUS,
  waterTowerDistance,
  waterTowerProvidesWater,
  WATER_TOWER_RANGE,
} from '../src/sim/buildings';
import { SEED_PACKET_SLOTS } from '../src/sim/seedInventory';
import { createEmptyGrid, digTrench, flowTrenchWater, trenchSourceTiles } from '../src/sim/farm';

describe('functional building effects', () => {
  it('adds eight distinct seed-packet slots per placed silo without changing the saved state shape', () => {
    const noBuildings: { id: string }[] = [];
    const oneSilo = [{ id: 'silo' }];
    const twoSilos = [{ id: 'silo' }, { id: 'silo' }];

    expect(seedPacketCapacity(noBuildings)).toBe(SEED_PACKET_SLOTS);
    expect(seedPacketCapacity(oneSilo)).toBe(SEED_PACKET_SLOTS + SILO_SEED_PACKET_BONUS);
    expect(seedPacketCapacity(twoSilos)).toBe(SEED_PACKET_SLOTS + SILO_SEED_PACKET_BONUS * 2);
  });

  it('makes a placed water tower a local bucket and trench source only inside its six-tile radius', () => {
    const tower = [{ id: 'water_tower', x: 40, z: 40 }];

    expect(waterTowerDistance(tower, 40, 40)).toBe(0);
    expect(waterTowerProvidesWater(tower, 40 + WATER_TOWER_RANGE, 40)).toBe(true);
    expect(waterTowerProvidesWater(tower, 40 + WATER_TOWER_RANGE + 0.01, 40)).toBe(false);
    expect(waterTowerProvidesWater([], 40, 40)).toBe(false);

    const tiles = createEmptyGrid();
    expect(digTrench(tiles, 43, 40)).toBe(true);
    const sources = trenchSourceTiles(
      tiles,
      (x, z) => (waterTowerProvidesWater(tower, x, z) ? 0 : Number.POSITIVE_INFINITY),
    );
    expect(sources).toEqual([{ x: 43, y: 40 }]);
    flowTrenchWater(tiles, () => 0, sources);
    expect(tiles[40]![43]!.watered).toBe(true);
  });
});
