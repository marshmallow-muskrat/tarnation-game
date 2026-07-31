import * as THREE from 'three';
import {
  FARM_COLORS,
  GRID_H,
  GRID_W,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SIZE,
  LANTERN_DISTANCE_MAX,
  LANTERN_DISTANCE_MIN,
  WORLD_SIZE,
  WOODS_COLORS,
  WOODS_H,
  WOODS_W,
} from '../content';
import type { Tile } from '../sim/farm';
import { cloneModel, type ModelKey } from './Assets';
import { buildDirtGeometries, DIRT_VARIANTS, dirtVariant, dirtYaw } from './dirt';
import { FarmTrees } from './FarmTrees';
import { standardMaterial } from './materials';
import { hash2 } from './noise';
import { ScatterChunks } from './ScatterChunks';
import { buildTerrain, type TerrainSystem } from './terrain';

export type Zone = 'farm' | 'woods';

const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _pos = new THREE.Vector3();

function seeded(i: number): number {
  let a = (i * 374761393 + 668265263) >>> 0;
  a = Math.imul(a ^ (a >>> 15), a | 1);
  a ^= a + Math.imul(a ^ (a >>> 7), a | 61);
  return ((a ^ (a >>> 14)) >>> 0) / 4294967296;
}

/**
 * Three.js scene — Gloamreach look recipe constants unchanged.
 * Pass 1 expands what is IN the world (terrain, sky, scatter, water).
 */
