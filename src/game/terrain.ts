import * as THREE from 'three';
import {
  FARM_COLORS,
  HOMESTEAD_MAX_X,
  HOMESTEAD_MAX_Z,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  LAKE_CX,
  LAKE_CZ,
  LAKE_RADIUS,
  WORLD_SIZE,
} from '../content';
import { standardMaterial, waterMaterial } from './materials';
import { fbm2D, hash2, lerp, smoothstep, valueNoise2D } from './noise';

export const TERRAIN_SEED = 0x7a24_0104;

const GREEN_A = new THREE.Color(FARM_COLORS.floorA);
const GREEN_B = new THREE.Color(FARM_COLORS.floorB);
const GREEN_C = new THREE.Color(FARM_COLORS.floorC);
const GREEN_D = new THREE.Color(FARM_COLORS.floorD);

export type TerrainSystem = {
  mesh: THREE.Mesh;
  riverMesh: THREE.Mesh;
  lakeMesh: THREE.Mesh;
  bankScatter: THREE.Group;
  riverCurve: THREE.CatmullRomCurve3;
  /** Sample final height at world xz */
  heightAt: (x: number, z: number) => number;
  /** Distance to nearest water surface (river or lake) */
  distToWater: (x: number, z: number) => number;
  /** Animate water (call each frame) */
  updateWater: (t: number, dt: number) => void;
};

function buildRiverCurve(): THREE.CatmullRomCurve3 {
  // Start west edge, meander across, end at lake
  const raw: THREE.Vector3[] = [
    new THREE.Vector3(-4, 0, 70),
    new THREE.Vector3(30, 0, 78),
    new THREE.Vector3(55, 0, 92),
    new THREE.Vector3(80, 0, 88),
    new THREE.Vector3(105, 0, 75),
    new THREE.Vector3(125, 0, 82),
    new THREE.Vector3(145, 0, 95),
    new THREE.Vector3(155, 0, 100),
    new THREE.Vector3(LAKE_CX - 8, 0, LAKE_CZ + 2),
    new THREE.Vector3(LAKE_CX, 0, LAKE_CZ),
  ];

  // Perpendicular meander offsets
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i]!.clone();
    if (i > 0 && i < raw.length - 1) {
      const prev = raw[i - 1]!;
      const next = raw[i + 1]!;
      const dx = next.x - prev.x;
      const dz = next.z - prev.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len;
      const pz = dx / len;
      const n = (valueNoise2D(p.x, p.z, 18, TERRAIN_SEED ^ 0x51) - 0.5) * 2;
      const n2 = (valueNoise2D(p.x + 40, p.z - 20, 9, TERRAIN_SEED ^ 0x99) - 0.5) * 2;
      const amp = 10 + n2 * 4;
      p.x += px * n * amp;
      p.z += pz * n * amp;
    }
    pts.push(p);
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
}

function riverWidthAt(t: number): number {
  // 3–7 units along length
  return 3 + 4 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2.3));
}

function distToCurve(
  curve: THREE.CatmullRomCurve3,
  x: number,
  z: number,
  samples = 80,
): { dist: number; t: number; width: number } {
  let best = Infinity;
  let bestT = 0;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPoint(t);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < best) {
      best = d;
      bestT = t;
    }
  }
  // refine
  const step = 1 / samples;
  for (let k = 0; k < 6; k++) {
    const t0 = Math.max(0, bestT - step);
    const t1 = Math.min(1, bestT + step);
    for (let j = 0; j <= 8; j++) {
      const t = t0 + ((t1 - t0) * j) / 8;
      const p = curve.getPoint(t);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < best) {
        best = d;
        bestT = t;
      }
    }
  }
  return { dist: best, t: bestT, width: riverWidthAt(bestT) };
}

function baseHeight(x: number, z: number): number {
  // Flatten homestead / farm
  if (
    x >= HOMESTEAD_MIN_X - 2 &&
    x <= HOMESTEAD_MAX_X + 2 &&
    z >= HOMESTEAD_MIN_Z - 2 &&
    z <= HOMESTEAD_MAX_Z + 2
  ) {
    const edge = Math.min(
      x - (HOMESTEAD_MIN_X - 2),
      HOMESTEAD_MAX_X + 2 - x,
      z - (HOMESTEAD_MIN_Z - 2),
      HOMESTEAD_MAX_Z + 2 - z,
    );
    const flat = smoothstep(0, 8, edge);
    const h = (fbm2D(x, z, TERRAIN_SEED) - 0.5) * 2.4;
    return h * (1 - flat * 0.92);
  }
  return (fbm2D(x, z, TERRAIN_SEED) - 0.5) * 2.4; // ±1.2
}

