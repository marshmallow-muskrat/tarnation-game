import * as THREE from 'three';
import {
  FARM_COLORS,
  GRID_H,
  GRID_W,
  HOMESTEAD_MAX_X,
  HOMESTEAD_MAX_Z,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  LAKE_CX,
  LAKE_CZ,
  LAKE_RADIUS,
  WORLD_SIZE,
} from '../content';
import { standardMaterial } from './materials';
import { fbm2D, hash2, lerp, smoothstep, valueNoise2D } from './noise';
import { buildStreamSpecs, StreamField } from './streams';
import { buildShoreFoam, createWaterAsset } from './water';

export const TERRAIN_SEED = 0x7a24_0104;

const GREEN_A = new THREE.Color(FARM_COLORS.floorA);
const GREEN_B = new THREE.Color(FARM_COLORS.floorB);
const GREEN_C = new THREE.Color(FARM_COLORS.floorC);
const GREEN_D = new THREE.Color(FARM_COLORS.floorD);

/** Per-tile soil state the terrain paints into its own vertex colours. */
export const SOIL_NONE = 0;
export const SOIL_TILLED = 1;
export const SOIL_WATERED = 2;

export type TerrainSystem = {
  mesh: THREE.Mesh;
  /** River, creeks, lake, their shimmer overlays and shoreline foam. */
  water: THREE.Group;
  bankScatter: THREE.Group;
  streams: StreamField;
  /** Sample final height at world xz */
  heightAt: (x: number, z: number) => number;
  /** Distance to nearest water surface (streams or lake) */
  distToWater: (x: number, z: number) => number;
  /** Animate water (call each frame) */
  updateWater: (t: number, dt: number) => void;
  /**
   * Repaint worked ground straight into the terrain's vertex colours.
   * `mask` is GRID_W × GRID_H of SOIL_* values, row-major.
   */
  applySoilMask: (mask: Uint8Array) => void;
};

const LAKE_WIDEN = 1.14;
const RIVER_WIDEN = 1.16;
const LAKE_FLOOR = -3.4;

