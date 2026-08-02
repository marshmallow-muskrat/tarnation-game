import * as THREE from 'three';
import {
  AXE_DAMAGE,
  BOULDER_COOLDOWN,
  BOULDER_DAMAGE,
  BOULDER_RADIUS,
  BOULDER_RANGE,
  BOULDER_SPEED,
  BEAR_TRAP_COOLDOWN,
  BEAR_TRAP_PLACE_RANGE,
  BEAR_TRAP_RADIUS,
  BOW_COOLDOWN,
  BOW_SPEED,
  BUCKET_CAPACITY,
  CROP_DEFS,
  FARM_TREE_CHOPS,
  FARM_TREE_WOOD,
  FIST_DAMAGE,
  FIXED_DT,
  GRID_H,
  GRID_W,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SIZE,
  HOMESTEAD_UPGRADE_WOOD,
  MARKET_RANGE,
  MELEE_COOLDOWN,
  MELEE_RANGE,
  PLAYER_ACCEL,
  PLAYER_DAMP,
  PLAYER_SPEED,
  SHOT_LIFETIME,
  SHOTGUN_COOLDOWN,
  SHOTGUN_PELLETS,
  SHOTGUN_SPEED,
  SHOTGUN_SPREAD,
  STUMP_CHOPS,
  TOOLBAR_SLOTS,
  TOOL_RANGE,
  WATER_COLLECT_RANGE,
  FOX_ATTACK_RADIUS,
  FOX_ATTACK_SLOT_GAP,
  FOX_ATTACK_LUNGE,
  FOX_ATTACK_PERIOD,
  FOX_BURROW_TIME,
  FOX_EAT_TIME,
  WORLD_SIZE,
} from '../content';
import {
  addSeedToInventory,
  addToInventory,
  checkWin,
  clearStump,
  createGameState,
  cycleWeapon,
  cycleSeed,
  fillBucket,
  isStumpCleared,
  isTreeChopped,
  markTreeChopped,
  markWinShown,
  onNewDay,
  placeBuilding,
  selectedSeed,
  sellEverything,
  sellItem,
  setToast,
  stepGameClock,
  takeFromInventory,
  unlockWeapon,
  useBucketWater,
  woodCount,
  type GameState,
} from '../sim/gameState';
import {
  clearBreedingParents,
  destroyCrop,
  digTrench,
  getTile,
  harvestTile,
  hasRepelNearby,
  makeBreedingBed,
  nibbleCrop,
  placeBearTrap,
  plantTile,
  tillTile,
  tileCenter,
  triggerBearTrap,
  waterTile,
  worldToTile,
  cropValueScore,
  totalWeirdness,
} from '../sim/farm';
import { crossbreed } from '../sim/genetics';
import { hasRoomFor } from '../sim/inventory';
import { cropItem, itemInfo, ITEM_WOOD, trophyItem, type ItemId } from '../sim/items';
import { purchaseAsset } from '../sim/economy';
import {
  type OutcomeKind,
  type OutcomeStatus,
} from '../sim/outcomes';
import { rollDrop, TROPHY_ODDS } from '../sim/luck';
import {
  generateWave,
  nearestEdgePoint,
} from '../sim/raid';
import { equipmentTimingFor, type EquipmentKey } from '../content/equipment';
import {
  cloneModel,
  initAssetLoaders,
  preloadGroup,
  type AssetLoadProgress,
  type ModelKey,
} from './Assets';
import { AudioFeedback } from './AudioFeedback';
import { InputController } from './InputController';
import {
  ActionStateMachine,
  DEFAULT_INTERACT_ACTION_TIMING,
  DEFAULT_RANGED_ACTION_TIMING,
  DEFAULT_TOOL_ACTION_TIMING,
  type ActionEvent,
} from './ActionStateMachine';
import { buildMarketStall } from './MarketStall';
import {
  disposeCloneOwnedMaterials,
  disposeModelClone,
  disposeObjectResources,
  markMaterialOwner,
} from './ResourceDisposal';
import { browserSaveStorage, SaveService } from './SaveService';
import {
  advanceSaveTimer,
  completedSaveFeedback,
  savingFeedback,
  type SaveFeedback,
} from './SaveTiming';
import { WorldRenderer } from './WorldRenderer';
import { CropBatches } from './CropBatches';
import { FoxDirector, type Fox, type FoxActions, type FoxDirectionWorld } from './FoxDirector';
import { EquipmentController } from './EquipmentController';
import { PlayerActionController, type PlayerClip } from './PlayerActionController';
import { PlacementCoordinator, PLACEABLE_BUILDINGS, type PlacementContext } from './PlacementCoordinator';
import { RuntimeMetrics, type RuntimeMetricsSnapshot } from './RuntimeMetrics';
import { HudPresenter, TOOLBAR, type HudContextMenu, type HudPopup, type HudSnapshot } from './HudPresenter';
import {
  InteractionSystem,
  SLOT_AXE,
  SLOT_SHOTGUN,
  SLOT_SHOVEL,
} from './InteractionSystem';
import { getEconomyCapability } from './EconomyCapability';
import type { PlacedBuilding } from '../sim/save';
import {
  assetDefinition,
  deedAssetId,
  deedItemId,
  isVendorAsset,
  shopAssets,
  type AssetCategory,
  type AssetId,
  type PurchasableAsset,
} from '../content/purchasables';
import { CENTRAL_CAMP, CENTRAL_CAMP_FIXTURES } from '../content/mapData';
import {
  calculateEnclosedTiles,
  fixtureObstacleTiles,
  fixtureTiles,
  footprintTiles,
  normalizeOrientation,
  orientedFootprint,
  occupiedPlacedTiles,
  placedCenter,
  placedOrigin,
  placementStatus,
  tileIsEnclosed,
  tileKey,
} from '../sim/placement';

type Shot = {
  root: THREE.Object3D;
  kind: 'arrow' | 'pellet';
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material;
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  ricochet: number;
  dmg: number;
};

type PendingPlayerAction = {
  clip: PlayerClip;
  onContact?: () => void;
  onFire?: () => void;
};

type Boulder = {
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  x: number;
  z: number;
  vx: number;
  vz: number;
  travelled: number;
  hit: Set<unknown>;
};

type CropActor = {
  root: THREE.Object3D;
  baseScale: number;
  tx: number;
  ty: number;
  stage: number;
};

type PlainsAnimal = {
  root: THREE.Object3D;
  baseScale: number;
  actions: AnimalActions;
  x: number;
  z: number;
  heading: number;
  targetHeading: number;
  speed: number;
  timer: number;
  hp: number;
  state: 'idle' | 'walk' | 'hurt';
  name: string;
};

type AnimalActions = {
  mixer: THREE.AnimationMixer | null;
  idle?: THREE.AnimationAction;
  walk?: THREE.AnimationAction;
  hurt?: THREE.AnimationAction;
  active?: THREE.AnimationAction;
};

type DeathMarker = {
  root: THREE.Group;
  corpse: THREE.Object3D;
  age: number;
  lifetime: number;
  fadeAt: number;
  materials: THREE.Material[];
  patchMaterial: THREE.Material;
  patchGeometry: THREE.BufferGeometry;
};

type LootMarker = {
  root: THREE.Object3D;
  age: number;
  lifetime: number;
  x: number;
  z: number;
};

type FeedbackParticle = {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  size: number;
};

type FeedbackBurst = {
  root: THREE.Group;
  age: number;
  lifetime: number;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshBasicMaterial;
  particles: FeedbackParticle[];
};

type DirtyTile = { tx: number; ty: number };

type ToolMode = 'farm' | 'trench' | 'breed';

const CROP_MODEL_BASE: Record<keyof typeof CROP_DEFS, string> = {
  grass: 'grasscrop',
  dandelion: 'dandelion',
  beet: 'beet',
  carrot: 'carrot',
  lettuce: 'lettuce',
};

const PLAINS_ANIMALS: readonly { model: ModelKey; name: string }[] = [
  { model: 'stag', name: 'Marsh Stag' },
  { model: 'bull', name: 'Gloam Bull' },
  { model: 'deer', name: 'Pebble Deer' },
  { model: 'fox', name: 'Thicket Fox' },
  { model: 'donkey', name: 'Dust Donkey' },
];

const HOMESTEAD_MODEL_KEYS = [
  'house_1',
  'house_2',
  'house_3',
  'house_4',
  'house_5',
] as const;

const HOMESTEAD_X = HOMESTEAD_MIN_X + 8;
const HOMESTEAD_Z = HOMESTEAD_MIN_Z + 8;

const VENDOR_CATEGORIES = ['Housing', 'Weapons', 'Buildings', 'Upgrades'] as const satisfies readonly AssetCategory[];

export class GameRuntime {
  constructor(private readonly saveService = new SaveService(browserSaveStorage())) {
    this.input.setFocusHandler((focused) => this.handleFocusChange(focused));
  }

  private readonly economyCapability = getEconomyCapability();

  private gs!: GameState;
  private world!: WorldRenderer;
  private input = new InputController();
  private readonly interaction = new InteractionSystem(this.input, {
    rotatePlacement: () => this.rotatePlacement(),
    placeSelectedBuilding: () => this.placeSelectedBuilding(),
    destroyAtPointer: () => this.destroyAtPointer(),
    openPlacedContext: () => this.openPlacedContext(),
    recordToolAttempt: () => this.recordAction('tool'),
    recordCombatAttempt: () => this.recordAction('combat'),
    useBucket: () => this.useBucket(),
    fireWeapon: () => this.fireWeapon(),
    useShovel: () => this.useShovel(),
    useAxe: () => this.useAxe(),
    useCombatAxe: () => this.meleeSwing(AXE_DAMAGE),
    emptyToolSlot: (index) => setToast(this.gs, `Slot ${index + 1} is empty`, 1.2),
  });
  private readonly placement = new PlacementCoordinator({
    pointerTile: () => this.pointerTile(),
    playerX: () => this.playerX,
    playerZ: () => this.playerZ,
    heading: () => this.headingTarget,
    playerTile: () => this.worldToFarmTile(this.playerX, this.playerZ),
    gameState: () => this.gs,
    fixtureReservations: () => this.fixtureReservations,
    terrainAllowed: (tx, ty) => this.world.distToWater(tx + 0.5, ty + 0.5) >= 2.5,
    woodCount: () => woodCount(this.gs),
    homesteadX: () => HOMESTEAD_X,
    homesteadZ: () => HOMESTEAD_Z,
  } satisfies PlacementContext);
  private audio = new AudioFeedback();
  private canvas!: HTMLCanvasElement;
  private accum = 0;
  private running = false;
  private disposed = false;
  private raf = 0;

  private playerRoot!: THREE.Object3D;
  private playerActions!: PlayerActionController;
  private equipment!: EquipmentController;
  private readonly actionState = new ActionStateMachine<null>();
  private readonly pendingPlayerActions = new Map<number, PendingPlayerAction>();
  private processingActionEvents = false;
  private playerX = WORLD_SIZE / 2;
  private playerZ = WORLD_SIZE / 2;
  private velX = 0;
  private velZ = 0;
  private headingTarget = 0;
  private nearWater = false;
  private toolMode: ToolMode = 'farm';
  private buildingMode = false;
  private demolishMode = false;
  private pauseOpen = false;
  private helpOpen = false;
  private reducedMotion = false;
  private debugGrid = false;
  private vendorOpen = false;
  private vendorTab: AssetCategory = 'Housing';
  private vendorMessage = '';
  private contextMenu: HudContextMenu = {
    open: false,
    x: 0,
    y: 0,
    name: '',
    placedIndex: -1,
    gate: false,
    gateOpen: false,
  };

  private foxes: Fox[] = [];
  private deathMarkers: DeathMarker[] = [];
  private lootMarkers: LootMarker[] = [];
  private feedbackBursts: FeedbackBurst[] = [];
  private shots: Shot[] = [];
  private boulders: Boulder[] = [];
  private shotCd = 0;
  private meleeCd = 0;
  private crops: CropActor[] = [];
  private cropFallbacks = new Map<string, CropActor>();
  private cropTargets = new Map<string, { x: number; y: number }>();
  private cropTargetSnapshot: { x: number; y: number }[] = [];
  private cropBatches: CropBatches | null = null;
  private stallRoot: THREE.Object3D | null = null;
  private stallX = 0;
  private stallZ = 0;
  private nearMarket = false;
  private merchantRoot: THREE.Object3D | null = null;
  private merchantMixer: THREE.AnimationMixer | null = null;
  private merchantX = CENTRAL_CAMP.merchantX;
  private merchantZ = CENTRAL_CAMP.merchantZ;
  private nearMerchant = false;
  private fixtureRoots: THREE.Object3D[] = [];
  private homesteadRoot: THREE.Object3D | null = null;
  private buildingRoots = new Map<string, THREE.Object3D>();
  private bearTrapRoots = new Map<string, THREE.Object3D>();
  private gateCloseTimers = new Map<PlacedBuilding, number>();
  /** In-progress chops, keyed "tx,ty". */
  private treeChops = new Map<string, number>();
  private fixtureReservations = new Set([
    ...fixtureTiles(CENTRAL_CAMP_FIXTURES),
    tileKey(Math.floor(CENTRAL_CAMP.merchantX), Math.floor(CENTRAL_CAMP.merchantZ)),
  ]);
  private fixtureObstacles = new Set([
    ...fixtureObstacleTiles(CENTRAL_CAMP_FIXTURES),
    tileKey(Math.floor(CENTRAL_CAMP.merchantX), Math.floor(CENTRAL_CAMP.merchantZ)),
  ]);
  private obstacleTiles = new Set<string>();
  private interactiveOccupancy = new Set<string>();
  private topologyVersion = 0;
  private occupancyVersion = 0;
  private readonly foxDirector = new FoxDirector({
    worldToFarmTile: (x, z) => this.worldToFarmTile(x, z),
    farmTileWorld: (tx, ty) => this.farmTileWorld(tx, ty),
    heightAt: (x, z) => this.world.heightAt(x, z),
    isEnclosed: (tx, ty) => this.isEnclosed(tx, ty),
    topologyVersion: () => this.topologyVersion,
    obstacleTiles: () => this.obstacleTiles,
  } satisfies FoxDirectionWorld);
  private enclosedTiles = new Uint8Array(GRID_W * GRID_H) as Uint8Array<ArrayBufferLike>;
  private saveTimer = 0;
  private saveFeedback: SaveFeedback = { state: 'saved', message: 'Save ready' };

  private animals: PlainsAnimal[] = [];
  private animalsSeeded = false;

  private popups: HudPopup[] = [];
  private popupId = 1;
  private hitPause = 0;
  /** Renderer-only randomness; never consume the simulation RNG for decoration. */
  private feedbackSeed = 0x51f15eed;
  private winShownLocal = false;
  private readonly runtimeMetrics = new RuntimeMetrics(performance.now());
  private readonly hudPresenter = new HudPresenter();

  private readonly playerTargetQuaternion = new THREE.Quaternion();
  private readonly playerUp = new THREE.Vector3(0, 1, 0);

  async mount(
    canvas: HTMLCanvasElement,
    onHud: (s: HudSnapshot) => void,
    options: {
      newAdventure?: boolean;
      onAssetProgress?: (progress: AssetLoadProgress) => void;
    } = {},
  ): Promise<void> {
    this.disposed = false;
    this.canvas = canvas;
    this.hudPresenter.setListener(onHud);
    this.input.setGestureHandler(() => this.audio.unlock());

    // Renderer must exist before preloading: KTX2Loader.detectSupport() needs it.
    this.world = new WorldRenderer(canvas);
    this.reducedMotion = localStorage.getItem('tarnation.reducedMotion') === '1';
    this.world.setReducedMotion(this.reducedMotion);
    initAssetLoaders(this.world.renderer);
    await preloadGroup('boot', options.onAssetProgress);
    await preloadGroup('first_play', options.onAssetProgress);
    // React development mode can dispose an effect while the asynchronous
    // asset preload is still in flight. Do not let that abandoned runtime
    // attach input handlers or render over the replacement runtime.
    if (this.disposed) return;

    if (options.newAdventure) {
      this.gs = createGameState();
    } else {
      const loaded = this.saveService.read();
      if (loaded.status !== 'ok') {
        throw new Error(loaded.message ?? 'This save could not be loaded. Choose New Adventure to start a clean save.');
      }
      if (!loaded.state) {
        throw new Error('No valid save was found. Choose New Adventure to start a clean save.');
      }
      this.gs = loaded.state;
    }
    this.syncActionMenuState();
    this.input.attach(canvas);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('beforeunload', this.persist);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.playerX = this.gs.playerX;
    this.playerZ = this.gs.playerZ;

    this.world.initFarmTrees({
      heightAt: (x, z) => this.world.heightAt(x, z),
      distToWater: (x, z) => this.world.distToWater(x, z),
      isChopped: (tx, ty) => isTreeChopped(this.gs, tx, ty),
      isStumpCleared: (tx, ty) => isStumpCleared(this.gs, tx, ty),
      tileBlocked: (tx, ty) => (this.gs.tiles[ty]?.[tx]?.state ?? 'grass') !== 'grass',
    });

    this.spawnPlayer();
    this.spawnStall();
    this.spawnMerchantCamp();
    this.cropBatches = new CropBatches();
    this.world.getFarmActors().add(this.cropBatches.getRoot());
    this.syncBuildings();
    for (const placed of this.gs.placedBuildings) {
      if (assetDefinition(placed.id)?.gate && placed.gateOpen) this.gateCloseTimers.set(placed, 3.5);
    }
    this.syncBearTrapModels();
    this.seedPlainsAnimals();
    this.refreshObstacleTopology();
    this.syncWorldTiles();
    this.rebuildCrops();
    this.recalculateEnclosure();
    this.world.snapCamera(this.playerX, this.playerZ);

    if (this.gs.clock.phase === 'night') this.spawnRaid();

    this.running = true;
    this.saveTimer = 0;
    this.persist();
    this.loop(performance.now());
    this.pushHud(true);
    this.loadBackgroundAssets(options.onAssetProgress);

    // Dev handle: lets the browser console drive the game for spot checks.
    (window as unknown as { tarnation?: GameRuntime }).tarnation = this;
  }

