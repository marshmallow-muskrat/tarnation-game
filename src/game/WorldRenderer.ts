import * as THREE from 'three';
import {
  FARM_COLORS,
  FARM_REGION_MAX_X,
  FARM_REGION_MAX_Z,
  FARM_REGION_MIN_X,
  FARM_REGION_MIN_Z,
  GRID_H,
  GRID_W,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SIZE,
  STARTER_PLOT,
  WORLD_SIZE,
} from '../content';
import type { Tile } from '../sim/farm';
import {
  CAMERA_WORLD_EDGE_MARGIN,
  cameraShakeAmplitude,
  clampCameraCoordinate,
  clampCameraZoom,
  cameraFrustum,
  lightingProfile,
  quantizeShadowAnchor,
  SHADOW_ANCHOR_STEP,
} from '../sim/camera';
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
  private cameraShakeEnabled = true;

  private hemisphere!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private rim!: THREE.DirectionalLight;
  heroLight!: THREE.PointLight;
  private portableLightActive = false;

  private overworldRoot = new THREE.Group();
  private farmBoundaryRoot!: THREE.Group;
  private starterPlotRoot!: THREE.Group;
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
  private shakeDuration = 0;
  private shakeAmp = 0;
  /** Renderer-only deterministic jitter; never consumes the seeded sim RNG. */
  private shakeSeed = 0x6f4a_2c11;
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
    this.buildFarmBoundary();

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

  /**
   * A low, non-colliding visual boundary makes the homestead footprint legible.
   * The shovel rule in GameRuntime is the mechanical authority; this marker does
   * not wall off the market, camp, or the rest of the map.
   */
  private buildFarmBoundary(): void {
    const group = new THREE.Group();
    group.name = 'authored_homestead_boundary';
    const postGeometry = new THREE.CylinderGeometry(0.1, 0.13, 0.48, 5);
    const railGeometry = new THREE.BoxGeometry(4, 0.08, 0.08);
    const material = standardMaterial(0x9a6a3e, { flatShading: true, roughness: 0.92 });
    const postCount = 4 * (Math.round((FARM_REGION_MAX_X - FARM_REGION_MIN_X) / 4) + 1);
    const spanCount = Math.round((FARM_REGION_MAX_X - FARM_REGION_MIN_X) / 4);
    const posts = new THREE.InstancedMesh(postGeometry, material, postCount);
    const rails = new THREE.InstancedMesh(railGeometry, material, spanCount * 4);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const euler = new THREE.Euler();
    let postIndex = 0;
    let railIndex = 0;

    const addPost = (x: number, z: number): void => {
      position.set(x, this.terrain.heightAt(x, z) + 0.24, z);
      rotation.setFromEuler(euler);
      matrix.compose(position, rotation, scale);
      posts.setMatrixAt(postIndex++, matrix);
    };
    const addRail = (x: number, z: number, angle: number): void => {
      position.set(x, this.terrain.heightAt(x, z) + 0.27, z);
      euler.set(0, angle, 0);
      rotation.setFromEuler(euler);
      matrix.compose(position, rotation, scale);
      rails.setMatrixAt(railIndex++, matrix);
    };

    for (let i = 0; i <= spanCount; i++) {
      const offset = i * 4;
      addPost(FARM_REGION_MIN_X + offset, FARM_REGION_MIN_Z);
      addPost(FARM_REGION_MIN_X + offset, FARM_REGION_MAX_Z);
      addPost(FARM_REGION_MIN_X, FARM_REGION_MIN_Z + offset);
      addPost(FARM_REGION_MAX_X, FARM_REGION_MIN_Z + offset);
    }
    for (let i = 0; i < spanCount; i++) {
      const offset = i * 4 + 2;
      addRail(FARM_REGION_MIN_X + offset, FARM_REGION_MIN_Z, 0);
      addRail(FARM_REGION_MIN_X + offset, FARM_REGION_MAX_Z, 0);
      addRail(FARM_REGION_MIN_X, FARM_REGION_MIN_Z + offset, Math.PI / 2);
      addRail(FARM_REGION_MAX_X, FARM_REGION_MIN_Z + offset, Math.PI / 2);
    }
    posts.count = postIndex;
    rails.count = railIndex;
    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
    posts.computeBoundingSphere();
    rails.computeBoundingSphere();
    group.add(posts, rails);

    const markerPositions: number[] = [];
    const addMarkerSegment = (ax: number, az: number, bx: number, bz: number): void => {
      markerPositions.push(
        ax,
        this.terrain.heightAt(ax, az) + 0.11,
        az,
        bx,
        this.terrain.heightAt(bx, bz) + 0.11,
        bz,
      );
    };
    const plotMaxX = STARTER_PLOT.minX + STARTER_PLOT.width;
    const plotMaxZ = STARTER_PLOT.minZ + STARTER_PLOT.height;
    addMarkerSegment(STARTER_PLOT.minX, STARTER_PLOT.minZ, plotMaxX, STARTER_PLOT.minZ);
    addMarkerSegment(plotMaxX, STARTER_PLOT.minZ, plotMaxX, plotMaxZ);
    addMarkerSegment(plotMaxX, plotMaxZ, STARTER_PLOT.minX, plotMaxZ);
    addMarkerSegment(STARTER_PLOT.minX, plotMaxZ, STARTER_PLOT.minX, STARTER_PLOT.minZ);
    const markerGeometry = new THREE.BufferGeometry();
    markerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(markerPositions, 3));
    const markerMaterial = new THREE.LineBasicMaterial({
      color: 0xf2c266,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    });
    const marker = new THREE.LineSegments(markerGeometry, markerMaterial);
    marker.renderOrder = 6;
    const markerPostGeometry = new THREE.ConeGeometry(0.12, 0.4, 4);
    const markerPostMaterial = standardMaterial(0xf2c266, { flatShading: true, roughness: 0.82 });
    const markerPosts = new THREE.InstancedMesh(markerPostGeometry, markerPostMaterial, 4);
    const corners = [
      [STARTER_PLOT.minX, STARTER_PLOT.minZ],
      [plotMaxX, STARTER_PLOT.minZ],
      [plotMaxX, plotMaxZ],
      [STARTER_PLOT.minX, plotMaxZ],
    ] as const;
    corners.forEach(([x, z], index) => {
      position.set(x, this.terrain.heightAt(x, z) + 0.2, z);
      matrix.compose(position, rotation, scale);
      markerPosts.setMatrixAt(index, matrix);
    });
    markerPosts.instanceMatrix.needsUpdate = true;
    markerPosts.computeBoundingSphere();
    const markerFill = new THREE.Mesh(
      new THREE.PlaneGeometry(STARTER_PLOT.width, STARTER_PLOT.height),
      new THREE.MeshBasicMaterial({
        color: 0xf2c266,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    markerFill.rotation.x = -Math.PI / 2;
    markerFill.position.set(
      STARTER_PLOT.minX + STARTER_PLOT.width / 2,
      this.terrain.heightAt(
        STARTER_PLOT.minX + STARTER_PLOT.width / 2,
        STARTER_PLOT.minZ + STARTER_PLOT.height / 2,
      ) + 0.06,
      STARTER_PLOT.minZ + STARTER_PLOT.height / 2,
    );
    markerFill.renderOrder = 5;
    this.starterPlotRoot = new THREE.Group();
    this.starterPlotRoot.name = 'starter_plot_guide';
    this.starterPlotRoot.add(markerFill, marker, markerPosts);
    group.add(this.starterPlotRoot);
    this.farmBoundaryRoot = group;
    this.overworldRoot.add(group);
  }

  setStarterPlotVisible(visible: boolean): void {
    this.starterPlotRoot.visible = visible;
  }

  /** Carrying or standing near a portable-light crop expands the local light. */
  setPortableLightActive(active: boolean): void {
    this.portableLightActive = active;
    this.heroLight.distance = active ? 10 : 6;
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
          _color.copy(this.trenchStructureColor).lerp(this.waterStructureColor, t.watered ? 0.9 : 0.45);
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
    const lighting = lightingProfile(phase, t, this.portableLightActive);
    this.keyLight.intensity = lighting.keyIntensity;
    this.hemisphere.intensity = lighting.hemisphereIntensity;
    this.heroLight.intensity = lighting.heroIntensity;
    this.heroLight.distance = this.portableLightActive ? 10 : 6;
    this.fogTarget.copy(this.fogDay).lerp(this.fogNight, lighting.nightBlend);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = lighting.fogDensity;
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
    const targetX = clampCameraCoordinate(x + leadX, 2, WORLD_SIZE - 2, CAMERA_WORLD_EDGE_MARGIN);
    const targetZ = clampCameraCoordinate(z + leadZ, 2, WORLD_SIZE - 2, CAMERA_WORLD_EDGE_MARGIN);
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
      const a = cameraShakeAmplitude(this.shakeTime, this.shakeDuration, this.shakeAmp);
      this.shakeOffset.set(
        (this.nextShakeRandom() - 0.5) * a,
        (this.nextShakeRandom() - 0.5) * a * 0.4,
        (this.nextShakeRandom() - 0.5) * a,
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
    x = clampCameraCoordinate(x, 2, WORLD_SIZE - 2, CAMERA_WORLD_EDGE_MARGIN);
    z = clampCameraCoordinate(z, 2, WORLD_SIZE - 2, CAMERA_WORLD_EDGE_MARGIN);
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
    if (this.reducedMotion || !this.cameraShakeEnabled) {
      this.shakeTime = 0;
      this.shakeDuration = 0;
      this.shakeAmp = 0;
      this.shakeOffset.set(0, 0, 0);
      return;
    }
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
    const safeAmplitude = Number.isFinite(amplitude) && amplitude > 0 ? amplitude : 0;
    if (safeDuration === 0 || safeAmplitude === 0) return;
    this.shakeTime = Math.max(this.shakeTime, safeDuration);
    this.shakeDuration = Math.max(this.shakeDuration, safeDuration);
    this.shakeAmp = Math.max(this.shakeAmp, safeAmplitude);
  }

  adjustZoom(delta: number): number {
    this.targetZoom = clampCameraZoom(this.targetZoom + delta);
    return this.targetZoom;
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    if (enabled) {
      this.shakeTime = 0;
      this.shakeDuration = 0;
      this.shakeAmp = 0;
      this.shakeOffset.set(0, 0, 0);
    }
  }

  setCameraShakeEnabled(enabled: boolean): void {
    this.cameraShakeEnabled = enabled;
    if (!enabled) {
      this.shakeTime = 0;
      this.shakeDuration = 0;
      this.shakeAmp = 0;
      this.shakeOffset.set(0, 0, 0);
    }
  }

  private nextShakeRandom(): number {
    this.shakeSeed = (this.shakeSeed * 1664525 + 1013904223) >>> 0;
    return this.shakeSeed / 0x1_0000_0000;
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
    const frustum = cameraFrustum(w, h);
    this.renderer.setSize(
      Math.max(1, Number.isFinite(w) ? w : 1),
      Math.max(1, Number.isFinite(h) ? h : 1),
      false,
    );
    this.camera.left = frustum.left;
    this.camera.right = frustum.right;
    this.camera.top = frustum.top;
    this.camera.bottom = frustum.bottom;
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
    this.removeBuildPreview();
    this.farmTrees?.dispose();
    this.scatter.dispose();

    disposeObjectResources(this.terrain.mesh, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.terrain.water, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.terrain.bankScatter, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.structureTiles, { geometries: true, materials: true, textures: true });
    disposeObjectResources(this.farmBoundaryRoot, { geometries: true, materials: true, textures: true });
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
    const anchorX = quantizeShadowAnchor(x, SHADOW_ANCHOR_STEP);
    const anchorY = quantizeShadowAnchor(y, SHADOW_ANCHOR_STEP);
    const anchorZ = quantizeShadowAnchor(z, SHADOW_ANCHOR_STEP);
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
