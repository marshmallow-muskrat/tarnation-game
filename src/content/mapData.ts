import type { AssetId } from './purchasables';

export const CENTRAL_CAMP = {
  minX: 114,
  minZ: 114,
  width: 14,
  height: 12,
  merchantX: 121.5,
  merchantZ: 111.5,
} as const;

export type FixedFixture = {
  id: AssetId;
  tx: number;
  ty: number;
  rotation: number;
};

/** Fixed map data; these objects are never purchased, spawned, or demolished. */
export const CENTRAL_CAMP_FIXTURES: readonly FixedFixture[] = [
  { id: 'fixture:caravan', tx: 117, ty: 118, rotation: 0 },
  { id: 'fixture:crate', tx: 115, ty: 116, rotation: 1 },
  { id: 'fixture:crate', tx: 125, ty: 118, rotation: 3 },
  { id: 'fixture:barrel', tx: 116, ty: 123, rotation: 0 },
  { id: 'fixture:barrel', tx: 126, ty: 123, rotation: 2 },
  { id: 'fixture:haystack', tx: 118, ty: 124, rotation: 1 },
  { id: 'fixture:coin-sack', tx: 124, ty: 124, rotation: 0 },
];

export function isCampTile(tx: number, ty: number): boolean {
  return (
    tx >= CENTRAL_CAMP.minX &&
    tx < CENTRAL_CAMP.minX + CENTRAL_CAMP.width &&
    ty >= CENTRAL_CAMP.minZ &&
    ty < CENTRAL_CAMP.minZ + CENTRAL_CAMP.height
  );
}

