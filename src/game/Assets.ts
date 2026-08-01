import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  modelDef,
  modelKeysForLoadGroup,
  type AssetLoadGroup,
  type ModelKey,
} from '../content/models';

// Model definitions live in src/content/models.ts. Adding an asset is a data edit
// there, never a code edit here.
export type { ModelKey } from '../content/models';

type CacheEntry = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  isFallback: boolean;
};

export type AssetLoadProgress = {
  group: AssetLoadGroup;
  loaded: number;
  total: number;
  fallbackKeys: readonly ModelKey[];
  complete: boolean;
};

export type AssetLoadReport = Omit<AssetLoadProgress, 'complete'> & { complete: true };

export const ASSET_LOAD_CONCURRENCY = 4;
const ASSET_LOAD_ORDER = ['boot', 'first_play', 'nearby', 'catalog', 'optional'] as const satisfies readonly AssetLoadGroup[];

const logged = new Set<string>();
const cache = new Map<ModelKey, CacheEntry>();
const loader = new GLTFLoader();

function logOnce(key: string, msg: string): void {
  if (logged.has(key)) return;
  logged.add(key);
  console.warn(`[Assets] ${msg}`);
}

function matStd(c: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: c, roughness: 0.86, metalness: 0.04 });
}

function fallbackFor(key: ModelKey): THREE.Object3D {
  const g = new THREE.Group();

  switch (key) {
    case 'player': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), matStd(0xe8d9b0));
      body.position.y = 0.65;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      break;
    }
    case 'fox': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 4, 8), matStd(0x8b5e3c));
      body.rotation.z = Math.PI / 2;
      body.rotation.x = THREE.MathUtils.degToRad(25);
      body.position.y = 0.22;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      break;
    }
    default: {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), matStd(0x888888));
      box.position.y = 0.2;
      box.castShadow = true;
      box.receiveShadow = true;
      g.add(box);
    }
  }
  return g;
}

function enableShadows(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

function groundFeet(root: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y;
}

function scaleToHeight(root: THREE.Object3D, targetH: number): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y > 0.01) {
    root.scale.multiplyScalar(targetH / size.y);
  }
  groundFeet(root);
}

/**
 * Tint a model without destroying it. Replacing materials outright throws away the
 * baked textures and vertex colours that give these models their detail, leaving a
 * featureless blob. Clone the original and multiply its colour instead.
 */
function tintMaterials(root: THREE.Object3D, tint: number, strength = 0.72): void {
  const t = new THREE.Color(tint);
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const src = Array.isArray(obj.material) ? obj.material : [obj.material];
    const out = src.map((m) => {
      const c = (m as THREE.Material).clone() as THREE.MeshStandardMaterial;
      if (c.color) c.color.lerp(t, strength);
      return c;
    });
    obj.material = out.length === 1 ? out[0]! : out;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
}

/** Unlit pure black, fog disabled — for anything that should read as a pure silhouette. */
function applySilhouetteMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.material = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
      obj.castShadow = true;
      obj.receiveShadow = false;
    }
  });
}

/** Manifest-driven treatment. No per-key switch — everything comes from ModelDef. */
function treatModel(key: ModelKey, root: THREE.Object3D): void {
  const def = modelDef(key);
  enableShadows(root);
  if (def.textureRepeat) {
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) {
        const map = (material as THREE.MeshStandardMaterial).map;
        if (!map) continue;
        map.wrapS = THREE.RepeatWrapping;
        map.wrapT = THREE.RepeatWrapping;
        map.needsUpdate = true;
      }
    });
  }
  if (def.height) scaleToHeight(root, def.height);
  if (def.animalScale) root.scale.multiplyScalar(def.animalScale);
  if (def.rotateX) root.rotation.x = THREE.MathUtils.degToRad(def.rotateX);
  if (def.silhouette) applySilhouetteMaterials(root);
  else if (def.tint !== undefined) tintMaterials(root, def.tint, def.tintStrength ?? 0.7);
}

/**
 * MUST be called with the live renderer before preloadAll().
 *
 * The KayKit models declare extensionsRequired:
 *   EXT_meshopt_compression, KHR_mesh_quantization, KHR_texture_basisu
 * A bare GLTFLoader throws on all three, which silently drops every model to its
 * primitive fallback. KTX2Loader also needs detectSupport(renderer) to pick a
 * transcode target for the GPU.
 */
export function initAssetLoaders(renderer: THREE.WebGLRenderer): void {
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ktx2 = new KTX2Loader().setTranscoderPath('basis/').detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
}

/**
 * Load one manifest group with a small fixed worker pool. A failed model is
 * still cached as a primitive fallback, so an optional art failure cannot block
 * the playable world; the report lets the UI offer a retry for critical groups.
 */