/** Noise-perturbed lake rim radius at angle a — shared by surface and foam. */
function lakeRimRadius(a: number): number {
  const n = 0.9 + 0.12 * valueNoise2D(Math.cos(a) * 8, Math.sin(a) * 8, 1, TERRAIN_SEED ^ 0x77);
  return LAKE_RADIUS * n;
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

/**
 * Water bodies are flattened *into* the terrain, not just subtracted from it —
 * with ±1.2 of ground noise, a fixed carve leaves a bed too rough for a flat
 * surface to sit in, and the water ends up buried.
 */
function lakeBasin(x: number, z: number): number {
  const dx = x - LAKE_CX;
  const dz = z - LAKE_CZ;
  const ang = Math.atan2(dz, dx);
  const rim =
    LAKE_RADIUS *
    (0.92 + 0.12 * valueNoise2D(Math.cos(ang) * 10, Math.sin(ang) * 10, 1, TERRAIN_SEED ^ 0x1a));
  const d = Math.hypot(dx, dz);
  if (d > rim * 1.3) return 0;
  return smoothstep(rim * 1.3, rim * 0.65, d);
}

/** Channel depth scales with width, so creeks are shallow and the river is not. */
function channelDepth(width: number): number {
  return 0.45 + width * 0.15;
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
  const patch = valueNoise2D(x, z, 6.5, TERRAIN_SEED ^ 0x5c1);
  out.lerp(GREEN_DARK, smoothstep(0.62, 1.0, patch) * 0.5);
  out.lerp(GREEN_PALE, smoothstep(0.38, 0.0, patch) * 0.38);
  const grain = valueNoise2D(x, z, 2.2, TERRAIN_SEED ^ 0xa71);
  out.offsetHSL(0, 0, (grain - 0.5) * 0.055);
  if (h < -0.35) {
    out.lerp(new THREE.Color(0x5a6a40), smoothstep(-0.35, -1.2, h));
  }
  if (
    x >= HOMESTEAD_MIN_X &&
    x <= HOMESTEAD_MAX_X &&
    z >= HOMESTEAD_MIN_Z &&
    z <= HOMESTEAD_MAX_Z
  ) {
    out.lerp(new THREE.Color(0x6fa84b), 0.25);
  }
}

function buildRibbon(
  streams: StreamField,
  index: number,
  segs: number,
): { geometry: THREE.BufferGeometry; basePositions: Float32Array } {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const spec = streams.specs[index]!;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = streams.point(index, t);
    const tan = streams.tangent(index, t);
    const nx = -tan.z;
    const nz = tan.x;
    const w = spec.widthAt(t) * 0.5 * RIVER_WIDEN;
    positions.push(p.x + nx * w, -0.15, p.z + nz * w);
    positions.push(p.x - nx * w, -0.15, p.z - nz * w);
    uvs.push(t * spec.uvScale, 0);
    uvs.push(t * spec.uvScale, 1);
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
  return { geometry, basePositions: posArr.slice() };
}

function buildLakeGeometry(): THREE.BufferGeometry {
  const segs = 48;
  const positions: number[] = [0, -0.12, 0];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const r = lakeRimRadius(a) * LAKE_WIDEN;
    positions.push(Math.cos(a) * r, -0.12, Math.sin(a) * r);
    uvs.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
    if (i < segs) {
      // Wound so the fan's normal points up (+Y).
      indices.push(0, i + 2, i + 1);
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
  streams: StreamField,
  heightAt: (x: number, z: number) => number,
): THREE.Group {
  const group = new THREE.Group();
  const stoneMat = standardMaterial(FARM_COLORS.stone, { roughness: 0.92, flatShading: true });
  const reedMat = standardMaterial(FARM_COLORS.reed, { roughness: 0.9, flatShading: true });

  const stoneGeo = new THREE.OctahedronGeometry(0.14, 0);
  const reedGeo = new THREE.ConeGeometry(0.06, 0.55, 4);

  const maxStones = 700;
  const maxReeds = 900;
  const stones = new THREE.InstancedMesh(stoneGeo, stoneMat, maxStones);
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, maxReeds);
  stones.castShadow = true;
  stones.receiveShadow = true;
  reeds.castShadow = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const e = new THREE.Euler();

  let si = 0;
  let ri = 0;

  streams.specs.forEach((spec, index) => {
    const samples = index === 0 ? 200 : 110;
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const base = streams.point(index, t);
      const tan = streams.tangent(index, t);
      const nx = -tan.z;
      const nz = tan.x;
      const w = spec.widthAt(t);

      for (const side of [-1, 1]) {
        if (si < maxStones && hash2(i, index * 3 + side, 11) > 0.45) {
          const out = w * 0.6 + 0.35 + hash2(i, index, 22) * 1.1;
          const x = base.x + nx * side * out + tan.x * (hash2(i, side, 12) - 0.5);
          const z = base.z + nz * side * out + tan.z * (hash2(i, side, 12) - 0.5);
          if (x > 2 && z > 2 && x < WORLD_SIZE - 2 && z < WORLD_SIZE - 2) {
            const sc = 0.6 + hash2(i, index, 33) * 0.8;
            p.set(x, heightAt(x, z) + 0.05 * sc, z);
            e.set(0, hash2(i, index, 44) * Math.PI * 2, 0);
            q.setFromEuler(e);
            s.set(sc, sc * (0.7 + hash2(i, index, 55) * 0.5), sc);
            m.compose(p, q, s);
            stones.setMatrixAt(si++, m);
          }
        }
        if (ri < maxReeds) {
          const out = w * 0.5 + 0.15 + hash2(i, index + 9, 66) * 0.9;
          const x = base.x + nx * side * out;
          const z = base.z + nz * side * out;
          if (x > 2 && z > 2 && x < WORLD_SIZE - 2 && z < WORLD_SIZE - 2) {
            const sc = 0.75 + hash2(i, index, 77) * 0.6;
            p.set(x, heightAt(x, z) + 0.25 * sc, z);
            e.set(0, hash2(i, index, 88) * Math.PI * 2, 0);
            q.setFromEuler(e);
            s.set(sc, sc, sc);
            m.compose(p, q, s);
            reeds.setMatrixAt(ri++, m);
          }
        }
      }
    }
  });

  // Lake shore
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    const r = lakeRimRadius(a) + 0.8 + hash2(i, 2, 100) * 2.5;
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
    if (ri < maxReeds) {
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
  stones.computeBoundingSphere();
  reeds.computeBoundingSphere();
  group.add(stones, reeds);
  return group;
}

/** Foam ribbon hugging one bank, pushed away from the channel. */
function buildStreamFoam(
  edge: { x: number; z: number; y: number }[],
  shifted: { x: number; z: number }[],
): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < edge.length; i++) {
    const a = edge[i]!;
    const b = shifted[i]!;
    positions.push(a.x, a.y + 0.014, a.z, b.x, a.y + 0.014, b.z);
    uvs.push(0, 0, 1, 0);
    if (i < edge.length - 1) {
      const k = i * 2;
      indices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({
    color: 0xe4f7f2,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 2;
  return mesh;
}

/**
 * Build the 240×240 terrain: river + creeks + lake carved in, water surfaces,
 * bank dressing, and the vertex-colour soil painting the farm draws through.
 */
export function buildTerrain(): TerrainSystem {
  const meander = (x: number, z: number, salt: number): number =>
    (valueNoise2D(x, z, 18, TERRAIN_SEED ^ salt) - 0.5) * 2;
  const streams = new StreamField(buildStreamSpecs(LAKE_CX, LAKE_CZ, meander));

  // Centreline heights per stream, sampled once — the carve needs the un-carved
  // height at the channel centre and can't afford a spline evaluation per vertex.
  const CENTRE_SAMPLES = 220;
  const centreH: Float32Array[] = streams.specs.map((_, index) => {
    const arr = new Float32Array(CENTRE_SAMPLES + 1);
    for (let i = 0; i <= CENTRE_SAMPLES; i++) {
      const p = streams.point(index, i / CENTRE_SAMPLES);
      arr[i] = baseHeight(p.x, p.z);
    }
    return arr;
  });
  const centreHeight = (stream: number, t: number): number =>
    centreH[stream]![Math.max(0, Math.min(CENTRE_SAMPLES, Math.round(t * CENTRE_SAMPLES)))]!;

  const segs = 240;
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segs, segs);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const col = new THREE.Color();

  const grid = segs + 1;
  const heights = new Float32Array(grid * grid);
  // (ix,iz) → vertex index, so soil painting can find a tile's four corners.
  const vertexAt = new Int32Array(grid * grid).fill(-1);

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + WORLD_SIZE / 2;
    const z = pos.getZ(i) + WORLD_SIZE / 2;
    pos.setX(i, x);
    pos.setZ(i, z);

    let h = baseHeight(x, z);
    const hit = streams.nearest(x, z);
    if (hit && hit.dist <= hit.width * 1.6) {
      const k = smoothstep(hit.width * 1.6, hit.width * 0.35, hit.dist);
      h = lerp(h, centreHeight(hit.stream, hit.t) - channelDepth(hit.width), k);
    }
    const basin = lakeBasin(x, z);
    if (basin > 0) h = lerp(h, LAKE_FLOOR, basin);

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

    const ix = Math.round((x / WORLD_SIZE) * segs);
    const iz = Math.round((z / WORLD_SIZE) * segs);
    heights[iz * grid + ix] = h;
    vertexAt[iz * grid + ix] = i;
  }

  const colorAttr = new THREE.BufferAttribute(colors, 3);
  geo.setAttribute('color', colorAttr);
  geo.computeVertexNormals();
  /** Pristine greens, so soil can be painted on and wiped off again. */
  const baseColors = colors.slice();

  const mat = standardMaterial(0xffffff, {
    roughness: 0.92,
    metalness: 0.02,
    flatShading: true,
    vertexColors: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;

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
    return Math.min(lake, streams.distToWater(x, z));
  };

  // ------------------------------------------------------------------ water
  const waterAsset = createWaterAsset([6, 2]);
  const creekAsset = createWaterAsset([10, 1.4]);
  const lakeAsset = createWaterAsset([9, 9]);
  const water = new THREE.Group();
  const ripples: { geo: THREE.BufferGeometry; base: Float32Array }[] = [];

  streams.specs.forEach((_, index) => {
    const isRiver = index === 0;
    const { geometry, basePositions } = buildRibbon(streams, index, isRiver ? 120 : 90);
    const rp = geometry.attributes.position as THREE.BufferAttribute;
    // One level per cross-section, just under the lower bank, so the surface is
    // flat across the channel and tucked under the ground at both edges.
    for (let i = 0; i < rp.count; i += 2) {
      const yL = heightAt(rp.getX(i), rp.getZ(i));
      const yR = heightAt(rp.getX(i + 1), rp.getZ(i + 1));
      const y = Math.min(yL, yR) - 0.06;
      for (const v of [i, i + 1]) {
        rp.setY(v, y);
        basePositions[v * 3 + 1] = y;
      }
    }
    geometry.computeVertexNormals();

    const asset = isRiver ? waterAsset : creekAsset;
    const surface = new THREE.Mesh(geometry, asset.material);
    surface.receiveShadow = true;
    const shimmer = new THREE.Mesh(geometry, asset.overlayMaterial);
    shimmer.position.y = 0.02;
    shimmer.renderOrder = 1;
    water.add(surface, shimmer);
    ripples.push({ geo: geometry, base: basePositions });

    // Foam along both banks of the main river only — creeks are too narrow for it
    // to read as anything but noise.
    if (!isRiver) return;
    for (const side of [-1, 1] as const) {
      const edge: { x: number; z: number; y: number }[] = [];
      const outer: { x: number; z: number }[] = [];
      for (let i = 0; i <= 120; i++) {
        const t = i / 120;
        const p = streams.point(index, t);
        const tan = streams.tangent(index, t);
        const halfWidth = streams.specs[index]!.widthAt(t) * 0.5;
        const inner = halfWidth * (RIVER_WIDEN - 0.06);
        edge.push({
          x: p.x + -tan.z * side * inner,
          z: p.z + tan.x * side * inner,
          y: rp.getY(i * 2),
        });
        outer.push({
          x: p.x + -tan.z * side * (inner + 0.9),
          z: p.z + tan.x * side * (inner + 0.9),
        });
      }
      water.add(buildStreamFoam(edge, outer));
    }
  });

  // One flat level for the whole lake: below the lowest bank, never so low that
  // the basin reads as a dry pit.
  const lakeLevel = (() => {
    let low = Infinity;
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const r = lakeRimRadius(a) * LAKE_WIDEN;
      low = Math.min(low, heightAt(LAKE_CX + Math.cos(a) * r, LAKE_CZ + Math.sin(a) * r));
    }
    return Math.min(low - 0.08, LAKE_FLOOR + 2.4);
  })();

  const lakeGeo = buildLakeGeometry();
  {
    const lp = lakeGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) lp.setY(i, lakeLevel);
    lakeGeo.translate(LAKE_CX, 0, LAKE_CZ);
    lakeGeo.computeVertexNormals();
  }
  const lakeMesh = new THREE.Mesh(lakeGeo, lakeAsset.material);
  lakeMesh.receiveShadow = true;
  const lakeShimmer = new THREE.Mesh(lakeGeo, lakeAsset.overlayMaterial);
  lakeShimmer.position.y = 0.02;
  lakeShimmer.renderOrder = 1;
  water.add(lakeMesh, lakeShimmer);

  {
    const segsFoam = 96;
    const rim: { x: number; z: number; y: number }[] = [];
    for (let i = 0; i <= segsFoam; i++) {
      const a = (i / segsFoam) * Math.PI * 2;
      const r = lakeRimRadius(a) * (LAKE_WIDEN - 0.06);
      rim.push({ x: LAKE_CX + Math.cos(a) * r, z: LAKE_CZ + Math.sin(a) * r, y: lakeLevel });
    }
    const foam = buildShoreFoam(rim, 1.1, LAKE_CX, LAKE_CZ);
    if (foam) water.add(foam);
  }

  const bankScatter = dressBanks(streams, heightAt);

  const updateWater = (t: number, _dt: number): void => {
    waterAsset.update(t);
    creekAsset.update(t * 1.35);
    lakeAsset.update(t * 0.55);
    for (const { geo: g, base } of ripples) {
      const rp = g.attributes.position as THREE.BufferAttribute;
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < rp.count; i++) {
        rp.setY(i, (base[i * 3 + 1] ?? -0.1) + Math.sin(t * 2.2 + uv.getX(i) * 14) * 0.025);
      }
      rp.needsUpdate = true;
    }
  };

  // ------------------------------------------------------------- soil painting
  const DRY_A = new THREE.Color(FARM_COLORS.tilled);
  const DRY_B = new THREE.Color(FARM_COLORS.tilledLight);
  const WET = new THREE.Color(FARM_COLORS.watered);
  /** Per-vertex soil level, so a repaint only touches what changed. */
  const vertexSoil = new Uint8Array(grid * grid);
  const prevSoil = new Uint8Array(grid * grid);
  const soilCol = new THREE.Color();

  const applySoilMask = (mask: Uint8Array): void => {
    vertexSoil.fill(0);
    // A vertex is a corner of up to four tiles; the strongest wins, which is what
    // fills the gaps between neighbouring worked tiles into one uniform field.
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const soil = mask[ty * GRID_W + tx]!;
        if (soil === SOIL_NONE) continue;
        for (const [dx, dz] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ] as const) {
          const ix = tx + dx;
          const iz = ty + dz;
          if (ix >= grid || iz >= grid) continue;
          const k = iz * grid + ix;
          if (soil > vertexSoil[k]!) vertexSoil[k] = soil;
        }
      }
    }

    let dirty = false;
    for (let k = 0; k < vertexSoil.length; k++) {
      const soil = vertexSoil[k]!;
      if (soil === prevSoil[k]) continue;
      prevSoil[k] = soil;
      const v = vertexAt[k]!;
      if (v < 0) continue;
      dirty = true;
      if (soil === SOIL_NONE) {
        colors[v * 3] = baseColors[v * 3]!;
        colors[v * 3 + 1] = baseColors[v * 3 + 1]!;
        colors[v * 3 + 2] = baseColors[v * 3 + 2]!;
        continue;
      }
      const ix = k % grid;
      const iz = (k / grid) | 0;
      if (soil === SOIL_WATERED) {
        soilCol.copy(WET);
        soilCol.offsetHSL(0, 0, (hash2(ix, iz, 0x5171) - 0.5) * 0.05);
      } else {
        soilCol.copy(DRY_A).lerp(DRY_B, hash2(ix, iz, 0x6d17));
        soilCol.offsetHSL(0, 0, (hash2(ix, iz, 0x9a3f) - 0.5) * 0.07);
      }
      colors[v * 3] = soilCol.r;
      colors[v * 3 + 1] = soilCol.g;
      colors[v * 3 + 2] = soilCol.b;
    }
    if (dirty) colorAttr.needsUpdate = true;
  };

  return {
    mesh,
    water,
    bankScatter,
    streams,
    heightAt,
    distToWater,
    updateWater,
    applySoilMask,
  };
}
