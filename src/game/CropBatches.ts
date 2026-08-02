import * as THREE from 'three';
import { instancedParts, type InstancedPart, type ModelKey } from './Assets';
import { disposeCloneOwnedMaterials, markMaterialOwner } from './ResourceDisposal';

const MAX_CROP_INSTANCES = 800;

export type CropBatchRecord = {
  tileKey: string;
  tx: number;
  ty: number;
  x: number;
  y: number;
  z: number;
  modelKey: ModelKey;
  tint?: number;
  baseScale: number;
};

type CropBatch = {
  key: string;
  records: Map<string, CropBatchRecord>;
  meshes: THREE.InstancedMesh[];
  ownedMaterials: THREE.Material[];
};

/**
 * Instance-compatible crop renderer.
 *
 * Crops are grouped by authored stage model and tint. A planted/harvested tile
 * only removes or adds one record and rebuilds the affected group; it never
 * tears down every crop in the field. The small scale pulse is still updated for
 * each instance, but the work is a handful of matrix-buffer writes rather than
 * hundreds of Object3D traversals and material clones.
 */
export class CropBatches {
  private readonly root = new THREE.Group();
  private readonly batches = new Map<string, CropBatch>();
  private readonly records = new Map<string, CropBatchRecord>();
  private readonly modelParts = new Map<ModelKey, InstancedPart[]>();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly identity = new THREE.Quaternion();
  private disposed = false;

  getRoot(): THREE.Group {
    return this.root;
  }

  /** Add or replace one tile. False means the model is using a primitive fallback. */
  upsert(record: CropBatchRecord, rebuild = true): boolean {
    if (this.disposed) return false;
    const parts = this.resolveParts(record.modelKey);
    if (parts.length === 0) return false;

    this.removeTile(record.tileKey);
    const key = batchKey(record.modelKey, record.tint);
    let batch = this.batches.get(key);
    if (!batch) {
      batch = this.createBatch(key, parts, record.tint);
      this.batches.set(key, batch);
      this.root.add(...batch.meshes);
    }
    if (batch.records.size >= MAX_CROP_INSTANCES) return false;
    batch.records.set(record.tileKey, record);
    this.records.set(record.tileKey, record);
    if (rebuild) this.rebuild(batch, 0);
    return true;
  }

  removeTile(tileKey: string): void {
    const existing = this.records.get(tileKey);
    if (!existing) return;
    this.records.delete(tileKey);
    const key = batchKey(existing.modelKey, existing.tint);
    const batch = this.batches.get(key);
    if (!batch) return;
    batch.records.delete(tileKey);
    if (batch.records.size === 0) {
      this.removeBatch(batch);
      this.batches.delete(key);
      return;
    }
    this.rebuild(batch, 0);
  }

  update(simTime: number, recomputeBounds = false): void {
    if (this.disposed) return;
    for (const batch of this.batches.values()) this.rebuild(batch, simTime, recomputeBounds);
  }

  clear(): void {
    for (const batch of this.batches.values()) this.removeBatch(batch);
    this.batches.clear();
    this.records.clear();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    const geometries = new Set<THREE.BufferGeometry>();
    for (const parts of this.modelParts.values()) {
      for (const part of parts) geometries.add(part.geometry);
    }
    for (const geometry of geometries) geometry.dispose();
    this.modelParts.clear();
    this.root.removeFromParent();
  }

  private resolveParts(key: ModelKey): InstancedPart[] {
    const cached = this.modelParts.get(key);
    if (cached) return cached;
    const parts = instancedParts(key);
    this.modelParts.set(key, parts);
    return parts;
  }

  private createBatch(key: string, parts: InstancedPart[], tint: number | undefined): CropBatch {
    const ownedMaterials: THREE.Material[] = [];
    const meshes = parts.map((part) => {
      let material = part.material;
      if (tint !== undefined && material instanceof THREE.MeshStandardMaterial) {
        const tinted = markMaterialOwner(material.clone(), 'clone');
        tinted.color.set(tint);
        material = tinted;
        ownedMaterials.push(tinted);
      }
      const mesh = new THREE.InstancedMesh(part.geometry, material, MAX_CROP_INSTANCES);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      return mesh;
    });
    return { key, records: new Map(), meshes, ownedMaterials };
  }

  private rebuild(batch: CropBatch, simTime: number, recomputeBounds = true): void {
    let index = 0;
    for (const record of batch.records.values()) {
      const pulse = 1 + Math.sin(simTime * 1.1 + record.tx) * 0.015;
      this.position.set(record.x, record.y, record.z);
      this.scale.setScalar(record.baseScale * pulse);
      this.matrix.compose(this.position, this.identity, this.scale);
      for (const mesh of batch.meshes) mesh.setMatrixAt(index, this.matrix);
      index++;
    }
    for (const mesh of batch.meshes) {
      mesh.count = index;
      mesh.instanceMatrix.needsUpdate = true;
      if (recomputeBounds) mesh.computeBoundingSphere();
    }
  }

  private removeBatch(batch: CropBatch): void {
    for (const mesh of batch.meshes) mesh.removeFromParent();
    disposeCloneOwnedMaterials(batch.ownedMaterials);
  }
}

function batchKey(modelKey: ModelKey, tint: number | undefined): string {
  return `${modelKey}:${tint === undefined ? 'source' : tint.toString(16)}`;
}
