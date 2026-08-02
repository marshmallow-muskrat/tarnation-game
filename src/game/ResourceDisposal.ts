import * as THREE from 'three';

export type MaterialOwner = 'asset-cache' | 'clone';

const MATERIAL_OWNER = 'tarnationMaterialOwner';
const SHARED_ASSET = 'tarnationSharedAsset';
const RELEASE_SHARED_ASSET = 'tarnationReleaseSharedAsset';

type MaterialWithOwner = THREE.Material & { userData: Record<string, unknown> };

function asMaterialOwner(material: THREE.Material): MaterialOwner | undefined {
  const value = (material as MaterialWithOwner).userData[MATERIAL_OWNER];
  return value === 'asset-cache' || value === 'clone' ? value : undefined;
}

/** Mark a material so its owner can dispose it without touching shared assets. */
export function markMaterialOwner<T extends THREE.Material>(material: T, owner: MaterialOwner): T {
  (material as MaterialWithOwner).userData[MATERIAL_OWNER] = owner;
  return material;
}

/** Mark a clone that shares geometry/materials with the asset cache. */
export function markModelClone(
  root: THREE.Object3D,
  sharedAsset: boolean,
  releaseSharedAsset?: () => void,
): void {
  root.userData[SHARED_ASSET] = sharedAsset;
  if (releaseSharedAsset) root.userData[RELEASE_SHARED_ASSET] = releaseSharedAsset;
  else delete root.userData[RELEASE_SHARED_ASSET];
}

function objectMaterials(root: THREE.Object3D): Set<THREE.Material> {
  const materials = new Set<THREE.Material>();
  root.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    if (!material) return;
    if (Array.isArray(material)) {
      for (const entry of material) materials.add(entry);
    } else {
      materials.add(material);
    }
  });
  return materials;
}

function objectGeometries(root: THREE.Object3D): Set<THREE.BufferGeometry> {
  const geometries = new Set<THREE.BufferGeometry>();
  root.traverse((object) => {
    const geometry = (object as THREE.Mesh).geometry;
    if (geometry) geometries.add(geometry);
  });
  return geometries;
}

function materialTextures(material: THREE.Material): Set<THREE.Texture> {
  const textures = new Set<THREE.Texture>();
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) textures.add(value);
  }
  return textures;
}

/** Dispose resources owned by a procedural scene subtree. */
export function disposeObjectResources(
  root: THREE.Object3D,
  options: { geometries?: boolean; materials?: boolean; textures?: boolean } = {},
): void {
  const materials = objectMaterials(root);
  const geometries = objectGeometries(root);
  if (options.textures) {
    const textures = new Set<THREE.Texture>();
    for (const material of materials) {
      for (const texture of materialTextures(material)) textures.add(texture);
    }
    for (const texture of textures) texture.dispose();
  }
  if (options.materials) for (const material of materials) material.dispose();
  if (options.geometries) for (const geometry of geometries) geometry.dispose();
}

/** Dispose only clone-owned materials, or all resources for an uncached fallback clone. */
export function disposeModelClone(root: THREE.Object3D): void {
  if (root.userData.tarnationResourcesDisposed === true) return;
  root.userData.tarnationResourcesDisposed = true;
  const sharedAsset = root.userData[SHARED_ASSET] === true;
  const materials = objectMaterials(root);
  if (sharedAsset) {
    disposeCloneOwnedMaterials(materials);
    const release = root.userData[RELEASE_SHARED_ASSET];
    delete root.userData[RELEASE_SHARED_ASSET];
    if (typeof release === 'function') release();
    return;
  }
  disposeObjectResources(root, { geometries: true, materials: true, textures: true });
}

export function disposeCloneOwnedMaterials(materials: Iterable<THREE.Material>): void {
  for (const material of materials) {
    if (asMaterialOwner(material) === 'clone') material.dispose();
  }
}
