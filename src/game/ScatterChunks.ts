import * as THREE from 'three';
import {
  CHUNK_COUNT,
  CHUNK_LOAD_RADIUS,
  CHUNK_SIZE,
  HOMESTEAD_MAX_X,
  HOMESTEAD_MAX_Z,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  WORLD_SIZE,
} from '../content';
import { standardMaterial } from './materials';
import { hash2 } from './noise';
import { TERRAIN_SEED } from './terrain';

type ChunkKey = string;

type ChunkMeshes = {
  key: ChunkKey;
  cx: number;
  cz: number;
  group: THREE.Group;
};

/**
 * 16×16 chunks, 15×15 covering the 240 world.
 * Only chunks within CHUNK_LOAD_RADIUS of the player are live.
 * All props are InstancedMesh — never per-prop Mesh objects.
 */
export class ScatterChunks {
  private readonly root = new THREE.Group();
  private readonly live = new Map<ChunkKey, ChunkMeshes>();
  private lastCx = Number.NaN;
  private lastCz = Number.NaN;
  private heightAt: (x: number, z: number) => number;
  private distToWater: (x: number, z: number) => number;

  // Shared geometries / materials
  private readonly geoBlade = new THREE.BoxGeometry(0.04, 0.35, 0.04);
  private readonly geoPebble = new THREE.OctahedronGeometry(0.12, 0);
  private readonly geoBush = new THREE.IcosahedronGeometry(0.32, 0);
  private readonly geoStem = new THREE.CylinderGeometry(0.02, 0.025, 0.28, 4);
  private readonly geoPetal = new THREE.OctahedronGeometry(0.07, 0);

  private readonly matGrass = standardMaterial(0x4a7a30, { flatShading: true, roughness: 0.95 });
  private readonly matPebble = standardMaterial(0x7a7a68, { flatShading: true, roughness: 0.94 });
  private readonly matBush = standardMaterial(0x3d6b32, { flatShading: true, roughness: 0.9 });
  private readonly matStem = standardMaterial(0x3a5a28, { flatShading: true });
  private readonly matFlowerA = standardMaterial(0xe87a9a, { flatShading: true });
  private readonly matFlowerB = standardMaterial(0xe8d060, { flatShading: true });

  private readonly _m = new THREE.Matrix4();
  private readonly _p = new THREE.Vector3();
  private readonly _q = new THREE.Quaternion();
  private readonly _s = new THREE.Vector3();
  private readonly _e = new THREE.Euler();

  constructor(
    heightAt: (x: number, z: number) => number,
    distToWater: (x: number, z: number) => number,
  ) {
    this.heightAt = heightAt;
    this.distToWater = distToWater;
  }

  getRoot(): THREE.Group {
    return this.root;
  }

  /** Call each frame with player world position. */
  update(playerX: number, playerZ: number): void {
    const cx = Math.floor(playerX / CHUNK_SIZE);
    const cz = Math.floor(playerZ / CHUNK_SIZE);
    if (cx === this.lastCx && cz === this.lastCz) return;
    this.lastCx = cx;
    this.lastCz = cz;

    const needed = new Set<ChunkKey>();
    for (let dz = -CHUNK_LOAD_RADIUS; dz <= CHUNK_LOAD_RADIUS; dz++) {
      for (let dx = -CHUNK_LOAD_RADIUS; dx <= CHUNK_LOAD_RADIUS; dx++) {
        const x = cx + dx;
        const z = cz + dz;
        if (x < 0 || z < 0 || x >= CHUNK_COUNT || z >= CHUNK_COUNT) continue;
        needed.add(`${x},${z}`);
      }
    }

    // Remove far chunks
    for (const [key, chunk] of this.live) {
      if (!needed.has(key)) {
        this.root.remove(chunk.group);
        this.live.delete(key);
      }
    }

    // Add new
    for (const key of needed) {
      if (this.live.has(key)) continue;
      const [sx, sz] = key.split(',').map(Number) as [number, number];
      const chunk = this.buildChunk(sx, sz);
      this.live.set(key, chunk);
      this.root.add(chunk.group);
    }
  }

