import * as THREE from 'three';
import { cloneModel, loadModel, type ModelKey } from '../game/Assets';
import { disposeModelClone } from '../game/ResourceDisposal';
import { BoundedLruCache } from './ThumbnailCache';

type IconView = {
  rotationY: number;
  camera: [number, number, number];
  targetY: number;
  zoom?: number;
};

type CachedIcon = {
  thumbnail: HTMLCanvasElement;
  root: THREE.Object3D;
};

const ICON_RESOLUTION = 96;
export const MODEL_ICON_CACHE_LIMIT = 32;

// Tool silhouettes are much easier to read from their broad profile. The
// default three-quarter view makes the axe and shovel nearly edge-on because
// their heads are wide on X but very thin on Z.
const ICON_VIEWS: Partial<Record<ModelKey, IconView>> = {
  axe: { rotationY: 0, camera: [0, 1.05, 2.65], targetY: 0.48, zoom: 1.28 },
  shovel: { rotationY: 0, camera: [0, 1.05, 2.65], targetY: 0.48, zoom: 1.12 },
  shotgun_2: { rotationY: 0, camera: [0, 0.95, 2.85], targetY: 0.48, zoom: 0.68 },
  bow_wooden: { rotationY: 0, camera: [0, 1.05, 2.8], targetY: 0.5 },
};

const thumbnailCache = new BoundedLruCache<CachedIcon>(MODEL_ICON_CACHE_LIMIT);
const pending = new Map<ModelKey, Promise<HTMLCanvasElement | null>>();

let rendererState: {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
} | null = null;
let generation = 0;

function createRendererState() {
  if (rendererState) return rendererState;

  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(ICON_RESOLUTION, ICON_RESOLUTION, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xf3f0df, 0x26382f, 2.2));
  const key = new THREE.DirectionalLight(0xffe0b0, 3.2);
  key.position.set(2, 4, 3);
  scene.add(key);

  rendererState = {
    canvas,
    renderer,
    scene,
    camera: new THREE.PerspectiveCamera(24, 1, 0.01, 50),
  };
  return rendererState;
}

function copyThumbnail(source: HTMLCanvasElement): HTMLCanvasElement {
  const thumbnail = document.createElement('canvas');
  thumbnail.width = ICON_RESOLUTION;
  thumbnail.height = ICON_RESOLUTION;
  const context = thumbnail.getContext('2d');
  if (!context) throw new Error('The browser could not create a 2D icon canvas.');
  context.clearRect(0, 0, ICON_RESOLUTION, ICON_RESOLUTION);
  context.drawImage(source, 0, 0, ICON_RESOLUTION, ICON_RESOLUTION);
  return thumbnail;
}

async function renderThumbnail(model: ModelKey, requestGeneration: number): Promise<HTMLCanvasElement | null> {
  const cached = thumbnailCache.get(model);
  if (cached) return cached.thumbnail;
  await loadModel(model);
  if (requestGeneration !== generation) return null;

  const state = createRendererState();
  const { root } = cloneModel(model);
  const view = ICON_VIEWS[model];
  root.rotation.y = view?.rotationY ?? -0.55;
  state.scene.add(root);
  try {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const boundsSize = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(boundsSize);
    box.getCenter(center);
    root.position.x -= center.x;
    root.position.z -= center.z;
    const extent = Math.max(boundsSize.x, boundsSize.y, boundsSize.z, 0.2);
    const cameraPosition = view?.camera ?? [2.15, 1.35, 2.15];
    const iconZoom = view?.zoom ?? 1;
    state.camera.position.set(
      (extent * cameraPosition[0]) / iconZoom,
      (extent * cameraPosition[1]) / iconZoom,
      (extent * cameraPosition[2]) / iconZoom,
    );
    state.camera.lookAt(0, boundsSize.y * (view?.targetY ?? 0.42), 0);
    state.renderer.render(state.scene, state.camera);

    const thumbnail = copyThumbnail(state.canvas);
    const evicted = thumbnailCache.set(model, { thumbnail, root });
    if (evicted) disposeModelClone(evicted.root);
    return thumbnail;
  } finally {
    state.scene.remove(root);
  }
}

/** Resolve a bounded, cached thumbnail using the single shared icon renderer. */
export function getModelIconThumbnail(model: ModelKey): Promise<HTMLCanvasElement | null> {
  const cached = thumbnailCache.get(model);
  if (cached) return Promise.resolve(cached.thumbnail);
  const existing = pending.get(model);
  if (existing) return existing;
  const requestGeneration = generation;
  const task = renderThumbnail(model, requestGeneration)
    .catch((error: unknown) => {
      console.warn(`[ModelIcon] Could not render ${model}:`, error);
      return null;
    })
    .finally(() => {
      if (pending.get(model) === task) pending.delete(model);
    });
  pending.set(model, task);
  return task;
}

export function paintModelIcon(canvas: HTMLCanvasElement, thumbnail: HTMLCanvasElement, size: number): void {
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.drawImage(thumbnail, 0, 0, ICON_RESOLUTION, ICON_RESOLUTION, 0, 0, size, size);
}

/** Release cached thumbnail canvases and the one shared WebGL context. */
export function disposeModelIconRenderer(): void {
  generation++;
  pending.clear();
  for (const icon of thumbnailCache.clear()) {
    icon.thumbnail.width = 0;
    icon.thumbnail.height = 0;
    disposeModelClone(icon.root);
  }
  if (!rendererState) return;
  rendererState.scene.clear();
  rendererState.renderer.dispose();
  rendererState.canvas.width = 0;
  rendererState.canvas.height = 0;
  rendererState = null;
}
