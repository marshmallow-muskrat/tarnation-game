/**
 * Standalone asset preview grid. Renders every .glb listed in MANIFEST using the
 * game's own lighting rig, so what you see here is what you get in-game.
 *
 * Run:  npm run dev  →  http://localhost:5173/picker.html
 * To preview a different set, drop .glb files in public/preview/ and list them below.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MANIFEST: string[] = [
  'Cowboy_Male', 'Cowboy_Female', 'Worker_Male', 'Worker_Female',
  'Casual_Male', 'Casual_Female', 'Casual2_Male', 'Casual3_Male',
  'OldClassy_Male', 'OldClassy_Female', 'Chef_Male', 'Viking_Male',
  'Witch', 'Wizard',
];

const grid = document.getElementById('grid')!;
const loader = new GLTFLoader();
const clock = new THREE.Clock();
const views: Array<() => void> = [];

for (const name of MANIFEST) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  const canvas = document.createElement('canvas');
  const label = document.createElement('div');
  label.className = 'name';
  label.textContent = name;
  cell.append(canvas, label);
  grid.append(cell);
  void setupView(canvas, name);
}

async function setupView(canvas: HTMLCanvasElement, name: string): Promise<void> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  // Game's rig, minus the hero light.
  scene.add(new THREE.HemisphereLight(0xbfe0ff, 0x4a6b33, 1.1));
  const key = new THREE.DirectionalLight(0xfff2d0, 2.2);
  key.position.set(-3, 6, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb0d8, 0.5);
  rim.position.set(4, 3, -5);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);

  let gltf;
  try {
    gltf = await loader.loadAsync(`preview/${name}.glb`);
  } catch {
    return;
  }
  const root = gltf.scene;

  // Normalise: centre on origin, scale so height is 1, sit on the floor.
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(centre);
  const s = 1 / Math.max(size.y, 0.001);
  root.scale.setScalar(s);
  root.position.set(-centre.x * s, -box.min.y * s, -centre.z * s);
  pivot.add(root);

  camera.position.set(0, 0.62, 2.35);
  camera.lookAt(0, 0.5, 0);

  // Idle clip if there is one — shows the character alive rather than in T-pose.
  const mixer = new THREE.AnimationMixer(root);
  const idle = gltf.animations.find((c) => /idle/i.test(c.name)) ?? gltf.animations[0];
  if (idle) mixer.clipAction(idle).play();

  let dragging = false;
  let lastX = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    pivot.rotation.y += (e.clientX - lastX) * 0.01;
    lastX = e.clientX;
  });

  views.push(() => {
    const dt = clock.getDelta();
    mixer.update(dt);
    if (!dragging) pivot.rotation.y += dt * 0.5;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  });
}

(function loop() {
  requestAnimationFrame(loop);
  clock.getDelta();
  for (const v of views) v();
})();