export async function preloadGroup(
  group: AssetLoadGroup,
  onProgress?: (progress: AssetLoadProgress) => void,
): Promise<AssetLoadReport> {
  const keys = modelKeysForLoadGroup(group);
  let next = 0;
  let loaded = 0;
  const fallbackKeys: ModelKey[] = [];
  const report = (complete: boolean): void => {
    onProgress?.({
      group,
      loaded,
      total: keys.length,
      fallbackKeys: [...fallbackKeys].sort(),
      complete,
    });
  };

  report(false);
  const worker = async (): Promise<void> => {
    while (true) {
      const index = next++;
      if (index >= keys.length) return;
      const key = keys[index]!;
      const entry = await loadModel(key);
      if (entry.isFallback) fallbackKeys.push(key);
      loaded++;
      report(false);
    }
  };

  const workerCount = Math.min(ASSET_LOAD_CONCURRENCY, keys.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  const finalFallbackKeys = [...fallbackKeys].sort();
  const result: AssetLoadReport = {
    group,
    loaded,
    total: keys.length,
    fallbackKeys: finalFallbackKeys,
    complete: true,
  };
  onProgress?.(result);
  return result;
}

/** Load every group in release order for callers that still need the old API. */
export async function preloadAll(
  onProgress?: (progress: AssetLoadProgress) => void,
): Promise<void> {
  for (const group of ASSET_LOAD_ORDER) await preloadGroup(group, onProgress);
}

export async function loadModel(key: ModelKey): Promise<CacheEntry> {
  const existing = cache.get(key);
  if (existing) return existing;

  const path = `models/${modelDef(key).path}`;
  try {
    const gltf = await loader.loadAsync(path);
    const scene = gltf.scene;
    treatModel(key, scene);
    const entry: CacheEntry = {
      scene,
      animations: gltf.animations ?? [],
      isFallback: false,
    };
    cache.set(key, entry);
    return entry;
  } catch (err) {
    logOnce(key, `missing or failed: ${path} — using primitive fallback — ${err}`);
    const scene = fallbackFor(key);
    treatModel(key, scene);
    const entry: CacheEntry = { scene, animations: [], isFallback: true };
    cache.set(key, entry);
    return entry;
  }
}

/** Drop only cached fallbacks so a later launch can retry failed network loads. */
export function resetFailedAssets(): number {
  let reset = 0;
  for (const [key, entry] of cache) {
    if (!entry.isFallback) continue;
    cache.delete(key);
    reset++;
  }
  return reset;
}

/** Whether a real model (rather than an uncached or primitive fallback) is ready. */
export function isModelReady(key: ModelKey): boolean {
  const entry = cache.get(key);
  return entry !== undefined && !entry.isFallback;
}

/** Clone a cached model for placement in the world. */
export function cloneModel(key: ModelKey): {
  root: THREE.Object3D;
  animations: THREE.AnimationClip[];
  isFallback: boolean;
} {
  const entry = cache.get(key);
  if (!entry) {
    const fb = fallbackFor(key);
    treatModel(key, fb);
    return { root: fb, animations: [], isFallback: true };
  }
  // SkeletonUtils.clone — Object3D.clone() does NOT rebind skinned meshes to the
  // cloned skeleton, so rigged glTF characters come out collapsed or invisible.
  const root = entry.isFallback ? entry.scene.clone(true) : skeletonClone(entry.scene);
  // Re-apply material treatment: clones share materials with the cached source.
  const def = modelDef(key);
  if (def.silhouette) applySilhouetteMaterials(root);
  else if (def.tint !== undefined) tintMaterials(root, def.tint, def.tintStrength ?? 0.7);
  enableShadows(root);
  return { root, animations: entry.animations, isFallback: entry.isFallback };
}

export function getTextureKey(_key: string): string | null {
  return null;
}

export type InstancedPart = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
};

/**
 * Meshopt/KHR quantization commonly stores positions and normals as normalized
 * integer attributes. BufferGeometry.applyMatrix4() mutates the backing array,
 * so transforming those attributes in place can overflow the integer range.
 * Convert the attributes that receive transforms to floats first.
 */
function dequantizeTransformAttributes(geometry: THREE.BufferGeometry): void {
  for (const name of ['position', 'normal', 'tangent'] as const) {
    const attr = geometry.getAttribute(name);
    if (!attr || (attr.array instanceof Float32Array && !attr.normalized)) continue;
    const values = new Float32Array(attr.count * attr.itemSize);
    for (let i = 0; i < attr.count; i++) {
      for (let c = 0; c < attr.itemSize; c++) values[i * attr.itemSize + c] = attr.getComponent(i, c);
    }
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, attr.itemSize));
  }
}

/**
 * Flatten a model into geometry/material pairs suitable for InstancedMesh.
 *
 * Scatter props render in the hundreds per chunk, so they must stay instanced —
 * individual meshes will not hold 60fps. A glTF is a hierarchy of meshes, so each
 * mesh's world matrix is baked into a cloned geometry and returned as its own part.
 * Callers create one InstancedMesh per part and write the same per-instance matrix
 * to all of them.
 *
 * Returns [] when the model is missing or is a primitive fallback, so callers can
 * keep their existing primitive path.
 */
export function instancedParts(key: ModelKey): InstancedPart[] {
  const entry = cache.get(key);
  if (!entry || entry.isFallback) return [];

  const parts: InstancedPart[] = [];
  entry.scene.updateMatrixWorld(true);
  entry.scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    const groups = obj.geometry.groups.length
      ? obj.geometry.groups
      : [{ start: 0, count: obj.geometry.index?.count ?? obj.geometry.attributes.position!.count, materialIndex: 0 }];
    for (const group of groups) {
      const geo = obj.geometry.clone();
      geo.clearGroups();
      geo.setDrawRange(group.start, group.count);
      dequantizeTransformAttributes(geo);
      geo.applyMatrix4(obj.matrixWorld);
      const mat = materials[group.materialIndex] ?? materials[0]!;
      parts.push({ geometry: geo, material: mat });
    }
  });
  return parts;
}
