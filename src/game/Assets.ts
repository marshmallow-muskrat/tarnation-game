import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

export type ModelKey =
  | 'player'
  | 'weasel'
  | 'crop1'
  | 'crop2'
  | 'crop3'
  | 'tree_farm'
  | 'tree_woods'
  | 'house1'
  | 'house2'
  | 'stalker'
  | 'animal_a'
  | 'animal_b'
  | 'scatter';

const MODEL_PATHS: Record<ModelKey, string> = {
  player: 'models/player.glb',
  weasel: 'models/weasel.glb',
  crop1: 'models/crop1.glb',
  crop2: 'models/crop2.glb',
  crop3: 'models/crop3.glb',
  tree_farm: 'models/tree_farm.glb',
  tree_woods: 'models/tree_woods.glb',
  house1: 'models/house1.glb',
  house2: 'models/house2.glb',
  stalker: 'models/stalker.glb',
  animal_a: 'models/animal_a.glb',
  animal_b: 'models/animal_b.glb',
  scatter: 'models/scatter.glb',
};

type CacheEntry = {
  scene: THREE.Object3D;
  animations: THREE.AnimationClip[];
  isFallback: boolean;
};

const logged = new Set<string>();
const cache = new Map<ModelKey, CacheEntry>();
const loader = new GLTFLoader();

const WEASEL_BROWN = 0x8b5e3c;

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
    case 'weasel': {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.35, 4, 8), matStd(WEASEL_BROWN));
      body.rotation.z = Math.PI / 2;
      body.rotation.x = THREE.MathUtils.degToRad(25);
      body.position.y = 0.22;
      body.castShadow = true;
      body.receiveShadow = true;
      g.add(body);
      break;
    }
    case 'crop1':
    case 'crop2':
    case 'crop3': {
      const h = key === 'crop1' ? 0.25 : key === 'crop2' ? 0.45 : 0.7;
      const c = key === 'crop3' ? 0xe8c33a : 0xc4d64a;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.12, h, 6), matStd(c));
      m.position.y = h / 2;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      break;
    }
    case 'tree_farm': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.9, 6), matStd(0x5a3a22));
      trunk.position.y = 0.45;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 7), matStd(0x3d6b35));
      crown.position.y = 1.25;
      crown.castShadow = true;
      crown.receiveShadow = true;
      g.add(trunk, crown);
      break;
    }
    case 'tree_woods': {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.2, 5), matStd(0x2a2218));
      trunk.position.y = 0.6;
      trunk.castShadow = true;
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 5), matStd(0x1e2824));
      crown.position.y = 1.4;
      crown.castShadow = true;
      g.add(trunk, crown);
      break;
    }
    case 'house1': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.4), matStd(0x9a6b42));
      base.position.y = 0.5;
      base.castShadow = true;
      base.receiveShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.2, 0.7, 4), matStd(0x7a4e2e));
      roof.position.y = 1.25;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      g.add(base, roof);
      break;
    }
    case 'house2': {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.8), matStd(0x9a6b42));
      base.position.y = 0.65;
      base.castShadow = true;
      base.receiveShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.9, 4), matStd(0x7a4e2e));
      roof.position.y = 1.55;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      g.add(base, roof);
      break;
    }
    case 'stalker': {
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.3, 0.9, 4, 8),
        new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }),
      );
      body.position.y = 0.75;
      body.castShadow = true;
      g.add(body);
      break;
    }
    case 'animal_a':
    case 'animal_b': {
      const c = key === 'animal_a' ? 0x8a6a4a : 0x6a7a5a;
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 4, 8), matStd(c));
      body.position.y = 0.5;
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

/** Brown weasel materials. */
function applyWeaselMaterials(root: THREE.Object3D): void {
  tintMaterials(root, WEASEL_BROWN, 0.72);
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

/** Woodsman: pure black unlit, fog false. */
function applyWoodsmanMaterials(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.material = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
      obj.castShadow = true;
      obj.receiveShadow = false;
    }
  });
}

function applyAnimalMaterials(root: THREE.Object3D, color: number): void {
  tintMaterials(root, color, 0.55);
}

/** Key-specific pose / material treatment after load or clone. */
function treatModel(key: ModelKey, root: THREE.Object3D): void {
  enableShadows(root);

  switch (key) {
    case 'player':
      scaleToHeight(root, 1.55);
      break;
    case 'weasel':
      scaleToHeight(root, 0.55);
      // ~0.45 overall + pitch forward ~25° so it runs low
      root.scale.multiplyScalar(0.45 / 0.55);
      root.rotation.x = THREE.MathUtils.degToRad(25);
      applyWeaselMaterials(root);
      groundFeet(root);
      break;
    case 'stalker':
      scaleToHeight(root, 1.75);
      applyWoodsmanMaterials(root);
      break;
    case 'animal_a':
      scaleToHeight(root, 1.1);
      applyAnimalMaterials(root, 0x8a6a4a);
      break;
    case 'animal_b':
      scaleToHeight(root, 1.0);
      applyAnimalMaterials(root, 0x6a7a5a);
      break;
    default:
      break;
  }
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

/** Load all known keys (missing files become fallbacks). */
export async function preloadAll(): Promise<void> {
  await Promise.all((Object.keys(MODEL_PATHS) as ModelKey[]).map((k) => loadModel(k)));
}

export async function loadModel(key: ModelKey): Promise<CacheEntry> {
  const existing = cache.get(key);
  if (existing) return existing;

  const path = MODEL_PATHS[key];
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
  if (key === 'weasel') applyWeaselMaterials(root);
  if (key === 'stalker') applyWoodsmanMaterials(root);
  if (key === 'animal_a') applyAnimalMaterials(root, 0x8a6a4a);
  if (key === 'animal_b') applyAnimalMaterials(root, 0x6a7a5a);
  enableShadows(root);
  return { root, animations: entry.animations, isFallback: entry.isFallback };
}

export function getTextureKey(_key: string): string | null {
  return null;
}