function lakeCarve(x: number, z: number): number {
  const dx = x - LAKE_CX;
  const dz = z - LAKE_CZ;
  // noise-perturbed rim
  const ang = Math.atan2(dz, dx);
  const rim =
    LAKE_RADIUS *
    (0.92 + 0.12 * valueNoise2D(Math.cos(ang) * 10, Math.sin(ang) * 10, 1, TERRAIN_SEED ^ 0x1a));
  const d = Math.hypot(dx, dz);
  if (d > rim * 1.35) return 0;
  const t = smoothstep(rim * 1.35, rim * 0.55, d);
  return t * 2.4; // how much to lower
}

function riverCarve(
  curve: THREE.CatmullRomCurve3,
  x: number,
  z: number,
): number {
  const { dist, width } = distToCurve(curve, x, z);
  const bank = width * 1.6;
  if (dist > bank) return 0;
  const t = 1 - smoothstep(0, bank, dist);
  // deeper in center
  return t * t * (1.1 + width * 0.12);
}

const GREEN_DARK = new THREE.Color(0x3f6428);
const GREEN_PALE = new THREE.Color(0x8fbc5c);

function vertexColor(x: number, z: number, h: number, out: THREE.Color): void {
  const n = fbm2D(x * 1.3, z * 1.3, TERRAIN_SEED ^ 0x33);
  const hNorm = smoothstep(-1.0, 1.0, h);
  out.copy(GREEN_A).lerp(GREEN_B, n);
  out.lerp(GREEN_C, hNorm * 0.55);
  out.lerp(GREEN_D, (1 - n) * 0.35);

  // fbm bottoms out around 21-unit cells, and the four base greens sit within ~15%
  // lightness of each other — across one screen that reads as a single flat colour.
  // Two finer, wider-contrast layers give the ground visible patchiness at the scale
  // the player actually sees.
  const patch = valueNoise2D(x, z, 6.5, TERRAIN_SEED ^ 0x5c1);
  out.lerp(GREEN_DARK, smoothstep(0.62, 1.0, patch) * 0.5);
  out.lerp(GREEN_PALE, smoothstep(0.38, 0.0, patch) * 0.38);
  const grain = valueNoise2D(x, z, 2.2, TERRAIN_SEED ^ 0xa71);
  out.offsetHSL(0, 0, (grain - 0.5) * 0.055);
  // slightly browner near water (lower)
  if (h < -0.35) {
    out.lerp(new THREE.Color(0x5a6a40), smoothstep(-0.35, -1.2, h));
  }
  // homestead lawn slightly greener
  if (
    x >= HOMESTEAD_MIN_X &&
    x <= HOMESTEAD_MAX_X &&
    z >= HOMESTEAD_MIN_Z &&
    z <= HOMESTEAD_MAX_Z
  ) {
    out.lerp(new THREE.Color(0x6fa84b), 0.25);
  }
}

function buildRiverRibbon(
  curve: THREE.CatmullRomCurve3,
  segs = 120,
  halfWidthSamples = 5,
): { geometry: THREE.BufferGeometry; basePositions: Float32Array } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t).normalize();
    const nx = -tan.z;
    const nz = tan.x;
    const w = riverWidthAt(t) * 0.5;
    // left and right
    positions.push(p.x + nx * w, -0.15, p.z + nz * w);
    positions.push(p.x - nx * w, -0.15, p.z - nz * w);
    uvs.push(t * 8, 0);
    uvs.push(t * 8, 1);
    if (i < segs) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  const posArr = new Float32Array(positions);
  geometry.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  void halfWidthSamples;
  return { geometry, basePositions: posArr.slice() };
}

