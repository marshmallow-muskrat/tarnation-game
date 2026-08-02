import * as THREE from 'three';
import {
  FARM_COLORS,
  GRID_H,
  GRID_W,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SIZE,
  WORLD_SIZE,
} from '../content';
import type { Tile } from '../sim/farm';
import { cloneModel, isModelReady, type ModelKey } from './Assets';
import { FarmTrees } from './FarmTrees';
import { standardMaterial } from './materials';
import { hash2 } from './noise';
import { ScatterChunks } from './ScatterChunks';
import { buildTerrain, SOIL_NONE, SOIL_TILLED, SOIL_WATERED, type TerrainSystem } from './terrain';
import { disposeCloneOwnedMaterials, disposeModelClone, disposeObjectResources } from './ResourceDisposal';

const _matrix = new THREE.Matrix4();
const _color = new THREE.Color();
const _pos = new THREE.Vector3();
const SHADOW_ANCHOR_STEP = 0.25;

/**
 * Three.js scene — one world, no zones. Worked soil is painted into the terrain's
 * own vertex colours rather than laid on top of it, so neighbouring tilled tiles
 * merge into a single continuous field instead of a grid of separate slabs.
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
  private reducedMotion = false;

  private hemisphere!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rim!: THREE.DirectionalLight;
  heroLight!: THREE.PointLight;

  private overworldRoot = new THREE.Group();
  /** Trenches and breeding beds — dug structures. */
  private structureTiles!: THREE.InstancedMesh;
  private hoverGroup = new THREE.Group();
  private hoverOutline!: THREE.LineSegments;
  private hoverTargetAlpha = 0;
  private hoverAlpha = 0;
  private toolHoverActive = false;
  private buildPreviewRoot: THREE.Object3D | null = null;
  private buildPreviewKey: ModelKey | null = null;
  private buildPreviewFootprint: THREE.Mesh | null = null;
  private buildPreviewFootprintSize = '';
  private debugGridGroup: THREE.Group | null = null;
  private debugGridMaterials: THREE.Material[] = [];
  private debugGridGeometries: THREE.BufferGeometry[] = [];
  private debugGridTextures: THREE.Texture[] = [];
  private buildPreviewMaterials: { material: THREE.Material; color: THREE.Color | null }[] = [];

  private terrain!: TerrainSystem;
  private scatter!: ScatterChunks;
  private farmTrees: FarmTrees | null = null;
  private soilMask = new Uint8Array(GRID_W * GRID_H);
  private sky!: THREE.Mesh;
  private horizonGroup = new THREE.Group();
  private motePoints!: THREE.Points;
  private moteVel: Float32Array | null = null;

  private fogTarget = new THREE.Color(FARM_COLORS.fog);
  private readonly fogDay = new THREE.Color(FARM_COLORS.fog);
  private readonly fogNight = new THREE.Color(0x1a2840);
  private readonly waterStructureColor = new THREE.Color(FARM_COLORS.water);
  private readonly trenchStructureColor = new THREE.Color(FARM_COLORS.trench);
  private readonly shadowAnchor = new THREE.Vector3(Number.NaN, Number.NaN, Number.NaN);
  private readonly groundRaycaster = new THREE.Raycaster();
  private readonly groundNdc = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly groundHit = new THREE.Vector3();
  private readonly screenForward = new THREE.Vector3(-1, 0, -1).normalize();
  private readonly screenRight = new THREE.Vector3(1, 0, -1).normalize();
  private readonly screenAngleFrom = new THREE.Vector3();
  private readonly screenAngleTarget = new THREE.Vector3();
  private shakeTime = 0;
  private shakeAmp = 0;
  private time = 0;

  private actors = new THREE.Group();
  private farmActors = new THREE.Group();
  private disposed = false;

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

    this.buildStructureTiles();
    this.buildHoverAffordances();
    this.buildAmbientMotes();

    this.overworldRoot.add(this.farmActors);
    this.scene.add(this.overworldRoot);
    this.scene.add(this.actors);
    this.scene.add(this.horizonGroup);

    const startX = WORLD_SIZE / 2;
    const startZ = WORLD_SIZE / 2;
    this.cameraTarget.set(startX, 0, startZ);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);

    // Scatter models are loaded by GameRuntime after this renderer is built.
    // The first real scatter chunks are created by snapCamera once the
    // first_play group has completed; building here would permanently cache
    // primitive fallbacks.
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
    const geo = new THREE.SphereGeometry(380, 32, 16);
    const colors = new Float32Array(geo.attributes.position!.count * 3);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const horizon = new THREE.Color(FARM_COLORS.skyHorizon);
    const zenith = new THREE.Color(FARM_COLORS.skyZenith);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
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
    const treeCount = 180;
    const trunkGeo = new THREE.CylinderGeometry(0.8, 1.2, 6, 5);
    const coneGeo = new THREE.ConeGeometry(3.5, 10, 6);
    const trunkMat = standardMaterial(0x2a3a28, { flatShading: true, roughness: 0.95 });
    const coneMat = standardMaterial(0x3a4a38, { flatShading: true, roughness: 0.95 });
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

  private buildStructureTiles(): void {
    const geo = new THREE.BoxGeometry(1.0, 0.18, 1.0);
    const mat = standardMaterial(0xffffff, { roughness: 0.92, flatShading: true });
    this.structureTiles = new THREE.InstancedMesh(geo, mat, 4000);
    this.structureTiles.receiveShadow = true;
    this.structureTiles.castShadow = true;
    this.structureTiles.count = 0;
    this.overworldRoot.add(this.structureTiles);
  }

  /** Overworld trees are drawn here but their state lives in the sim. */
  initFarmTrees(hooks: ConstructorParameters<typeof FarmTrees>[0]): void {
    this.farmTrees = new FarmTrees(hooks);
    this.overworldRoot.add(this.farmTrees.getRoot());
  }

  getFarmTrees(): FarmTrees | null {
    return this.farmTrees;
  }

  setInteractiveOccupancy(blocked: ReadonlySet<string>, version: number): void {
    this.scatter.setInteractiveOccupancy(blocked, version);
  }

  /**
   * A single thin outline on the hovered tile — not a filled quad, which would
   * wash out the tile's own colour.
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

  /**
   * Push farm state to the renderer: soil colours straight into the terrain, dug
   * structures as instanced slabs.
   */
  syncFarmTiles(tiles: Tile[][]): void {
    this.soilMask.fill(SOIL_NONE);
    let si = 0;
    const maxT = this.structureTiles.instanceMatrix.count;

    for (let row = 0; row < GRID_H; row++) {
      for (let col = 0; col < GRID_W; col++) {
        const t = tiles[row]![col]!;
        if (t.state === 'grass') continue;

        const wx = col + 0.5;
        const wz = row + 0.5;

        if (t.state === 'tilled' || t.state === 'planted' || t.state === 'mature') {
          this.soilMask[row * GRID_W + col] =
            t.watered || t.state === 'mature' ? SOIL_WATERED : SOIL_TILLED;
          continue;
        }

        if (si >= maxT) continue;
        if (t.state === 'trench') {
          _color.copy(this.trenchStructureColor).lerp(this.waterStructureColor, 0.45);
        } else if (t.state === 'breeding') {
          _color.set(0x8a5ab0);
        } else {
          continue;
        }
        this.structureTiles.setColorAt(si, _color);
        _pos.set(wx, this.terrain.heightAt(wx, wz) + 0.12, wz);
        _matrix.identity();
        _matrix.setPosition(_pos);
        this.structureTiles.setMatrixAt(si, _matrix);
        si++;
      }
    }

    this.terrain.applySoilMask(this.soilMask);
    this.structureTiles.count = si;
    this.structureTiles.instanceMatrix.needsUpdate = true;
    if (this.structureTiles.instanceColor) this.structureTiles.instanceColor.needsUpdate = true;
    this.structureTiles.computeBoundingSphere();
    this.renderer.shadowMap.needsUpdate = true;
  }

  applyDayNight(phase: 'day' | 'night', t: number): void {
    let night = 0;
    if (phase === 'night') {
      night = t < 0.1 ? t / 0.1 : t > 0.9 ? (1 - t) / 0.1 : 1;
    } else if (t > 0.88) {
      night = ((t - 0.88) / 0.12) * 0.45;
    }
    this.keyLight.intensity = THREE.MathUtils.lerp(2.2, 0.55, night);
    this.hemisphere.intensity = THREE.MathUtils.lerp(1.1, 0.45, night);
    this.heroLight.intensity = THREE.MathUtils.lerp(3.0, 5.5, night);
    this.fogTarget.copy(this.fogDay).lerp(this.fogNight, night);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = THREE.MathUtils.lerp(0.012, 0.028, night);
    }
  }

  /** Tool affordance: a soft outline on the hovered tile. Pass null to fade out. */
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

  /**
   * Ghost the selected building over the hovered tile. The footprint stays
   * lightweight (one tile) while the model and colour communicate what will be
   * placed; invalid targets tint red instead of silently accepting a click.
   */
  setBuildPreview(
    key: ModelKey | null,
    x = 0,
    z = 0,
    rotation = 0,
    valid = false,
    footprint: { width: number; height: number } = { width: 1, height: 1 },
  ): void {
    if (!key) {
      this.removeBuildPreview();
      return;
    }
    const needsLoadedModelRefresh =
      this.buildPreviewRoot?.userData.assetFallback === true && isModelReady(key);
    if (!this.buildPreviewRoot || this.buildPreviewKey !== key || needsLoadedModelRefresh) {
      this.removeBuildPreview();
      const { root } = cloneModel(key);
      root.name = `build_preview_${key}`;
      root.userData.assetFallback = !isModelReady(key);
      root.renderOrder = 4;
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.castShadow = false;
        obj.receiveShadow = false;
        obj.renderOrder = 4;
        const source = Array.isArray(obj.material) ? obj.material : [obj.material];
        const copies = source.map((material) => {
          const copy = material.clone();
          copy.transparent = true;
          copy.opacity = 0.46;
          copy.depthWrite = false;
          const color =
            copy instanceof THREE.MeshStandardMaterial ||
            copy instanceof THREE.MeshBasicMaterial ||
            copy instanceof THREE.MeshPhongMaterial
              ? copy.color.clone()
              : null;
          this.buildPreviewMaterials.push({ material: copy, color });
          return copy;
        });
        disposeCloneOwnedMaterials(source);
        obj.material = copies.length === 1 ? copies[0]! : copies;
      });
      this.buildPreviewRoot = root;
      this.buildPreviewKey = key;
      this.farmActors.add(root);
      const footprintMaterial = new THREE.MeshBasicMaterial({
        color: 0x76d88a,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.buildPreviewFootprint = new THREE.Mesh(
        new THREE.PlaneGeometry(footprint.width, footprint.height),
        footprintMaterial,
      );
      this.buildPreviewFootprint.rotation.x = -Math.PI / 2;
      this.buildPreviewFootprint.renderOrder = 3;
      this.farmActors.add(this.buildPreviewFootprint);
    } else if (this.buildPreviewFootprint && this.buildPreviewFootprintSize !== `${footprint.width}x${footprint.height}`) {
      this.buildPreviewFootprint.geometry.dispose();
      this.buildPreviewFootprint.geometry = new THREE.PlaneGeometry(footprint.width, footprint.height);
    }
    this.buildPreviewFootprintSize = `${footprint.width}x${footprint.height}`;
    const invalidTint = new THREE.Color(0xe07060);
    for (const entry of this.buildPreviewMaterials) {
      entry.material.opacity = 0.46;
      if (entry.color) {
        const color = entry.color.clone();
        if (!valid) color.lerp(invalidTint, 0.42);
        if (
          entry.material instanceof THREE.MeshStandardMaterial ||
          entry.material instanceof THREE.MeshBasicMaterial ||
          entry.material instanceof THREE.MeshPhongMaterial
        ) entry.material.color.copy(color);
      }
    }
    this.buildPreviewRoot.visible = true;
    this.buildPreviewRoot.position.set(x, this.terrain.heightAt(x, z) + 0.025, z);
    this.buildPreviewRoot.rotation.y = rotation;
    if (this.buildPreviewFootprint) {
      this.buildPreviewFootprint.visible = true;
      this.buildPreviewFootprint.position.set(x, this.terrain.heightAt(x, z) + 0.018, z);
      this.buildPreviewFootprint.rotation.y = rotation;
      (this.buildPreviewFootprint.material as THREE.MeshBasicMaterial).color.set(
        valid ? 0x76d88a : 0xe07060,
      );
    }
  }

  private removeBuildPreview(): void {
    if (!this.buildPreviewRoot) return;
    const root = this.buildPreviewRoot;
    root.removeFromParent();
    for (const entry of this.buildPreviewMaterials) entry.material.dispose();
    this.buildPreviewMaterials = [];
    disposeModelClone(root);
    this.buildPreviewRoot = null;
    this.buildPreviewKey = null;
    if (this.buildPreviewFootprint) {
      this.buildPreviewFootprint.removeFromParent();
      this.buildPreviewFootprint.geometry.dispose();
      (this.buildPreviewFootprint.material as THREE.Material).dispose();
      this.buildPreviewFootprint = null;
      this.buildPreviewFootprintSize = '';
    }
  }

  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  distToWater(x: number, z: number): number {
    return this.terrain.distToWater(x, z);
  }

  followPlayer(x: number, z: number, leadX: number, leadZ: number, dt: number): void {
    const targetX = x + leadX;
    const targetZ = z + leadZ;
    const hy = this.terrain.heightAt(x, z);

    this.updateShadowAnchor(x, z, hy);
    this.cameraTarget.x = THREE.MathUtils.damp(this.cameraTarget.x, targetX, 4.5, dt);
    this.cameraTarget.z = THREE.MathUtils.damp(this.cameraTarget.z, targetZ, 4.5, dt);
    this.cameraTarget.y = THREE.MathUtils.damp(this.cameraTarget.y, hy, 4.5, dt);

    this.zoom = THREE.MathUtils.lerp(this.zoom, this.targetZoom, 1 - Math.exp(-dt * 4.2));
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

    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset).add(this.shakeOffset);
    this.camera.lookAt(this.cameraTarget);

    this.heroLight.position.set(x, hy + 3.1, z);
    this.sky.position.copy(this.cameraTarget);

    this.scatter.update(x, z);
    this.farmTrees?.update(x, z);
  }

  snapCamera(x: number, z: number): void {
    const hy = this.terrain.heightAt(x, z);
    this.updateShadowAnchor(x, z, hy);
    this.cameraTarget.set(x, hy, z);
    this.camera.position.copy(this.cameraTarget).add(this.cameraOffset);
    this.camera.lookAt(this.cameraTarget);
    this.sky.position.copy(this.cameraTarget);
    this.scatter.update(x, z);
    this.farmTrees?.update(x, z);
  }

  shake(duration: number, amplitude: number): void {
    if (this.reducedMotion) {
      this.shakeTime = 0;
      this.shakeAmp = 0;
      this.shakeOffset.set(0, 0, 0);
      return;
    }
    this.shakeTime = duration;
    this.shakeAmp = amplitude;
  }

  adjustZoom(delta: number): number {
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom + delta, 0.78, 1.3);
    return this.targetZoom;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      this.shakeTime = 0;
      this.shakeAmp = 0;
      this.shakeOffset.set(0, 0, 0);
    }
  }

  /** Debug-only grid and coordinate labels. The normal scene never creates these. */
  setGridDebug(enabled: boolean): void {
    if (this.debugGridGroup) {
      this.debugGridGroup.removeFromParent();
      for (const material of this.debugGridMaterials) material.dispose();
      for (const geometry of this.debugGridGeometries) geometry.dispose();
      for (const texture of this.debugGridTextures) texture.dispose();
      this.debugGridMaterials = [];
      this.debugGridGeometries = [];
      this.debugGridTextures = [];
      this.debugGridGroup = null;
    }
    if (!enabled) return;

    const group = new THREE.Group();
    group.name = 'debug_grid_f12';
    const positions: number[] = [];
    for (let i = 0; i <= WORLD_SIZE; i++) {
      positions.push(i, 0.08, 0, i, 0.08, WORLD_SIZE);
      positions.push(0, 0.08, i, WORLD_SIZE, 0.08, i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: 0xf7e39a,
      transparent: true,
      opacity: 0.25,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.renderOrder = 20;
    group.add(lines);
    this.debugGridMaterials.push(material);
    this.debugGridGeometries.push(geometry);

    // One texture plane carries a tiny coordinate pair in every tile. This
    // keeps F12 at one extra draw call instead of creating 57,600 DOM or
    // Sprite objects, while still making the requested A-00/B-00 sequence
    // inspectable on both axes.
    const labelCanvas = document.createElement('canvas');
    const labelSize = 4096;
    labelCanvas.width = labelSize;
    labelCanvas.height = labelSize;
    const ctx = labelCanvas.getContext('2d');
    if (ctx) {
      const cell = labelSize / WORLD_SIZE;
      ctx.clearRect(0, 0, labelSize, labelSize);
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let ty = 0; ty < WORLD_SIZE; ty++) {
        for (let tx = 0; tx < WORLD_SIZE; tx++) {
          const x = (tx + 0.5) * cell;
          const y = (ty + 0.5) * cell;
          ctx.fillStyle = 'rgba(12, 24, 17, 0.48)';
          ctx.fillRect(tx * cell, ty * cell, cell, cell);
          ctx.fillStyle = 'rgba(255, 235, 161, 0.86)';
          ctx.fillText(this.gridLabel(tx), x, y - 3.3);
          ctx.fillStyle = 'rgba(179, 231, 214, 0.72)';
          ctx.fillText(this.gridLabel(ty), x, y + 3.3);
        }
      }
    }
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    labelTexture.magFilter = THREE.LinearFilter;
    labelTexture.minFilter = THREE.LinearFilter;
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const labelPlane = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE), labelMaterial);
    labelPlane.rotation.x = -Math.PI / 2;
    labelPlane.position.set(WORLD_SIZE / 2, 0.16, WORLD_SIZE / 2);
    labelPlane.renderOrder = 21;
    group.add(labelPlane);
    this.debugGridMaterials.push(labelMaterial);
    this.debugGridGeometries.push(labelPlane.geometry);
    this.debugGridTextures.push(labelTexture);
    this.debugGridGroup = group;
    this.overworldRoot.add(group);
  }

  private gridLabel(index: number): string {
    const block = String.fromCharCode(65 + Math.floor(index / 100));
    return `${block}-${String(index % 100).padStart(2, '0')}`;
  }

  getScreenBasis(): { forward: THREE.Vector3; right: THREE.Vector3 } {
    return { forward: this.screenForward, right: this.screenRight };
  }

  /** Screen-space direction from one world point to another, in radians. */
  screenAngleTo(fromX: number, fromZ: number, toX: number, toZ: number): number {
    this.screenAngleFrom
      .set(fromX, this.terrain.heightAt(fromX, fromZ), fromZ)
      .project(this.camera);
    this.screenAngleTarget.set(toX, this.terrain.heightAt(toX, toZ), toZ).project(this.camera);
    return Math.atan2(
      this.screenAngleTarget.x - this.screenAngleFrom.x,
      this.screenAngleTarget.y - this.screenAngleFrom.y,
    );
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
    this.terrain.updateWater(this.time, dt);
    if (!this.reducedMotion) this.updateMotes(dt);

    const target = this.toolHoverActive ? this.hoverTargetAlpha : 0;
    this.hoverAlpha = THREE.MathUtils.damp(this.hoverAlpha, target, 12, dt);
    const hoverMat = this.hoverOutline.material as THREE.LineBasicMaterial;
    hoverMat.opacity = this.hoverAlpha * 0.85;
    if (this.hoverAlpha < 0.02) this.hoverOutline.visible = false;
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
      y += Math.sin(this.time * 0.7 + i) * 0.002;
      if (y > 5.5) y = 0.5;
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

  /** Release procedural world resources and the renderer exactly once. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.setGridDebug(false);
    this.removeBuildPreview();
    this.farmTrees?.dispose();
    this.scatter.dispose();

    disposeObjectResources(this.terrain.mesh, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.terrain.water, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.terrain.bankScatter, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.structureTiles, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.hoverGroup, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.motePoints, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.sky, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.horizonGroup, { geometries: true, materials: true, textures: true });

    for (const root of [...this.actors.children, ...this.farmActors.children]) {
      root.removeFromParent();
      disposeModelClone(root);
    }
    this.scene.clear();
    this.overworldRoot.clear();
    this.actors.clear();
    this.farmActors.clear();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  getFarmActors(): THREE.Group {
    return this.farmActors;
  }

  getSharedActors(): THREE.Group {
    return this.actors;
  }

  spawnProp(key: ModelKey, x: number, z: number, parent: THREE.Group, scale = 1): THREE.Object3D {
    const { root } = cloneModel(key);
    root.position.set(x, this.terrain.heightAt(x, z), z);
    root.scale.multiplyScalar(scale);
    parent.add(root);
    this.markShadowsDirty();
    return root;
  }

  raycastGround(ndcX: number, ndcY: number): { x: number; z: number } | null {
    this.groundNdc.set(ndcX, ndcY);
    this.groundRaycaster.setFromCamera(this.groundNdc, this.camera);
    const hits = this.groundRaycaster.intersectObject(this.terrain.mesh, false);
    if (hits.length > 0 && hits[0]) {
      return { x: hits[0].point.x, z: hits[0].point.z };
    }
    if (this.groundRaycaster.ray.intersectPlane(this.groundPlane, this.groundHit)) {
      return { x: this.groundHit.x, z: this.groundHit.z };
    }
    return null;
  }

  raycastTree(ndcX: number, ndcY: number): { tx: number; ty: number } | null {
    return this.farmTrees?.pickTree(ndcX, ndcY, this.camera) ?? null;
  }

  markShadowsDirty(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  private updateShadowAnchor(x: number, z: number, y: number): void {
    const anchorX = Math.round(x / SHADOW_ANCHOR_STEP) * SHADOW_ANCHOR_STEP;
    const anchorY = Math.round(y / SHADOW_ANCHOR_STEP) * SHADOW_ANCHOR_STEP;
    const anchorZ = Math.round(z / SHADOW_ANCHOR_STEP) * SHADOW_ANCHOR_STEP;
    if (
      this.shadowAnchor.x === anchorX &&
      this.shadowAnchor.y === anchorY &&
      this.shadowAnchor.z === anchorZ
    ) {
      return;
    }
    this.shadowAnchor.set(anchorX, anchorY, anchorZ);
    // The shadow camera is only ±40 wide, so it travels with the player. The
    // quantized anchor also prevents sub-texel camera churn from rebuilding the
    // 2048px shadow map every render frame.
    this.keyLight.position.set(anchorX - 6, anchorY + 13, anchorZ + 4);
    this.keyLight.target.position.set(anchorX, anchorY, anchorZ);
    this.keyLight.target.updateMatrixWorld();
    this.markShadowsDirty();
  }

  getWorldBounds(): { minX: number; maxX: number; minZ: number; maxZ: number } {
    return { minX: 2, maxX: WORLD_SIZE - 2, minZ: 2, maxZ: WORLD_SIZE - 2 };
  }
}
