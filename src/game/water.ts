import * as THREE from 'three';

/**
 * Water asset for the river and lake.
 *
 * Two procedurally drawn textures drive it: a colour map (depth bands + drifting
 * caustic blobs) and a matching normal map so the surface actually catches the key
 * light. Both scroll at different rates, which is what sells "moving water" far
 * better than the single scrolling gradient this replaced.
 */

const SIZE = 256;

function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  return { canvas, ctx: canvas.getContext('2d')! };
}

/** Deterministic 0..1 — no Math.random, so the water looks the same every session. */
function rnd(i: number, salt: number): number {
  let n = (Math.imul(i, 374761393) ^ Math.imul(salt, 668265263)) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function buildColorTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas();

  // Deep base, then broad lighter bands so shallows read differently from depth.
  ctx.fillStyle = '#1d5257';
  ctx.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 22; i++) {
    const y = rnd(i, 7) * SIZE;
    const h = 8 + rnd(i, 8) * 46;
    ctx.fillStyle = `rgba(84, 176, 176, ${0.05 + rnd(i, 9) * 0.09})`;
    ctx.fillRect(0, y, SIZE, h);
  }

  // Caustic cells — soft bright rings, the classic shallow-water shimmer.
  for (let i = 0; i < 120; i++) {
    const x = rnd(i, 11) * SIZE;
    const y = rnd(i, 12) * SIZE;
    const r = 6 + rnd(i, 13) * 26;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.06 + rnd(i, 14) * 0.14;
    g.addColorStop(0, `rgba(198, 246, 240, ${a})`);
    g.addColorStop(0.55, `rgba(140, 214, 210, ${a * 0.45})`);
    g.addColorStop(1, 'rgba(120, 200, 200, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thin foam streaks along the flow direction.
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 40; i++) {
    const y = rnd(i, 21) * SIZE;
    const x = rnd(i, 22) * SIZE;
    const len = 18 + rnd(i, 23) * 60;
    ctx.strokeStyle = `rgba(226, 250, 246, ${0.05 + rnd(i, 24) * 0.1})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len * 0.5, y + (rnd(i, 25) - 0.5) * 10, x + len, y);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function buildNormalTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas();
  // Flat normal = (0.5, 0.5, 1)
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Ripple crests: paired light/dark lobes tilt the normal left then right.
  for (let i = 0; i < 90; i++) {
    const x = rnd(i, 31) * SIZE;
    const y = rnd(i, 32) * SIZE;
    const r = 10 + rnd(i, 33) * 30;
    for (const [dx, color] of [
      [-r * 0.35, 'rgba(96, 128, 255, 0.55)'],
      [r * 0.35, 'rgba(168, 128, 255, 0.55)'],
    ] as const) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(128, 128, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + dx, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export interface WaterAsset {
  material: THREE.MeshStandardMaterial;
  /** Second layer, offset the other way, drawn just above the first. */
  overlayMaterial: THREE.MeshStandardMaterial;
  update: (t: number) => void;
}

/**
 * Build one shared water asset. `repeat` scales the texture against world units,
 * so the river (long and thin) and the lake (broad) can each pick a sane density.
 */
export function createWaterAsset(repeat: [number, number] = [6, 2]): WaterAsset {
  const color = buildColorTexture();
  const normal = buildNormalTexture();
  const colorB = color.clone();
  colorB.needsUpdate = true;
  const normalB = normal.clone();
  normalB.needsUpdate = true;

  const [rx, ry] = repeat;
  color.repeat.set(rx, ry);
  normal.repeat.set(rx, ry);
  colorB.repeat.set(rx * 0.58, ry * 0.65);
  normalB.repeat.set(rx * 0.58, ry * 0.65);

  const material = new THREE.MeshStandardMaterial({
    map: color,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    color: 0x9fd8d4,
    roughness: 0.16,
    metalness: 0.28,
    transparent: true,
    opacity: 0.9,
    // Both faces: the surface is viewed from above on the bank and from below when
    // the player wades in, and a one-sided quad simply vanishes from one of them.
    side: THREE.DoubleSide,
  });

  const overlayMaterial = new THREE.MeshStandardMaterial({
    map: colorB,
    normalMap: normalB,
    normalScale: new THREE.Vector2(0.5, 0.5),
    color: 0xbfeae2,
    roughness: 0.08,
    metalness: 0.45,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });

  const update = (t: number): void => {
    color.offset.set((t * 0.035) % 1, (Math.sin(t * 0.18) * 0.05) % 1);
    normal.offset.set((t * 0.05) % 1, (t * 0.012) % 1);
    colorB.offset.set((-t * 0.018) % 1, (t * 0.01) % 1);
    normalB.offset.set((-t * 0.03) % 1, (Math.cos(t * 0.2) * 0.04) % 1);
  };

  return { material, overlayMaterial, update };
}

/**
 * A soft ring of foam where water meets land. Built from the same shoreline points
 * the caller already has, so it hugs the noise-perturbed rim exactly.
 */
export function buildShoreFoam(
  points: { x: number; z: number; y: number }[],
  width = 0.9,
  cx = 0,
  cz = 0,
): THREE.Mesh | null {
  if (points.length < 3) return null;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const dx = p.x - cx;
    const dz = p.z - cz;
    const len = Math.hypot(dx, dz) || 1;
    positions.push(p.x, p.y + 0.012, p.z);
    positions.push(p.x + (dx / len) * width, p.y + 0.012, p.z + (dz / len) * width);
    uvs.push(0, 0, 1, 0);
    if (i < points.length - 1) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const { canvas, ctx } = makeCanvas();
  const grd = ctx.createLinearGradient(0, 0, SIZE, 0);
  grd.addColorStop(0, 'rgba(236, 252, 248, 0.85)');
  grd.addColorStop(0.45, 'rgba(214, 244, 238, 0.35)');
  grd.addColorStop(1, 'rgba(200, 236, 230, 0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}