function buildLakeGeometry(): THREE.BufferGeometry {
  const segs = 48;
  const positions: number[] = [0, -0.12, 0]; // center later offset
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const n = 0.9 + 0.12 * valueNoise2D(Math.cos(a) * 8, Math.sin(a) * 8, 1, TERRAIN_SEED ^ 0x77);
    const r = LAKE_RADIUS * n;
    positions.push(Math.cos(a) * r, -0.12, Math.sin(a) * r);
    uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    if (i < segs) {
      indices.push(0, i + 1, i + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function dressBanks(
  curve: THREE.CatmullRomCurve3,
  heightAt: (x: number, z: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = standardMaterial(FARM_COLORS.stone, { roughness: 0.92, flatShading: true });
  const reedMat = standardMaterial(FARM_COLORS.reed, { roughness: 0.9, flatShading: true });

  const stoneGeo = new THREE.OctahedronGeometry(0.14, 0);
  const reedGeo = new THREE.ConeGeometry(0.06, 0.55, 4);

  // Pre-count
  const maxStones = 400;
  const maxReeds = 500;
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, maxStones);
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, maxReeds);
  stones.castShadow = true;
  stones.receiveShadow = true;
  reeds.castShadow = true;
  stones.count = 0;
  reeds.count = 0;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();

  let si = 0;
  let ri = 0;
  for (let i = 0; i < 220; i++) {
    const t = i / 220;
    const base = curve.getPoint(t);
    const tan = curve.getTangent(t).normalize();
    const nx = -tan.z;
    const nz = tan.x;
    const w = riverWidthAt(t);

    for (const side of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        if (si >= maxStones) break;
        const along = (hash2(i, k + side * 3, 11) - 0.5) * 0.8;
        const out = w * 0.55 + 0.4 + hash2(i, k, 22) * 1.4;
        const x = base.x + nx * side * out + tan.x * along;
        const z = base.z + nz * side * out + tan.z * along;
        if (x < 2 || z < 2 || x > WORLD_SIZE - 2 || z > WORLD_SIZE - 2) continue;
        // skip dense homestead core
        if (
          x > HOMESTEAD_MIN_X + 10 &&
          x < HOMESTEAD_MAX_X - 10 &&
          z > HOMESTEAD_MIN_Z + 12 &&
          z < HOMESTEAD_MAX_Z - 8
        )
          continue;
        const y = heightAt(x, z);
        const sc = 0.7 + hash2(i, k, 33) * 0.9;
        p.set(x, y + 0.05 * sc, z);
        e.set(0, hash2(i, k, 44) * Math.PI * 2, 0);
        q.setFromEuler(e);
        s.set(sc, sc * (0.7 + hash2(i, k, 55) * 0.5), sc);
        m.compose(p, q, s);
        stones.setMatrixAt(si++, m);
      }
      for (let k = 0; k < 2; k++) {
        if (ri >= maxReeds) break;
        const out = w * 0.5 + 0.2 + hash2(i, k + 9, 66) * 1.1;
        const x = base.x + nx * side * out;
        const z = base.z + nz * side * out;
        if (x < 2 || z < 2 || x > WORLD_SIZE - 2 || z > WORLD_SIZE - 2) continue;
        if (
          x > HOMESTEAD_MIN_X + 10 &&
          x < HOMESTEAD_MAX_X - 10 &&
          z > HOMESTEAD_MIN_Z + 12 &&
          z < HOMESTEAD_MAX_Z - 8
        )
          continue;
        const y = heightAt(x, z);
        const sc = 0.8 + hash2(i, k, 77) * 0.6;
        p.set(x, y + 0.25 * sc, z);
        e.set(0, hash2(i, k, 88) * Math.PI * 2, 0);
        q.setFromEuler(e);
        s.set(sc, sc, sc);
        m.compose(p, q, s);
        reeds.setMatrixAt(ri++, m);
      }
    }
  }

  // Lake shore denser
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    const n = 0.95 + 0.1 * hash2(i, 1, 99);
    const r = LAKE_RADIUS * n + 0.8 + hash2(i, 2, 100) * 2.5;
    const x = LAKE_CX + Math.cos(a) * r;
    const z = LAKE_CZ + Math.sin(a) * r;
    if (x < 2 || z < 2 || x > WORLD_SIZE - 2 || z > WORLD_SIZE - 2) continue;
    const y = heightAt(x, z);
    if (si < maxStones) {
      const sc = 0.8 + hash2(i, 3, 101) * 1.0;
      p.set(x, y + 0.04, z);
      e.set(0, hash2(i, 4, 102) * 6, 0);
      q.setFromEuler(e);
      s.set(sc, sc * 0.7, sc);
      m.compose(p, q, s);
      stones.setMatrixAt(si++, m);
    }
    if (ri < maxReeds && i % 1 === 0) {
      const sc = 0.9 + hash2(i, 5, 103) * 0.5;
      p.set(x + (hash2(i, 6, 104) - 0.5), y + 0.28, z + (hash2(i, 7, 105) - 0.5));
      e.set(0, hash2(i, 8, 106) * 6, 0);
      q.setFromEuler(e);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      reeds.setMatrixAt(ri++, m);
    }
  }

  stones.count = si;
  reeds.count = ri;
  stones.instanceMatrix.needsUpdate = true;
  reeds.instanceMatrix.needsUpdate = true;
  group.add(stones, reeds);
  return group;
}

/**
 * Build 240×240 terrain with river/lake carving, water meshes, bank dressing.
 */