  private loadBackgroundAssets(onProgress?: (progress: AssetLoadProgress) => void): void {
    const load = async (): Promise<void> => {
      if (this.disposed) return;
      await preloadGroup('nearby', onProgress);
      if (this.disposed) return;
      this.syncBuildings();
      await preloadGroup('catalog', onProgress);
      if (this.disposed) return;
      // A saved run may contain a building whose model belongs to the catalog
      // group. Re-sync once that group is ready so the initial fallback is
      // replaced without delaying first play.
      this.syncBuildings();
      if (this.disposed) return;
      await preloadGroup('optional', onProgress);
    };
    void load().catch((err: unknown) => {
      console.error('[Assets] background load failed', err);
    });
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.clearShots();
    this.clearBoulders();
    this.clearFoxes(false);
    this.clearAnimals();
    this.clearCrops();
    this.cropBatches?.dispose();
    this.cropBatches = null;
    this.clearDeathMarkers();
    this.clearLootMarkers();
    this.clearFeedbackBursts();

    this.equipment?.dispose();
    this.playerActions?.dispose();
    this.merchantMixer?.stopAllAction();
    if (this.merchantMixer && this.merchantRoot) this.merchantMixer.uncacheRoot(this.merchantRoot);
    this.merchantMixer = null;
    if (this.playerRoot) {
      this.playerRoot.removeFromParent();
      disposeModelClone(this.playerRoot);
    }
    if (this.stallRoot) {
      this.stallRoot.removeFromParent();
      disposeObjectResources(this.stallRoot, { geometries: true, materials: true, textures: true });
      this.stallRoot = null;
    }
    for (const root of this.fixtureRoots) {
      root.removeFromParent();
      disposeModelClone(root);
    }
    this.fixtureRoots = [];
    if (this.merchantRoot) {
      this.merchantRoot.removeFromParent();
      disposeModelClone(this.merchantRoot);
      this.merchantRoot = null;
    }
    if (this.homesteadRoot) {
      this.homesteadRoot.removeFromParent();
      disposeModelClone(this.homesteadRoot);
      this.homesteadRoot = null;
    }
    for (const root of this.buildingRoots.values()) {
      root.removeFromParent();
      disposeModelClone(root);
    }
    this.buildingRoots.clear();
    for (const root of this.bearTrapRoots.values()) {
      root.removeFromParent();
      disposeModelClone(root);
    }
    this.bearTrapRoots.clear();
    this.gateCloseTimers.clear();
    this.treeChops.clear();
    this.cancelPlayerActions('focus_lost');
    this.input.setFocusHandler(null);
    this.input.dispose();
    this.input.setGestureHandler(null);
    this.audio.dispose();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('beforeunload', this.persist);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.persist();
    this.hudPresenter.setListener(null);
    this.world?.dispose();
    const handles = window as unknown as {
      tarnation?: GameRuntime;
    };
    if (handles.tarnation === this) delete handles.tarnation;
  }

  dismissWin(): void {
    this.winShownLocal = true;
    markWinShown(this.gs);
    this.persist();
    this.pushHud(true);
  }

  private resize = (): void => {
    const parent = this.canvas.parentElement;
    const w = parent?.clientWidth ?? window.innerWidth;
    const h = parent?.clientHeight ?? window.innerHeight;
    this.canvas.width = w * Math.min(window.devicePixelRatio, 2);
    this.canvas.height = h * Math.min(window.devicePixelRatio, 2);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.world?.resize(w, h);
  };

