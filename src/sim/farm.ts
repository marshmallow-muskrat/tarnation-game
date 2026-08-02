import {
  CROP_DEFS,
  CROP_STAGES,
  GRID_H,
  GRID_W,
  TILL_DECAY_DAYS,
  type BaseCropId,
} from '../content';
import type { HybridMech, Seed } from './genetics';
import {
  cropYieldForSeed,
  growthDurationForSeed,
  makeSeed,
  nibbleDamageForSeed,
  PORTABLE_LIGHT_RADIUS,
  raidAttractionForSeed,
  REPEL_FOX_RADIUS,
  RICOCHET_RADIUS,
} from './genetics';

export type TileState = 'grass' | 'tilled' | 'planted' | 'mature' | 'trench' | 'breeding';

export interface Tile {
  state: TileState;
  plantedAt: number;
  watered: boolean;
  stage: number;
  growth: number;
  /** Crop seed currently planted (if any) */
  seed: Seed | null;
  /** Breeding bed has two parent slots filled when breeding */
  breedA: Seed | null;
  breedB: Seed | null;
  /** Fence / trench damage for sappers */
  structureHp: number;
  /** Bear trap placed from the Q slot. */
  bearTrap: boolean;
  /** The bear trap has fired and should render its closed model. */
  bearTrapClosed: boolean;
  /** Day the tile was turned over. Unplanted soil goes back to grass. */
  tilledDay: number;
}

export function emptyTile(): Tile {
  return {
    state: 'grass',
    plantedAt: -1,
    watered: false,
    stage: 0,
    growth: 0,
    seed: null,
    breedA: null,
    breedB: null,
    structureHp: 0,
    bearTrap: false,
    bearTrapClosed: false,
    tilledDay: -1,
  };
}

export function createEmptyGrid(): Tile[][] {
  const tiles: Tile[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    const row: Tile[] = [];
    for (let x = 0; x < GRID_W; x++) {
      row.push(emptyTile());
    }
    tiles.push(row);
  }
  return tiles;
}

export function cloneGrid(tiles: Tile[][]): Tile[][] {
  return tiles.map((row) =>
    row.map((t) => ({
      ...t,
      seed: t.seed ? { ...t.seed, traits: { ...t.seed.traits }, lineage: t.seed.lineage ? [...t.seed.lineage] : undefined } : null,
      breedA: t.breedA ? { ...t.breedA, traits: { ...t.breedA.traits } } : null,
      breedB: t.breedB ? { ...t.breedB, traits: { ...t.breedB.traits } } : null,
    })),
  );
}

export function getTile(tiles: Tile[][], tx: number, ty: number): Tile | null {
  if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return null;
  return tiles[ty]![tx]!;
}

export function tillTile(tiles: Tile[][], tx: number, ty: number, day = 1): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t || (t.state !== 'grass' && t.state !== 'trench')) return false;
  if (t.state === 'trench') return false;
  t.state = 'tilled';
  t.watered = false;
  t.stage = 0;
  t.growth = 0;
  t.plantedAt = -1;
  t.seed = null;
  t.tilledDay = day;
  return true;
}

/**
 * Bare soil left unplanted goes back to grass. Called at dawn, so a tile tilled
 * on day N is gone on the morning of day N+1+TILL_DECAY_DAYS at the latest —
 * turn the ground over on the day you mean to sow it.
 */
export function decayUnplantedTilth(tiles: Tile[][], day: number): { x: number; y: number }[] {
  const lost: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const t = tiles[y]![x]!;
      if (t.state !== 'tilled') continue;
      if (t.tilledDay < 0) {
        // Pre-existing soil from an older save — start its clock now.
        t.tilledDay = day;
        continue;
      }
      if (day - t.tilledDay < TILL_DECAY_DAYS + 1) continue;
      tiles[y]![x] = emptyTile();
      lost.push({ x, y });
    }
  }
  return lost;
}

export function digTrench(tiles: Tile[][], tx: number, ty: number): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t || t.state === 'planted' || t.state === 'mature' || t.state === 'breeding') return false;
  t.state = 'trench';
  t.structureHp = 3;
  t.seed = null;
  t.watered = false;
  return true;
}

export function makeBreedingBed(tiles: Tile[][], tx: number, ty: number): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t || t.state !== 'tilled') return false;
  t.state = 'breeding';
  t.breedA = null;
  t.breedB = null;
  return true;
}

export function plantTile(
  tiles: Tile[][],
  tx: number,
  ty: number,
  seed: Seed,
): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t) return false;
  if (t.state === 'breeding') {
    if (!t.breedA) {
      t.breedA = seed;
      return true;
    }
    if (!t.breedB) {
      t.breedB = seed;
      return true;
    }
    return false;
  }
  if (t.state !== 'tilled') return false;
  t.state = 'planted';
  t.watered = false;
  t.stage = 0;
  t.growth = 0;
  t.plantedAt = -1;
  t.seed = seed;
  return true;
}

