/**
 * Standalone presentation audit for the active catalog and authored props.
 *
 * Run: npm run dev → http://localhost:5173/picker.html
 * The picker uses the same manifest loader, lighting profile, target heights,
 * shadows, and authored presentation builders as the game world.
 */
import * as THREE from 'three';
import {
  MODEL_LOAD_GROUPS,
  type ModelKey,
} from './content/models';
import {
  assetDefinition,
  fixtureAssets,
  shopAssets,
  type AuthoredVisual,
} from './content/purchasables';
import { cloneModel, initAssetLoaders, preloadGroup } from './game/Assets';
import { buildMarketStall } from './game/MarketStall';
import { buildAuthoredVisual } from './game/PresentationProps';
import { standardMaterial } from './game/materials';

type PickerVisual = AuthoredVisual | 'market-stall';

type PickerEntry = {
  label: string;
  modelKey: ModelKey | null;
  visual?: PickerVisual;
  detail: string;
};

function assetEntry(id: string): PickerEntry | null {
  const asset = assetDefinition(id);
  if (!asset) return null;
  return {
    label: asset.displayName,
    modelKey: asset.modelKey,
    visual: asset.authoredVisual,
    detail: `${asset.footprint.width}×${asset.footprint.height} footprint · ${asset.useType}`,
  };
}

const SOLD_ENTRIES = shopAssets()
  .map((asset) => assetEntry(asset.id))
  .filter((entry): entry is PickerEntry => entry !== null);

const FIXTURE_ENTRIES = fixtureAssets()
  .map((asset) => assetEntry(asset.id))
  .filter((entry): entry is PickerEntry => entry !== null);

const ENTRIES: readonly PickerEntry[] = [
  { label: 'Market Stall', modelKey: null, visual: 'market-stall', detail: 'Authored world prop · player-facing selling point' },
  ...SOLD_ENTRIES,
  { label: 'Bucket', modelKey: null, visual: 'bucket', detail: 'Authored held prop · 1×1 tool footprint' },
  ...FIXTURE_ENTRIES,
];

const grid = document.getElementById('grid');
if (!grid) throw new Error('Picker grid element is missing');

const views: Array<() => void> = [];
let lastFrameTime = performance.now();
let frameDelta = 0;
const loadingCanvas = document.createElement('canvas');
loadingCanvas.width = 1;
loadingCanvas.height = 1;
const loadingRenderer = new THREE.WebGLRenderer({ canvas: loadingCanvas, antialias: false });

function buildEntryRoot(entry: PickerEntry): THREE.Object3D {
  if (entry.visual === 'market-stall') return buildMarketStall();
  if (entry.visual) return buildAuthoredVisual(entry.visual);
  if (!entry.modelKey) throw new Error(`Picker entry has no visual source: ${entry.label}`);
  return cloneModel(entry.modelKey).root;
}

async function setupView(canvas: HTMLCanvasElement, entry: PickerEntry): Promise<void> {
  await assetsReady;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x4a6b33, 1.1));
  const key = new THREE.DirectionalLight(0xfff2d0, 2.2);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb0d8, 0.5);
  rim.position.set(4, 3, -5);
  scene.add(rim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 12),
    standardMaterial(0x304531, { roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const root = buildEntryRoot(entry);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  root.position.set(-centre.x, -box.min.y, -centre.z);
  scene.add(root);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const targetY = Math.max(size.y * 0.45, 0.15);
  const extent = Math.max(size.x, size.y, size.z, 0.6);
  const distance = Math.max(2.2, extent * 2.8);
  camera.position.set(distance * 0.78, targetY + distance * 0.72, distance * 0.78);
  camera.lookAt(0, targetY, 0);

  let dragging = false;
  let lastX = 0;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
  });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (event) => {
    if (!dragging) return;
    root.rotation.y += (event.clientX - lastX) * 0.01;
    lastX = event.clientX;
  });

  views.push(() => {
    if (!dragging) root.rotation.y += frameDelta * 0.35;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  });
}

const assetsReady = (async () => {
  initAssetLoaders(loadingRenderer);
  for (const group of Object.keys(MODEL_LOAD_GROUPS) as (keyof typeof MODEL_LOAD_GROUPS)[]) {
    await preloadGroup(group);
  }
  const status = document.getElementById('status');
  if (status) status.textContent = `Loaded ${ENTRIES.length} active presentation views`;
})();

for (const entry of ENTRIES) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  const canvas = document.createElement('canvas');
  const label = document.createElement('div');
  label.className = 'name';
  label.textContent = entry.label;
  const detail = document.createElement('div');
  detail.className = 'detail';
  detail.textContent = entry.detail;
  cell.append(canvas, label, detail);
  grid.append(cell);
  void setupView(canvas, entry);
}

(function loop(): void {
  requestAnimationFrame((timestamp) => {
    frameDelta = Math.min(Math.max((timestamp - lastFrameTime) / 1000, 0), 0.1);
    lastFrameTime = timestamp;
    for (const view of views) view();
    loop();
  });
})();
