import { SEED_PACKET_SLOTS } from './seedInventory';
import type { PlacedBuilding } from './save';

/** Additional distinct seed genotypes a placed silo can hold. */
export const SILO_SEED_PACKET_BONUS = 8;

/** Player distance at which a placed water tower supplies bucket water. */
export const WATER_TOWER_RANGE = 6;

export function countPlacedBuilding(
  placedBuildings: readonly Pick<PlacedBuilding, 'id'>[],
  id: string,
): number {
  return placedBuildings.reduce((count, building) => count + (building.id === id ? 1 : 0), 0);
}

/** Seed capacity is derived from saved placed buildings, not a second save field. */
export function seedPacketCapacity(
  placedBuildings: readonly Pick<PlacedBuilding, 'id'>[],
): number {
  return SEED_PACKET_SLOTS + countPlacedBuilding(placedBuildings, 'silo') * SILO_SEED_PACKET_BONUS;
}

/** Distance to the nearest placed water tower, or Infinity when none exists. */
export function waterTowerDistance(
  placedBuildings: readonly Pick<PlacedBuilding, 'id' | 'x' | 'z'>[],
  x: number,
  z: number,
): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const building of placedBuildings) {
    if (building.id !== 'water_tower') continue;
    nearest = Math.min(nearest, Math.hypot(x - building.x, z - building.z));
  }
  return nearest;
}

export function waterTowerProvidesWater(
  placedBuildings: readonly Pick<PlacedBuilding, 'id' | 'x' | 'z'>[],
  x: number,
  z: number,
): boolean {
  return waterTowerDistance(placedBuildings, x, z) <= WATER_TOWER_RANGE;
}