  private buildChunk(cx: number, cz: number): ChunkMeshes {
    const key = `${cx},${cz}`;
    const group = new THREE.Group();
    group.name = `chunk_${key}`;
    const seed = (cx * 73856093) ^ (cz * 19349663) ^ TERRAIN_SEED;

    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;

    // Density — err high
    const nGrass = 55 + Math.floor(hash2(cx, cz, seed) * 16); // 55-70
    const nPebble = 14 + Math.floor(hash2(cx, cz, seed + 1) * 7); // 14-20
    const nBush = 5 + Math.floor(hash2(cx, cz, seed + 3) * 4); // 5-8
    const nFlower = 10 + Math.floor(hash2(cx, cz, seed + 4) * 6); // 10-15

    // Grass: 3 blades per tuft → nGrass * 3
    const grass = new THREE.InstancedMesh(this.geoBlade, this.matGrass, nGrass * 3);
    grass.castShadow = true;
    grass.receiveShadow = true;
    let gi = 0;

    const pebbles = new THREE.InstancedMesh(this.geoPebble, this.matPebble, nPebble);
    pebbles.castShadow = true;
    pebbles.receiveShadow = true;
    let pi = 0;

    const bushes = new THREE.InstancedMesh(this.geoBush, this.matBush, nBush * 3);
    bushes.castShadow = true;
    bushes.receiveShadow = true;
    let bui = 0;

    const stems = new THREE.InstancedMesh(this.geoStem, this.matStem, nFlower);
    const petals = new THREE.InstancedMesh(this.geoPetal, this.matFlowerA, nFlower);
    stems.castShadow = true;
    petals.castShadow = true;
    let fi = 0;

    const placeOk = (x: number, z: number, allowNearWater = false): boolean => {
      if (x < 1 || z < 1 || x > WORLD_SIZE - 1 || z > WORLD_SIZE - 1) return false;
      // Keep clear around homestead building only (not the whole tillable world)
      if (
        x >= HOMESTEAD_MIN_X + 12 &&
        x <= HOMESTEAD_MAX_X - 12 &&
        z >= HOMESTEAD_MIN_Z + 14 &&
        z <= HOMESTEAD_MAX_Z - 8
      )
        return false;
      if (!allowNearWater && this.distToWater(x, z) < 0.8) return false;
      return true;
    };

    // Grass tufts
    for (let i = 0; i < nGrass; i++) {
      const x = originX + hash2(i, 1, seed) * CHUNK_SIZE;
      const z = originZ + hash2(i, 2, seed) * CHUNK_SIZE;
      // allow light grass in homestead
      const inHomestead =
        x >= HOMESTEAD_MIN_X &&
        x <= HOMESTEAD_MAX_X &&
        z >= HOMESTEAD_MIN_Z &&
        z <= HOMESTEAD_MAX_Z;
      if (this.distToWater(x, z) < 0.5) continue;
      if (inHomestead && hash2(i, 3, seed) > 0.35) continue; // thinner lawn
      const y = this.heightAt(x, z);
      const yaw = hash2(i, 4, seed) * Math.PI * 2;
      const sc = 0.75 + hash2(i, 5, seed) * 0.5;
      for (let b = 0; b < 3; b++) {
        const ox = (b - 1) * 0.05;
        const oz = (hash2(i, b + 6, seed) - 0.5) * 0.06;
        this._p.set(x + ox, y + 0.15 * sc, z + oz);
        this._e.set(0, yaw + b * 0.4, (hash2(i, b, seed) - 0.5) * 0.25);
        this._q.setFromEuler(this._e);
        this._s.set(sc, sc * (0.9 + hash2(i, b + 10, seed) * 0.3), sc);
        this._m.compose(this._p, this._q, this._s);
        grass.setMatrixAt(gi++, this._m);
      }
    }
    grass.count = gi;

    // Pebbles
    for (let i = 0; i < nPebble; i++) {
      const x = originX + hash2(i, 20, seed) * CHUNK_SIZE;
      const z = originZ + hash2(i, 21, seed) * CHUNK_SIZE;
      if (!placeOk(x, z, true)) continue;
      if (
        x >= HOMESTEAD_MIN_X &&
        x <= HOMESTEAD_MAX_X &&
        z >= HOMESTEAD_MIN_Z &&
        z <= HOMESTEAD_MAX_Z &&
        hash2(i, 22, seed) > 0.4
      )
        continue;
      const y = this.heightAt(x, z);
      const sc = 0.7 + hash2(i, 23, seed) * 0.7;
      this._p.set(x, y + 0.04 * sc, z);
      this._e.set(hash2(i, 24, seed), hash2(i, 25, seed) * 6, hash2(i, 26, seed));
      this._q.setFromEuler(this._e);
      this._s.set(sc, sc * 0.65, sc);
      this._m.compose(this._p, this._q, this._s);
      pebbles.setMatrixAt(pi++, this._m);
    }
    pebbles.count = pi;

    // Boulders are owned by FarmTrees now — they sit on whole tiles and block
    // tilling, so their placement has to be something the sim can query.

    // Bushes (2-3 clusters)
    for (let i = 0; i < nBush; i++) {
      const x = originX + hash2(i, 40, seed) * CHUNK_SIZE;
      const z = originZ + hash2(i, 41, seed) * CHUNK_SIZE;
      if (!placeOk(x, z)) continue;
      if (
        x >= HOMESTEAD_MIN_X &&
        x <= HOMESTEAD_MAX_X &&
        z >= HOMESTEAD_MIN_Z &&
        z <= HOMESTEAD_MAX_Z
      )
        continue;
      const y = this.heightAt(x, z);
      const parts = 2 + Math.floor(hash2(i, 42, seed) * 2);
      for (let p = 0; p < parts; p++) {
        const ox = (hash2(i, p + 43, seed) - 0.5) * 0.45;
        const oz = (hash2(i, p + 44, seed) - 0.5) * 0.45;
        const sc = 0.7 + hash2(i, p + 45, seed) * 0.55;
        this._p.set(x + ox, y + 0.22 * sc, z + oz);
        this._e.set(0, hash2(i, p + 46, seed) * 6, 0);
        this._q.setFromEuler(this._e);
        this._s.set(sc, sc * 0.85, sc);
        this._m.compose(this._p, this._q, this._s);
        bushes.setMatrixAt(bui++, this._m);
      }
    }
    bushes.count = bui;

    // Flowers
    for (let i = 0; i < nFlower; i++) {
      const x = originX + hash2(i, 50, seed) * CHUNK_SIZE;
      const z = originZ + hash2(i, 51, seed) * CHUNK_SIZE;
      if (!placeOk(x, z)) continue;
      const y = this.heightAt(x, z);
      const sc = 0.8 + hash2(i, 52, seed) * 0.4;
      this._p.set(x, y + 0.14 * sc, z);
      this._e.set(0, 0, 0);
      this._q.setFromEuler(this._e);
      this._s.set(sc, sc, sc);
      this._m.compose(this._p, this._q, this._s);
      stems.setMatrixAt(fi, this._m);
      this._p.set(x, y + 0.3 * sc, z);
      this._s.set(sc, sc, sc);
      this._m.compose(this._p, this._q, this._s);
      petals.setMatrixAt(fi, this._m);
      // alternate flower colour via scale trick — second material mesh half
      if (hash2(i, 53, seed) > 0.5) {
        // recolor can't per-instance easily without instanceColor; use slight scale
        this._s.set(sc * 1.1, sc * 1.1, sc * 1.1);
        this._m.compose(this._p, this._q, this._s);
        petals.setMatrixAt(fi, this._m);
      }
      fi++;
    }
    stems.count = fi;
    petals.count = fi;
    // Dual flower colours: second instanced mesh
    const petalsB = new THREE.InstancedMesh(this.geoPetal, this.matFlowerB, nFlower);
    petalsB.castShadow = true;
    let fib = 0;
    for (let i = 0; i < nFlower; i++) {
      if (hash2(i, 53, seed) <= 0.5) continue;
      const x = originX + hash2(i, 50, seed) * CHUNK_SIZE;
      const z = originZ + hash2(i, 51, seed) * CHUNK_SIZE;
      if (!placeOk(x, z)) continue;
      const y = this.heightAt(x, z);
      const sc = 0.85 + hash2(i, 52, seed) * 0.35;
      this._p.set(x, y + 0.3 * sc, z);
      this._q.identity();
      this._s.set(sc, sc, sc);
      this._m.compose(this._p, this._q, this._s);
      petalsB.setMatrixAt(fib++, this._m);
    }
    petalsB.count = fib;

    // Trees are no longer scattered here — FarmTrees owns every overworld tree so
    // each one is choppable and respawns on its own timer.

    grass.instanceMatrix.needsUpdate = true;
    pebbles.instanceMatrix.needsUpdate = true;
    bushes.instanceMatrix.needsUpdate = true;
    stems.instanceMatrix.needsUpdate = true;
    petals.instanceMatrix.needsUpdate = true;
    petalsB.instanceMatrix.needsUpdate = true;

    group.add(grass, pebbles, bushes, stems, petals, petalsB);

    return { key, cx, cz, group };
  }
}