export function buildTerrain(): TerrainSystem {
  const curve = buildRiverCurve();
  const segs = 240;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();

  // Shift plane from centered to [0, WORLD_SIZE]
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + WORLD_SIZE / 2;
    const z = pos.getZ(i) + WORLD_SIZE / 2;
    pos.setX(i, x);
    pos.setZ(i, z);

    let h = baseHeight(x, z);
    h -= riverCarve(curve, x, z);
    h -= lakeCarve(x, z);
    // Flatten homestead building pad
    if (
      x >= HOMESTEAD_MIN_X + 14 &&
      x <= HOMESTEAD_MAX_X - 14 &&
      z >= HOMESTEAD_MIN_Z + 16 &&
      z <= HOMESTEAD_MAX_Z - 10
    ) {
      h = lerp(h, 0, 0.9);
    }
    pos.setY(i, h);
    vertexColor(x, z, h, col);
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = standardMaterial(0xffffff, {
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
    vertexColors: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

  // Height field lookup via bilinear sample of grid
  const grid = segs + 1;
  const heights = new Float32Array(grid * grid);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const ix = Math.round((x / WORLD_SIZE) * segs);
    const iz = Math.round((z / WORLD_SIZE) * segs);
    heights[iz * grid + ix] = pos.getY(i);
  }

  const heightAt = (x: number, z: number): number => {
    const u = (x / WORLD_SIZE) * segs;
    const v = (z / WORLD_SIZE) * segs;
    const x0 = Math.floor(u);
    const z0 = Math.floor(v);
    if (x0 < 0 || z0 < 0 || x0 >= segs || z0 >= segs) return 0;
    const fx = u - x0;
    const fz = v - z0;
    const h00 = heights[z0 * grid + x0] ?? 0;
    const h10 = heights[z0 * grid + x0 + 1] ?? h00;
    const h01 = heights[(z0 + 1) * grid + x0] ?? h00;
    const h11 = heights[(z0 + 1) * grid + x0 + 1] ?? h00;
    return lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fz);
  };

  const distToWater = (x: number, z: number): number => {
    const lake = Math.hypot(x - LAKE_CX, z - LAKE_CZ) - LAKE_RADIUS * 0.95;
    const { dist, width } = distToCurve(curve, x, z, 100);
    const river = dist - width * 0.45;
    return Math.min(lake, river);
  };

  // River ribbon
  const { geometry: riverGeo, basePositions } = buildRiverRibbon(curve);
  // Set Y from terrain slightly below bank
  {
    const rp = riverGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) {
      const x = rp.getX(i);
      const z = rp.getZ(i);
      // water sits in carved channel
      const y = Math.min(heightAt(x, z) - 0.08, -0.05);
      rp.setY(i, y);
      basePositions[i * 3 + 1] = y;
    }
    riverGeo.computeVertexNormals();
  }
  const wMat = waterMaterial();
  // Use a small canvas texture so we can scroll offset for flow
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, '#2a6569');
  grd.addColorStop(0.5, '#3a8a90');
  grd.addColorStop(1, '#2a6569');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 16);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1);
  wMat.map = tex;
  wMat.needsUpdate = true;

  const riverMesh = new THREE.Mesh(riverGeo, wMat);
  riverMesh.receiveShadow = true;

  const lakeGeo = buildLakeGeometry();
  // Position lake mesh at lake center; Y from terrain
  {
    const lp = lakeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) {
      const lx = lp.getX(i) + LAKE_CX;
      const lz = lp.getZ(i) + LAKE_CZ;
      const y = Math.min(heightAt(lx, lz) - 0.05, -0.08);
      lp.setY(i, y);
    }
    lakeGeo.translate(LAKE_CX, 0, LAKE_CZ);
    lakeGeo.computeVertexNormals();
  }
  const lakeMat = waterMaterial();
  lakeMat.map = tex;
  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.receiveShadow = true;

  const bankScatter = dressBanks(curve, heightAt);

  const updateWater = (t: number, _dt: number): void => {
    tex.offset.x = (t * 0.08) % 1;
    // Subtle sine displacement along river
    const rp = riverGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) {
      const baseY = basePositions[i * 3 + 1] ?? -0.1;
      const u = (riverGeo.attributes.uv as THREE.BufferAttribute).getX(i);
      rp.setY(i, baseY + Math.sin(t * 2.2 + u * 14) * 0.025);
    }
    rp.needsUpdate = true;
  };

  return {
    mesh,
    riverMesh,
    lakeMesh,
    bankScatter,
    riverCurve: curve,
    heightAt,
    distToWater,
    updateWater,
  };
}
