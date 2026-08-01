import * as THREE from 'three';
import {
  CHUNK_SIZE,
  GRID_H,
  GRID_W,
  GROVE_CELL,
  GROVE_DENSE,
  GROVE_SPARSE,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SIZE,
  ROCK_TILE_FRACTION,
  TREE_CHUNK_RADIUS,
} from '../content';
import { instancedParts } from './Assets';
import { standardMaterial } from './materials';
import { hash2, smoothstep, valueNoise2D } from './noise';
import { TERRAIN_SEED } from './terrain';

const TREE_SEED = TERRAIN_SEED ^ 0x7a3e;
const ROCK_SEED = TERRAIN_SEED ^ 0x2b91;

/** Where GameRuntime puts the market stall and drops the player in. */
const STALL_X = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2 + 6;
const STALL_Z = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE - 8;
const SPAWN_X = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2;
const SPAWN_Z = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE / 2;

export interface FarmTreeHooks {
  heightAt: (x: number, z: number) => number;
  distToWater: (x: number, z: number) => number;
  /** Felled and waiting on its respawn timer. */
  isChopped: (tx: number, ty: number) => boolean;
  /** The stump left behind has been cleared away. */
  isStumpCleared: (tx: number, ty: number) => boolean;
  /** Tile is worked ground (tilled, planted, trench…) — nothing stands there. */
  tileBlocked: (tx: number, ty: number) => boolean;
}

type Chunk = { key: string; group: THREE.Group };

/**
 * Overworld trees and boulders.
 *
 * Placement is a per-tile hash biased by a low-frequency grove field, so woodland
 * clumps into copses with open ground between them rather than dusting the whole
 * map evenly. Only *felled* trees cost memory — those live in the save.
 */
export class FarmTrees {
  private readonly root = new THREE.Group();
  private readonly live = new Map<string, Chunk>();
  private lastCx = Number.NaN;
  private lastCz = Number.NaN;
  private hooks: FarmTreeHooks;

  private readonly geoTrunk = new THREE.CylinderGeometry(0.13, 0.2, 1.25, 6);
  private readonly geoCanopy = new THREE.ConeGeometry(0.7, 1.3, 7);
  private readonly geoStump = new THREE.CylinderGeometry(0.2, 0.24, 0.24, 6);
  private readonly geoBoulder = new THREE.DodecahedronGeometry(0.55, 0);

  private readonly matTrunk = standardMaterial(0x5a3a22, { flatShading: true, roughness: 0.92 });
  private readonly matCanopy = standardMaterial(0x3d6b35, { flatShading: true, roughness: 0.88 });
  private readonly matStump = standardMaterial(0x7a5a38, { flatShading: true, roughness: 0.95 });
  private readonly matBoulder = standardMaterial(0x5a5a4e, { flatShading: true, roughness: 0.9 });

  private readonly _m = new THREE.Matrix4();
  private readonly _p = new THREE.Vector3();
  private readonly _q = new THREE.Quaternion();
  private readonly _s = new THREE.Vector3();
  private readonly _e = new THREE.Euler();

  constructor(hooks: FarmTreeHooks) {
    this.hooks = hooks;
  }

  getRoot(): THREE.Group {
    return this.root;
  }

  /** Clearings kept around the stall and the spawn point. */
  private inClearing(x: number, z: number): boolean {
    if (Math.hypot(x - STALL_X, z - STALL_Z) < 9) return true;
    if (Math.hypot(x - SPAWN_X, z - SPAWN_Z) < 5) return true;
    return false;
  }

  /**
   * Grove density at a point: mostly-empty meadow between mostly-wooded copses,
   * averaging out to FARM_TREE_FRACTION across the map.
   */
  private groveDensity(x: number, z: number): number {
    const broad = valueNoise2D(x, z, GROVE_CELL, TREE_SEED);
    const detail = valueNoise2D(x, z, GROVE_CELL * 0.4, TREE_SEED ^ 0x99);
    const field = broad * 0.72 + detail * 0.28;
    // Centred so the average of the ramp lands near FARM_TREE_FRACTION.
    const t = smoothstep(0.42, 0.68, field);
    return GROVE_SPARSE + (GROVE_DENSE - GROVE_SPARSE) * t;
  }

  /** Would a tree stand here if nobody had touched it? */
  private treeSlot(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
    const x = tx + 0.5;
    const z = ty + 0.5;
    if (this.inClearing(x, z)) return false;
    if (this.hooks.distToWater(x, z) < 1.6) return false;
    if (this.rockSlot(tx, ty)) return false;
    return hash2(tx, ty, TREE_SEED) < this.groveDensity(x, z);
  }