  private persist = (): void => {
    if (!this.gs) return;
    this.saveFeedback = savingFeedback();
    this.pushHud(true);
    const result = this.saveService.save(this.gs);
    if (result.status === 'ok') this.saveTimer = 0;
    this.saveFeedback = completedSaveFeedback(result);
    if (result.status !== 'ok') {
      console.error(`[Save] ${result.status}: ${result.message ?? 'save was not written'}`);
    }
    this.pushHud(true);
  };

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.persist();
  };

  private spawnPlayer(): void {
    const { root, animations } = cloneModel('player');
    this.playerRoot = root;
    this.playerRoot.position.set(this.playerX, 0, this.playerZ);
    this.world.getSharedActors().add(this.playerRoot);
    this.playerActions = new PlayerActionController(root, animations);
    this.equipment = new EquipmentController(root, this.playerActions);
    this.equipment.refresh(this.gs);
  }

  /** The legacy selling stall remains separate from the traveling merchant. */
  private spawnStall(): void {
    if (this.stallRoot) return;
    const root = buildMarketStall();
    this.stallX = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2 + 6;
    this.stallZ = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE - 8;
    root.position.set(this.stallX, this.world.heightAt(this.stallX, this.stallZ), this.stallZ);
    root.rotation.y = -0.5;
    this.stallRoot = root;
    this.world.getFarmActors().add(root);
    this.world.markShadowsDirty();
  }

  private spawnMerchantCamp(): void {
    for (const root of this.fixtureRoots) {
      root.removeFromParent();
      disposeModelClone(root);
    }
    this.fixtureRoots = [];
    for (const fixture of CENTRAL_CAMP_FIXTURES) {
      const asset = assetDefinition(fixture.id);
      if (!asset) continue;
      const { root } = cloneModel(asset.modelKey);
      const center = placedCenter({ tx: fixture.tx, ty: fixture.ty }, fixture.rotation, asset);
      root.name = `fixture_${fixture.id}`;
      root.position.set(center.x, this.world.heightAt(center.x, center.z), center.z);
      root.rotation.y = normalizeOrientation(fixture.rotation) * Math.PI / 2;
      this.world.getFarmActors().add(root);
      this.fixtureRoots.push(root);
    }

    if (!this.merchantRoot) {
      const { root, animations } = cloneModel('player');
      root.name = 'traveling_merchant';
      root.scale.multiplyScalar(0.92);
      root.position.set(this.merchantX, this.world.heightAt(this.merchantX, this.merchantZ), this.merchantZ);
      root.rotation.y = Math.PI;
      this.merchantRoot = root;
      this.world.getFarmActors().add(root);
      const idle = animations.find((clip) => /^idle$/i.test(clip.name));
      if (idle) {
        this.merchantMixer = new THREE.AnimationMixer(root);
        const action = this.merchantMixer.clipAction(idle);
        // Keep two copies of the same character from breathing in lockstep.
        action.time = idle.duration * 0.53;
        action.play();
      }
    }
    this.world.markShadowsDirty();
  }

  /** Cache movement obstacles once per placement/gate topology change. */
  private refreshObstacleTopology(): void {
    this.obstacleTiles.clear();
    for (const key of this.fixtureObstacles) this.obstacleTiles.add(key);
    for (const key of occupiedPlacedTiles(this.gs.placedBuildings)) this.obstacleTiles.add(key);
    this.topologyVersion++;
    this.foxDirector.clear();
    this.refreshInteractiveOccupancy();
  }

  /**
   * Decorative scatter has no gameplay authority, but it must not draw through
   * camp reservations, placed footprints, or worked/cropped tiles.
   */
  private refreshInteractiveOccupancy(): void {
    this.interactiveOccupancy.clear();
    for (const key of this.fixtureReservations) this.interactiveOccupancy.add(key);
    for (const key of this.obstacleTiles) this.interactiveOccupancy.add(key);
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const tile = this.gs.tiles[ty]?.[tx];
        if (tile && (tile.state !== 'grass' || tile.bearTrap === true || tile.bearTrapClosed === true)) {
          this.interactiveOccupancy.add(tileKey(tx, ty));
        }
      }
    }
    this.occupancyVersion++;
    this.world.setInteractiveOccupancy(this.interactiveOccupancy, this.occupancyVersion);
  }

  /** Push a tile-state mutation to both the terrain and deterministic scatter. */
  private syncWorldTiles(dirtyTiles?: readonly DirtyTile[]): void {
    this.world.syncFarmTiles(this.gs.tiles);
    if (!dirtyTiles) {
      this.refreshInteractiveOccupancy();
      return;
    }
    for (const { tx, ty } of dirtyTiles) {
      if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) continue;
      const key = tileKey(tx, ty);
      const tile = this.gs.tiles[ty]![tx]!;
      const occupied = tile.state !== 'grass' || tile.bearTrap === true || tile.bearTrapClosed === true;
      if (occupied) this.interactiveOccupancy.add(key);
      else this.interactiveOccupancy.delete(key);
    }
    this.occupancyVersion++;
    this.world.setInteractiveOccupancy(this.interactiveOccupancy, this.occupancyVersion);
  }

  private syncBuildings(): void {
    if (this.homesteadRoot) {
      this.homesteadRoot.removeFromParent();
      disposeModelClone(this.homesteadRoot);
    }
    this.homesteadRoot = null;
    for (const root of this.buildingRoots.values()) {
      root.removeFromParent();
      disposeModelClone(root);
    }
    this.buildingRoots.clear();

    const tier = Math.min(Math.max(this.gs.homesteadTier, 1), HOMESTEAD_MODEL_KEYS.length);
    const homestead = cloneModel(HOMESTEAD_MODEL_KEYS[tier - 1]! ).root;
    homestead.name = `homestead_tier_${tier}`;
    homestead.position.set(HOMESTEAD_X, this.world.heightAt(HOMESTEAD_X, HOMESTEAD_Z), HOMESTEAD_Z);
    homestead.rotation.y = -0.25;
    this.world.getFarmActors().add(homestead);
    this.homesteadRoot = homestead;

    this.gs.placedBuildings.forEach((placed: PlacedBuilding, index) => {
      const def = assetDefinition(placed.id);
      if (!def) return;
      const root = cloneModel(def.modelKey).root;
      root.name = `placed_${placed.id}_${index}`;
      root.position.set(placed.x, this.world.heightAt(placed.x, placed.z), placed.z);
      root.rotation.y = normalizeOrientation(placed.rotation) * Math.PI / 2;
      if (def.gate && placed.gateOpen) root.rotation.y += Math.PI / 2;
      this.world.getFarmActors().add(root);
      this.buildingRoots.set(`${index}:${placed.id}`, root);
    });
    this.world.markShadowsDirty();
  }

  private syncBearTrapModels(): void {
    for (const root of this.bearTrapRoots.values()) {
      root.removeFromParent();
      disposeModelClone(root);
    }
    this.bearTrapRoots.clear();
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const tile = this.gs.tiles[ty]![tx]!;
        if (!tile.bearTrap && !tile.bearTrapClosed) continue;
        const key = `${tx},${ty}`;
        const model = tile.bearTrapClosed ? 'bear_trap_closed' : 'bear_trap_open';
        const root = cloneModel(model).root;
        const wc = this.farmTileWorld(tx, ty);
        root.name = `${model}_${key}`;
        root.position.set(wc.x, this.world.heightAt(wc.x, wc.z), wc.z);
        root.rotation.y = (tx * 17 + ty * 31) % 6.28;
        this.world.getFarmActors().add(root);
        this.bearTrapRoots.set(key, root);
      }
    }
    this.world.markShadowsDirty();
  }

  // ---------------------------------------------------------------- HUD API

  sellOne(id: ItemId): void {
    this.recordOutcome('sale', 'attempted');
    if (!this.nearMarket) {
      this.recordOutcome('sale', 'rejected');
      return;
    }
    const earned = sellItem(this.gs, id, false);
    if (earned > 0) this.afterSale(id, earned);
    else this.recordOutcome('sale', 'rejected');
  }

  sellStack(id: ItemId): void {
    this.recordOutcome('sale', 'attempted');
    if (!this.nearMarket) {
      this.recordOutcome('sale', 'rejected');
      return;
    }
    const earned = sellItem(this.gs, id, true);
    if (earned > 0) this.afterSale(id, earned);
    else this.recordOutcome('sale', 'rejected');
  }

  sellAll(): void {
    this.recordOutcome('sale', 'attempted');
    if (!this.nearMarket) {
      this.recordOutcome('sale', 'rejected');
      return;
    }
    const earned = sellEverything(this.gs);
    if (earned > 0) {
      this.recordOutcome('sale', 'completed');
      this.runtimeMetrics.recordSale(earned);
      setToast(this.gs, `Sold everything for ${earned} duckettes`, 2.5);
      this.popup(`+${earned}₫`, this.playerX, this.playerZ);
      this.persist();
      this.pushHud(true);
    } else this.recordOutcome('sale', 'rejected');
  }

  private afterSale(id: ItemId, earned: number): void {
    this.recordOutcome('sale', 'completed');
    this.runtimeMetrics.recordSale(earned);
    setToast(this.gs, `Sold ${itemInfo(id).name} · +${earned}₫`, 1.5);
    this.popup(`+${earned}₫`, this.playerX, this.playerZ);
    this.persist();
    this.pushHud(true);
  }

  selectSlot(index: number): void {
    if (index < 0 || index >= TOOLBAR_SLOTS) return;
    this.buildingMode = false;
    this.placement.clear();
    this.demolishMode = false;
    this.gs.inventoryOpen = false;
    this.closeContextMenu();
    this.cancelPlayerActions();
    if (index !== SLOT_SHOTGUN) this.clearShots();
    this.gs.toolbarSlot = index;
    this.gs.toolSlotActive = false;
    if (index === SLOT_SHOTGUN) this.gs.weapon = this.gs.weapon === 'bow' ? 'bow' : 'shotgun';
    if (index === SLOT_AXE) this.gs.weapon = 'axe';
    if (index !== SLOT_SHOVEL) this.toolMode = 'farm';
    this.equipment.refresh(this.gs);
    this.pushHud(true);
  }

  selectToolSlot(): void {
    this.buildingMode = false;
    this.placement.clear();
    this.demolishMode = false;
    this.gs.inventoryOpen = false;
    this.syncActionMenuState();
    this.cancelPlayerActions();
    this.clearShots();
    this.gs.toolSlotActive = true;
    this.toolMode = 'farm';
    this.equipment.refresh(this.gs);
    this.pushHud(true);
  }

  toggleBuildMode(): void {
    if (!this.buildingMode && !this.legacyBuildEnabled() && !this.nearMerchant && !this.placement.activeDeedAssetId) {
      setToast(this.gs, 'Visit the Traveling Merchant to buy building deeds', 2);
      return;
    }
    if (!this.buildingMode && !this.legacyBuildEnabled() && this.nearMerchant && !this.placement.activeDeedAssetId) {
      this.openVendor();
      return;
    }
    this.buildingMode = !this.buildingMode;
    this.toolMode = 'farm';
    this.cancelPlayerActions();
    this.clearShots();
    this.gs.toolSlotActive = false;
    this.equipment.refresh(this.gs);
    setToast(
      this.gs,
      this.buildingMode
        ? `Build mode · choose a structure, then click clear ground`
        : 'Build mode off',
      1.6,
    );
    this.pushHud(true);
  }

  selectBuild(index: number): void {
    if (!this.placement.select(index)) return;
    if (!this.buildingMode) this.buildingMode = true;
    this.toolMode = 'farm';
    setToast(this.gs, `Build: ${PLACEABLE_BUILDINGS[index]!.name}`, 1.2);
    this.pushHud(true);
  }

  toggleHelp(): void {
    this.helpOpen = !this.helpOpen;
    if (this.helpOpen) {
      this.velX = 0;
      this.velZ = 0;
    }
    this.syncActionMenuState();
    this.pushHud(true);
  }

  toggleInventory(): void {
    this.gs.inventoryOpen = !this.gs.inventoryOpen;
    this.syncActionMenuState();
    this.pushHud(true);
  }

  private legacyBuildEnabled(): boolean {
    return new URLSearchParams(window.location.search).has('legacy');
  }

  private availableVendorTabs(): AssetCategory[] {
    return VENDOR_CATEGORIES.filter((category) => shopAssets(category).length > 0);
  }

  openVendor(): void {
    if (!this.nearMerchant) {
      setToast(this.gs, 'Stand near the Traveling Merchant to shop', 1.8);
      return;
    }
    this.vendorOpen = true;
    this.vendorMessage = '';
    this.buildingMode = false;
    this.placement.clear();
    this.demolishMode = false;
    this.gs.inventoryOpen = false;
    this.closeContextMenu();
    this.cancelPlayerActions();
    this.velX = 0;
    this.velZ = 0;
    this.syncActionMenuState();
    this.pushHud(true);
  }

  closeVendor(): void {
    this.vendorOpen = false;
    this.vendorMessage = '';
    this.syncActionMenuState();
    this.pushHud(true);
  }

  selectVendorTab(tab: AssetCategory): void {
    if (!this.availableVendorTabs().includes(tab)) return;
    this.vendorTab = tab;
    this.vendorMessage = '';
    this.pushHud(true);
  }

  buyAsset(id: AssetId): void {
    this.recordOutcome('purchase', 'attempted');
    if (!this.nearMerchant) {
      this.recordOutcome('purchase', 'rejected');
      return;
    }
    const asset = assetDefinition(id);
    if (!asset || !isVendorAsset(asset)) {
      this.recordOutcome('purchase', 'rejected');
      return;
    }
    const result = purchaseAsset(this.gs, asset, this.economyCapability);
    if (!result.ok) {
      this.recordOutcome('purchase', 'rejected');
      this.vendorMessage = `Cannot buy ${asset.displayName}: ${result.quote.reasons.join(' · ')}`;
      setToast(this.gs, this.vendorMessage, 2.2);
      this.pushHud(true);
      return;
    }
    const materialSummary = Object.entries(result.materialSpent)
      .map(([material, cost]) => `${cost} ${material}`)
      .join(', ');
    const spentSummary = result.duckettesSpent > 0 || materialSummary
      ? ` · spent ${result.duckettesSpent} duckettes${materialSummary ? ` + ${materialSummary}` : ''}`
      : this.economyCapability.allowFreePurchases
        ? ' · no currency cost in this sandbox'
        : ' · no duckette or material cost';
    this.vendorMessage = `${asset.displayName} deed added to inventory${spentSummary}`;
    this.recordOutcome('purchase', 'completed');
    this.persist();
    this.pushHud(true);
  }

  useInventoryItem(id: ItemId): void {
    const assetId = deedAssetId(id);
    if (!assetId) return;
    const asset = assetDefinition(assetId);
    if (!asset || !this.gs.inventory.some((slot) => slot?.id === id)) return;
    this.gs.inventoryOpen = false;
    this.syncActionMenuState();
    if (asset.id === 'utility:bear-trap') {
      this.gs.bearTrapCooldown = 0;
      this.tryBearTrap(() => takeFromInventory(this.gs, id, 1));
      this.pushHud(true);
      return;
    }
    if (asset.useType === 'place') {
      this.startPlacement(asset.id);
      return;
    }
    if (asset.useType === 'equip') {
      const equipped = this.equipCatalogAsset(asset);
      if (equipped) {
        takeFromInventory(this.gs, id, 1);
        this.persist();
      }
      this.pushHud(true);
      return;
    }
    if (asset.id === 'upgrade:irrigation') {
      if (this.gs.irrigationTier >= 3) {
        setToast(this.gs, 'Irrigation is already fully upgraded', 1.6);
        return;
      }
      this.gs.irrigationTier = 3;
      takeFromInventory(this.gs, id, 1);
      setToast(this.gs, 'Irrigation upgraded · crops no longer need bucket water', 2.2);
      this.recordAction('upgrade_irrigation');
      this.persist();
      this.pushHud(true);
      return;
    }
    if (asset.id === 'ability:boulder') {
      if (!this.tryBoulderRoll()) return;
    }
    if (!takeFromInventory(this.gs, id, 1)) return;
    this.persist();
    this.pushHud(true);
  }

  deleteInventoryItem(id: ItemId): void {
    if (takeFromInventory(this.gs, id, 1)) {
      setToast(this.gs, `Deleted one ${itemInfo(id).name}`, 1.4);
      this.persist();
      this.pushHud(true);
    }
  }

  private equipCatalogAsset(asset: PurchasableAsset): boolean {
    if (asset.id === 'tool:shotgun') {
      this.selectSlot(SLOT_SHOTGUN);
      return true;
    }
    if (asset.id === 'tool:shovel') {
      this.selectSlot(SLOT_SHOVEL);
      return true;
    }
    if (asset.id === 'tool:axe') {
      this.selectSlot(SLOT_AXE);
      return true;
    }
    if (asset.id === 'tool:bucket') {
      this.selectToolSlot();
      return true;
    }
    return false;
  }

  private startPlacement(assetId: AssetId): void {
    const asset = assetDefinition(assetId);
    if (!asset || asset.useType !== 'place') return;
    if (!this.gs.inventory.some((slot) => slot?.id === deedItemId(assetId))) {
      setToast(this.gs, `No ${asset.displayName} deed`, 1.4);
      return;
    }
    if (!this.placement.begin(assetId)) return;
    this.buildingMode = true;
    this.demolishMode = false;
    this.toolMode = 'farm';
    this.cancelPlayerActions();
    this.clearShots();
    setToast(this.gs, `${asset.displayName} placement · right-click rotates · Esc cancels`, 2);
    this.pushHud(true);
  }

  private rotatePlacement(): void {
    if (!this.buildingMode || !this.placement.activeDeedAssetId) return;
    this.placement.rotate();
    this.pushHud(true);
  }

  private cancelActiveState(): void {
    if (this.contextMenu.open) {
      this.closeContextMenu();
      return;
    }
    if (this.buildingMode || this.placement.activeDeedAssetId) {
      this.cancelPlayerActions();
      this.recordOutcome('building', 'cancelled');
      this.buildingMode = false;
      this.placement.clear();
      this.world.setBuildPreview(null);
      setToast(this.gs, 'Placement cancelled', 1.2);
      this.pushHud(true);
      return;
    }
    if (this.actionState.isBusy) {
      this.cancelPlayerActions();
      return;
    }
    if (this.demolishMode) {
      this.demolishMode = false;
      setToast(this.gs, 'Demolish mode off', 1.2);
      this.pushHud(true);
      return;
    }
    if (this.vendorOpen) {
      this.closeVendor();
      return;
    }
    if (this.helpOpen) {
      this.helpOpen = false;
      this.pushHud(true);
      return;
    }
    if (this.gs.inventoryOpen) {
      this.gs.inventoryOpen = false;
      this.syncActionMenuState();
      this.pushHud(true);
      return;
    }
    if (this.pauseOpen) {
      this.pauseOpen = false;
      this.syncActionMenuState();
      this.pushHud(true);
      return;
    }
    this.pauseOpen = true;
    this.velX = 0;
    this.velZ = 0;
    this.syncActionMenuState();
    this.pushHud(true);
  }

  resumeGame(): void {
    if (!this.pauseOpen) return;
    this.pauseOpen = false;
    this.syncActionMenuState();
    this.pushHud(true);
  }

  closeContextMenu(): void {
    this.contextMenu = {
      open: false,
      x: 0,
      y: 0,
      name: '',
      placedIndex: -1,
      gate: false,
      gateOpen: false,
    };
    this.syncActionMenuState();
    this.pushHud(true);
  }

  private placedIndexAtPointer(): number {
    const tile = this.pointerTile();
    if (!tile) return -1;
    for (let index = this.gs.placedBuildings.length - 1; index >= 0; index--) {
      const placed = this.gs.placedBuildings[index]!;
      const asset = assetDefinition(placed.id);
      if (!asset || asset.fixture) continue;
      const origin = placedOrigin(placed, placed.rotation, asset);
      if (footprintTiles(asset, origin, placed.rotation).some((t) => t.tx === tile.tx && t.ty === tile.ty)) return index;
    }
    return -1;
  }

  private openPlacedContext(): boolean {
    const index = this.placedIndexAtPointer();
    if (index < 0) return false;
    const asset = assetDefinition(this.gs.placedBuildings[index]!.id);
    if (!asset || asset.fixture) return false;
    const pointer = this.input.getPointerClient();
    this.contextMenu = {
      open: true,
      x: pointer.x,
      y: pointer.y,
      name: asset.displayName,
      placedIndex: index,
      gate: asset.gate,
      gateOpen: this.gs.placedBuildings[index]!.gateOpen === true,
    };
    this.syncActionMenuState();
    this.pushHud(true);
    return true;
  }

  contextRotate(): void {
    const index = this.contextMenu.placedIndex;
    const placed = this.gs.placedBuildings[index];
    const asset = placed ? assetDefinition(placed.id) : null;
    if (!placed || !asset) return this.closeContextMenu();
    const next = (normalizeOrientation(placed.rotation) + 1) % 4;
    const origin = placedOrigin(placed, next, asset);
    const otherPlaced = this.gs.placedBuildings.filter((_, i) => i !== index);
    const status = placementStatus({
      asset,
      origin,
      rotation: next,
      tiles: this.gs.tiles,
      placed: otherPlaced,
      fixtures: this.fixtureReservations,
    });
    if (!status.valid) {
      setToast(this.gs, `Cannot rotate: ${status.reason}`, 1.8);
      return this.closeContextMenu();
    }
    placed.rotation = next;
    this.refreshObstacleTopology();
    this.syncBuildings();
    this.recalculateEnclosure();
    this.persist();
    this.closeContextMenu();
  }

  contextDestroy(): void {
    const index = this.contextMenu.placedIndex;
    this.closeContextMenu();
    this.destroyPlacedIndex(index);
  }

  contextToggleGate(): void {
    const index = this.contextMenu.placedIndex;
    const placed = this.gs.placedBuildings[index];
    const asset = placed ? assetDefinition(placed.id) : null;
    if (!placed || !asset?.gate) return this.closeContextMenu();
    placed.gateOpen = placed.gateOpen !== true;
    if (placed.gateOpen) this.gateCloseTimers.set(placed, 3.5);
    else this.gateCloseTimers.delete(placed);
    this.refreshObstacleTopology();
    this.syncBuildings();
    this.recalculateEnclosure();
    this.persist();
    setToast(this.gs, placed.gateOpen ? 'Gate opened' : 'Gate closed', 1.1);
    this.closeContextMenu();
  }

  private destroyAtPointer(): void {
    const index = this.placedIndexAtPointer();
    if (index < 0) {
      setToast(this.gs, 'Point at a placed asset to demolish it', 1.2);
      return;
    }
    this.destroyPlacedIndex(index);
  }

  private destroyPlacedIndex(index: number): void {
    const placed = this.gs.placedBuildings[index];
    if (!placed) return;
    const asset = assetDefinition(placed.id);
    if (!asset || asset.fixture) return;
    const deed = deedItemId(asset.id);
    if (!hasRoomFor(this.gs.inventory, deed)) {
      setToast(this.gs, 'No inventory space for the returned deed', 1.8);
      return;
    }
    this.gateCloseTimers.delete(placed);
    this.gs.placedBuildings.splice(index, 1);
    addToInventory(this.gs, deed, 1);
    this.refreshObstacleTopology();
    this.syncBuildings();
    this.recalculateEnclosure();
    this.persist();
    setToast(this.gs, `${asset.displayName} demolished · deed returned`, 1.6);
    this.pushHud(true);
  }

  useUltimate(): void {
    this.recordAction('boulder');
    if (this.tryBoulderRoll()) this.persist();
  }

  useBearTrap(): void {
    this.recordAction('bear_trap');
    this.tryBearTrap();
  }

  /** Console helpers — teleport, hand out items, jump the clock. */
  debug() {
    return {
      state: this.gs,
      world: this.world,
      economy: () => this.economySnapshot(),
      teleport: (x: number, z: number) => {
        this.playerX = x;
        this.playerZ = z;
        this.velX = 0;
        this.velZ = 0;
        this.world.snapCamera(x, z);
      },
      grant: (id: ItemId, n = 1) => {
        addToInventory(this.gs, id, n);
        this.pushHud(true);
      },
      till: (radius = 3) => {
        const cx = Math.floor(this.playerX);
        const cz = Math.floor(this.playerZ);
        let n = 0;
        for (let ty = cz - radius; ty <= cz + radius; ty++) {
          for (let tx = cx - radius; tx <= cx + radius; tx++) {
            if (this.tileBlockedForTilling(tx, ty)) continue;
            if (tillTile(this.gs.tiles, tx, ty, this.gs.clock.day)) n++;
          }
        }
        this.world.getFarmTrees()?.rebuildAll();
        this.syncWorldTiles();
        return n;
      },
      skipDay: () => {
        this.gs.clock = { ...this.gs.clock, day: this.gs.clock.day + 1 };
        const res = onNewDay(this.gs);
        this.refreshCropTargetsFromTiles();
        this.clearDeathMarkers();
        this.clearLootMarkers();
        this.clearFeedbackBursts();
        this.world.getFarmTrees()?.rebuildAll();
        this.syncWorldTiles();
        this.pushHud(true);
        return { lost: res.lostTilth.length, regrown: res.regrown.length };
      },
      raid: () => {
        this.spawnRaid();
        for (const w of this.foxes) {
          w.state = 'seek';
          w.timer = 0;
          w.x = this.playerX + (this.gs.rng() - 0.5) * 5;
          w.z = this.playerZ + (this.gs.rng() - 0.5) * 5;
          w.root.scale.setScalar(w.baseScale);
          w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
          this.playFoxAction(w, 'walk');
        }
        return this.foxes.length;
      },
      foxCount: () => this.foxes.length,
      melee: () => {
        this.meleeCd = 0;
        this.meleeSwing(AXE_DAMAGE);
        return this.foxes.length;
      },
    };
  }

  private recordAction(kind: string): void {
    this.runtimeMetrics.recordAction(kind);
  }

  private handleFocusChange(focused: boolean): void {
    if (focused) {
      this.actionState.enable();
      if (this.gs) this.syncActionMenuState();
      return;
    }
    const cancelled = this.actionState.disable();
    for (const actionId of cancelled) this.pendingPlayerActions.delete(actionId);
    this.playerActions?.cancel();
    this.velX = 0;
    this.velZ = 0;
  }

  private cancelPlayerActions(reason: 'cancel' | 'focus_lost' = 'cancel'): void {
    const cancelled = this.actionState.cancel(reason);
    for (const actionId of cancelled) this.pendingPlayerActions.delete(actionId);
    this.playerActions?.cancel();
  }

  private syncActionMenuState(): void {
    const menuOpen =
      this.pauseOpen ||
      this.helpOpen ||
      this.vendorOpen ||
      this.contextMenu.open ||
      this.gs.inventoryOpen;
    if (menuOpen) {
      const cancelled = this.actionState.enterMenu();
      for (const actionId of cancelled) this.pendingPlayerActions.delete(actionId);
      this.playerActions?.cancel();
    } else {
      this.actionState.exitMenu();
    }
  }

  private flushActionEvents(): void {
    if (this.processingActionEvents) return;
    this.processingActionEvents = true;
    try {
      while (true) {
        const events = this.actionState.drainEvents();
        if (events.length === 0) break;
        for (const event of events) this.applyActionEvent(event);
      }
    } finally {
      this.processingActionEvents = false;
    }
  }

  private applyActionEvent(event: ActionEvent<null>): void {
    const pending = this.pendingPlayerActions.get(event.actionId);
    if (!pending) return;
    if (event.type === 'start') {
      if (event.kind === 'tool') this.meleeCd = MELEE_COOLDOWN;
      this.playerActions?.play(pending.clip);
    } else if (event.type === 'contact') {
      pending.onContact?.();
    } else if (event.type === 'fire') {
      pending.onFire?.();
    } else if (event.type === 'complete') {
      this.pendingPlayerActions.delete(event.actionId);
    }
  }

  private recordOutcome(
    kind: OutcomeKind,
    status: OutcomeStatus,
    legacyActionKind: string = kind,
  ): void {
    this.runtimeMetrics.recordOutcome(kind, status, this.gs.simTime, legacyActionKind);
  }

  private economySnapshot(): RuntimeMetricsSnapshot {
    return this.runtimeMetrics.snapshot(this.gs.simTime, this.gs.clock.day, performance.now());
  }

  // ------------------------------------------------------------------- loop

  private last = 0;
  private loop = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;

    if (this.hitPause > 0) {
      this.hitPause -= dt;
      this.world.render();
      this.input.endFrame();
      return;
    }

    this.accum += dt;
    while (this.accum >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accum -= FIXED_DT;
    }

    this.playerActions.update(dt);
    this.merchantMixer?.update(dt);
    for (const a of this.animals) a.actions.mixer?.update(dt);
    this.world.update(dt);
    this.stepPopups(dt);
    this.stepDeathMarkers(dt);
    this.stepLootMarkers(dt);
    this.stepFeedbackBursts(dt);

    const speed = Math.hypot(this.velX, this.velZ);
    this.playerActions.updateLocomotion(speed > 0.4, speed, this.equipment.animationProfile);

    let leadX = 0;
    let leadZ = 0;
    const sp = Math.hypot(this.velX, this.velZ);
    if (sp > 0.1) {
      leadX = (this.velX / sp) * 1.2;
      leadZ = (this.velZ / sp) * 1.2;
    }
    this.world.followPlayer(this.playerX, this.playerZ, leadX, leadZ, dt);
    this.updateHover();

    const py = this.world.heightAt(this.playerX, this.playerZ);
    this.playerRoot.position.set(this.playerX, py, this.playerZ);
    this.playerTargetQuaternion.setFromAxisAngle(
      this.playerUp,
      this.headingTarget,
    );
    this.playerRoot.quaternion.slerp(this.playerTargetQuaternion, 1 - Math.exp(-dt * 10));
    this.equipment.update(dt);

    this.world.render();
    this.input.endFrame();
    this.pushHud(false);
  };

  private handleHotkeys(): void {
    if (this.pauseOpen) {
      if (this.input.justPressed('Escape')) this.cancelActiveState();
      return;
    }
    for (let i = 0; i < TOOLBAR_SLOTS; i++) {
      if (this.input.justPressed(`Digit${i + 1}`)) {
        this.selectSlot(i);
        const def = TOOLBAR[i]!;
        setToast(this.gs, def.empty ? `Slot ${i + 1} — empty` : def.name, 1.2);
      }
    }
    if (this.input.justPressed('Digit6') || this.input.justPressed('KeyT')) {
      this.selectToolSlot();
      setToast(this.gs, `Bucket · ${this.gs.bucketFill}/${BUCKET_CAPACITY}`, 1.2);
    }
    if (this.input.justPressed('KeyQ')) this.useUltimate();
    if (this.input.justPressed('KeyB')) this.useBearTrap();
    if (this.input.justPressed('KeyI')) this.toggleInventory();
    if (this.input.justPressed('KeyH')) this.toggleHelp();
    if (this.input.justPressed('KeyR')) {
      cycleWeapon(this.gs);
      this.gs.toolbarSlot = this.gs.weapon === 'axe' ? SLOT_AXE : SLOT_SHOTGUN;
      this.gs.toolSlotActive = false;
      this.equipment.refresh(this.gs);
      setToast(this.gs, `Weapon: ${this.gs.weapon}`, 1.2);
    }
    if (this.input.justPressed('KeyU')) this.tryUpgradeHomestead();
    if (this.input.justPressed('KeyV')) {
      const muted = this.audio.toggleMuted();
      setToast(this.gs, muted ? 'Sound muted' : 'Sound on', 1.4);
      if (!muted) this.audio.play('ui');
    }
    if (this.input.justPressed('F12')) {
      this.debugGrid = !this.debugGrid;
      this.world.setGridDebug(this.debugGrid);
      this.equipment.setDebugVisible(this.debugGrid);
      setToast(this.gs, this.debugGrid ? 'Grid debug on' : 'Grid debug off', 1.4);
    }
    if (this.input.justPressed('KeyX')) {
      this.demolishMode = !this.demolishMode;
      this.buildingMode = false;
      this.placement.clear();
      this.closeContextMenu();
      setToast(this.gs, this.demolishMode ? 'Demolish mode · click an asset · Esc exits' : 'Demolish mode off', 1.6);
    }
    if (this.input.justPressed('Equal') || this.input.justPressed('NumpadAdd')) {
      const zoom = this.world.adjustZoom(0.1);
      setToast(this.gs, `Camera zoom ${zoom.toFixed(1)}×`, 1.2);
    }
    if (this.input.justPressed('Minus') || this.input.justPressed('NumpadSubtract')) {
      const zoom = this.world.adjustZoom(-0.1);
      setToast(this.gs, `Camera zoom ${zoom.toFixed(1)}×`, 1.2);
    }
    if (this.input.justPressed('KeyM')) {
      this.reducedMotion = !this.reducedMotion;
      this.world.setReducedMotion(this.reducedMotion);
      localStorage.setItem('tarnation.reducedMotion', this.reducedMotion ? '1' : '0');
      setToast(this.gs, this.reducedMotion ? 'Reduced motion on' : 'Reduced motion off', 1.6);
    }
    if (this.input.justPressed('KeyP')) this.toggleBuildMode();
    if (this.buildingMode && this.input.justPressed('KeyN')) {
      const nextIndex = (this.placement.currentIndex + 1) % PLACEABLE_BUILDINGS.length;
      this.placement.select(nextIndex);
      setToast(this.gs, `Build: ${PLACEABLE_BUILDINGS[nextIndex]!.name}`, 1.2);
    }

    if (this.input.justPressed('BracketLeft') || this.input.justPressed('Comma')) {
      cycleSeed(this.gs, -1);
      const s = selectedSeed(this.gs);
      if (s) setToast(this.gs, `Seed: ${s.displayName}`, 1.2);
    }
    if (this.input.justPressed('BracketRight') || this.input.justPressed('Period')) {
      cycleSeed(this.gs, 1);
      const s = selectedSeed(this.gs);
      if (s) setToast(this.gs, `Seed: ${s.displayName}`, 1.2);
    }

    if (this.input.justPressed('Escape')) this.cancelActiveState();

    const structure: [string, ToolMode, string][] = [
      ['KeyZ', 'trench', 'Tool: trench dig'],
      ['KeyC', 'breed', 'Tool: breeding bed'],
    ];
    for (const [code, mode, label] of structure) {
      if (!this.input.justPressed(code)) continue;
      this.selectSlot(SLOT_SHOVEL);
      this.toolMode = mode;
      setToast(this.gs, label, 1.2);
    }
  }

  private update(dt: number): void {
    this.handleHotkeys();
    if (this.actionState.currentState === 'disabled') {
      this.velX = 0;
      this.velZ = 0;
      return;
    }
    if (this.helpOpen) {
      this.velX = 0;
      this.velZ = 0;
      return;
    }
    if (this.pauseOpen) {
      this.velX = 0;
      this.velZ = 0;
      return;
    }
    if (this.gs.inventoryOpen) {
      this.velX = 0;
      this.velZ = 0;
      return;
    }
    if (this.contextMenu.open) {
      this.velX = 0;
      this.velZ = 0;
      return;
    }
    const b = this.world.getWorldBounds();
    this.movePlayer(dt, b.minX, b.maxX, b.minZ, b.maxZ);

    const saveStep = advanceSaveTimer(this.saveTimer, dt);
    this.saveTimer = saveStep.elapsed;
    if (saveStep.due) this.persist();

    if (this.shotCd > 0) this.shotCd -= dt;
    if (this.meleeCd > 0) this.meleeCd -= dt;
    this.stepShots(dt);
    this.stepBoulders(dt);
    this.stepFoxes(dt);
    this.stepAnimals(dt);

    this.nearWater = this.world.distToWater(this.playerX, this.playerZ) <= WATER_COLLECT_RANGE;
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY && this.input.justPressed('KeyE')) {
      fillBucket(this.gs);
      this.recordAction('fill_bucket');
      setToast(this.gs, `Bucket filled (${this.gs.bucketFill}/${BUCKET_CAPACITY})`, 2);
    }

    this.nearMarket =
      Math.hypot(this.playerX - this.stallX, this.playerZ - this.stallZ) <= MARKET_RANGE;
    this.nearMerchant =
      Math.hypot(this.playerX - this.merchantX, this.playerZ - this.merchantZ) <= MARKET_RANGE;
    this.stepGateTimers(dt);
    if (this.nearMerchant && this.input.justPressed('KeyE')) this.openVendor();
    if (this.vendorOpen && !this.nearMerchant) {
      this.vendorOpen = false;
      this.vendorMessage = '';
      setToast(this.gs, 'You walked away from the Traveling Merchant', 1.5);
    }
    if (this.vendorOpen) {
      this.velX = 0;
      this.velZ = 0;
      return;
    }

    this.interaction.process({
      buildingMode: this.buildingMode,
      demolishMode: this.demolishMode,
      toolSlotActive: this.gs.toolSlotActive,
      toolbarSlot: this.gs.toolbarSlot,
    });

    this.actionState.advance(dt);
    this.flushActionEvents();

    const clock = stepGameClock(this.gs, dt);
    this.world.applyDayNight(this.gs.clock.phase, this.gs.clock.t);

    if (clock.matured.length) {
      for (const m of clock.matured) this.syncCropTile(m.x, m.y);
      this.syncWorldTiles(clock.matured.map(({ x, y }) => ({ tx: x, ty: y })));
      for (const m of clock.matured) {
        const c = this.crops.find((x) => x.tx === m.x && x.ty === m.y);
        if (c) c.root.scale.setScalar(c.baseScale * 1.3);
      }
    }
    this.cropBatches?.update(this.gs.simTime);
    for (const c of this.crops) {
      const s = c.root.scale.x;
      const target = c.baseScale * (1 + Math.sin(this.gs.simTime * 1.1 + c.tx) * 0.015);
      c.root.scale.setScalar(
        THREE.MathUtils.lerp(s, target, 0.08),
      );
    }

    if (clock.becameNight) {
      setToast(this.gs, 'Night falls. Defend the crops!', 3);
      this.spawnRaid();
      this.persist();
    }
    if (clock.becameDay) {
      this.runtimeMetrics.setDaysReached(this.gs.clock.day);
      this.clearFoxes();
      this.clearDeathMarkers();
      this.clearLootMarkers();
      this.clearFeedbackBursts();
      const { lostTilth, regrown } = onNewDay(this.gs);
      this.refreshCropTargetsFromTiles();
      setToast(
        this.gs,
        lostTilth.length
          ? `Day ${this.gs.clock.day} — ${lostTilth.length} bare plots went back to grass`
          : `Day ${this.gs.clock.day}`,
        3,
      );
      if (lostTilth.length || regrown.length) {
        this.world.getFarmTrees()?.rebuildAll();
        this.world.markShadowsDirty();
      }
      this.syncWorldTiles();
      this.persist();
      if (checkWin(this.gs) && !this.gs.winShown) {
        if (!this.runtimeMetrics.hasCompleted('settlement_goal')) {
          this.recordOutcome('settlement_goal', 'completed');
        }
        this.winShownLocal = false;
      }
    }
  }

  private movePlayer(dt: number, minX: number, maxX: number, minZ: number, maxZ: number): void {
    const stick = this.input.getMoveStick();
    this.actionState.setMovementIntent(Math.hypot(stick.x, stick.y) > 1e-6);
    const movementScale = this.actionState.movementScale;
    const { forward, right } = this.world.getScreenBasis();
    let wishX = right.x * stick.x + forward.x * stick.y;
    let wishZ = right.z * stick.x + forward.z * stick.y;
    const wlen = Math.hypot(wishX, wishZ);
    if (wlen > 1e-6) {
      wishX /= wlen;
      wishZ /= wlen;
      this.velX += wishX * PLAYER_ACCEL * movementScale * dt;
      this.velZ += wishZ * PLAYER_ACCEL * movementScale * dt;
      this.headingTarget = Math.atan2(wishX, wishZ);
    } else {
      const damp = Math.exp(-PLAYER_DAMP * dt);
      this.velX *= damp;
      this.velZ *= damp;
    }
    const sp = Math.hypot(this.velX, this.velZ);
    const maxSpeed = PLAYER_SPEED * movementScale;
    if (sp > maxSpeed) {
      this.velX = (this.velX / sp) * maxSpeed;
      this.velZ = (this.velZ / sp) * maxSpeed;
    }
    const nextX = THREE.MathUtils.clamp(this.playerX + this.velX * dt, minX, maxX);
    const nextZ = THREE.MathUtils.clamp(this.playerZ + this.velZ * dt, minZ, maxZ);
    if (this.canPlayerOccupy(nextX, this.playerZ)) this.playerX = nextX;
    else this.velX = 0;
    if (this.canPlayerOccupy(this.playerX, nextZ)) this.playerZ = nextZ;
    else this.velZ = 0;
    this.gs.playerX = this.playerX;
    this.gs.playerZ = this.playerZ;
  }

  private worldToFarmTile(wx: number, wz: number): { tx: number; ty: number } | null {
    const { tx, ty } = worldToTile(wx, wz, 1);
    if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return null;
    return { tx, ty };
  }

  private farmTileWorld(tx: number, ty: number): { x: number; z: number } {
    const c = tileCenter(tx, ty, 1);
    return { x: c.x, z: c.y };
  }

  /** Rock, tree, stump or open water — all of them stop a shovel. */
  private tileBlockedForTilling(tx: number, ty: number): boolean {
    const trees = this.world.getFarmTrees();
    if (trees?.blocksTilling(tx, ty)) return true;
    const key = tileKey(tx, ty);
    if (this.fixtureReservations.has(key) || this.obstacleTiles.has(key)) return true;
    return this.world.distToWater(tx + 0.5, ty + 0.5) < 0.8;
  }

  private recalculateEnclosure(): void {
    // Empty camp ground is reserved for presentation/placement, not a wall.
    // Only visible fixture footprints participate in enclosure topology.
    const blocked = fixtureObstacleTiles(CENTRAL_CAMP_FIXTURES);
    for (const placed of this.gs.placedBuildings) {
      const asset = assetDefinition(placed.id);
      if (!asset || !asset.blocksEnclosure || (asset.gate && placed.gateOpen)) continue;
      const origin = {
        tx: Math.floor(placed.x - orientedFootprint(asset, placed.rotation).width / 2),
        ty: Math.floor(placed.z - orientedFootprint(asset, placed.rotation).height / 2),
      };
      for (const tile of footprintTiles(asset, origin, placed.rotation)) {
        blocked.add(tileKey(tile.tx, tile.ty));
      }
    }
    this.enclosedTiles = calculateEnclosedTiles(blocked);
  }

  private isEnclosed(tx: number, ty: number): boolean {
    return tileIsEnclosed(this.enclosedTiles, tx, ty);
  }

  private canPlayerOccupy(x: number, z: number): boolean {
    const tile = this.worldToFarmTile(x, z);
    if (!tile) return false;
    const key = tileKey(tile.tx, tile.ty);
    if (!this.obstacleTiles.has(key)) {
      return true;
    }
    // Save/footprint migrations can occasionally load an actor inside a newly
    // solid tile. Permit motion within that one tile so the player can leave,
    // while still refusing entry into any other obstacle.
    const current = this.worldToFarmTile(this.playerX, this.playerZ);
    if (current && current.tx === tile.tx && current.ty === tile.ty) return true;
    return this.openGateAt(tile.tx, tile.ty);
  }

  private openGateAt(tx: number, ty: number): boolean {
    for (let index = 0; index < this.gs.placedBuildings.length; index++) {
      const placed = this.gs.placedBuildings[index]!;
      const asset = assetDefinition(placed.id);
      if (!asset?.gate || placed.gateOpen) continue;
      const origin = {
        tx: Math.floor(placed.x - orientedFootprint(asset, placed.rotation).width / 2),
        ty: Math.floor(placed.z - orientedFootprint(asset, placed.rotation).height / 2),
      };
      if (!footprintTiles(asset, origin, placed.rotation).some((tile) => tile.tx === tx && tile.ty === ty)) continue;
      placed.gateOpen = true;
      this.gateCloseTimers.set(placed, 3.5);
      this.refreshObstacleTopology();
      this.syncBuildings();
      this.recalculateEnclosure();
      this.persist();
      this.audio.play('build');
      setToast(this.gs, 'Gate opened', 1.1);
      return true;
    }
    return false;
  }

  private stepGateTimers(dt: number): void {
    if (this.gateCloseTimers.size === 0) return;
    const playerTile = this.worldToFarmTile(this.playerX, this.playerZ);
    let changed = false;
    for (const [placed, remaining] of [...this.gateCloseTimers.entries()]) {
      const asset = placed ? assetDefinition(placed.id) : null;
      if (!this.gs.placedBuildings.includes(placed) || !asset?.gate || placed.gateOpen !== true) {
        this.gateCloseTimers.delete(placed);
        continue;
      }
      const origin = placedOrigin(placed, placed.rotation, asset);
      const playerStillInGate = playerTile
        ? footprintTiles(asset, origin, placed.rotation).some(
            (tile) => tile.tx === playerTile.tx && tile.ty === playerTile.ty,
          )
        : false;
      if (playerStillInGate) {
        this.gateCloseTimers.set(placed, 3.5);
        continue;
      }
      const next = remaining - dt;
      if (next > 0) {
        this.gateCloseTimers.set(placed, next);
        continue;
      }
      placed.gateOpen = false;
      this.gateCloseTimers.delete(placed);
      changed = true;
    }
    if (!changed) return;
    this.refreshObstacleTopology();
    this.syncBuildings();
    this.recalculateEnclosure();
    this.persist();
    setToast(this.gs, 'Gate closed', 1.1);
  }

  /** The grid only lights up for the shovel — the tool that actually works soil. */
  private updateHover(): void {
    if (this.demolishMode) {
      const index = this.placedIndexAtPointer();
      const placed = index >= 0 ? this.gs.placedBuildings[index] : null;
      const asset = placed ? assetDefinition(placed.id) : null;
      if (!placed || !asset) {
        this.world.setHover(null, null, false);
        this.world.setBuildPreview(null);
        return;
      }
      const size = orientedFootprint(asset, placed.rotation);
      const origin = placedOrigin(placed, placed.rotation, asset);
      const center = placedCenter(origin, placed.rotation, asset);
      this.world.setHover(origin.tx, origin.ty, false);
      this.world.setBuildPreview(
        asset.modelKey,
        center.x,
        center.z,
        normalizeOrientation(placed.rotation) * Math.PI / 2,
        false,
        size,
      );
      return;
    }
    if (this.buildingMode) {
      const placement = this.placement.status();
      if (!placement.tile) {
        this.world.setHover(null, null, false);
        this.world.setBuildPreview(null);
        return;
      }
      this.world.setHover(placement.tile.tx, placement.tile.ty, placement.valid);
      if (placement.asset) {
        const size = orientedFootprint(placement.asset, placement.rotation);
        this.world.setBuildPreview(
          placement.asset.modelKey,
          placement.x,
          placement.z,
          placement.rotation * Math.PI / 2,
          placement.valid,
          size,
        );
      }
      return;
    }
    this.world.setBuildPreview(null);
    const shovelSelected = !this.gs.toolSlotActive && this.gs.toolbarSlot === SLOT_SHOVEL;
    const axeSelected = !this.gs.toolSlotActive && this.gs.toolbarSlot === SLOT_AXE;
    if (!shovelSelected && !axeSelected) {
      this.world.setHover(null, null, false);
      return;
    }
    const tile = this.pointerTile();
    if (!tile) {
      this.world.setHover(null, null, false);
      return;
    }
    const wc = this.farmTileWorld(tile.tx, tile.ty);
    const dist = Math.hypot(this.playerX - wc.x, this.playerZ - wc.z);
    const trees = this.world.getFarmTrees();
    const treeTarget = axeSelected ? this.pointerTreeTile() : null;
    const usable = shovelSelected
      ? dist <= TOOL_RANGE && !this.tileBlockedForTilling(tile.tx, tile.ty)
      : treeTarget
        ? dist <= TOOL_RANGE + 0.6
        : dist <= TOOL_RANGE + 0.6 && !!trees && (trees.hasTree(tile.tx, tile.ty) || trees.hasStump(tile.tx, tile.ty));
    this.world.setHover(tile.tx, tile.ty, usable);
  }

  private pointerTile(): { tx: number; ty: number } | null {
    const ndc = this.input.getPointerNdc();
    const hit = this.world.raycastGround(ndc.x, ndc.y);
    if (!hit) return null;
    return this.worldToFarmTile(hit.x, hit.z);
  }

  private pointerTreeTile(): { tx: number; ty: number } | null {
    const ndc = this.input.getPointerNdc();
    return this.world.raycastTree(ndc.x, ndc.y);
  }

  private tryUpgradeHomestead(): void {
    const distance = Math.hypot(this.playerX - HOMESTEAD_X, this.playerZ - HOMESTEAD_Z);
    if (distance > 8) {
      setToast(this.gs, 'Stand by the homestead to upgrade it', 1.8);
      return;
    }
    if (this.gs.homesteadTier >= HOMESTEAD_MODEL_KEYS.length) {
      setToast(this.gs, 'The homestead is fully upgraded', 1.8);
      return;
    }
    const nextTier = this.gs.homesteadTier + 1;
    const cost = HOMESTEAD_UPGRADE_WOOD[nextTier - 1] ?? 0;
    if (woodCount(this.gs) < cost) {
      setToast(this.gs, `Homestead tier ${nextTier}: need ${cost} Wood`, 2);
      return;
    }
    if (cost > 0) takeFromInventory(this.gs, ITEM_WOOD, cost);
    this.gs.homesteadTier = nextTier;
    this.runtimeMetrics.recordUpgrade(this.gs.simTime);
    const unlocked = nextTier === 2 ? unlockWeapon(this.gs, 'bow') : nextTier === 3 ? unlockWeapon(this.gs, 'axe') : false;
    this.syncBuildings();
    this.persist();
    this.spawnFeedbackBurst(HOMESTEAD_X, HOMESTEAD_Z, 0xf2c266, 8, 0.32);
    this.audio.play('build');
    setToast(
      this.gs,
      unlocked
        ? `Homestead tier ${nextTier} · new weapon: ${this.gs.unlockedWeapons[this.gs.unlockedWeapons.length - 1]}`
        : `Homestead tier ${nextTier}`,
      2.4,
    );
  }

  private placeSelectedBuilding(): void {
    this.recordOutcome('building', 'attempted');
    const placement = this.placement.status();
    const selected = placement.asset;
    if (!selected || !placement.valid || !placement.tile) {
      this.recordOutcome('building', 'rejected');
      setToast(this.gs, placement.reason, 1.6);
      return;
    }
    const deedPlacement = this.placement.activeDeedAssetId !== null;
    if (!this.beginInteractAction('pickUp', () => {
      const legacyCost = PLACEABLE_BUILDINGS.find((entry) => entry.id === selected.id)?.cost ?? selected.materialCost.wood ?? 0;
      if (!deedPlacement) {
        if (!takeFromInventory(this.gs, ITEM_WOOD, legacyCost)) {
          this.recordOutcome('building', 'rejected');
          setToast(this.gs, `Need ${legacyCost} Wood`, 1.6);
          return;
        }
      } else if (!takeFromInventory(this.gs, deedItemId(selected.id), 1)) {
        this.recordOutcome('building', 'rejected');
        setToast(this.gs, `No ${selected.displayName} deed`, 1.6);
        return;
      }
      this.recordOutcome('building', 'completed', 'build');
      placeBuilding(this.gs, selected.id, placement.x, placement.z, placement.rotation, false);
      this.runtimeMetrics.recordBuildingPlaced();
      this.refreshObstacleTopology();
      this.syncBuildings();
      this.recalculateEnclosure();
      this.persist();
      this.spawnFeedbackBurst(placement.x, placement.z, 0xf2c266, 8, 0.28);
      this.audio.play('build');
      setToast(this.gs, `Built ${selected.displayName}`, 1.6);
      this.buildingMode = false;
      this.placement.clear();
      this.pushHud(true);
    })) this.recordOutcome('building', 'rejected');
  }

  private useBucket(): void {
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) {
      this.beginMeleeAction('pickUp', () => {
        fillBucket(this.gs);
        this.recordAction('fill_bucket');
        this.spawnFeedbackBurst(this.playerX, this.playerZ, 0x69b8dc, 4, 0.22);
        this.audio.play('water');
        setToast(this.gs, `Bucket filled (${this.gs.bucketFill}/${BUCKET_CAPACITY})`, 1.6);
        this.persist();
      });
      return;
    }
    const tilePos = this.pointerTile();
    if (!tilePos) return;
    const { tx, ty } = tilePos;
    const tile = getTile(this.gs.tiles, tx, ty);
    const wc = this.farmTileWorld(tx, ty);
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) return;
    this.beginMeleeAction('pickUp', () => {
      this.waterWithBucket(tx, ty, tile?.state === 'planted' && !tile.watered);
    });
  }

  private useAxe(): void {
    // A tree is a direct click target. Ground aiming remains a fallback for
    // ordinary melee, but the player never has to line up a reticle with timber.
    const tilePos = this.pointerTreeTile() ?? this.pointerTile();
    this.beginMeleeAction('swordSlash', () => {
      if (tilePos && this.chopFarmTree(tilePos.tx, tilePos.ty)) return;
      // Nothing to chop — swing at whatever is in front of you instead.
      this.applyMeleeDamage(AXE_DAMAGE);
    });
  }

  private useShovel(): void {
    const tilePos = this.pointerTile();
    if (!tilePos) {
      this.meleeSwing(FIST_DAMAGE, 'pickUp');
      return;
    }
    const { tx, ty } = tilePos;
    const tile = getTile(this.gs.tiles, tx, ty);
    if (!tile) return;
    const wc = this.farmTileWorld(tx, ty);
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) {
      this.meleeSwing(FIST_DAMAGE, 'pickUp');
      return;
    }

    const trees = this.world.getFarmTrees();
    if (trees?.hasTree(tx, ty)) {
      setToast(this.gs, 'You need the axe for that (slot 3)', 1.6);
      return;
    }
    if (trees?.hasStump(tx, ty)) {
      setToast(this.gs, 'Clear the stump with the axe (slot 3)', 1.6);
      return;
    }
    if (trees?.rockSlot(tx, ty)) {
      setToast(this.gs, 'A boulder sits here — nothing will grow', 1.6);
      return;
    }

    if (this.toolMode === 'trench') {
      if (tile.state === 'planted' || tile.state === 'mature' || tile.state === 'breeding') return;
      this.beginMeleeAction('pickUp', () => {
        if (!digTrench(this.gs.tiles, tx, ty)) return;
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const t2 = getTile(this.gs.tiles, tx + dx, ty + dy);
          if (t2?.state === 'planted' && !t2.watered && this.world.distToWater(wc.x, wc.z) < 3) {
            t2.watered = true;
          }
        }
        this.syncWorldTiles([
          { tx, ty },
          { tx: tx + 1, ty },
          { tx: tx - 1, ty },
          { tx, ty: ty + 1 },
          { tx, ty: ty - 1 },
        ]);
        this.spawnFeedbackBurst(wc.x, wc.z, 0x69b8dc, 5, 0.24);
        this.audio.play('tool');
        this.persist();
      });
      return;
    }

    if (this.toolMode === 'breed') {
      if (tile.state === 'tilled') {
        this.beginMeleeAction('pickUp', () => {
          if (!makeBreedingBed(this.gs.tiles, tx, ty)) return;
          this.syncWorldTiles([{ tx, ty }]);
          this.spawnFeedbackBurst(wc.x, wc.z, 0xd79358, 6, 0.26);
          this.audio.play('build');
          setToast(this.gs, 'Breeding bed ready — plant two seeds', 2.5);
          this.persist();
        });
      } else if (tile.state === 'breeding' && tile.breedA && tile.breedB) {
        this.beginMeleeAction('pickUp', () => {
          const parents = clearBreedingParents(this.gs.tiles, tx, ty);
          if (!parents) return;
          const child = crossbreed(parents.a, parents.b, this.gs.rng);
          addSeedToInventory(this.gs, child);
          this.gs.tiles[ty]![tx]!.state = 'tilled';
          this.syncWorldTiles([{ tx, ty }]);
          this.spawnFeedbackBurst(wc.x, wc.z, 0xf2c266, 7, 0.28);
          this.audio.play('reward');
          setToast(this.gs, `Hybrid: ${child.displayName}!`, 3.5);
          this.persist();
        });
      }
      return;
    }

    if (tile.state === 'grass') {
      if (this.tileBlockedForTilling(tx, ty)) {
        setToast(this.gs, "This ground can't be worked", 1.4);
        return;
      }
      this.beginMeleeAction('pickUp', () => {
        if (!tillTile(this.gs.tiles, tx, ty, this.gs.clock.day)) return;
        this.recordAction('till');
        this.syncWorldTiles([{ tx, ty }]);
        this.spawnFeedbackBurst(wc.x, wc.z, 0x8a5a38, 5, 0.24);
        this.audio.play('tool');
        this.persist();
      });
    } else if (tile.state === 'tilled' || tile.state === 'breeding') {
      this.recordOutcome('plant', 'attempted');
      const seed = selectedSeed(this.gs);
      if (!seed) {
        this.recordOutcome('plant', 'rejected');
        setToast(this.gs, 'No seeds', 1.5);
        return;
      }
      if (!this.beginMeleeAction('pickUp', () => {
        if (!plantTile(this.gs.tiles, tx, ty, seed)) {
          this.recordOutcome('plant', 'rejected');
          return;
        }
        this.recordOutcome('plant', 'completed');
        this.runtimeMetrics.recordCropPlanted();
        this.syncCropTile(tx, ty);
        this.syncWorldTiles([{ tx, ty }]);
        this.spawnFeedbackBurst(wc.x, wc.z, 0x8ccf6a, 5, 0.2);
        this.audio.play('tool');
        this.persist();
      })) this.recordOutcome('plant', 'rejected');
    } else if (tile.state === 'planted' && !tile.watered) {
      this.beginMeleeAction('pickUp', () => this.waterWithBucket(tx, ty, true));
    } else if (tile.state === 'mature') {
      this.recordOutcome('harvest', 'attempted');
      if (!tile.seed) {
        this.recordOutcome('harvest', 'rejected');
        return;
      }
      if (!this.beginMeleeAction('pickUp', () => {
        const res = harvestTile(this.gs.tiles, tx, ty);
        if (res.ok && res.seed) {
          const id = cropItem(res.seed.displayName);
          if (!addToInventory(this.gs, id, res.count)) {
            this.recordOutcome('harvest', 'rejected');
            return;
          }
          this.recordOutcome('harvest', 'completed');
          this.runtimeMetrics.recordCropHarvested(res.count);
          this.gs.stats.cropsHarvested += res.count;
          addSeedToInventory(this.gs, { ...res.seed, traits: { ...res.seed.traits } });
          this.syncCropTile(tx, ty);
          this.syncWorldTiles([{ tx, ty }]);
          this.popup(`+${res.count} ${res.seed.displayName}`, wc.x, wc.z);
          this.spawnFeedbackBurst(wc.x, wc.z, 0xf2c266, 6, 0.24);
          this.audio.play('reward');
          this.persist();
        } else this.recordOutcome('harvest', 'rejected');
      })) this.recordOutcome('harvest', 'rejected');
    }
  }

  /** Pour one bucket-water on a tile. Tier-3 irrigation waters without spending. */
  private waterWithBucket(tx: number, ty: number, thirsty: boolean): void {
    if (!thirsty) {
      setToast(this.gs, 'Nothing to water here', 1.2);
      return;
    }
    if (this.gs.irrigationTier < 3) {
      if (this.gs.bucketFill <= 0) {
        setToast(this.gs, 'Bucket empty — fill at the river or a creek', 2);
        return;
      }
      if (!useBucketWater(this.gs)) return;
    }
    if (waterTile(this.gs.tiles, tx, ty, this.gs.simTime)) {
      this.recordAction('water');
      this.syncWorldTiles([{ tx, ty }]);
      const wc = this.farmTileWorld(tx, ty);
      this.spawnFeedbackBurst(wc.x, wc.z, 0x69b8dc, 4, 0.2);
      this.audio.play('water');
      this.persist();
    }
  }

  /**
   * Fell a tree (five swings) or clear a stump (one). Returns true when the swing
   * was spent on timber, so the caller doesn't also swing at the air.
   */
  private chopFarmTree(tx: number, ty: number): boolean {
    const trees = this.world.getFarmTrees();
    if (!trees) return false;
    const wc = this.farmTileWorld(tx, ty);
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE + 0.6) return false;

    const key = `${tx},${ty}`;

    if (trees.hasStump(tx, ty)) {
      const swings = (this.treeChops.get(key) ?? 0) + 1;
      if (swings < STUMP_CHOPS) {
        this.treeChops.set(key, swings);
        this.recordAction('chop');
        this.spawnFeedbackBurst(wc.x, wc.z, 0xc9854a, 4, 0.2);
        this.audio.play('tool');
        return true;
      }
      this.treeChops.delete(key);
      this.recordAction('chop');
      if (!clearStump(this.gs, tx, ty)) return true;
      // Stump clearing is intentionally generous: a felled tree leaves one
      // extra piece of the economy behind even though the model reads as a log.
      addToInventory(this.gs, ITEM_WOOD, 1);
      this.gs.stats.woodGathered += 1;
      trees.invalidateTile(tx, ty);
      this.world.markShadowsDirty();
      this.spawnFeedbackBurst(wc.x, wc.z, 0xf2c266, 6, 0.24);
      this.audio.play('tool');
      this.popup('+1 Wood', wc.x, wc.z);
      setToast(this.gs, 'Stump cleared · +1 Wood', 1.2);
      this.persist();
      return true;
    }

    if (!trees.hasTree(tx, ty)) return false;

    const chops = (this.treeChops.get(key) ?? 0) + 1;
    this.recordAction('chop');
    this.treeChops.set(key, chops);
    this.world.shake(0.05, 0.04);
    this.spawnFeedbackBurst(wc.x, wc.z, 0xc9854a, 4, 0.2);
    this.audio.play('tool');

    if (chops < FARM_TREE_CHOPS) {
      setToast(this.gs, `Chopping… ${chops}/${FARM_TREE_CHOPS}`, 0.8);
      return true;
    }

    this.treeChops.delete(key);
    if (!addToInventory(this.gs, ITEM_WOOD, FARM_TREE_WOOD)) return true;
    markTreeChopped(this.gs, tx, ty);
    trees.invalidateTile(tx, ty);
    this.world.markShadowsDirty();
    this.gs.stats.woodGathered += FARM_TREE_WOOD;
    this.runtimeMetrics.recordTreeFelled();
    this.world.shake(0.14, 0.12);
    this.spawnFeedbackBurst(wc.x, wc.z, 0xf2c266, 8, 0.32);
    this.audio.play('reward');
    this.popup(`+${FARM_TREE_WOOD} Wood`, wc.x, wc.z);
    this.persist();
    return true;
  }

  // ---------------------------------------------------------------- combat

  private fireWeapon(): void {
    if (this.gs.toolSlotActive || this.gs.toolbarSlot !== SLOT_SHOTGUN) return;
    if (this.gs.weapon === 'shotgun') {
      this.fireShotgun();
      return;
    }
    if (this.gs.weapon === 'bow') {
      this.fireBow();
      return;
    }
    this.meleeSwing(AXE_DAMAGE);
  }

  private aimDirection(): { dx: number; dz: number } {
    const ndc = this.input.getPointerNdc();
    const hit = this.world.raycastGround(ndc.x, ndc.y);
    let dx = Math.sin(this.headingTarget);
    let dz = Math.cos(this.headingTarget);
    if (hit) {
      dx = hit.x - this.playerX;
      dz = hit.z - this.playerZ;
    }
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    this.headingTarget = Math.atan2(dx, dz);
    return { dx, dz };
  }

  private fireShotgun(): void {
    if (this.shotCd > 0) return;
    const { dx, dz } = this.aimDirection();
    const sideX = dz;
    const sideZ = -dx;
    this.beginRangedAction(() => {
      const pelletMaterial = new THREE.MeshStandardMaterial({
        color: 0x4b4b45,
        metalness: 0.65,
        roughness: 0.35,
      });
      for (let i = 0; i < SHOTGUN_PELLETS; i++) {
        const spread = (i - (SHOTGUN_PELLETS - 1) / 2) * SHOTGUN_SPREAD;
        const rawX = dx + sideX * spread;
        const rawZ = dz + sideZ * spread;
        const length = Math.hypot(rawX, rawZ) || 1;
        const pelletX = rawX / length;
        const pelletZ = rawZ / length;
        const geometry = new THREE.SphereGeometry(0.065, 6, 4);
        const mesh = new THREE.Mesh(geometry, pelletMaterial);
        mesh.position.set(
          this.playerX + pelletX * 0.4,
          this.world.heightAt(this.playerX, this.playerZ) + 0.82,
          this.playerZ + pelletZ * 0.4,
        );
        mesh.castShadow = true;
        this.world.getSharedActors().add(mesh);
        this.shots.push({
          root: mesh,
          kind: 'pellet',
          geometry,
          material: pelletMaterial,
          x: this.playerX,
          z: this.playerZ,
          vx: pelletX * SHOTGUN_SPEED,
          vz: pelletZ * SHOTGUN_SPEED,
          life: SHOT_LIFETIME,
          ricochet: 0,
          dmg: 1,
        });
      }
      this.shotCd = SHOTGUN_COOLDOWN;
      this.audio.play('shot');
      this.world.shake(0.06, 0.05);
    });
  }

  private clearShots(): void {
    for (let i = this.shots.length - 1; i >= 0; i--) this.removeShotAt(i);
  }

  private removeShotAt(index: number): void {
    const shot = this.shots[index];
    if (!shot) return;
    this.shots.splice(index, 1);
    shot.root.removeFromParent();
    if (shot.kind === 'arrow') {
      disposeModelClone(shot.root);
      return;
    }
    shot.geometry?.dispose();
    if (shot.material && !this.shots.some((other) => other.material === shot.material)) {
      shot.material.dispose();
    }
  }

  private fireBow(): void {
    if (this.shotCd > 0) return;
    const { dx, dz } = this.aimDirection();
    this.beginRangedAction(() => {
      const { root } = cloneModel('arrow');
      root.scale.multiplyScalar(0.85);
      root.position.set(
        this.playerX + dx * 0.35,
        this.world.heightAt(this.playerX, this.playerZ) + 0.95,
        this.playerZ + dz * 0.35,
      );
      root.rotation.y = Math.atan2(dx, dz);
      root.castShadow = true;
      this.world.getSharedActors().add(root);
      this.shots.push({
        root,
        kind: 'arrow',
        x: this.playerX,
        z: this.playerZ,
        vx: dx * BOW_SPEED,
        vz: dz * BOW_SPEED,
        life: SHOT_LIFETIME,
        ricochet: 0,
        dmg: 2,
      });
      this.shotCd = BOW_COOLDOWN;
      this.audio.play('shot');
    });
  }

  private beginMeleeAction(clip: PlayerClip, onContact: () => void): boolean {
    if (!this.actionState.isBusy && this.meleeCd > 0) return false;
    // Do not restart a one-shot halfway through its authored motion when the
    // player holds the mouse down. That turns a readable chop/dig into a
    // jittering pose; let the current swing finish before accepting the next.
    if (!this.actionState.isBusy && this.playerActions.isOneShotRunning) return false;
    const admission = this.actionState.request({
      kind: 'tool',
      timing: this.equipment.actionTimingFor('tool') ?? DEFAULT_TOOL_ACTION_TIMING,
      payload: null,
      bufferable: true,
    });
    if (admission.disposition === 'rejected' || admission.actionId === null) return false;
    this.pendingPlayerActions.set(admission.actionId, { clip, onContact });
    this.flushActionEvents();
    return true;
  }

  private beginRangedAction(onFire: () => void): boolean {
    if (!this.actionState.isBusy && this.playerActions.isOneShotRunning) return false;
    const admission = this.actionState.request({
      kind: 'ranged',
      timing: this.equipment.actionTimingFor('ranged') ?? DEFAULT_RANGED_ACTION_TIMING,
      payload: null,
      bufferable: false,
    });
    if (admission.disposition === 'rejected' || admission.actionId === null) return false;
    this.pendingPlayerActions.set(admission.actionId, { clip: 'shoot', onFire });
    this.flushActionEvents();
    return true;
  }

  private beginInteractAction(
    clip: PlayerClip,
    onContact: () => void,
    profileKey: EquipmentKey = 'build_preview',
  ): boolean {
    if (this.actionState.isBusy || this.playerActions.isOneShotRunning) return false;
    const admission = this.actionState.request({
      kind: 'interact',
      timing: equipmentTimingFor(profileKey, 'interact') ?? DEFAULT_INTERACT_ACTION_TIMING,
      payload: null,
      bufferable: false,
    });
    if (admission.disposition === 'rejected' || admission.actionId === null) return false;
    this.pendingPlayerActions.set(admission.actionId, { clip, onContact });
    this.flushActionEvents();
    return true;
  }

  private applyMeleeDamage(damage: number): void {
    let connected = false;
    for (const w of [...this.foxes]) {
      if (w.dead) continue;
      if (Math.hypot(w.x - this.playerX, w.z - this.playerZ) > MELEE_RANGE) continue;
      this.damageFox(w, damage);
      connected = true;
    }
    for (const a of [...this.animals]) {
      if (Math.hypot(a.x - this.playerX, a.z - this.playerZ) > MELEE_RANGE) continue;
      this.damageAnimal(a, damage);
      connected = true;
    }
    if (connected) {
      this.world.shake(0.08, 0.07);
      this.hitPause = 0.04;
    }
  }

  /** Tool swing — hits everything alive inside a short radius. */
  private meleeSwing(
    damage: number,
    clip: PlayerClip = damage === FIST_DAMAGE ? 'punch' : 'swordSlash',
  ): void {
    this.beginMeleeAction(clip, () => this.applyMeleeDamage(damage));
  }

  private tryBoulderRoll(): boolean {
    if (this.gs.boulderCooldown > 0) {
      setToast(this.gs, `Boulder ready in ${Math.ceil(this.gs.boulderCooldown)}s`, 1.2);
      return false;
    }
    const { dx, dz } = this.aimDirection();
    const geometry = new THREE.DodecahedronGeometry(BOULDER_RADIUS, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x6f6a5e, flatShading: true, roughness: 0.95 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.set(
      this.playerX,
      this.world.heightAt(this.playerX, this.playerZ) + BOULDER_RADIUS,
      this.playerZ,
    );
    this.world.getSharedActors().add(mesh);
    this.boulders.push({
      mesh,
      geometry,
      material,
      x: this.playerX,
      z: this.playerZ,
      vx: dx * BOULDER_SPEED,
      vz: dz * BOULDER_SPEED,
      travelled: 0,
      hit: new Set(),
    });
    this.gs.boulderCooldown = BOULDER_COOLDOWN;
    this.world.shake(0.2, 0.18);
    setToast(this.gs, 'Boulder Roll!', 1.2);
    return true;
  }

  private stepBoulders(dt: number): void {
    for (let i = this.boulders.length - 1; i >= 0; i--) {
      const b = this.boulders[i]!;
      const step = Math.hypot(b.vx, b.vz) * dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.travelled += step;
      b.mesh.position.set(b.x, this.world.heightAt(b.x, b.z) + BOULDER_RADIUS, b.z);
      b.mesh.rotateOnWorldAxis(
        new THREE.Vector3(b.vz, 0, -b.vx).normalize(),
        step / BOULDER_RADIUS,
      );

      for (const w of [...this.foxes]) {
        if (w.dead || b.hit.has(w)) continue;
        if (Math.hypot(w.x - b.x, w.z - b.z) > BOULDER_RADIUS + 0.4) continue;
        b.hit.add(w);
        this.damageFox(w, BOULDER_DAMAGE);
      }
      for (const a of [...this.animals]) {
        if (b.hit.has(a)) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) > BOULDER_RADIUS + 0.4) continue;
        b.hit.add(a);
        this.damageAnimal(a, BOULDER_DAMAGE);
      }

      if (
        b.travelled >= BOULDER_RANGE ||
        b.x < 1 ||
        b.z < 1 ||
        b.x > WORLD_SIZE - 1 ||
        b.z > WORLD_SIZE - 1
      ) {
        this.removeBoulderAt(i);
      }
    }
  }

  private clearBoulders(): void {
    for (let i = this.boulders.length - 1; i >= 0; i--) this.removeBoulderAt(i);
  }

  private removeBoulderAt(index: number): void {
    const boulder = this.boulders[index];
    if (!boulder) return;
    this.boulders.splice(index, 1);
    boulder.mesh.removeFromParent();
    boulder.geometry.dispose();
    boulder.material.dispose();
  }

  private tryBearTrap(onPlaced?: () => void): boolean {
    if (this.gs.bearTrapCooldown > 0) {
      setToast(this.gs, `Bear trap ready in ${Math.ceil(this.gs.bearTrapCooldown)}s`, 1.2);
      return false;
    }
    const pointer = this.pointerTile();
    const fallbackX = this.playerX + Math.sin(this.headingTarget) * 1.5;
    const fallbackZ = this.playerZ + Math.cos(this.headingTarget) * 1.5;
    const tilePos = pointer ?? this.worldToFarmTile(fallbackX, fallbackZ);
    if (!tilePos) return false;
    const wc = this.farmTileWorld(tilePos.tx, tilePos.ty);
    const tile = getTile(this.gs.tiles, tilePos.tx, tilePos.ty);
    if (
      !tile ||
      Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > BEAR_TRAP_PLACE_RANGE ||
      this.tileBlockedForTilling(tilePos.tx, tilePos.ty) ||
      this.world.distToWater(wc.x, wc.z) < 1.2
    ) {
      setToast(this.gs, 'Place the bear trap on clear ground nearby', 1.5);
      return false;
    }
    return this.beginInteractAction('pickUp', () => {
      if (!placeBearTrap(this.gs.tiles, tilePos.tx, tilePos.ty)) {
        setToast(this.gs, 'A trap is already here or the ground is occupied', 1.5);
        return;
      }
      this.gs.bearTrapCooldown = BEAR_TRAP_COOLDOWN;
      onPlaced?.();
      this.syncWorldTiles([{ tx: tilePos.tx, ty: tilePos.ty }]);
      this.syncBearTrapModels();
      this.spawnFeedbackBurst(wc.x, wc.z, 0xd2a86a, 6, 0.26);
      this.audio.play('trap');
      setToast(this.gs, 'Bear trap set', 1.4);
      this.persist();
      this.pushHud(true);
    }, 'bear_trap');
  }

  private stepShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]!;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      s.root.position.set(s.x, this.world.heightAt(s.x, s.z) + (s.kind === 'arrow' ? 0.95 : 0.8), s.z);
      if (s.kind === 'arrow') {
        s.root.rotation.y = Math.atan2(s.vx, s.vz);
      }

      if (s.life <= 0) {
        this.removeShotAt(i);
        continue;
      }

      let consumed = false;
      for (const w of [...this.foxes]) {
        if (w.dead) continue;
        if (Math.hypot(s.x - w.x, s.z - w.z) > 0.8) continue;
        this.damageFox(w, s.dmg);
        if (s.ricochet > 0) {
          s.ricochet--;
          s.vx = -s.vx + (this.gs.rng() - 0.5) * 4;
          s.vz = -s.vz + (this.gs.rng() - 0.5) * 4;
        } else {
          consumed = true;
        }
        break;
      }
      if (!consumed) {
        for (const a of [...this.animals]) {
          if (Math.hypot(s.x - a.x, s.z - a.z) > 0.9) continue;
          this.damageAnimal(a, s.dmg);
          if (s.ricochet > 0) {
            s.ricochet--;
            s.vx *= -1;
            s.vz *= -0.8;
          } else {
            consumed = true;
          }
          break;
        }
      }
      if (consumed) {
        this.removeShotAt(i);
      }
    }
  }

  private damageFox(w: Fox, amount: number): void {
    if (w.dead) return;
    this.recordOutcome('fox_defense', 'attempted');
    w.hp -= amount;
    if (w.hp > 0) {
      w.root.scale.set(w.baseScale * 1.25, w.baseScale * 0.8, w.baseScale * 1.25);
      w.state = 'flee';
      this.playFoxAction(w, 'walk');
      this.spawnFeedbackBurst(w.x, w.z, 0xffb45c, 4, 0.2);
      this.audio.play('hit');
      return;
    }
    w.dead = true;
    this.resetFoxTrap(w);
    this.recordOutcome('fox_defense', 'completed', 'fox_felled');
    this.gs.stats.foxesFelled += 1;
    this.runtimeMetrics.recordFoxFelled();
    this.world.shake(0.09, 0.08);
    this.hitPause = 0.05;
    this.spawnFeedbackBurst(w.x, w.z, 0xef7561, 8, 0.32);
    this.audio.play('defeat');
    this.stopMixer(w.actions.mixer, w.root);
    this.spawnDeathMarker(w.root, w.baseScale, w.x, w.z, w.root.rotation.y, 'fox');
    this.rollTrophy(`fox:${w.kind}`, `${w.kind[0]!.toUpperCase()}${w.kind.slice(1)}`, w.x, w.z);
    // Dead is dead — drop it now rather than waiting for the next sweep.
    this.foxes = this.foxes.filter((o) => !o.dead);
  }

  private damageAnimal(a: PlainsAnimal, amount: number): void {
    a.hp -= amount;
    a.state = 'hurt';
    a.timer = 1.2;
    if (a.hp > 0) {
      a.root.scale.set(a.baseScale * 1.1, a.baseScale * 0.9, a.baseScale * 1.1);
      this.spawnFeedbackBurst(a.x, a.z, 0xffb45c, 4, 0.2);
      this.audio.play('hit');
      return;
    }
    this.stopMixer(a.actions.mixer, a.root);
    this.spawnFeedbackBurst(a.x, a.z, 0xef7561, 8, 0.32);
    this.audio.play('defeat');
    this.spawnDeathMarker(a.root, a.baseScale, a.x, a.z, a.heading, 'animal');
    this.animals = this.animals.filter((o) => o !== a);
    this.rollTrophy(`animal:${a.name}`, a.name, a.x, a.z);
  }

  /** Leave a short-lived, grounded carcass marker instead of making a kill pop. */
  private spawnDeathMarker(
    corpse: THREE.Object3D,
    baseScale: number,
    x: number,
    z: number,
    heading: number,
    kind: 'fox' | 'animal',
  ): void {
    corpse.removeFromParent();
    corpse.scale.setScalar(baseScale);
    corpse.position.set(0, 0.06, 0);
    corpse.rotation.set(0, heading, Math.PI / 2);

    const materials: THREE.Material[] = [];
    corpse.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const source = Array.isArray(obj.material) ? obj.material : [obj.material];
      const copies = source.map((material) => {
        const copy = markMaterialOwner(material.clone(), 'clone');
        copy.transparent = true;
        copy.opacity = 1;
        materials.push(copy);
        return copy;
      });
      disposeCloneOwnedMaterials(source);
      obj.material = copies.length === 1 ? copies[0]! : copies;
      obj.castShadow = true;
      obj.receiveShadow = true;
    });

    const group = new THREE.Group();
    group.name = `remains_${kind}`;
    group.position.set(x, this.world.heightAt(x, z), z);
    group.add(corpse);

    // A subtle low-poly patch gives the player a readable defeat location even
    // when the animal silhouette is partly hidden by terrain or foliage.
    const radius = kind === 'fox' ? 0.48 : 0.7;
    const patchGeometry = new THREE.CircleGeometry(radius, 12);
    const patchMaterial = new THREE.MeshStandardMaterial({
      color: 0x6c382b,
      transparent: true,
      opacity: 0.48,
      roughness: 0.96,
      depthWrite: false,
    });
    const patch = new THREE.Mesh(patchGeometry, patchMaterial);
    patch.rotation.x = -Math.PI / 2;
    patch.position.y = 0.018;
    patch.receiveShadow = true;
    group.add(patch);

    this.world.getFarmActors().add(group);
    this.deathMarkers.push({
      root: group,
      corpse,
      age: 0,
      lifetime: 12,
      fadeAt: 9.5,
      materials,
      patchMaterial,
      patchGeometry,
    });
    while (this.deathMarkers.length > 28) {
      this.removeDeathMarker(this.deathMarkers[0]!);
      this.deathMarkers.shift();
    }
    this.world.markShadowsDirty();
  }

  private removeDeathMarker(marker: DeathMarker): void {
    marker.root.removeFromParent();
    disposeModelClone(marker.corpse);
    marker.patchMaterial.dispose();
    marker.patchGeometry.dispose();
  }

  private clearDeathMarkers(): void {
    for (const marker of this.deathMarkers) this.removeDeathMarker(marker);
    this.deathMarkers = [];
  }

  private stepDeathMarkers(dt: number): void {
    for (let i = this.deathMarkers.length - 1; i >= 0; i--) {
      const marker = this.deathMarkers[i]!;
      marker.age += dt;
      if (marker.age >= marker.lifetime) {
        this.removeDeathMarker(marker);
        this.deathMarkers.splice(i, 1);
        continue;
      }
      if (marker.age < marker.fadeAt) continue;
      const alpha = THREE.MathUtils.clamp(
        1 - (marker.age - marker.fadeAt) / (marker.lifetime - marker.fadeAt),
        0,
        1,
      );
      for (const material of marker.materials) material.opacity = alpha;
      marker.patchMaterial.opacity = alpha * 0.48;
    }
  }

  /** A rare trophy is immediately visible in the world as well as in inventory. */
  private spawnLootMarker(x: number, z: number): void {
    const root = cloneModel('trophy').root;
    root.scale.multiplyScalar(0.78);
    root.position.set(x, this.world.heightAt(x, z) + 0.12, z);
    root.name = 'trophy_drop_marker';
    this.world.getFarmActors().add(root);
    this.lootMarkers.push({ root, age: 0, lifetime: 9, x, z });
    while (this.lootMarkers.length > 12) {
      const oldest = this.lootMarkers[0]!;
      oldest.root.removeFromParent();
      disposeModelClone(oldest.root);
      this.lootMarkers.shift();
    }
    this.world.markShadowsDirty();
  }

  private clearLootMarkers(): void {
    for (const marker of this.lootMarkers) {
      marker.root.removeFromParent();
      disposeModelClone(marker.root);
    }
    this.lootMarkers = [];
  }

  private stepLootMarkers(dt: number): void {
    for (let i = this.lootMarkers.length - 1; i >= 0; i--) {
      const marker = this.lootMarkers[i]!;
      marker.age += dt;
      if (marker.age >= marker.lifetime) {
        marker.root.removeFromParent();
        disposeModelClone(marker.root);
        this.lootMarkers.splice(i, 1);
        continue;
      }
      marker.root.position.y =
        this.world.heightAt(marker.x, marker.z) + 0.18 + Math.sin(marker.age * 4.2) * 0.06;
      marker.root.rotation.y += dt * 1.8;
    }
  }

  private nextFeedbackRandom(): number {
    this.feedbackSeed = (this.feedbackSeed * 1664525 + 1013904223) >>> 0;
    return this.feedbackSeed / 0x1_0000_0000;
  }

  /** Small, shared low-poly contact feedback for actions that changed the world. */
  private spawnFeedbackBurst(
    x: number,
    z: number,
    color: number,
    count = 5,
    spread = 0.16,
  ): void {
    const root = new THREE.Group();
    root.name = 'action_feedback_burst';
    root.position.set(x, this.world.heightAt(x, z) + 0.22, z);
    const geometry = new THREE.OctahedronGeometry(0.07, 0);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const particles: FeedbackParticle[] = [];
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(geometry, material);
      const size = 0.65 + this.nextFeedbackRandom() * 0.65;
      mesh.position.set(
        (this.nextFeedbackRandom() - 0.5) * spread,
        this.nextFeedbackRandom() * 0.12,
        (this.nextFeedbackRandom() - 0.5) * spread,
      );
      mesh.scale.setScalar(size);
      mesh.renderOrder = 6;
      root.add(mesh);
      particles.push({
        mesh,
        size,
        velocity: new THREE.Vector3(
          (this.nextFeedbackRandom() - 0.5) * 1.45,
          0.72 + this.nextFeedbackRandom() * 1.15,
          (this.nextFeedbackRandom() - 0.5) * 1.45,
        ),
        spin: new THREE.Vector3(
          (this.nextFeedbackRandom() - 0.5) * 8,
          (this.nextFeedbackRandom() - 0.5) * 8,
          (this.nextFeedbackRandom() - 0.5) * 8,
        ),
      });
    }
    this.world.getFarmActors().add(root);
    this.feedbackBursts.push({ root, age: 0, lifetime: 0.46, geometry, material, particles });
    while (this.feedbackBursts.length > 24) {
      this.removeFeedbackBurst(this.feedbackBursts[0]!);
      this.feedbackBursts.shift();
    }
  }

  private removeFeedbackBurst(burst: FeedbackBurst): void {
    burst.root.removeFromParent();
    burst.geometry.dispose();
    burst.material.dispose();
  }

  private clearFeedbackBursts(): void {
    for (const burst of this.feedbackBursts) this.removeFeedbackBurst(burst);
    this.feedbackBursts = [];
  }

  private stepFeedbackBursts(dt: number): void {
    for (let i = this.feedbackBursts.length - 1; i >= 0; i--) {
      const burst = this.feedbackBursts[i]!;
      burst.age += dt;
      if (burst.age >= burst.lifetime) {
        this.removeFeedbackBurst(burst);
        this.feedbackBursts.splice(i, 1);
        continue;
      }
      const progress = burst.age / burst.lifetime;
      burst.material.opacity = 0.95 * (1 - progress);
      for (const particle of burst.particles) {
        particle.velocity.y -= 4.1 * dt;
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        particle.mesh.rotation.x += particle.spin.x * dt;
        particle.mesh.rotation.y += particle.spin.y * dt;
        particle.mesh.rotation.z += particle.spin.z * dt;
        particle.mesh.scale.setScalar(particle.size * (1 - progress * 0.55));
      }
    }
  }

  /**
   * Trophies drop on death only, at 1% — with bad-luck protection, so every kill
   * of that same creature that comes up empty adds another point of chance.
   */
  private rollTrophy(key: string, label: string, x: number, z: number): void {
    if (!rollDrop(this.gs.dropPity, key, TROPHY_ODDS, this.gs.rng)) return;
    const id = trophyItem(label);
    if (!addToInventory(this.gs, id, 1)) return;
    this.gs.trophies.push(label);
    this.gs.stats.trophies += 1;
    setToast(this.gs, `Trophy: ${label}!`, 3);
    this.popup(`+1 ${label} Trophy`, x, z);
    this.spawnLootMarker(x, z);
  }

  // ----------------------------------------------------------------- raids

  private spawnRaid(): void {
    this.clearFoxes();
    this.clearDeathMarkers();
    this.clearLootMarkers();
    this.clearFeedbackBursts();
    const spawns = generateWave(
      this.gs.clock.day,
      this.gs.seed,
      cropValueScore(this.gs.tiles),
      totalWeirdness(this.gs.tiles),
    ).filter((spawn) => !this.isEnclosed(Math.floor(spawn.x), Math.floor(spawn.y)));
    for (const sp of spawns) {
      const { root, animations } = cloneModel('fox');
      const x = sp.x;
      const z = sp.y;
      const baseScale = root.scale.x;
      root.position.set(x, this.world.heightAt(x, z), z);
      root.scale.setScalar(baseScale * 0.15);
      const foxActions: FoxActions = { mixer: null };
      if (animations.length) {
        const mixer = new THREE.AnimationMixer(root);
        foxActions.mixer = mixer;
        foxActions.idle = mixer.clipAction(
          animations.find((clip) => /idle/i.test(clip.name)) ?? animations[0]!,
        );
        const walkClip = animations.find((clip) => /walk|run|gallop/i.test(clip.name));
        const attackClip = animations.find((clip) => /attack|bite|snap/i.test(clip.name));
        foxActions.walk = walkClip ? mixer.clipAction(walkClip) : foxActions.idle;
        foxActions.attack = attackClip ? mixer.clipAction(attackClip) : foxActions.idle;
        foxActions.idle.play();
      }
      this.world.getFarmActors().add(root);
      this.foxes.push({
        root,
        baseScale,
        actions: foxActions,
        x,
        z,
        state: 'burrow',
        kind: sp.kind,
        hp: 1,
        timer: FOX_BURROW_TIME,
        targetTx: -1,
        targetTy: -1,
        eatTimer: 0,
        dead: false,
        haulSeed: false,
        attackSlot: this.foxes.length,
        // Spread a player attack around the full ring. Random angles let two
        // actors share the same approach lane and makes the long fox silhouette
        // read as one tangled pile even when their centres are separated.
        attackAngle:
          (this.foxes.length / Math.max(1, spawns.length)) * Math.PI * 2 +
          (this.gs.rng() - 0.5) * 0.22,
        trappedTx: -1,
        trappedTy: -1,
        path: [],
        pathGoalKey: '',
        pathTimer: 0,
        pathTopologyVersion: -1,
      });
    }
    this.world.markShadowsDirty();
  }

  private clearFoxes(restoreTraps = true): void {
    for (const w of this.foxes) {
      if (restoreTraps) this.resetFoxTrap(w);
      this.stopMixer(w.actions.mixer, w.root);
      w.root.removeFromParent();
      disposeModelClone(w.root);
    }
    this.foxes = [];
  }

  private stopMixer(mixer: THREE.AnimationMixer | null, root: THREE.Object3D): void {
    if (!mixer) return;
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
  }

  private clearAnimals(): void {
    for (const animal of this.animals) {
      this.stopMixer(animal.actions.mixer, animal.root);
      animal.root.removeFromParent();
      disposeModelClone(animal.root);
    }
    this.animals = [];
  }

  private resetFoxTrap(w: Fox): void {
    if (w.trappedTx < 0 || w.trappedTy < 0) return;
    const tile = getTile(this.gs.tiles, w.trappedTx, w.trappedTy);
    if (tile?.bearTrapClosed) {
      tile.bearTrapClosed = false;
      tile.bearTrap = true;
      this.syncBearTrapModels();
    }
    w.trappedTx = -1;
    w.trappedTy = -1;
  }

  private playFoxAction(w: Fox, action: 'idle' | 'walk' | 'attack'): void {
    const next = w.actions[action] ?? w.actions.idle ?? w.actions.walk;
    if (!next || w.actions.active === next) return;
    w.actions.active?.fadeOut(0.12);
    next.reset().fadeIn(0.12).play();
    w.actions.active = next;
  }

  private nearestOpenBearTrap(x: number, z: number): { tx: number; ty: number; wx: number; wz: number } | null {
    const r = Math.ceil(BEAR_TRAP_RADIUS + 0.5);
    const cx = Math.floor(x);
    const cz = Math.floor(z);
    let best: { tx: number; ty: number; wx: number; wz: number } | null = null;
    let bestDistance = BEAR_TRAP_RADIUS;
    for (let ty = cz - r; ty <= cz + r; ty++) {
      for (let tx = cx - r; tx <= cx + r; tx++) {
        const tile = getTile(this.gs.tiles, tx, ty);
        if (!tile?.bearTrap || tile.bearTrapClosed) continue;
        const wc = this.farmTileWorld(tx, ty);
        const distance = Math.hypot(x - wc.x, z - wc.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { tx, ty, wx: wc.x, wz: wc.z };
        }
      }
    }
    return best;
  }

  private stepFoxes(dt: number): void {
    const crops = this.cropTargetList();
    this.foxDirector.advance();
    for (const w of [...this.foxes]) {
      if (w.dead) continue;
      w.actions.mixer?.update(dt);

      if (w.state !== 'burrow' && w.state !== 'trapped') {
        const bearTrap = this.nearestOpenBearTrap(w.x, w.z);
        if (bearTrap && triggerBearTrap(this.gs.tiles, bearTrap.tx, bearTrap.ty)) {
          this.recordAction('trap_catch');
          w.x = bearTrap.wx;
          w.z = bearTrap.wz;
          w.state = 'trapped';
          w.timer = 5;
          w.trappedTx = bearTrap.tx;
          w.trappedTy = bearTrap.ty;
          w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
          w.root.rotation.y = Math.atan2(this.playerX - w.x, this.playerZ - w.z);
          this.playFoxAction(w, 'idle');
          this.syncWorldTiles([{ tx: bearTrap.tx, ty: bearTrap.ty }]);
          this.syncBearTrapModels();
          this.spawnFeedbackBurst(w.x, w.z, 0xd2a86a, 8, 0.3);
          this.audio.play('trap');
          setToast(this.gs, 'Fox caught in the bear trap!', 2.2);
          continue;
        }
      }

      const tpos = this.worldToFarmTile(w.x, w.z);
      if (tpos && hasRepelNearby(this.gs.tiles, tpos.tx, tpos.ty, 3)) w.state = 'flee';

      if (w.state === 'trapped') {
        this.playFoxAction(w, 'idle');
        w.timer -= dt;
        if (w.timer <= 0) {
          this.resetFoxTrap(w);
          w.state = 'flee';
          this.playFoxAction(w, 'walk');
        }
        continue;
      }

      if (w.state === 'burrow') {
        w.timer -= dt;
        const t = 1 - w.timer / FOX_BURROW_TIME;
        w.root.scale.setScalar(w.baseScale * (0.15 + 0.85 * Math.min(1, t)));
        if (w.timer <= 0) {
          w.state = 'seek';
          w.root.scale.setScalar(w.baseScale);
          this.playFoxAction(w, 'walk');
          this.foxDirector.pickTarget(w, crops);
        }
        continue;
      }

      if (w.state === 'attack') {
        w.timer -= dt;
        const phase = 1 - Math.max(0, w.timer) / FOX_ATTACK_PERIOD;
        const directionX = Math.sin(w.attackAngle);
        const directionZ = Math.cos(w.attackAngle);
        const lunge = Math.max(0, Math.sin(phase * Math.PI * 2)) * FOX_ATTACK_LUNGE;
        const radius = FOX_ATTACK_RADIUS + (w.attackSlot % 3) * FOX_ATTACK_SLOT_GAP - lunge;
        w.x = this.playerX + directionX * radius;
        w.z = this.playerZ + directionZ * radius;
        w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
        w.root.rotation.y = Math.atan2(this.playerX - w.x, this.playerZ - w.z);
        const pulse = Math.sin(phase * Math.PI * 2);
        w.root.scale.set(
          w.baseScale * (1 + pulse * 0.05),
          w.baseScale * (1 - pulse * 0.08),
          w.baseScale * (1 + pulse * 0.05),
        );
        this.playFoxAction(w, 'attack');
        if (w.timer <= 0) {
          w.state = 'seek';
          w.root.scale.setScalar(w.baseScale);
          this.playFoxAction(w, 'walk');
        }
        continue;
      }

      if (w.state === 'seek') {
        this.playFoxAction(w, 'walk');
        if (w.kind === 'sapper') {
          if (w.targetTx < 0) {
            let found = false;
            for (let y = 0; y < GRID_H && !found; y++) {
              for (let x = 0; x < GRID_W; x++) {
                if (getTile(this.gs.tiles, x, y)?.state === 'trench') {
                  w.targetTx = x;
                  w.targetTy = y;
                  found = true;
                  break;
                }
              }
            }
            if (!found) {
              w.state = 'flee';
              continue;
            }
            w.path = [];
            w.pathGoalKey = '';
            w.pathTimer = 0;
          }
        } else if (crops.length === 0) {
          // Give each fox a point on an attack ring. The path itself still ends
          // on the player's tile graph, so a fence cannot be walked through.
          const radius = FOX_ATTACK_RADIUS + (w.attackSlot % 3) * FOX_ATTACK_SLOT_GAP;
          const targetX = this.playerX + Math.sin(w.attackAngle) * radius;
          const targetZ = this.playerZ + Math.cos(w.attackAngle) * radius;
          const playerTile = this.worldToFarmTile(this.playerX, this.playerZ);
          const route = playerTile
            ? this.foxDirector.moveTowardTile(w, playerTile.tx, playerTile.ty, this.foxDirector.speedFor(w.kind) * 0.5, dt)
            : { atGoal: false, hasPath: false };
          if (route.atGoal || Math.hypot(targetX - w.x, targetZ - w.z) < 0.28) {
            w.state = 'attack';
            w.timer = FOX_ATTACK_PERIOD;
            this.playFoxAction(w, 'attack');
          } else if (!route.hasPath) {
            w.state = 'flee';
          }
          continue;
        } else if (w.targetTx < 0) {
          this.foxDirector.pickTarget(w, crops);
          if (w.targetTx < 0) {
            w.state = 'flee';
            continue;
          }
        }

        const route = this.foxDirector.moveTowardTile(w, w.targetTx, w.targetTy, this.foxDirector.speedFor(w.kind), dt);
        if (!route.hasPath) {
          w.state = 'flee';
          continue;
        }
        if (route.atGoal) {
          if (w.kind === 'sapper') {
            const t = getTile(this.gs.tiles, w.targetTx, w.targetTy);
            if (t && t.state === 'trench') {
              t.structureHp -= 1;
              if (t.structureHp <= 0) {
                t.state = 'grass';
                this.syncWorldTiles([{ tx: w.targetTx, ty: w.targetTy }]);
              }
            }
            w.state = 'flee';
          } else if (w.kind === 'nibbler') {
            const nibbled = nibbleCrop(this.gs.tiles, w.targetTx, w.targetTy);
            if (nibbled) this.syncCropTile(w.targetTx, w.targetTy);
            this.syncWorldTiles([{ tx: w.targetTx, ty: w.targetTy }]);
            w.targetTx = -1;
            if (this.gs.rng() < 0.4) w.state = 'flee';
          } else if (w.kind === 'hauler') {
            if (destroyCrop(this.gs.tiles, w.targetTx, w.targetTy)) {
              w.haulSeed = true;
              this.syncCropTile(w.targetTx, w.targetTy);
              this.syncWorldTiles([{ tx: w.targetTx, ty: w.targetTy }]);
            }
            w.state = 'flee';
          } else {
            w.state = 'eat';
            w.eatTimer = FOX_EAT_TIME;
            w.root.scale.set(w.baseScale * 1.25, w.baseScale * 0.85, w.baseScale * 1.25);
            this.playFoxAction(w, 'attack');
          }
        }
        continue;
      }

      if (w.state === 'eat') {
        this.playFoxAction(w, 'attack');
        w.eatTimer -= dt;
        w.root.scale.y = w.baseScale * (1 + Math.sin(this.gs.simTime * 12) * 0.08);
        if (w.eatTimer <= 0) {
          if (destroyCrop(this.gs.tiles, w.targetTx, w.targetTy)) {
            this.syncCropTile(w.targetTx, w.targetTy);
          }
          this.syncWorldTiles([{ tx: w.targetTx, ty: w.targetTy }]);
          w.state = 'flee';
          w.root.scale.setScalar(w.baseScale);
        }
        continue;
      }

      if (w.state === 'flee') {
        this.playFoxAction(w, 'walk');
        const edge = nearestEdgePoint(w.x, w.z);
        const sp = this.foxDirector.speedFor(w.kind) * (w.haulSeed ? 1.15 : 1.3);
        const edgeTx = THREE.MathUtils.clamp(Math.round(edge.x), 0, WORLD_SIZE - 1);
        const edgeTy = THREE.MathUtils.clamp(Math.round(edge.y), 0, WORLD_SIZE - 1);
        const route = this.foxDirector.moveTowardTile(w, edgeTx, edgeTy, sp, dt);
        const dist = Math.hypot(edge.x - w.x, edge.y - w.z);
        if (route.atGoal || dist < 0.5) {
          w.dead = true;
          this.stopMixer(w.actions.mixer, w.root);
          w.root.removeFromParent();
          disposeModelClone(w.root);
        }
      }
    }
    this.foxDirector.separate(this.foxes);
    this.foxes = this.foxes.filter((w) => !w.dead);
  }

  private cropTargetList(): { x: number; y: number }[] {
    this.cropTargetSnapshot.length = 0;
    for (const target of this.cropTargets.values()) this.cropTargetSnapshot.push(target);
    return this.cropTargetSnapshot;
  }

  /** Reconcile one farm tile with its batched or primitive crop representation. */
  private syncCropTile(tx: number, ty: number, rebuildBatch = true): void {
    const key = tileKey(tx, ty);
    this.cropBatches?.removeTile(key);
    const fallback = this.cropFallbacks.get(key);
    if (fallback) {
      fallback.root.removeFromParent();
      disposeModelClone(fallback.root);
      this.cropFallbacks.delete(key);
      const index = this.crops.indexOf(fallback);
      if (index >= 0) this.crops.splice(index, 1);
    }

    const tile = getTile(this.gs.tiles, tx, ty);
    if (!tile || (tile.state !== 'planted' && tile.state !== 'mature') || !tile.seed) {
      this.cropTargets.delete(key);
      return;
    }
    this.cropTargets.set(key, { x: tx, y: ty });

    const stage = tile.state === 'mature' ? 2 : tile.stage;
    const base = CROP_MODEL_BASE[tile.seed.species] ?? CROP_MODEL_BASE.beet;
    const suffix = stage === 2 ? 4 : stage + 1;
    const modelKey = `${base}_${suffix}` as ModelKey;
    const color = CROP_DEFS[tile.seed.species]?.color;
    const wc = this.farmTileWorld(tx, ty);
    const batched = this.cropBatches?.upsert(
      {
        tileKey: key,
        tx,
        ty,
        x: wc.x,
        y: this.world.heightAt(wc.x, wc.z),
        z: wc.z,
        modelKey,
        tint: color,
        baseScale: 1,
      },
      rebuildBatch,
    ) ?? false;
    if (batched) {
      this.world.markShadowsDirty();
      return;
    }

    // Preserve primitive fallbacks when a crop asset is unavailable.
    const { root } = cloneModel(modelKey);
    const baseScale = root.scale.x;
    root.position.set(wc.x, this.world.heightAt(wc.x, wc.z), wc.z);
    if (color) {
      root.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
          const source = object.material;
          object.material = markMaterialOwner(source.clone(), 'clone');
          disposeCloneOwnedMaterials([source]);
          object.material.color.set(color);
        }
      });
    }
    this.world.getFarmActors().add(root);
    const actor = { root, baseScale, tx, ty, stage };
    this.crops.push(actor);
    this.cropFallbacks.set(key, actor);
    this.world.markShadowsDirty();
  }

  private rebuildCrops(): void {
    this.clearCrops();
    this.refreshCropTargetsFromTiles();
    let n = 0;
    const maxVisible = 800;
    for (let ty = 0; ty < GRID_H && n < maxVisible; ty++) {
      for (let tx = 0; tx < GRID_W && n < maxVisible; tx++) {
        const tile = this.gs.tiles[ty]![tx]!;
        if (tile.state !== 'planted' && tile.state !== 'mature') continue;
        this.syncCropTile(tx, ty, false);
        n++;
      }
    }
    this.cropBatches?.update(this.gs.simTime, true);
    this.world.markShadowsDirty();
  }

  private refreshCropTargetsFromTiles(): void {
    this.cropTargets.clear();
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const tile = this.gs.tiles[ty]![tx]!;
        if ((tile.state === 'planted' || tile.state === 'mature') && tile.seed) {
          this.cropTargets.set(tileKey(tx, ty), { x: tx, y: ty });
        }
      }
    }
  }

  private clearCrops(): void {
    this.cropBatches?.clear();
    for (const crop of this.crops) {
      crop.root.removeFromParent();
      disposeModelClone(crop.root);
    }
    this.crops = [];
    this.cropFallbacks.clear();
    this.cropTargets.clear();
    this.cropTargetSnapshot.length = 0;
  }

  private seedPlainsAnimals(): void {
    if (this.animalsSeeded) return;
    this.animalsSeeded = true;
    for (let i = 0; i < 10; i++) {
      const animal = PLAINS_ANIMALS[i % PLAINS_ANIMALS.length]!;
      let x = 0;
      let z = 0;
      let tries = 0;
      do {
        x = 20 + this.gs.rng() * (WORLD_SIZE - 40);
        z = 20 + this.gs.rng() * (WORLD_SIZE - 40);
        tries++;
      } while (tries < 40 && this.world.distToWater(x, z) < 4);
      const { root, animations } = cloneModel(animal.model);
      const baseScale = root.scale.x;
      root.position.set(x, this.world.heightAt(x, z), z);
      this.world.getFarmActors().add(root);
      const actions: AnimalActions = { mixer: null };
      if (animations.length) {
        const mixer = new THREE.AnimationMixer(root);
        actions.mixer = mixer;
        const idleClip = animations.find((clip) => /^idle$/i.test(clip.name));
        const walkClip = animations.find((clip) => /^walk$/i.test(clip.name));
        const hurtClip = animations.find((clip) => /hitreact1/i.test(clip.name));
        actions.idle = mixer.clipAction(idleClip ?? animations[0]!);
        actions.walk = walkClip ? mixer.clipAction(walkClip) : actions.idle;
        actions.hurt = hurtClip ? mixer.clipAction(hurtClip) : actions.walk;
        actions.idle.play();
        actions.active = actions.idle;
      }
      this.animals.push({
        root,
        baseScale,
        actions,
        x,
        z,
        heading: this.gs.rng() * Math.PI * 2,
        targetHeading: this.gs.rng() * Math.PI * 2,
        speed: 1.1 + this.gs.rng() * 0.8,
        timer: 2 + this.gs.rng() * 4,
        hp: 3,
        state: 'idle',
        name: animal.name,
      });
    }
  }

  private playAnimalAction(a: PlainsAnimal, action: 'idle' | 'walk' | 'hurt'): void {
    const next = a.actions[action] ?? a.actions.idle ?? a.actions.walk;
    if (!next || a.actions.active === next) return;
    const previous = a.actions.active;
    next.reset();
    if (action === 'hurt') {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }
    next.play();
    if (previous) previous.crossFadeTo(next, 0.16, true);
    else next.fadeIn(0.16);
    a.actions.active = next;
  }

  private stepAnimals(dt: number): void {
    for (const a of this.animals) {
      a.timer -= dt;
      const scale = THREE.MathUtils.damp(a.root.scale.x, a.baseScale, 8, dt);
      a.root.scale.setScalar(scale);
      if (a.state === 'hurt') {
        this.playAnimalAction(a, 'hurt');
        const dx = a.x - this.playerX;
        const dz = a.z - this.playerZ;
        const len = Math.hypot(dx, dz) || 1;
        a.x += (dx / len) * a.speed * 2.2 * dt;
        a.z += (dz / len) * a.speed * 2.2 * dt;
        a.heading = Math.atan2(dx, dz);
        if (a.timer <= 0) {
          a.state = 'walk';
          a.timer = 3;
          this.playAnimalAction(a, 'walk');
        }
      } else {
        if (a.timer <= 0) {
          a.state = a.state === 'idle' ? 'walk' : 'idle';
          a.timer = 2 + this.gs.rng() * 4;
          a.targetHeading = this.gs.rng() * Math.PI * 2;
          this.playAnimalAction(a, a.state);
        }
        if (a.state === 'walk') {
          a.heading = THREE.MathUtils.damp(a.heading, a.targetHeading, 3, dt);
          a.x += Math.sin(a.heading) * a.speed * dt;
          a.z += Math.cos(a.heading) * a.speed * dt;
        }
      }
      a.x = THREE.MathUtils.clamp(a.x, 4, WORLD_SIZE - 4);
      a.z = THREE.MathUtils.clamp(a.z, 4, WORLD_SIZE - 4);
      a.root.position.set(a.x, this.world.heightAt(a.x, a.z), a.z);
      a.root.rotation.y = a.heading;
    }
  }

  // ---------------------------------------------------------------- popups

  /** Float a "+N Item" off a world position. */
  private popup(text: string, x: number, z: number): void {
    const screen = this.projectToScreen(x, z);
    this.popups.push({ id: this.popupId++, text, x: screen.x, y: screen.y, life: 1 });
    if (this.popups.length > 8) this.popups.shift();
  }

  private projectToScreen(x: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, this.world.heightAt(x, z) + 0.8, z).project(this.world.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  private stepPopups(dt: number): void {
    for (const p of this.popups) {
      p.life -= dt / 1.4;
      p.y -= dt * 0.05;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
  }

  private interactionHint(seed: ReturnType<typeof selectedSeed>): string {
    const controls = `1 shotgun · 2 shovel · 3 axe · 6 bucket · Q boulder · B bear trap · R weapon · U upgrade · P build · X demolish · I inventory · [ ] seed (${seed?.displayName ?? '—'}) · + / − zoom · M motion · F12 grid`;
    if (this.buildingMode) {
      const selected = this.placement.selectedAsset();
      return `Build: ${selected?.displayName ?? 'asset'} · right-click rotate · click place · Esc exit`;
    }
    if (this.nearMerchant) return 'E — open the Traveling Merchant shop';
    if (this.nearMarket) return 'Market stall — sell for duckettes';
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) return 'E — fill bucket';
    if (this.toolMode !== 'farm') return `Tool: ${this.toolMode} · 2 back to shovel`;

    const tile = this.pointerTile();
    if (this.gs.toolSlotActive) {
      if (!tile) return '6 bucket · point at a planted tile to water';
      const target = getTile(this.gs.tiles, tile.tx, tile.ty);
      if (target?.state === 'planted' && !target.watered) return '6 bucket · click to water';
      if (target?.state === 'mature') return 'Harvest is ready · switch to the shovel';
      return '6 bucket · point at a thirsty crop';
    }

    if (this.gs.toolbarSlot === SLOT_SHOVEL) {
      if (!tile) return '2 shovel · point at a farm tile';
      const target = getTile(this.gs.tiles, tile.tx, tile.ty);
      const wc = this.farmTileWorld(tile.tx, tile.ty);
      if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) return 'Move closer to work this tile';
      const trees = this.world.getFarmTrees();
      if (trees?.hasTree(tile.tx, tile.ty)) return 'Axe required here · switch to slot 3';
      if (trees?.hasStump(tile.tx, tile.ty)) return 'Clear the stump with the axe · slot 3';
      if (trees?.rockSlot(tile.tx, tile.ty)) return 'Boulder occupies this tile';
      if (!target) return 'Point at a farm tile';
      if (target.state === 'grass') return 'Click to till this tile';
      if (target.state === 'tilled' || target.state === 'breeding') {
        return seed ? `Click to plant ${seed.displayName}` : 'No seed selected';
      }
      if (target.state === 'planted' && !target.watered) return 'Use the bucket to water this crop';
      if (target.state === 'mature') return 'Click to harvest';
    }

    if (this.gs.toolbarSlot === SLOT_AXE) {
      const trees = tile ? this.world.getFarmTrees() : null;
      if (tile && trees?.hasTree(tile.tx, tile.ty)) return 'Click to chop this tree';
      if (tile && trees?.hasStump(tile.tx, tile.ty)) return 'Click to clear this stump';
      return '3 axe · click a tree to chop';
    }

    if (this.gs.toolbarSlot === SLOT_SHOTGUN) return '1 shotgun · click or right-click to fire';
    return controls;
  }

  // ------------------------------------------------------------------- HUD

  private pushHud(force: boolean): void {
    if (!this.gs || !this.hudPresenter.hasListener) return;
    this.hudPresenter.push(force, {
      state: this.gs,
      hint: this.interactionHint(selectedSeed(this.gs)),
      buildingMode: this.buildingMode,
      selectedBuildIndex: this.placement.currentIndex,
      placement: () => {
        const status = this.placement.status();
        return { valid: status.valid, reason: status.reason };
      },
      helpOpen: this.helpOpen,
      toolSlotModel: null,
      marketOpen: this.nearMarket,
      vendorOpen: this.vendorOpen,
      vendorTab: this.vendorTab,
      vendorTabs: this.availableVendorTabs(),
      vendorMessage: this.vendorMessage,
      economy: this.economyCapability,
      setVendorTab: (tab) => {
        this.vendorTab = tab;
      },
      contextMenu: this.contextMenu,
      demolishMode: this.demolishMode,
      paused: this.pauseOpen,
      marketAngle: this.world.screenAngleTo(this.playerX, this.playerZ, this.stallX, this.stallZ),
      marketDistance: Math.round(Math.hypot(this.playerX - this.stallX, this.playerZ - this.stallZ)),
      popups: this.popups,
      save: this.saveFeedback,
      winShownLocal: this.winShownLocal,
    });
  }
}