export class WorldRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  /** far plane raised to 400 per v4 horizon requirements */
  readonly camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 400);
  private readonly cameraOffset = new THREE.Vector3(10.5, 12.5, 10.5);
  private readonly cameraTarget = new THREE.Vector3();
  private readonly shakeOffset = new THREE.Vector3();
  private targetZoom = 1;
  private zoom = 1;

  private hemisphere!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rim!: THREE.DirectionalLight;
  heroLight!: THREE.PointLight;

  private overworldRoot = new THREE.Group();
  private woodsRoot = new THREE.Group();
  /** One instanced mesh per dirt patch shape, plus a box for trench/breed/trap. */
  private dirtMeshes: THREE.InstancedMesh[] = [];
  private specialTiles!: THREE.InstancedMesh;
  private furrowMesh!: THREE.InstancedMesh;
  private woodsTiles!: THREE.InstancedMesh;
  /** Contextual tool hover: center + 8 neighbours */
  private hoverGroup = new THREE.Group();
  private hoverOutline!: THREE.LineSegments;
  private hoverTargetAlpha = 0;
  private hoverAlpha = 0;
  private toolHoverActive = false;

  private terrain!: TerrainSystem;
  private scatter!: ScatterChunks;
  private farmTrees: FarmTrees | null = null;
  private sky!: THREE.Mesh;
  private horizonGroup = new THREE.Group();
  private motePoints!: THREE.Points;
  private moteVel: Float32Array | null = null;

  private zone: Zone = 'farm';
  private fogTarget = new THREE.Color(FARM_COLORS.fog);
  private shakeTime = 0;
  private shakeAmp = 0;
  private time = 0;

  private actors = new THREE.Group();
  private farmActors = new THREE.Group();
  private woodsActors = new THREE.Group();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Daytime density ~0.012 so distant geometry fades into sky
    this.scene.fog = new THREE.FogExp2(FARM_COLORS.fog, 0.012);
    this.scene.background = new THREE.Color(FARM_COLORS.skyZenith);

    this.setupLighting();
    this.buildSky();
    this.buildHorizon();

    this.terrain = buildTerrain();
    this.overworldRoot.add(this.terrain.mesh);
    this.overworldRoot.add(this.terrain.water);
    this.overworldRoot.add(this.terrain.bankScatter);

    this.scatter = new ScatterChunks(this.terrain.heightAt, this.terrain.distToWater);
    this.overworldRoot.add(this.scatter.getRoot());

    this.buildFarmPlotTiles();
    this.buildHoverAffordances();
    this.buildAmbientMotes();
    this.buildWoodsFloor();

    this.overworldRoot.add(this.farmActors);
    this.woodsRoot.add(this.woodsActors);
    this.woodsRoot.visible = false;

    this.scene.add(this.overworldRoot);
    this.scene.add(this.woodsRoot);
    this.scene.add(this.actors);
    this.scene.add(this.horizonGroup);

    const startX = WORLD_SIZE / 2;
    const startZ = WORLD_SIZE / 2;
    this.cameraTarget.set(startX, 0, startZ);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);

    // Initial scatter around spawn
    this.scatter.update(startX, startZ);
    this.renderer.shadowMap.needsUpdate = true;
  }

  private setupLighting(): void {
    this.hemisphere = new THREE.HemisphereLight(0xbfe0ff, 0x4a6b33, 1.1);
    this.scene.add(this.hemisphere);

    this.keyLight = new THREE.DirectionalLight(0xfff2d0, 2.2);
    this.keyLight.position.set(-6, 13, 4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.left = -40;
    this.keyLight.shadow.camera.right = 40;
    this.keyLight.shadow.camera.top = 40;
    this.keyLight.shadow.camera.bottom = -40;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 80;
    this.keyLight.shadow.bias = -0.0006;
    this.keyLight.shadow.normalBias = 0.02;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.rim = new THREE.DirectionalLight(0x8fb0d8, 0.5);
    this.rim.position.set(8, 6, -9);
    this.scene.add(this.rim);

    this.heroLight = new THREE.PointLight(0xffc98c, 3.0, 6.0, 2);
    this.heroLight.position.set(0, 3.1, 0);
    this.scene.add(this.heroLight);
  }

  private buildSky(): void {
    // Large inverted sphere, vertex gradient, unlit BackSide
    const geo = new THREE.SphereGeometry(380, 32, 16);
    const colors = new Float32Array(geo.attributes.position!.count * 3);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const horizon = new THREE.Color(FARM_COLORS.skyHorizon);
    const zenith = new THREE.Color(FARM_COLORS.skyZenith);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      // y from -r to r → 0 at horizon band
      const t = Math.min(1, Math.max(0, (y / 380) * 0.5 + 0.35));
      c.copy(horizon).lerp(zenith, t * t);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
  }

  private buildHorizon(): void {
    // Distant treeline ring r=150–200
    const treeCount = 180;
    const trunkGeo = new THREE.CylinderGeometry(0.8, 1.2, 6, 5);
    const coneGeo = new THREE.ConeGeometry(3.5, 10, 6);
    const trunkMat = standardMaterial(0x2a3a28, { flatShading: true, roughness: 0.95 });
    const coneMat = standardMaterial(0x3a4a38, { flatShading: true, roughness: 0.95 });
    // Tint toward fog
    trunkMat.color.lerp(new THREE.Color(FARM_COLORS.fog), 0.45);
    coneMat.color.lerp(new THREE.Color(FARM_COLORS.fog), 0.5);

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const cones = new THREE.InstancedMesh(coneGeo, coneMat, treeCount);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const e = new THREE.Euler();
    const cx = WORLD_SIZE / 2;
    const cz = WORLD_SIZE / 2;

    for (let i = 0; i < treeCount; i++) {
      const a = (i / treeCount) * Math.PI * 2 + hash2(i, 1, 9) * 0.05;
      const r = 155 + hash2(i, 2, 9) * 45;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const sc = 1.2 + hash2(i, 3, 9) * 1.8;
      p.set(x, 2.5 * sc, z);
      e.set(0, hash2(i, 4, 9) * 6, 0);
      q.setFromEuler(e);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      trunks.setMatrixAt(i, m);
      p.set(x, 8 * sc, z);
      s.set(sc, sc * 1.1, sc);
      m.compose(p, q, s);
      cones.setMatrixAt(i, m);
    }
    this.horizonGroup.add(trunks, cones);

    // 8–14 big hills at r=200–280
    const hillCount = 12;
    for (let i = 0; i < hillCount; i++) {
      const a = (i / hillCount) * Math.PI * 2 + hash2(i, 10, 11) * 0.3;
      const r = 210 + hash2(i, 11, 11) * 60;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const useCone = hash2(i, 12, 11) > 0.4;
      const sc = 14 + hash2(i, 13, 11) * 22;
      const geo = useCone
        ? new THREE.ConeGeometry(sc * 0.9, sc * 1.1, 6)
        : new THREE.IcosahedronGeometry(sc * 0.7, 0);
      const mat = standardMaterial(0x5a6a50, { flatShading: true, roughness: 0.96 });
      mat.color.lerp(new THREE.Color(FARM_COLORS.fog), 0.55);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, sc * 0.25, z);
      mesh.rotation.y = hash2(i, 14, 11) * 6;
      if (!useCone) mesh.scale.y = 0.55;
      this.horizonGroup.add(mesh);
    }
  }

  /**
 * Farm tiles are flush — sparse InstancedMesh for non-grass only.
 * Entire 240×240 world is tillable; grass = terrain (no overlay).
 */
  private buildFarmPlotTiles(): void {
    const maxTiles = 16000;
    // 0.18 thick, not 0.06: terrain carries ±1.2 noise across 1-unit quads, so a
    // thin tile sitting ~0.01 proud of the sampled centre height gets swallowed by
    // the ground and the player cannot tell tilled from grass.
    const dirtGeos = buildDirtGeometries();
    for (const geo of dirtGeos) {
      const mesh = new THREE.InstancedMesh(
        geo,
        standardMaterial(0xffffff, { roughness: 0.92, flatShading: true }),
        maxTiles,
      );
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.count = 0;
      this.dirtMeshes.push(mesh);
      this.overworldRoot.add(mesh);
    }

    // Trenches, breeding beds and traps stay square — they are dug structures,
    // not turned soil, and the straight edge is how the player reads them.
    const geo = new THREE.BoxGeometry(1.0, 0.18, 1.0);
    const mat = standardMaterial(0xffffff, { roughness: 0.92, flatShading: true });
    this.specialTiles = new THREE.InstancedMesh(geo, mat, maxTiles);
    this.specialTiles.receiveShadow = true;
    this.specialTiles.castShadow = true;
    this.specialTiles.count = 0;

    const furrowGeo = new THREE.BoxGeometry(0.92, 0.02, 0.06);
    const furrowMat = standardMaterial(FARM_COLORS.tilledLight, {
      roughness: 0.9,
      flatShading: true,
    });
    this.furrowMesh = new THREE.InstancedMesh(furrowGeo, furrowMat, maxTiles * 3);
    this.furrowMesh.castShadow = true;
    this.furrowMesh.receiveShadow = true;
    this.furrowMesh.count = 0;

    this.overworldRoot.add(this.specialTiles);
    this.overworldRoot.add(this.furrowMesh);
  }

  /** Overworld trees are owned here but need sim state — GameRuntime supplies it. */
  initFarmTrees(hooks: ConstructorParameters<typeof FarmTrees>[0]): void {
    this.farmTrees = new FarmTrees(hooks);
    this.overworldRoot.add(this.farmTrees.getRoot());
  }

  getFarmTrees(): FarmTrees | null {
    return this.farmTrees;
  }

  /** Soft emissive outlines for hover tile + 8 neighbours — faded, never persistent. */
  /**
   * A single thin outline on the hovered tile — not a filled quad, and not the 8
   * neighbours. Filled quads wash out the tile's own colour (which is the only way
   * the player can tell tilled from watered from trench), and the neighbour ring
   * reads as exactly the persistent grid we removed.
   */
  private buildHoverAffordances(): void {
    const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const edges = new THREE.EdgesGeometry(plane);
    const mat = new THREE.LineBasicMaterial({
      color: 0xf4ffc0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    const outline = new THREE.LineSegments(edges, mat);
    outline.visible = false;
    outline.renderOrder = 5;
    this.hoverOutline = outline;
    this.hoverGroup.add(outline);
    this.overworldRoot.add(this.hoverGroup);
  }

  /** Sparse slow floating motes on the farm — catch the light. */
  private buildAmbientMotes(): void {
    const count = 140;
    const positions = new Float32Array(count * 3);
    this.moteVel = new Float32Array(count * 3);
    const cx = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2;
    const cz = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE / 2;
    for (let i = 0; i < count; i++) {
      positions[i * 3] = cx + (Math.random() - 0.5) * 90;
      positions[i * 3 + 1] = 0.6 + Math.random() * 4.5;
      positions[i * 3 + 2] = cz + (Math.random() - 0.5) * 90;
      this.moteVel[i * 3] = (Math.random() - 0.5) * 0.15;
      this.moteVel[i * 3 + 1] = 0.04 + Math.random() * 0.08;
      this.moteVel[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfff2c8,
      size: 0.09,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    this.motePoints = new THREE.Points(geo, mat);
    this.motePoints.frustumCulled = false;
    this.overworldRoot.add(this.motePoints);
  }

  private buildWoodsFloor(): void {
    const undercroft = new THREE.Mesh(
      new THREE.PlaneGeometry(WOODS_W + 8, WOODS_H + 8),
      standardMaterial(0x0c1412, { roughness: 1 }),
    );
    undercroft.rotation.x = -Math.PI / 2;
    undercroft.position.set(WOODS_W / 2, -0.1, WOODS_H / 2);
    undercroft.receiveShadow = true;
    this.woodsRoot.add(undercroft);

    const cols = Math.floor(WOODS_W);
    const rows = Math.floor(WOODS_H);
    const geo = new THREE.BoxGeometry(0.94, 0.08, 0.94);
    const mat = standardMaterial(0xffffff, { roughness: 0.94 });
    this.woodsTiles = new THREE.InstancedMesh(geo, mat, cols * rows);
    this.woodsTiles.receiveShadow = true;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const variation = seeded(index + 900);
        _matrix.makeRotationY((variation - 0.5) * 0.02);
        _pos.set(col + 0.5, -0.04 + variation * 0.01, row + 0.5);
        _matrix.setPosition(_pos);
        this.woodsTiles.setMatrixAt(index, _matrix);
        _color
          .set(WOODS_COLORS.floorA)
          .lerp(new THREE.Color(WOODS_COLORS.floorB), variation);
        this.woodsTiles.setColorAt(index, _color);
      }
    }
    this.woodsTiles.instanceMatrix.needsUpdate = true;
    if (this.woodsTiles.instanceColor) this.woodsTiles.instanceColor.needsUpdate = true;
    this.woodsRoot.add(this.woodsTiles);
  }

  syncFarmTiles(tiles: Tile[][]): void {
    let si = 0;
    let fi = 0;
    const dirtCounts = new Array<number>(DIRT_VARIANTS).fill(0);
    const _q = new THREE.Quaternion();
    const _s = new THREE.Vector3(1, 1, 1);
    const maxT = this.specialTiles.instanceMatrix.count;

    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        const t = tiles[row]![col]!;
        if (t.state === 'grass' && !t.trap) continue;
        if (si >= maxT) break;

        const variation = seeded(row * GRID_W + col + 17);
        const wx = col + 0.5;
        const wz = row + 0.5;
        const groundY = this.terrain.heightAt(wx, wz);

        // Every worked tile must sit clearly proud of the terrain. TILE_LIFT is the
        // floor; anything below it disappears into the ground noise.
        const TILE_LIFT = 0.1;
        let yOff = TILE_LIFT;
        // Turned soil gets one of five irregular dirt patches; dug structures keep
        // the square slab.
        let soil = false;
        if (t.state === 'trench') {
          // Wet channel: dark earth lerped toward water so it reads as dug and full.
          _color.set(FARM_COLORS.trench).lerp(new THREE.Color(FARM_COLORS.water), 0.45);
          yOff = TILE_LIFT + 0.02;
        } else if (t.state === 'breeding') {
          _color.set(0x8a5ab0);
          yOff = TILE_LIFT + 0.06;
        } else if (t.state === 'tilled' || (t.state === 'planted' && !t.watered)) {
          _color
            .set(FARM_COLORS.tilled)
            .lerp(new THREE.Color(FARM_COLORS.tilledLight), 0.55);
          yOff = TILE_LIFT;
          soil = true;
        } else if (t.watered || t.state === 'mature') {
          _color.set(FARM_COLORS.watered);
          yOff = TILE_LIFT;
          soil = true;
        } else if (t.trap) {
          _color.set(0x9a5ac0);
          yOff = TILE_LIFT + 0.05;
        } else {
          _color
            .set(FARM_COLORS.floorA)
            .lerp(new THREE.Color(FARM_COLORS.floorB), variation * 0.55);
        }

        _pos.set(wx, groundY + yOff, wz);
        if (soil) {
          const v = dirtVariant(col, row);
          const mesh = this.dirtMeshes[v]!;
          const idx = dirtCounts[v]!;
          if (idx < mesh.instanceMatrix.count) {
            // Slight per-tile scale jitter on top of the shape + quarter-turn, so
            // even two neighbours on the same variant don't line up.
            const jitter = 0.94 + variation * 0.16;
            _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), dirtYaw(col, row));
            _s.set(jitter, 1, jitter);
            _matrix.compose(_pos, _q, _s);
            mesh.setMatrixAt(idx, _matrix);
            mesh.setColorAt(idx, _color);
            dirtCounts[v] = idx + 1;
          }
        } else {
          this.specialTiles.setColorAt(si, _color);
          _matrix.identity();
          _matrix.setPosition(_pos);
          this.specialTiles.setMatrixAt(si, _matrix);
          si++;
        }

        if (t.state === 'tilled' || (t.state === 'planted' && !t.watered)) {
          for (let r = 0; r < 3; r++) {
            if (fi >= this.furrowMesh.instanceMatrix.count) break;
            const zOff = -0.28 + r * 0.28;
            _pos.set(wx, groundY + yOff + 0.1, wz + zOff);
            _s.set(1, 1, 1);
            _q.identity();
            _matrix.compose(_pos, _q, _s);
            this.furrowMesh.setMatrixAt(fi++, _matrix);
          }
        }
      }
    }

    for (let v = 0; v < this.dirtMeshes.length; v++) {
      const mesh = this.dirtMeshes[v]!;
      mesh.count = dirtCounts[v]!;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      // An InstancedMesh caches its bounding sphere from the instances it had when
      // it was first culled — which was none. Without this the whole field is
      // invisible: the stale sphere sits at the origin, 120 units from the farm.
      mesh.computeBoundingSphere();
    }
    this.specialTiles.count = si;
    this.furrowMesh.count = fi;
    this.specialTiles.instanceMatrix.needsUpdate = true;
    this.furrowMesh.instanceMatrix.needsUpdate = true;
    if (this.specialTiles.instanceColor) this.specialTiles.instanceColor.needsUpdate = true;
    this.specialTiles.computeBoundingSphere();
    this.furrowMesh.computeBoundingSphere();
    this.renderer.shadowMap.needsUpdate = true;
  }

  setZone(zone: Zone): void {
    if (this.zone === zone) return;
    this.zone = zone;
    this.overworldRoot.visible = zone === 'farm';
    this.woodsRoot.visible = zone === 'woods';
    this.horizonGroup.visible = zone === 'farm';
    this.sky.visible = true;

    if (zone === 'woods') {
      this.fogTarget.set(WOODS_COLORS.fog);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.036;
      }
      this.hemisphere.color.set(0x8fb9b0);
      this.hemisphere.groundColor.set(0x0b1211);
      this.hemisphere.intensity = 1.2;
      this.keyLight.color.set(0xbcd6d4);
      this.keyLight.intensity = 1.95;
      this.rim.color.set(0x5d86bd);
      this.rim.intensity = 0.8;
      this.heroLight.intensity = 8.4;
      this.heroLight.distance = LANTERN_DISTANCE_MAX;
      this.targetZoom = 1.05;
      (this.scene.background as THREE.Color).set(WOODS_COLORS.fog);
    } else {
      this.fogTarget.set(FARM_COLORS.fog);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.density = 0.012;
      }
      this.hemisphere.color.set(0xbfe0ff);
      this.hemisphere.groundColor.set(0x4a6b33);
      this.hemisphere.intensity = 1.1;
      this.keyLight.color.set(0xfff2d0);
      this.keyLight.intensity = 2.2;
      this.rim.color.set(0x8fb0d8);
      this.rim.intensity = 0.5;
      this.heroLight.intensity = 3.0;
      this.heroLight.distance = 6.0;
      this.targetZoom = 1;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  getZone(): Zone {
    return this.zone;
  }

  applyDayNight(phase: 'day' | 'night', t: number): void {
    if (this.zone !== 'farm') return;
    let night = 0;
    if (phase === 'night') {
      night = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
    } else if (t > 0.88) {
      night = ((t - 0.88) / 0.12) * 0.45;
    }
    this.keyLight.intensity = THREE.MathUtils.lerp(2.2, 0.55, night);
    this.hemisphere.intensity = THREE.MathUtils.lerp(1.1, 0.45, night);
    this.heroLight.intensity = THREE.MathUtils.lerp(3.0, 5.5, night);
    const fogDay = new THREE.Color(FARM_COLORS.fog);
    const fogNight = new THREE.Color(0x1a2840);
    this.fogTarget.copy(fogDay).lerp(fogNight, night);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = THREE.MathUtils.lerp(0.012, 0.028, night);
    }
  }

  setLanternFuel(fuel01: number): void {
    if (this.zone !== 'woods') return;
    const d = THREE.MathUtils.lerp(LANTERN_DISTANCE_MIN, LANTERN_DISTANCE_MAX, fuel01);
    this.heroLight.distance = d;
    this.heroLight.intensity = THREE.MathUtils.lerp(3.5, 8.4, fuel01);
  }

  /**
 * Tool affordance only: soft outline on hovered tile + gentle glow on 8 neighbours.
 * Pass null to fade out. Never a persistent grid overlay.
 */
  setHover(tileX: number | null, tileZ: number | null, inRange: boolean): void {
    if (tileX === null || tileZ === null) {
      this.toolHoverActive = false;
      this.hoverTargetAlpha = 0;
      return;
    }
    if (tileX < 0 || tileZ < 0 || tileX >= GRID_W || tileZ >= GRID_H) {
      this.toolHoverActive = false;
      this.hoverTargetAlpha = 0;
      return;
    }
    this.toolHoverActive = true;
    this.hoverTargetAlpha = 1;

    const wx = tileX + 0.5;
    const wz = tileZ + 0.5;
    const y = this.terrain.heightAt(wx, wz) + 0.3;
    this.hoverOutline.position.set(wx, y, wz);
    this.hoverOutline.visible = true;
    (this.hoverOutline.material as THREE.LineBasicMaterial).color.set(
      inRange ? 0xf4ffc0 : 0xe07060,
    );
  }

  heightAt(x: number, z: number): number {
    if (this.zone === 'woods') return 0;
    return this.terrain.heightAt(x, z);
  }

  distToWater(x: number, z: number): number {
    if (this.zone === 'woods') return 999;
    return this.terrain.distToWater(x, z);
  }

  followPlayer(x: number, z: number, leadX: number, leadZ: number, dt: number): void {
    const targetX = x + leadX;
    const targetZ = z + leadZ;
    const hy = this.zone === 'farm' ? this.terrain.heightAt(x, z) : 0;

    // The shadow camera is only ±40 wide. Pinned at the origin it covers one corner
    // of a 240×240 world, so nothing near the player ever casts a shadow. Move the
    // light and its target with the player so the frustum always contains them.
    this.keyLight.position.set(x - 6, hy + 13, z + 4);
    this.keyLight.target.position.set(x, hy, z);
    this.keyLight.target.updateMatrixWorld();
    this.renderer.shadowMap.needsUpdate = true;
    this.cameraTarget.x = THREE.MathUtils.damp(this.cameraTarget.x, targetX, 4.5, dt);
    this.cameraTarget.z = THREE.MathUtils.damp(this.cameraTarget.z, targetZ, 4.5, dt);
    this.cameraTarget.y = THREE.MathUtils.damp(this.cameraTarget.y, hy, 4.5, dt);

    this.zoom = THREE.MathUtils.lerp(
      this.zoom,
      this.targetZoom,
      1 - Math.exp(-dt * 4.2),
    );
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = this.shakeAmp * (this.shakeTime > 0 ? 1 : 0);
      this.shakeOffset.set(
        (Math.random() - 0.5) * a,
        (Math.random() - 0.5) * a * 0.4,
        (Math.random() - 0.5) * a,
      );
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    this.camera.position
      .copy(this.cameraTarget)
      .add(this.cameraOffset)
      .add(this.shakeOffset);
    this.camera.lookAt(this.cameraTarget);

    this.heroLight.position.set(x, hy + 3.1, z);
    // Sky follows camera so horizon never ends
    this.sky.position.copy(this.cameraTarget);

    if (this.zone === 'farm') {
      this.scatter.update(x, z);
      this.farmTrees?.update(x, z);
    }
  }

  snapCamera(x: number, z: number): void {
    const hy = this.zone === 'farm' ? this.terrain.heightAt(x, z) : 0;
    this.cameraTarget.set(x, hy, z);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);
    this.sky.position.copy(this.cameraTarget);
    if (this.zone === 'farm') {
      this.scatter.update(x, z);
      this.farmTrees?.update(x, z);
    }
  }

  shake(duration: number, amplitude: number): void {
    this.shakeTime = duration;
    this.shakeAmp = amplitude;
  }

  getScreenBasis(): { forward: THREE.Vector3; right: THREE.Vector3 } {
    const forward = new THREE.Vector3(-1, 0, -1).normalize();
    const right = new THREE.Vector3(1, 0, -1).normalize();
    return { forward, right };
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const frustum = 5;
    this.camera.left = -frustum * aspect;
    this.camera.right = frustum * aspect;
    this.camera.top = frustum;
    this.camera.bottom = -frustum;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): void {
    this.time += dt;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.lerp(this.fogTarget, 1 - Math.exp(-dt * 2.2));
    }
    if (this.zone === 'farm') {
      this.terrain.updateWater(this.time, dt);
      this.updateMotes(dt);
    }

    // Fade tool hover affordance in/out
    const target = this.toolHoverActive ? this.hoverTargetAlpha : 0;
    this.hoverAlpha = THREE.MathUtils.damp(this.hoverAlpha, target, 12, dt);
    const hoverMat = this.hoverOutline.material as THREE.LineBasicMaterial;
    hoverMat.opacity = this.hoverAlpha * 0.85;
    if (this.hoverAlpha < 0.02) this.hoverOutline.visible = false;

    // Motes / hover only on farm overworld
    if (this.motePoints) {
      this.motePoints.visible = this.zone === 'farm';
    }
  }

  private updateMotes(dt: number): void {
    if (!this.moteVel) return;
    const pos = this.motePoints.geometry.attributes.position as THREE.BufferAttribute;
    const cx = this.cameraTarget.x;
    const cz = this.cameraTarget.z;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + this.moteVel[i * 3]! * dt;
      let y = pos.getY(i) + this.moteVel[i * 3 + 1]! * dt;
      let z = pos.getZ(i) + this.moteVel[i * 3 + 2]! * dt;
      // gentle bob
      y += Math.sin(this.time * 0.7 + i) * 0.002;
      if (y > 5.5) y = 0.5;
      // keep near camera
      if (Math.hypot(x - cx, z - cz) > 55) {
        x = cx + (Math.random() - 0.5) * 80;
        z = cz + (Math.random() - 0.5) * 80;
        y = 0.5 + Math.random() * 3;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  getFarmActors(): THREE.Group {
    return this.farmActors;
  }

  getWoodsActors(): THREE.Group {
    return this.woodsActors;
  }

  getSharedActors(): THREE.Group {
    return this.actors;
  }

  spawnProp(key: ModelKey, x: number, z: number, parent: THREE.Group, scale = 1): THREE.Object3D {
    const { root } = cloneModel(key);
    const y = parent === this.farmActors || parent === this.actors ? this.terrain.heightAt(x, z) : 0;
    root.position.set(x, y, z);
    root.scale.multiplyScalar(scale);
    parent.add(root);
    this.renderer.shadowMap.needsUpdate = true;
    return root;
  }

  raycastGround(ndcX: number, ndcY: number): { x: number; z: number } | null {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    if (this.zone === 'farm') {
      const hits = raycaster.intersectObject(this.terrain.mesh, false);
      if (hits.length > 0 && hits[0]) {
        return { x: hits[0].point.x, z: hits[0].point.z };
      }
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      return { x: hit.x, z: hit.z };
    }
    return null;
  }

  markShadowsDirty(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** World bounds for overworld walking */
  getWorldBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return { minX: 2, maxX: WORLD_SIZE - 2, minZ: 2, maxZ: WORLD_SIZE - 2 };
  }
}
