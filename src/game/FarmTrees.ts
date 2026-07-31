import * as THREE from 'three';
import {
  CHUNK_SIZE,
  FARM_TREE_FRACTION,
  GRID_H,
  GRID_W,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SIZE,
  TREE_CHUNK_RADIUS,
} from '../content';
import { standardMaterial } from './materials';
import { hash2 } from './noise';
import { TERRAIN_SEED } from './terrain';

const TREE_SEED = TERRAIN_SEED ^ 0x7a3e;

/** Where GameRuntime puts the homestead building and drops the player in. */
const HOUSE_X = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2;
const HOUSE_Z = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE - 6;
const SPAWN_X = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2;
const SPAWN_Z = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE / 2;

export interface FarmTreeHooks {
  heightAt: (x: number, z: number) => number;
  distToWater: (x: number, z: number) => number;
  /** Already felled and waiting on its respawn timer. */
  isChopped: (tx: number, ty: number) => boolean;
  /** Tile is worked ground (tilled, planted, trench…) — no tree stands there. */
  tileBlocked: (tx: number, ty: number) => boolean;
}

type Chunk = { key: string; group: THREE.Group };

/**
 * Overworld trees. A quarter of every tile in the world carries one, so they are
 * placed by a per-tile hash rather than stored — only the *felled* ones cost
 * memory, and those live in the save as `choppedTrees`.
 *
 * Everything is instanced per 16×16 chunk and only chunks near the player are
 * live, which is what keeps 25% coverage of a 240×240 world affordable.
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

  private readonly matTrunk = standardMaterial(0x5a3a22, {
    flatShading: true,
    roughness: 0.92,
  });
  private readonly matCanopy = standardMaterial(0x3d6b35, {
    flatShading: true,
    roughness: 0.88,
  });
  private readonly matStump = standardMaterial(0x7a5a38, {
    flatShading: true,
    roughness: 0.95,
  });

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

  /** Would a tree stand here if nobody had touched it? */
  private treeSlot(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return false;
    if (hash2(tx, ty, TREE_SEED) >= FARM_TREE_FRACTION) return false;
    const x = tx + 0.5;
    const z = ty + 0.5;
    // No trees standing in the river or the lake.
    if (this.hooks.distToWater(x, z) < 1.6) return false;
    // Two small clearings — one around the buildings, one where the player spawns —
    // so the homestead is never walled in. Everywhere else keeps its full quarter.
    if (Math.hypot(x - HOUSE_X, z - HOUSE_Z) < 8) return false;
    if (Math.hypot(x - SPAWN_X, z - SPAWN_Z) < 4) return false;
    return true;
  }

  /** A tree is standing on this tile right now. */
  hasTree(tx: number, ty: number): boolean {
    if (!this.treeSlot(tx, ty)) return false;
    if (this.hooks.isChopped(tx, ty)) return false;
    return !this.hooks.tileBlocked(tx, ty);
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
    const key = `${Math.floor(tx / CHUNK_SIZE)},${Math.floor(ty / CHUNK_SIZE)}`;
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

  rebuildAll(): void {
    const keys = [...this.live.keys()];
    for (const key of keys) {
      const existing = this.live.get(key)!;
      this.root.remove(existing.group);
      this.live.delete(key);
      const [sx, sz] = key.split(',').map(Number) as [number, number];
      const chunk = this.buildChunk(sx, sz);
      if (!chunk) continue;
      this.live.set(key, chunk);
      this.root.add(chunk.group);
    }
  }

  private buildChunk(cx: number, cz: number): Chunk | null {
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;
    if (originX + CHUNK_SIZE < 0 || originZ + CHUNK_SIZE < 0) return null;
    if (originX >= GRID_W || originZ >= GRID_H) return null;

    const max = CHUNK_SIZE * CHUNK_SIZE;
    const trunks = new THREE.InstancedMesh(this.geoTrunk, this.matTrunk, max);
    const canopy = new THREE.InstancedMesh(this.geoCanopy, this.matCanopy, max * 2);
    const stumps = new THREE.InstancedMesh(this.geoStump, this.matStump, max);
    trunks.castShadow = true;
    trunks.receiveShadow = true;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    stumps.castShadow = true;
    stumps.receiveShadow = true;

    let ti = 0;
    let ci = 0;
    let si = 0;

    for (let ty = originZ; ty < originZ + CHUNK_SIZE; ty++) {
      for (let tx = originX; tx < originX + CHUNK_SIZE; tx++) {
        if (!this.treeSlot(tx, ty)) continue;
        const blocked = this.hooks.tileBlocked(tx, ty);
        const chopped = this.hooks.isChopped(tx, ty);

        // Scatter within the tile so 25% coverage doesn't read as a lattice.
        const x = tx + 0.5 + (hash2(tx, ty, 0x11) - 0.5) * 0.55;
        const z = ty + 0.5 + (hash2(tx, ty, 0x22) - 0.5) * 0.55;
        const y = this.hooks.heightAt(x, z);

        if (chopped && !blocked) {
          this._p.set(x, y + 0.1, z);
          this._e.set(0, hash2(tx, ty, 0x33) * 6, 0);
          this._q.setFromEuler(this._e);
          this._s.set(1, 1, 1);
          this._m.compose(this._p, this._q, this._s);
          stumps.setMatrixAt(si++, this._m);
          continue;
        }
        if (chopped || blocked) continue;

        const sc = 0.85 + hash2(tx, ty, 0x44) * 0.7;
        const lean = (hash2(tx, ty, 0x55) - 0.5) * 0.12;
        this._e.set(lean, hash2(tx, ty, 0x66) * 6, lean * 0.6);
        this._q.setFromEuler(this._e);

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

    trunks.count = ti;
    canopy.count = ci;
    stumps.count = si;
    trunks.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
    stumps.instanceMatrix.needsUpdate = true;

    const group = new THREE.Group();
    group.name = `trees_${cx},${cz}`;
    group.add(trunks, canopy, stumps);
    return { key: `${cx},${cz}`, group };
  }
}
