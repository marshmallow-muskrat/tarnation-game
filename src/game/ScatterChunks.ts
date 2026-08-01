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
import { instancedParts, type InstancedPart, type ModelKey } from './Assets';
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

type InstanceBatch = {
  meshes: THREE.InstancedMesh[];
  count: number;
};

type ScatterModelParts = {
  grass: InstancedPart[][];
  rock: InstancedPart[][];
  bush: InstancedPart[][];
  flower: InstancedPart[][];
};

const SCATTER_MODEL_KEYS = {
  grass: ['grass', 'grass_2', 'grass_short'],
  rock: ['rock_1', 'rock_2', 'rock_3'],
  bush: ['bush_1', 'bush_2'],
  // The Ultimate Nature Pack calls its flower clump `flowers`; the five plant
  // silhouettes round out the variation without introducing rejected `sn_` art.
  flower: ['flowers', 'plant_1', 'plant_2', 'plant_3', 'plant_4', 'plant_5'],
} satisfies Record<keyof ScatterModelParts, readonly ModelKey[]>;

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

  // Primitive fallbacks stay here for missing or failed assets.
  private readonly geoBlade = new THREE.BoxGeometry(0.04, 0.35, 0.04);
  private readonly geoPebble = new THREE.OctahedronGeometry(0.12, 0);
  private readonly geoBush = new THREE.IcosahedronGeometry(0.32, 0);
  private readonly geoFlower = new THREE.OctahedronGeometry(0.07, 0);

  private readonly matGrass = standardMaterial(0x4a7a30, { flatShading: true, roughness: 0.95 });
  private readonly matPebble = standardMaterial(0x7a7a68, { flatShading: true, roughness: 0.94 });
  private readonly matBush = standardMaterial(0x3d6b32, { flatShading: true, roughness: 0.9 });
  private readonly matFlower = standardMaterial(0xe87a9a, { flatShading: true });

  private readonly _m = new THREE.Matrix4();
  private readonly _p = new THREE.Vector3();
  private readonly _q = new THREE.Quaternion();
  private readonly _s = new THREE.Vector3();
  private readonly _e = new THREE.Euler();

  /** Resolved once after first_play loading, then reused by every live chunk. */
  private modelParts: ScatterModelParts | null = null;

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

  private resolveModels(): ScatterModelParts {
    if (!this.modelParts) {
      const load = (keys: readonly ModelKey[]): InstancedPart[][] =>
        keys.map((key) => instancedParts(key)).filter((parts) => parts.length > 0);

      this.modelParts = {
        grass: load(SCATTER_MODEL_KEYS.grass),
        rock: load(SCATTER_MODEL_KEYS.rock),
        bush: load(SCATTER_MODEL_KEYS.bush),
        flower: load(SCATTER_MODEL_KEYS.flower),
      };
    }
    return this.modelParts;
  }

  /** Build one InstancedMesh per glTF part, or one primitive fallback mesh. */
  private createBatches(
    models: InstancedPart[][],
    capacity: number,
    fallback: InstancedPart,
  ): InstanceBatch[] {
    const variants = models.length > 0 ? models : [[fallback]];
    return variants.map((parts) => ({
      count: 0,
      meshes: parts.map((part) => {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, capacity);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        return mesh;
      }),
    }));
  }

  private writeInstance(batch: InstanceBatch, matrix: THREE.Matrix4): void {
    for (const mesh of batch.meshes) mesh.setMatrixAt(batch.count, matrix);
    batch.count++;
  }

  private finishBatches(batches: InstanceBatch[]): void {
    for (const batch of batches) {
      for (const mesh of batch.meshes) {
        mesh.count = batch.count;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
    }
  }

  private pickBatch(batches: InstanceBatch[], roll: number): InstanceBatch {
    return batches[Math.min(batches.length - 1, Math.floor(roll * batches.length))]!;
  }

  private buildChunk(cx: number, cz: number): ChunkMeshes {
    const key = `${cx},${cz}`;
    const group = new THREE.Group();
    group.name = `chunk_${key}`;
    const seed = (cx * 73856093) ^ (cz * 19349663) ^ TERRAIN_SEED;
    const models = this.resolveModels();

    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;

    // Density — keep the existing gameplay dressing; real models replace only
    // the geometry and inherit the same deterministic placement.
    const nGrass = 55 + Math.floor(hash2(cx, cz, seed) * 16); // 55-70
    const nPebble = 14 + Math.floor(hash2(cx, cz, seed + 1) * 7); // 14-20
    const nBush = 5 + Math.floor(hash2(cx, cz, seed + 3) * 4); // 5-8
    const nFlower = 10 + Math.floor(hash2(cx, cz, seed + 4) * 6); // 10-15

    const grass = this.createBatches(models.grass, nGrass * 3, {
      geometry: this.geoBlade,
      material: this.matGrass,
    });
    const pebbles = this.createBatches(models.rock, nPebble, {
      geometry: this.geoPebble,
      material: this.matPebble,
    });
    const bushes = this.createBatches(models.bush, nBush * 3, {
      geometry: this.geoBush,
      material: this.matBush,
    });
    const flowers = this.createBatches(models.flower, nFlower, {
      geometry: this.geoFlower,
      material: this.matFlower,
    });

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

    // Grass clumps. Ultimate Nature grass models already contain a small clump,
    // while the primitive fallback keeps the old three-blade silhouette.
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

      const realModel = models.grass.length > 0;
      const batch = this.pickBatch(grass, hash2(i, 7, seed));
      if (realModel) {
        this._p.set(x, y, z);
        this._e.set(0, yaw, 0);
        this._q.setFromEuler(this._e);
        this._s.set(sc, sc, sc);
        this._m.compose(this._p, this._q, this._s);
        this.writeInstance(batch, this._m);
        continue;
      }

      for (let b = 0; b < 3; b++) {
        const ox = (b - 1) * 0.05;
        const oz = (hash2(i, b + 6, seed) - 0.5) * 0.06;
        this._p.set(x + ox, y + 0.15 * sc, z + oz);
        this._e.set(0, yaw + b * 0.4, (hash2(i, b, seed) - 0.5) * 0.25);
        this._q.setFromEuler(this._e);
        this._s.set(sc, sc * (0.9 + hash2(i, b + 10, seed) * 0.3), sc);
        this._m.compose(this._p, this._q, this._s);
        this.writeInstance(batch, this._m);
      }
    }

    // Pebbles use the small Ultimate Nature rock silhouettes rather than
    // geometric octahedrons. They remain separate from FarmTrees' tile boulders.
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
      this._p.set(x, y, z);
      this._e.set(hash2(i, 24, seed), hash2(i, 25, seed) * 6, hash2(i, 26, seed));
      this._q.setFromEuler(this._e);
      this._s.set(sc, sc * 0.65, sc);
      this._m.compose(this._p, this._q, this._s);
      this.writeInstance(this.pickBatch(pebbles, hash2(i, 27, seed)), this._m);
    }

    // Bushes: a real model is already a complete bush, so one model replaces
    // each old primitive cluster. The fallback preserves the old 2–3 blob look.
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
      const sc = 0.75 + hash2(i, 45, seed) * 0.5;
      const batch = this.pickBatch(bushes, hash2(i, 46, seed));

      if (models.bush.length > 0) {
        this._p.set(x, y, z);
        this._e.set(0, hash2(i, 47, seed) * 6, 0);
        this._q.setFromEuler(this._e);
        this._s.set(sc, sc, sc);
        this._m.compose(this._p, this._q, this._s);
        this.writeInstance(batch, this._m);
        continue;
      }

      const parts = 2 + Math.floor(hash2(i, 42, seed) * 2);
      for (let p = 0; p < parts; p++) {
        const ox = (hash2(i, p + 43, seed) - 0.5) * 0.45;
        const oz = (hash2(i, p + 44, seed) - 0.5) * 0.45;
        const partScale = 0.7 + hash2(i, p + 45, seed) * 0.55;
        this._p.set(x + ox, y + 0.22 * partScale, z + oz);
        this._e.set(0, hash2(i, p + 46, seed) * 6, 0);
        this._q.setFromEuler(this._e);
        this._s.set(partScale, partScale * 0.85, partScale);
        this._m.compose(this._p, this._q, this._s);
        this.writeInstance(batch, this._m);
      }
    }

    // Flowers/plants use the full low-poly Nature silhouettes. The primitive
    // fallback remains a small petal mesh at the same ground-level anchor.
    for (let i = 0; i < nFlower; i++) {
      const x = originX + hash2(i, 50, seed) * CHUNK_SIZE;
      const z = originZ + hash2(i, 51, seed) * CHUNK_SIZE;
      if (!placeOk(x, z)) continue;
      const y = this.heightAt(x, z);
      const sc = 0.8 + hash2(i, 52, seed) * 0.4;
      this._p.set(x, y, z);
      this._e.set(0, hash2(i, 54, seed) * 6, 0);
      this._q.setFromEuler(this._e);
      this._s.set(sc, sc, sc);
      this._m.compose(this._p, this._q, this._s);
      this.writeInstance(this.pickBatch(flowers, hash2(i, 53, seed)), this._m);
    }

    this.finishBatches(grass);
    this.finishBatches(pebbles);
    this.finishBatches(bushes);
    this.finishBatches(flowers);

    group.add(
      ...grass.flatMap((batch) => batch.meshes),
      ...pebbles.flatMap((batch) => batch.meshes),
      ...bushes.flatMap((batch) => batch.meshes),
      ...flowers.flatMap((batch) => batch.meshes),
    );

    return { key, cx, cz, group };
  }
}