/** Read-only planting predicate used by transactional seed consumption. */
export function canPlantTile(tiles: Tile[][], tx: number, ty: number): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t) return false;
  if (t.state === 'breeding') return !t.breedA || !t.breedB;
  return t.state === 'tilled';
}

export function waterTile(tiles: Tile[][], tx: number, ty: number, simTime: number): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t || t.state !== 'planted' || t.watered) return false;
  t.watered = true;
  t.plantedAt = simTime;
  t.growth = 0;
  return true;
}

/** Locate trench tiles that touch the authored open-water boundary. */
export function trenchSourceTiles(
  tiles: Tile[][],
  distToWater: (x: number, z: number) => number,
  maxDistance = 0.8,
): { x: number; y: number }[] {
  const sources: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (tiles[y]![x]!.state !== 'trench') continue;
      if (distToWater(x + 0.5, y + 0.5) <= maxDistance) sources.push({ x, y });
    }
  }
  return sources;
}

/** Flow water along trenches downhill using height samples. */
export function flowTrenchWater(
  tiles: Tile[][],
  heightAt: (x: number, z: number) => number,
  sourceTiles: { x: number; y: number }[],
): number {
  // Recompute the wet/dry state from source connectivity so a destroyed or
  // disconnected trench cannot leave an old blue state behind.
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (tiles[y]![x]!.state === 'trench') tiles[y]![x]!.watered = false;
    }
  }

  // BFS from water-touching trenches / sources; water planted tiles adjacent downhill.
  let watered = 0;
  const queue: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  for (const source of sourceTiles) {
    const tile = getTile(tiles, source.x, source.y);
    if (!tile || tile.state !== 'trench') continue;
    const key = `${source.x},${source.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tile.watered = true;
    queue.push(source);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      const t = getTile(tiles, nx, ny);
      if (!t) continue;
      const h0 = heightAt(cur.x + 0.5, cur.y + 0.5);
      const h1 = heightAt(nx + 0.5, ny + 0.5);
      if (h1 > h0 + 0.05) continue; // only downhill / flat
      seen.add(key);
      if (t.state === 'trench') {
        t.watered = true;
        queue.push({ x: nx, y: ny });
      } else if (t.state === 'planted' && !t.watered) {
        t.watered = true;
        t.plantedAt = 0;
        t.growth = Math.max(t.growth, 0);
        watered++;
      }
    }
  }
  return watered;
}

export interface HarvestResult {
  ok: boolean;
  seed: Seed | null;
  count: number;
  hybridChild: Seed | null;
}

export function harvestTile(tiles: Tile[][], tx: number, ty: number): HarvestResult {
  const t = getTile(tiles, tx, ty);
  if (!t) return { ok: false, seed: null, count: 0, hybridChild: null };

  if (t.state === 'breeding' && t.breedA && t.breedB) {
    // Harvesting a full breeding bed yields hybrid when "ready" — treat as mature when both set
    const child = null; // crossbreed done by caller with rng
    t.breedA = null;
    t.breedB = null;
    t.state = 'tilled';
    return { ok: true, seed: null, count: 0, hybridChild: child };
  }

  if (t.state !== 'mature' || !t.seed) return { ok: false, seed: null, count: 0, hybridChild: null };

  const yieldN = cropYieldForSeed(t.seed);
  const seed = t.seed;
  t.state = 'tilled';
  t.watered = false;
  t.stage = 0;
  t.growth = 0;
  t.plantedAt = -1;
  t.seed = null;
  return { ok: true, seed, count: yieldN, hybridChild: null };
}

export function clearBreedingParents(tiles: Tile[][], tx: number, ty: number): { a: Seed; b: Seed } | null {
  const t = getTile(tiles, tx, ty);
  if (!t || t.state !== 'breeding' || !t.breedA || !t.breedB) return null;
  const a = t.breedA;
  const b = t.breedB;
  t.breedA = null;
  t.breedB = null;
  return { a, b };
}

/** Destroy crop (fox ate it) → tilled. Ironroot resists. */
export function destroyCrop(tiles: Tile[][], tx: number, ty: number): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t || (t.state !== 'planted' && t.state !== 'mature')) return false;
  if (t.seed?.mech === 'ironroot' && t.state === 'mature') return false;
  t.state = 'tilled';
  t.watered = false;
  t.stage = 0;
  t.growth = 0;
  t.plantedAt = -1;
  t.seed = null;
  return true;
}

/** Nibbler takes one bite — reduces growth or destroys if young. */
export function nibbleCrop(tiles: Tile[][], tx: number, ty: number): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t || !isCropTile(t) || !t.seed) return false;
  if (t.seed.mech === 'ironroot') return false;
  if (t.state === 'mature') {
    t.state = 'planted';
    t.growth = Math.max(0, 1 - nibbleDamageForSeed(t.seed!, 0.5));
    t.stage = Math.min(CROP_STAGES - 1, Math.floor(t.growth * CROP_STAGES));
    t.watered = true;
    return true;
  }
  t.growth = Math.max(0, t.growth - nibbleDamageForSeed(t.seed!, 0.35));
  if (t.growth <= 0.05) return destroyCrop(tiles, tx, ty);
  return true;
}

export function isCropTile(t: Tile): boolean {
  return t.state === 'planted' || t.state === 'mature';
}

export function stepCrops(tiles: Tile[][], dt: number): { x: number; y: number }[] {
  const matured: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const t = tiles[y]![x]!;
      if (t.state !== 'planted' || !t.watered || !t.seed) continue;
      const cropDef = CROP_DEFS[t.seed.species];
      const base = cropDef?.grow ?? 100;
      const baseWaterNeed = cropDef?.waterNeed ?? 0.5;
      const grow = growthDurationForSeed(t.seed, base, baseWaterNeed);
      t.growth = Math.min(1, t.growth + dt / grow);
      const newStage = Math.min(CROP_STAGES - 1, Math.floor(t.growth * CROP_STAGES));
      if (t.growth >= 1) {
        t.state = 'mature';
        t.stage = CROP_STAGES - 1;
        matured.push({ x, y });
      } else {
        t.stage = newStage;
      }
    }
  }
  return matured;
}

export function findCropTiles(tiles: Tile[][]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const t = tiles[y]![x]!;
      if (isCropTile(t)) out.push({ x, y });
    }
  }
  return out;
}

export function totalWeirdness(tiles: Tile[][]): number {
  let w = 0;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const t = tiles[y]![x]!;
      if (isCropTile(t) && t.seed) w += t.seed.traits.weirdness;
    }
  }
  return w;
}

export function cropValueScore(tiles: Tile[][]): number {
  let v = 0;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const t = tiles[y]![x]!;
      if (isCropTile(t) && t.seed) {
        v += 1 + t.seed.traits.yield / 50 + raidAttractionForSeed(t.seed);
      }
    }
  }
  return v;
}

function hasActiveMechanismNearby(
  tiles: Tile[][],
  tx: number,
  ty: number,
  mech: HybridMech,
  radius: number,
): boolean {
  const boundedRadius = Math.max(0, radius);
  const r = Math.ceil(boundedRadius);
  for (let y = ty - r; y <= ty + r; y++) {
    for (let x = tx - r; x <= tx + r; x++) {
      const t = getTile(tiles, x, y);
      if (t?.seed?.mech === mech && isCropTile(t)) {
        if (Math.hypot(x - tx, y - ty) <= boundedRadius) return true;
      }
    }
  }
  return false;
}

/** Nearby repel_foxes hybrid, capped at the authored local radius. */
export function hasRepelNearby(
  tiles: Tile[][],
  tx: number,
  ty: number,
  radius = REPEL_FOX_RADIUS,
): boolean {
  return hasActiveMechanismNearby(
    tiles,
    tx,
    ty,
    'repel_foxes',
    Math.min(Math.max(0, radius), REPEL_FOX_RADIUS),
  );
}

/** A live ricochet crop arms at most one bounce for nearby fired projectiles. */
export function hasRicochetNearby(
  tiles: Tile[][],
  tx: number,
  ty: number,
  radius = RICOCHET_RADIUS,
): boolean {
  return hasActiveMechanismNearby(
    tiles,
    tx,
    ty,
    'ricochet',
    Math.min(Math.max(0, radius), RICOCHET_RADIUS),
  );
}

/** A live portable-light crop provides local night light without moving the crop. */
export function hasPortableLightNearby(
  tiles: Tile[][],
  tx: number,
  ty: number,
  radius = PORTABLE_LIGHT_RADIUS,
): boolean {
  return hasActiveMechanismNearby(
    tiles,
    tx,
    ty,
    'portable_light',
    Math.min(Math.max(0, radius), PORTABLE_LIGHT_RADIUS),
  );
}

export function placeBearTrap(tiles: Tile[][], tx: number, ty: number): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t || t.state === 'planted' || t.state === 'mature' || t.bearTrap || t.bearTrapClosed) {
    return false;
  }
  t.bearTrap = true;
  t.bearTrapClosed = false;
  return true;
}

export function triggerBearTrap(tiles: Tile[][], tx: number, ty: number): boolean {
  const t = getTile(tiles, tx, ty);
  if (!t?.bearTrap || t.bearTrapClosed) return false;
  t.bearTrap = false;
  t.bearTrapClosed = true;
  return true;
}

export function worldToTile(wx: number, wy: number, tileSize: number): { tx: number; ty: number } {
  return {
    tx: Math.floor(wx / tileSize),
    ty: Math.floor(wy / tileSize),
  };
}

export function tileCenter(tx: number, ty: number, tileSize: number): { x: number; y: number } {
  return {
    x: tx * tileSize + tileSize / 2,
    y: ty * tileSize + tileSize / 2,
  };
}

export function defaultSeed(species: BaseCropId = 'beet'): Seed {
  return makeSeed(species);
}

export type { HybridMech };