  /** A boulder sits on this tile — permanent, and nothing grows or tills there. */
  rockSlot(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
    const x = tx + 0.5;
    const z = ty + 0.5;
    if (this.inClearing(x, z)) return false;
    if (this.hooks.distToWater(x, z) < 1.2) return false;
    return hash2(tx, ty, ROCK_SEED) < ROCK_TILE_FRACTION;
  }

  /** A tree is standing on this tile right now. */
  hasTree(tx: number, ty: number): boolean {
    if (!this.treeSlot(tx, ty)) return false;
    if (this.hooks.isChopped(tx, ty)) return false;
    return !this.hooks.tileBlocked(tx, ty);
  }

  /** A stump the player still has to clear before the tile can be worked. */
  hasStump(tx: number, ty: number): boolean {
    if (!this.treeSlot(tx, ty)) return false;
    if (!this.hooks.isChopped(tx, ty)) return false;
    if (this.hooks.isStumpCleared(tx, ty)) return false;
    return !this.hooks.tileBlocked(tx, ty);
  }

  /** Anything physically standing on the tile that stops a hoe. */
  blocksTilling(tx: number, ty: number): boolean {
    return this.rockSlot(tx, ty) || this.hasTree(tx, ty) || this.hasStump(tx, ty);
  }

  /** Nearest standing tree to a world point, within `range` tiles. */
  nearestTree(x: number, z: number, range: number): { tx: number; ty: number } | null {
    const r = Math.ceil(range);
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    let best: { tx: number; ty: number } | null = null;
    let bestD = range;
    for (let ty = cz - r; ty <= cz + r; ty++) {
      for (let tx = cx - r; tx <= cx + r; tx++) {
        if (!this.hasTree(tx, ty)) continue;
        const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - z);
        if (d < bestD) {
          bestD = d;
          best = { tx, ty };
        }
      }
    }
    return best;
  }

  update(playerX: number, playerZ: number): void {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cz = Math.floor(playerZ / CHUNK_SIZE);
    if (cx === this.lastCx && cz === this.lastCz) return;
    this.lastCx = cx;
    this.lastCz = cz;

    const needed = new Set<string>();
    for (let dz = -TREE_CHUNK_RADIUS; dz <= TREE_CHUNK_RADIUS; dz++) {
      for (let dx = -TREE_CHUNK_RADIUS; dx <= TREE_CHUNK_RADIUS; dx++) {
        needed.add(`${cx + dx},${cz + dz}`);
      }
    }

    for (const [key, chunk] of this.live) {
      if (!needed.has(key)) {
        this.root.remove(chunk.group);
        this.live.delete(key);
      }
    }
    for (const key of needed) {
      if (this.live.has(key)) continue;
      const [sx, sz] = key.split(',').map(Number) as [number, number];
      const chunk = this.buildChunk(sx, sz);
      if (!chunk) continue;
      this.live.set(key, chunk);
      this.root.add(chunk.group);
    }
  }

  /** Rebuild the chunk holding a tile — after a chop, or when one grows back. */
  invalidateTile(tx: number, ty: number): void {
    this.rebuild(`${Math.floor(tx / CHUNK_SIZE)},${Math.floor(ty / CHUNK_SIZE)}`);
  }

  rebuildAll(): void {
    for (const key of [...this.live.keys()]) this.rebuild(key);
  }

  private rebuild(key: string): void {
    const existing = this.live.get(key);
    if (!existing) return;
    this.root.remove(existing.group);
    this.live.delete(key);
    const [sx, sz] = key.split(',').map(Number) as [number, number];
    const chunk = this.buildChunk(sx, sz);
    if (!chunk) return;
    this.live.set(key, chunk);
    this.root.add(chunk.group);
  }

  /**
   * Real tree/rock models, flattened for instancing. Resolved lazily on first chunk
   * because Assets preloading finishes after the renderer is constructed. Empty
   * means the model is missing and the primitive cone/cylinder path is used instead.
   */
  private modelParts: {
    tree: ReturnType<typeof instancedParts>;
    rock: ReturnType<typeof instancedParts>;
    stump: ReturnType<typeof instancedParts>;
  } | null = null;

  private resolveModels(): void {
    if (this.modelParts) return;
    this.modelParts = {
      tree: instancedParts('tree_oak'),
      rock: instancedParts('rock_a'),
      stump: instancedParts('tree_stump'),
    };
  }

  private buildChunk(cx: number, cz: number): Chunk | null {
    this.resolveModels();
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    if (originX + CHUNK_SIZE < 0 || originZ + CHUNK_SIZE < 0) return null;
    if (originX >= GRID_W || originZ >= GRID_H) return null;

    const max = CHUNK_SIZE * CHUNK_SIZE;
    const mp = this.modelParts!;

    // One InstancedMesh per model part (a tree is trunk + leaves as separate meshes,
    // each with its own material). Every part receives the same per-instance matrix.
    const treeParts = mp.tree.length
      ? mp.tree.map((pt) => new THREE.InstancedMesh(pt.geometry, pt.material, max))
      : [
          new THREE.InstancedMesh(this.geoTrunk, this.matTrunk, max),
          new THREE.InstancedMesh(this.geoCanopy, this.matCanopy, max),
        ];
    const rockParts = mp.rock.length
      ? mp.rock.map((pt) => new THREE.InstancedMesh(pt.geometry, pt.material, max))
      : [new THREE.InstancedMesh(this.geoBoulder, this.matBoulder, max)];
    const stumpParts = mp.stump.length
      ? mp.stump.map((pt) => new THREE.InstancedMesh(pt.geometry, pt.material, max))
      : [new THREE.InstancedMesh(this.geoStump, this.matStump, max)];

    const trunks = treeParts[0]!;
    const canopy = treeParts[1] ?? treeParts[0]!;
    const stumps = stumpParts[0]!;
    const boulders = rockParts[0]!;
    const usingModels = mp.tree.length > 0;

    for (const m of [...treeParts, ...rockParts, ...stumpParts]) {
      m.castShadow = true;
      m.receiveShadow = true;
    }

    let ti = 0;
    let ci = 0;
    let si = 0;
    let bi = 0;

    for (let ty = originZ; ty < originZ + CHUNK_SIZE; ty++) {
      for (let tx = originX; tx < originX + CHUNK_SIZE; tx++) {
        if (this.rockSlot(tx, ty)) {
          const x = tx + 0.5 + (hash2(tx, ty, 0x71) - 0.5) * 0.3;
          const z = ty + 0.5 + (hash2(tx, ty, 0x72) - 0.5) * 0.3;
          const sc = 0.6 + hash2(tx, ty, 0x73) * 0.7;
          this._p.set(x, this.hooks.heightAt(x, z) + 0.24 * sc, z);
          this._e.set(0, hash2(tx, ty, 0x74) * 6, 0);
          this._q.setFromEuler(this._e);
          this._s.set(sc, sc * 0.78, sc);
          this._m.compose(this._p, this._q, this._s);
          boulders.setMatrixAt(bi++, this._m);
          continue;
        }
        if (!this.treeSlot(tx, ty)) continue;
        if (this.hooks.tileBlocked(tx, ty)) continue;

        // Scatter within the tile so coverage doesn't read as a lattice.
        const x = tx + 0.5 + (hash2(tx, ty, 0x11) - 0.5) * 0.55;
        const z = ty + 0.5 + (hash2(tx, ty, 0x22) - 0.5) * 0.55;
        const y = this.hooks.heightAt(x, z);

        if (this.hooks.isChopped(tx, ty)) {
          if (this.hooks.isStumpCleared(tx, ty)) continue;
          this._p.set(x, y + 0.1, z);
          this._e.set(0, hash2(tx, ty, 0x33) * 6, 0);
          this._q.setFromEuler(this._e);
          this._s.set(1, 1, 1);
          this._m.compose(this._p, this._q, this._s);
          stumps.setMatrixAt(si++, this._m);
          continue;
        }

        const sc = 0.85 + hash2(tx, ty, 0x44) * 0.7;
        const lean = (hash2(tx, ty, 0x55) - 0.5) * 0.12;
        this._e.set(lean, hash2(tx, ty, 0x66) * 6, lean * 0.6);
        this._q.setFromEuler(this._e);

        if (usingModels) {
          // The model already has trunk and foliage positioned relative to each
          // other, so every part takes the identical ground-level matrix.
          this._p.set(x, y, z);
          this._s.set(sc, sc, sc);
          this._m.compose(this._p, this._q, this._s);
          for (const part of treeParts) part.setMatrixAt(ti, this._m);
          ti++;
          ci = ti;
          continue;
        }

        this._p.set(x, y + 0.62 * sc, z);
        this._s.set(sc, sc, sc);
        this._m.compose(this._p, this._q, this._s);
        trunks.setMatrixAt(ti++, this._m);

        this._p.set(x, y + 1.5 * sc, z);
        this._m.compose(this._p, this._q, this._s);
        canopy.setMatrixAt(ci++, this._m);

        this._p.set(x, y + 2.15 * sc, z);
        this._s.set(sc * 0.7, sc * 0.72, sc * 0.7);
        this._m.compose(this._p, this._q, this._s);
        canopy.setMatrixAt(ci++, this._m);
      }
    }

    if (usingModels) {
      for (const part of treeParts) part.count = ti;
    } else {
      trunks.count = ti;
      canopy.count = ci;
    }
    for (const part of stumpParts) part.count = si;
    for (const part of rockParts) part.count = bi;

    const all = [...treeParts, ...stumpParts, ...rockParts];
    for (const m of all) {
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }

    const group = new THREE.Group();
    group.name = `trees_${cx},${cz}`;
    group.add(...all);
    return { key: `${cx},${cz}`, group };
  }
}
