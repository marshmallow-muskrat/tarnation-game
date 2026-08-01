import { GRID_H, GRID_W } from '../content';
import { CENTRAL_CAMP_FIXTURES, isCampTile, type FixedFixture } from '../content/mapData';
import {
  assetDefinition,
  type AssetId,
  type PurchasableAsset,
} from '../content/purchasables';
import type { Tile } from './farm';
import type { PlacedBuilding } from './save';

export type GridTile = { tx: number; ty: number };

export type PlacementStatus = {
  valid: boolean;
  reason: string;
  tiles: GridTile[];
};

export function tileKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function normalizeOrientation(rotation: number): number {
  if (!Number.isFinite(rotation)) return 0;
  // New saves store quarter-turns. Older saves stored arbitrary radians.
  const candidate = Number.isInteger(rotation) && rotation >= 0 && rotation <= 3
    ? rotation
    : Math.round(rotation / (Math.PI / 2));
  return ((candidate % 4) + 4) % 4;
}

export function orientedFootprint(
  asset: PurchasableAsset,
  rotation: number,
): { width: number; height: number } {
  const orientation = normalizeOrientation(rotation);
  return orientation % 2 === 0
    ? { ...asset.footprint }
    : { width: asset.footprint.height, height: asset.footprint.width };
}

export function footprintTiles(
  asset: PurchasableAsset,
  origin: GridTile,
  rotation: number,
): GridTile[] {
  const size = orientedFootprint(asset, rotation);
  const tiles: GridTile[] = [];
  for (let ty = origin.ty; ty < origin.ty + size.height; ty++) {
    for (let tx = origin.tx; tx < origin.tx + size.width; tx++) tiles.push({ tx, ty });
  }
  return tiles;
}

export function placedOrigin(placed: Pick<PlacedBuilding, 'x' | 'z'>, rotation: number, asset: PurchasableAsset): GridTile {
  const size = orientedFootprint(asset, rotation);
  return {
    tx: Math.floor(placed.x - size.width / 2),
    ty: Math.floor(placed.z - size.height / 2),
  };
}

export function placedCenter(origin: GridTile, rotation: number, asset: PurchasableAsset): { x: number; z: number } {
  const size = orientedFootprint(asset, rotation);
  return {
    x: origin.tx + size.width / 2,
    z: origin.ty + size.height / 2,
  };
}

/** Physical fixture footprints. Unlike fixtureTiles(), this does not reserve the
 * empty ground between props and is therefore safe for actor collision/pathing. */
export function fixtureObstacleTiles(
  fixtures: readonly FixedFixture[] = CENTRAL_CAMP_FIXTURES,
): Set<string> {
  const out = new Set<string>();
  for (const fixture of fixtures) {
    const asset = assetDefinition(fixture.id);
    if (!asset?.blocksMovement) continue;
    for (const tile of footprintTiles(asset, { tx: fixture.tx, ty: fixture.ty }, fixture.rotation)) {
      out.add(tileKey(tile.tx, tile.ty));
    }
  }
  return out;
}

/** Land reserved against tilling and player construction. */
export function fixtureTiles(fixtures: readonly FixedFixture[] = CENTRAL_CAMP_FIXTURES): Set<string> {
  const out = fixtureObstacleTiles(fixtures);
  // The whole camp reservation is intentionally larger than the visible props:
  // it keeps players from planting between fixtures and preserves the approach.
  for (let ty = 0; ty < GRID_H; ty++) {
    for (let tx = 0; tx < GRID_W; tx++) {
      if (isCampTile(tx, ty)) out.add(tileKey(tx, ty));
    }
  }
  return out;
}

export function occupiedPlacedTiles(placed: readonly PlacedBuilding[]): Set<string> {
  const out = new Set<string>();
  for (const building of placed) {
    const asset = assetDefinition(building.id as AssetId);
    if (!asset || !asset.blocksMovement || (asset.gate && building.gateOpen)) continue;
    const origin = placedOrigin(building, building.rotation, asset);
    for (const tile of footprintTiles(asset, origin, building.rotation)) {
      out.add(tileKey(tile.tx, tile.ty));
    }
  }
  return out;
}

export function placementStatus(args: {
  asset: PurchasableAsset;
  origin: GridTile;
  rotation: number;
  tiles: Tile[][];
  placed: readonly PlacedBuilding[];
  fixtures?: Set<string>;
  playerTile?: GridTile | null;
  terrainAllowed?: (tx: number, ty: number) => boolean;
}): PlacementStatus {
  const footprint = footprintTiles(args.asset, args.origin, args.rotation);
  const occupied = occupiedPlacedTiles(args.placed);
  const fixtures = args.fixtures ?? fixtureTiles();

  for (const tile of footprint) {
    if (tile.tx < 0 || tile.ty < 0 || tile.tx >= GRID_W || tile.ty >= GRID_H) {
      return { valid: false, reason: 'That footprint would leave the map', tiles: footprint };
    }
    const key = tileKey(tile.tx, tile.ty);
    if (occupied.has(key)) return { valid: false, reason: 'That footprint overlaps another asset', tiles: footprint };
    if (fixtures.has(key)) return { valid: false, reason: 'That ground is reserved for the encampment', tiles: footprint };
    if (args.playerTile && args.playerTile.tx === tile.tx && args.playerTile.ty === tile.ty) {
      return { valid: false, reason: 'Move off the footprint before placing', tiles: footprint };
    }
    const terrain = args.tiles[tile.ty]?.[tile.tx];
    if (!terrain || terrain.state !== 'grass') return { valid: false, reason: 'Place on clear grass', tiles: footprint };
    if (args.terrainAllowed && !args.terrainAllowed(tile.tx, tile.ty)) {
      return { valid: false, reason: 'That terrain is not suitable for this asset', tiles: footprint };
    }
  }
  return { valid: true, reason: 'Ready to place', tiles: footprint };
}

/**
 * Compute enclosed tiles by flooding from all four map edges with 8-directional
 * movement. The same direction set is exported for animal navigation.
 */
export const GRID_DIRECTIONS_8 = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
] as const;

export function calculateEnclosedTiles(
  blocked: ReadonlySet<string>,
  width = GRID_W,
  height = GRID_H,
): Uint8Array {
  const reachable = new Uint8Array(width * height);
  const queue: GridTile[] = [];
  const enqueue = (tx: number, ty: number): void => {
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) return;
    const index = ty * width + tx;
    if (reachable[index] || blocked.has(tileKey(tx, ty))) return;
    reachable[index] = 1;
    queue.push({ tx, ty });
  };
  for (let tx = 0; tx < width; tx++) {
    enqueue(tx, 0);
    enqueue(tx, height - 1);
  }
  for (let ty = 1; ty < height - 1; ty++) {
    enqueue(0, ty);
    enqueue(width - 1, ty);
  }
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!;
    for (const [dx, dy] of GRID_DIRECTIONS_8) enqueue(current.tx + dx, current.ty + dy);
  }

  const enclosed = new Uint8Array(width * height);
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const index = ty * width + tx;
      if (!reachable[index] && !blocked.has(tileKey(tx, ty))) enclosed[index] = 1;
    }
  }
  return enclosed;
}

export function tileIsEnclosed(enclosed: Uint8Array, tx: number, ty: number, width = GRID_W): boolean {
  if (tx < 0 || ty < 0 || tx >= width || ty >= Math.ceil(enclosed.length / width)) return false;
  return enclosed[ty * width + tx] === 1;
}
