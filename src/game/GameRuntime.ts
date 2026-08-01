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
  HAULER_SPEED,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SIZE,
  HOMESTEAD_UPGRADE_WOOD,
  INVENTORY_SLOTS,
  MARKET_RANGE,
  MELEE_COOLDOWN,
  MELEE_RANGE,
  NIBBLER_SPEED,
  PLAYER_ACCEL,
  PLAYER_DAMP,
  PLAYER_SPEED,
  SAVE_KEY,
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
  FOX_SEPARATION,
  FOX_EAT_TIME,
  FOX_SPEED,
  WIN_DAY,
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
  loadFromString,
  markTreeChopped,
  markWinShown,
  onNewDay,
  placeBuilding,
  saveToString,
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
  findCropTiles,
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
import { occupiedSlots } from '../sim/inventory';
import { hasRoomFor } from '../sim/inventory';
import { cropItem, cropName, itemInfo, ITEM_WOOD, trophyItem, type ItemId } from '../sim/items';
import { rollDrop, TROPHY_ODDS } from '../sim/luck';
import {
  generateWave,
  nearestEdgePoint,
  type FoxType,
} from '../sim/raid';
import { cloneModel, preloadAll, initAssetLoaders, type ModelKey } from './Assets';
import { AudioFeedback } from './AudioFeedback';
import { InputController } from './InputController';
import { buildMarketStall } from './MarketStall';
import { WorldRenderer } from './WorldRenderer';
import type { BuildingId, PlacedBuilding } from '../sim/save';
import {
  assetDefinition,
  deedAssetId,
  deedItemId,
  shopAssets,
  type AssetCategory,
  type AssetId,
  type PurchasableAsset,
} from '../content/purchasables';
import { CENTRAL_CAMP, CENTRAL_CAMP_FIXTURES } from '../content/mapData';
import {
  calculateEnclosedTiles,
  GRID_DIRECTIONS_8,
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

export type HudSlot = {
  id: ItemId | null;
  name: string;
  glyph: string;
  model: ModelKey | null;
  count: number;
  price: number;
  blurb: string;
};

export type HudToolbarSlot = {
  index: number;
  name: string;
  glyph: string;
  model: ModelKey | null;
  selected: boolean;
  empty: boolean;
};

export type HudBuildOption = {
  index: number;
  name: string;
  model: ModelKey;
  cost: number;
  canAfford: boolean;
};

export type HudMarket = {
  open: boolean;
  items: { id: ItemId; name: string; glyph: string; model: ModelKey | null; count: number; price: number }[];
  total: number;
};

export type HudVendorAsset = {
  id: AssetId;
  name: string;
  description: string;
  footprint: string;
  useType: PurchasableAsset['useType'];
  gate: boolean;
  model: ModelKey;
  price: number;
  material: string;
};

export type HudVendor = {
  open: boolean;
  tab: AssetCategory;
  tabs: AssetCategory[];
  items: HudVendorAsset[];
  message: string;
};

export type HudContextMenu = {
  open: boolean;
  x: number;
  y: number;
  name: string;
  placedIndex: number;
  gate: boolean;
  gateOpen: boolean;
};

/** Floating "+3 Wood" that rises off whatever you just gathered. */
export type HudPopup = {
  id: number;
  text: string;
  /** Viewport fraction, 0..1 from the top-left. */
  x: number;
  y: number;
  /** 1 at spawn → 0 when it should be gone. */
  life: number;
};

type EconomyMetrics = {
  sessionStartedAt: number;
  actions: number;
  actionKinds: Record<string, number>;
  saleTransactions: number;
  duckettesEarned: number;
  upgrades: number;
  firstUpgradeInGameSeconds: number | null;
  buildingsPlaced: number;
  cropsPlanted: number;
  cropsHarvested: number;
  treesFelled: number;
  foxesFelled: number;
  daysReached: number;
};

export type HudSnapshot = {
  day: number;
  phase: 'day' | 'night';
  phaseT: number;
  hint: string;
  inventory: HudSlot[];
  inventoryOpen: boolean;
  duckettes: number;
  toolbar: HudToolbarSlot[];
  build: {
    active: boolean;
    selectedIndex: number;
    wood: number;
    options: HudBuildOption[];
    placement: {
      valid: boolean;
      reason: string;
    };
  };
  helpOpen: boolean;
  toolSlot: {
    name: string;
    glyph: string;
    model: ModelKey | null;
    selected: boolean;
    fill: number;
    capacity: number;
  };
  ultimate: {
    name: string;
    glyph: string;
    model: ModelKey;
    ready: boolean;
    cooldown: number;
    max: number;
  };
  bearTrap: {
    name: string;
    glyph: string;
    model: ModelKey;
    ready: boolean;
    cooldown: number;
    max: number;
  };
  market: HudMarket;
  vendor: HudVendor;
  contextMenu: HudContextMenu;
  demolishMode: boolean;
  paused: boolean;
  /** Screen-space bearing to the market stall, radians, 0 = straight up. */
  marketAngle: number;
  marketDistance: number;
  popups: HudPopup[];
  toast: string;
  win: null | {
    daysSurvived: number;
    cropsHarvested: number;
    woodGathered: number;
    trophies: number;
  };
};

type FoxState = 'burrow' | 'seek' | 'attack' | 'eat' | 'flee' | 'trapped';

type Fox = {
  root: THREE.Object3D;
  baseScale: number;
  actions: FoxActions;
  x: number;
  z: number;
  state: FoxState;
  kind: FoxType;
  hp: number;
  timer: number;
  targetTx: number;
  targetTy: number;
  eatTimer: number;
  dead: boolean;
  haulSeed: boolean;
  attackSlot: number;
  attackAngle: number;
  trappedTx: number;
  trappedTy: number;
  path: { tx: number; ty: number }[];
  pathGoalKey: string;
  pathTimer: number;
};

type FoxActions = {
  mixer: THREE.AnimationMixer | null;
  idle?: THREE.AnimationAction;
  walk?: THREE.AnimationAction;
  attack?: THREE.AnimationAction;
  active?: THREE.AnimationAction;
};

type Shot = {
  root: THREE.Object3D;
  kind: 'arrow' | 'pellet';
  x: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  ricochet: number;
  dmg: number;
};

type Boulder = {
  mesh: THREE.Mesh;
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
  mixer: THREE.AnimationMixer | null;
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

type DeathMarker = {
  root: THREE.Group;
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

type BuildingPlacement = {
  tile: { tx: number; ty: number } | null;
  x: number;
  z: number;
  valid: boolean;
  reason: string;
  asset: PurchasableAsset | null;
  rotation: number;
};

type ToolMode = 'farm' | 'trench' | 'breed';

type PlayerClip =
  | 'idle'
  | 'walk'
  | 'run'
  | 'walkCarry'
  | 'runCarry'
  | 'pickUp'
  | 'shoot'
  | 'swordSlash'
  | 'punch';

type EquippedToolKey = 'axe' | 'bow_wooden' | 'shotgun_2' | 'shovel';

type ToolProfile = {
  scale: number;
  /** Transform from the animated right-hand socket into the tool's grip pose. */
  carryPosition: readonly [number, number, number];
  carryRotation: readonly [number, number, number];
  /** A readable strike/pickup pose while the rig plays a one-shot clip. */
  actionPosition: readonly [number, number, number];
  actionRotation: readonly [number, number, number];
  actionScale: number;
  /** Some carry clips are authored for a particular silhouette. */
  runClip: 'walkCarry' | 'runCarry';
  /** Optional second-hand contact point in the model's local coordinates. */
  supportGrip?: readonly [number, number, number];
  /** Override the carry grip for a one-shot action such as digging. */
  actionSupportGrip?: readonly [number, number, number];
  /** How strongly the left arm follows the support grip, 0..1. */
  supportBlend?: number;
};

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

const TOOL_PROFILES: Record<EquippedToolKey, ToolProfile> = {
  axe: {
    scale: 1.35,
    carryPosition: [0.02, -0.1, 0.03],
    carryRotation: [0, 0, -0.55],
    actionPosition: [0.25, 0.14, -0.3],
    actionRotation: [0, 0, -0.55],
    actionScale: 1.15,
    runClip: 'runCarry',
  },
  bow_wooden: {
    scale: 0.58,
    carryPosition: [0, -0.24, 0.04],
    carryRotation: [0, 0, -0.25],
    actionPosition: [0.05, -0.16, -0.18],
    actionRotation: [0, 0, -0.25],
    actionScale: 1,
    runClip: 'walkCarry',
  },
  shotgun_2: {
    scale: 0.45,
    // The source is an X-axis prop: the negative end is the stock and the
    // positive end is the barrel. Put the stock in the right hand and use the
    // fore-end as a real left-hand target instead of letting the gun float from
    // the wrist or hang upside down.
    carryPosition: [0.2, 0, 0],
    carryRotation: [0, 0, 0],
    actionPosition: [0.2, 0, 0],
    actionRotation: [0, 0, 0],
    actionScale: 1,
    runClip: 'runCarry',
    supportGrip: [0.55, 0, 0],
  },
  shovel: {
    // The shovel's source is vertical. Rotate it across the body for carry so
    // the upper shaft sits in the right hand and the lower shaft meets the
    // left hand; the action pose then returns it toward the soil.
    scale: 1.2,
    carryPosition: [0.84, 0.02, -0.04],
    carryRotation: [0, 0, Math.PI / 2],
    actionPosition: [0.45, 0, -0.25],
    actionRotation: [0, 0, -0.62],
    actionScale: 1,
    runClip: 'runCarry',
    supportGrip: [0, 0.35, 0],
    actionSupportGrip: [0, 0.05, 0],
    supportBlend: 0.82,
  },
};

const HOMESTEAD_MODEL_KEYS = [
  'house_1',
  'house_2',
  'house_3',
  'house_4',
  'house_5',
] as const;

const PLACEABLE_BUILDING_IDS = [
  'well',
  'chicken_coop',
  'silo',
  'windmill',
  'tower_windmill',
  'water_tower',
  'fence',
  'fence2',
  'gate',
  'small_barn',
  'open_barn',
  'barn',
  'silo_house',
  'big_barn',
] as const;

const PLACEABLE_BUILDINGS: {
  id: BuildingId;
  model: ModelKey;
  name: string;
  cost: number;
}[] = PLACEABLE_BUILDING_IDS.flatMap((id) => {
  const asset = assetDefinition(id);
  if (!asset) return [];
  return [{
    id,
    model: asset.modelKey,
    name: asset.displayName,
    cost: asset.materialCost.wood ?? asset.price,
  }];
});

const HOMESTEAD_X = HOMESTEAD_MIN_X + 8;
const HOMESTEAD_Z = HOMESTEAD_MIN_Z + 8;

/**
 * Bottom toolbar. Slot 1 is the brown shotgun, slot 2 the shovel you work the
 * ground with, slot 3 the red axe. The bucket has its own water slot, and Boulder
 * Roll its own ability slots to the left.
 */
const SLOT_SHOTGUN = 0;
const SLOT_SHOVEL = 1;
const SLOT_AXE = 2;

const TOOLBAR_ASSET_IDS = [
  'tool:shotgun',
  'tool:shovel',
  'tool:axe',
  null,
  null,
] as const;

const TOOLBAR = TOOLBAR_ASSET_IDS.map((id) => {
  const asset = id ? assetDefinition(id) : null;
  return {
    name: asset?.displayName ?? '',
    glyph: '',
    model: asset?.modelKey ?? null,
    empty: !asset,
  };
});

const CROP_ICON_MODELS: Record<string, ModelKey> = {
  Grass: 'grasscrop_4',
  Dandelion: 'dandelion_4',
  Beet: 'beet_4',
  Carrot: 'carrot_4',
  Lettuce: 'lettuce_4',
};

function itemIconModel(id: ItemId): ModelKey | null {
  if (id === ITEM_WOOD) return 'wood_log';
  const deed = deedAssetId(id);
  if (deed) return assetDefinition(deed)?.modelKey ?? null;
  const crop = cropName(id);
  if (crop !== null) return CROP_ICON_MODELS[crop] ?? null;
  if (id.startsWith('trophy:')) return 'trophy';
  return null;
}

export class GameRuntime {
  private gs!: GameState;
  private world!: WorldRenderer;
  private input = new InputController();
  private audio = new AudioFeedback();
  private canvas!: HTMLCanvasElement;
  private accum = 0;
  private running = false;
  private disposed = false;
  private raf = 0;

  private playerRoot!: THREE.Object3D;
  private playerMixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private playerActions: Partial<Record<PlayerClip, THREE.AnimationAction>> = {};
  private oneShotAction: THREE.AnimationAction | null = null;
  private handBone: THREE.Object3D | null = null;
  private leftHandBone: THREE.Object3D | null = null;
  private leftUpperArmBone: THREE.Object3D | null = null;
  private leftLowerArmBone: THREE.Object3D | null = null;
  private equippedToolRoot: THREE.Object3D | null = null;
  private equippedToolKey: EquippedToolKey | null = null;
  private equippedToolSourceScale = 1;
  private playerX = WORLD_SIZE / 2;
  private playerZ = WORLD_SIZE / 2;
  private velX = 0;
  private velZ = 0;
  private headingTarget = 0;
  private nearWater = false;
  private toolMode: ToolMode = 'farm';
  private buildingMode = false;
  private placementAssetId: AssetId | null = null;
  private placementRotation = 0;
  private demolishMode = false;
  private pauseOpen = false;
  private helpOpen = false;
  private reducedMotion = false;
  private placeableBuildingIndex = 0;
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
  private stallRoot: THREE.Object3D | null = null;
  private stallX = 0;
  private stallZ = 0;
  private nearMarket = false;
  private merchantRoot: THREE.Object3D | null = null;
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
  private enclosedTiles = new Uint8Array(GRID_W * GRID_H) as Uint8Array<ArrayBufferLike>;
  private saveTimer = 0;

  private animals: PlainsAnimal[] = [];
  private animalsSeeded = false;

  private popups: HudPopup[] = [];
  private popupId = 1;
  private hitPause = 0;
  /** Renderer-only randomness; never consume the simulation RNG for decoration. */
  private feedbackSeed = 0x51f15eed;
  private onHud: ((s: HudSnapshot) => void) | null = null;
  private lastHudJson = '';
  private winShownLocal = false;
  private economyMetrics: EconomyMetrics = {
    sessionStartedAt: performance.now(),
    actions: 0,
    actionKinds: {},
    saleTransactions: 0,
    duckettesEarned: 0,
    upgrades: 0,
    firstUpgradeInGameSeconds: null,
    buildingsPlaced: 0,
    cropsPlanted: 0,
    cropsHarvested: 0,
    treesFelled: 0,
    foxesFelled: 0,
    daysReached: 1,
  };

  private readonly supportTarget = new THREE.Vector3();
  private readonly supportJoint = new THREE.Vector3();
  private readonly supportEffector = new THREE.Vector3();
  private readonly supportToTarget = new THREE.Vector3();
  private readonly supportToEffector = new THREE.Vector3();
  private readonly supportAxis = new THREE.Vector3();
  private readonly supportWorldQuaternion = new THREE.Quaternion();
  private readonly supportParentQuaternion = new THREE.Quaternion();
  private readonly supportLocalQuaternion = new THREE.Quaternion();

  async mount(
    canvas: HTMLCanvasElement,
    onHud: (s: HudSnapshot) => void,
    options: { newAdventure?: boolean } = {},
  ): Promise<void> {
    this.disposed = false;
    this.canvas = canvas;
    this.onHud = onHud;
    this.input.setGestureHandler(() => this.audio.unlock());

    // Renderer must exist before preloading: KTX2Loader.detectSupport() needs it.
    this.world = new WorldRenderer(canvas);
    this.reducedMotion = localStorage.getItem('tarnation.reducedMotion') === '1';
    this.world.setReducedMotion(this.reducedMotion);
    initAssetLoaders(this.world.renderer);
    await preloadAll();
    // React development mode can dispose an effect while the asynchronous
    // asset preload is still in flight. Do not let that abandoned runtime
    // attach input handlers or render over the replacement runtime.
    if (this.disposed) return;

    const raw = options.newAdventure ? null : localStorage.getItem(SAVE_KEY);
    const loaded = raw ? loadFromString(raw) : null;
    if (raw && !loaded) {
      throw new Error('This save could not be loaded. Choose New Adventure to start a clean save.');
    }
    this.gs = loaded ?? createGameState();
    this.input.attach(canvas);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('beforeunload', this.persist);

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
    this.syncBuildings();
    for (const placed of this.gs.placedBuildings) {
      if (assetDefinition(placed.id)?.gate && placed.gateOpen) this.gateCloseTimers.set(placed, 3.5);
    }
    this.syncBearTrapModels();
    this.seedPlainsAnimals();
    this.world.syncFarmTiles(this.gs.tiles);
    this.rebuildCrops();
    this.recalculateEnclosure();
    this.world.snapCamera(this.playerX, this.playerZ);

    if (this.gs.clock.phase === 'night') this.spawnRaid();

    this.running = true;
    this.saveTimer = 0;
    this.persist();
    this.loop(performance.now());
    this.pushHud(true);

    // Dev handle: lets the browser console drive the game for spot checks.
    (window as unknown as { tarnation?: GameRuntime }).tarnation = this;
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.clearDeathMarkers();
    this.clearLootMarkers();
    this.clearFeedbackBursts();
    this.input.dispose();
    this.input.setGestureHandler(null);
    this.audio.dispose();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('beforeunload', this.persist);
    this.persist();
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
    try {
      localStorage.setItem(SAVE_KEY, saveToString(this.gs));
    } catch {
      // ignore
    }
  };

  private spawnPlayer(): void {
    const { root, animations } = cloneModel('player');
    this.playerRoot = root;
    this.playerRoot.position.set(this.playerX, 0, this.playerZ);
    this.world.getSharedActors().add(this.playerRoot);
    if (animations.length > 0) {
      this.playerMixer = new THREE.AnimationMixer(root);
      const idle = animations.find((c) => /idle/i.test(c.name)) ?? animations[0]!;
      const walk =
        animations.find((c) => /^walk$/i.test(c.name)) ??
        animations.find((c) => /walk|run|locomotion/i.test(c.name)) ??
        animations[1] ??
        animations[0]!;
      this.idleAction = this.playerMixer.clipAction(idle);
      this.walkAction = this.playerMixer.clipAction(walk);
      const clipAction = (pattern: RegExp): THREE.AnimationAction | undefined => {
        const clip = animations.find((c) => pattern.test(c.name));
        return clip ? this.playerMixer!.clipAction(clip) : undefined;
      };
      this.playerActions = {
        idle: this.idleAction,
        walk: this.walkAction,
        run: clipAction(/^run$/i),
        walkCarry: clipAction(/^walk_carry$/i),
        runCarry: clipAction(/^run_carry$/i),
        pickUp: clipAction(/^pickup$/i),
        shoot: clipAction(/^shoot_onehanded$/i),
        swordSlash: clipAction(/^swordslash$/i),
        punch: clipAction(/^punch$/i),
      };
      this.idleAction.play();
    }
    this.handBone = this.findRightHand(root);
    this.leftHandBone = this.findPlayerBone(root, /^(fist|hand)[._ -]?l$|left.?hand|hand.?left/i);
    this.leftUpperArmBone = this.findPlayerBone(root, /^(upper.?arm|arm)[._ -]?l$|left.?upper.?arm/i);
    this.leftLowerArmBone = this.findPlayerBone(root, /^(lower.?arm|forearm|arm)[._ -]?l$|left.?forearm/i);
    this.refreshEquippedTool();
  }

  private findRightHand(root: THREE.Object3D): THREE.Object3D | null {
    let hand: THREE.Object3D | null = null;
    root.traverse((obj) => {
      if (hand || !obj.name) return;
      if (/^(fist|hand)[._ -]?r$|right.?hand|hand.?right/i.test(obj.name)) hand = obj;
    });
    return hand;
  }

  private findPlayerBone(root: THREE.Object3D, pattern: RegExp): THREE.Object3D | null {
    let bone: THREE.Object3D | null = null;
    root.traverse((obj) => {
      if (bone || !(obj instanceof THREE.Bone) || !obj.name) return;
      if (pattern.test(obj.name)) bone = obj;
    });
    return bone;
  }

  private refreshEquippedTool(): void {
    const desired: EquippedToolKey | null =
      !this.gs || this.gs.toolSlotActive
        ? null
        : this.gs.toolbarSlot === SLOT_AXE
          ? 'axe'
          : this.gs.toolbarSlot === SLOT_SHOVEL
            ? 'shovel'
            : this.gs.toolbarSlot === SLOT_SHOTGUN && this.gs.weapon === 'bow'
              ? 'bow_wooden'
              : this.gs.toolbarSlot === SLOT_SHOTGUN && this.gs.weapon === 'shotgun'
                ? 'shotgun_2'
                : null;
    if (desired === this.equippedToolKey && this.equippedToolRoot?.parent === this.handBone) return;
    this.equippedToolRoot?.removeFromParent();
    this.equippedToolRoot = null;
    this.equippedToolKey = null;
    if (!desired || !this.handBone) return;

    const { root } = cloneModel(desired);
    root.name = `equipped_${desired}`;
    const profile = TOOL_PROFILES[desired];
    this.equippedToolSourceScale = root.scale.x;
    root.scale.multiplyScalar(profile.scale);
    root.position.set(...profile.carryPosition);
    root.rotation.set(...profile.carryRotation);
    if (desired === 'axe' || desired === 'shovel') {
      // Draw the narrow dark props after the body, but retain depth testing so a
      // correctly placed handle can still pass behind the torso naturally.
      root.renderOrder = 3;
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.renderOrder = 3;
      });
    }
    this.handBone.add(root);
    this.equippedToolRoot = root;
    this.equippedToolKey = desired;
  }

  private applyEquippedToolPose(action: boolean): void {
    if (!this.equippedToolRoot || !this.equippedToolKey) return;
    const profile = TOOL_PROFILES[this.equippedToolKey];
    const position = action ? profile.actionPosition : profile.carryPosition;
    const rotation = action ? profile.actionRotation : profile.carryRotation;
    this.equippedToolRoot.position.set(...position);
    this.equippedToolRoot.rotation.set(...rotation);
    this.equippedToolRoot.scale.setScalar(
      this.equippedToolSourceScale * profile.scale * (action ? profile.actionScale : 1),
    );
  }

  /**
   * The Cowboy rig has authored carry clips, but the tool props are not part of
   * that rig. A small two-bone solve keeps the left hand on the fore-end/shaft
   * after the mixer has posed the body. It is intentionally renderer-only: the
   * simulation never needs to know where a hand is.
   */
  private applySupportHandPose(): void {
    if (
      !this.equippedToolRoot ||
      !this.equippedToolKey ||
      !this.leftHandBone ||
      !this.leftUpperArmBone ||
      !this.leftLowerArmBone
    ) return;

    const profile = TOOL_PROFILES[this.equippedToolKey];
    const oneShot = this.oneShotAction;
    const oneShotActive = oneShot?.isRunning() ?? false;
    // The one-handed shooting clip is authored around the right arm. Let the
    // left hand return to the animation rather than pulling it toward the gun.
    if (oneShotActive && this.equippedToolKey === 'shotgun_2') return;
    const grip = oneShotActive ? profile.actionSupportGrip : profile.supportGrip;
    if (!grip) return;

    this.playerRoot.updateMatrixWorld(true);
    this.equippedToolRoot.updateMatrixWorld(true);
    this.supportTarget.set(...grip);
    this.equippedToolRoot.localToWorld(this.supportTarget);

    const blend = (profile.supportBlend ?? 0.7) * (oneShotActive ? 0.58 : 1);
    for (let i = 0; i < 3; i++) {
      this.rotateArmJointToward(this.leftLowerArmBone, blend);
      this.rotateArmJointToward(this.leftUpperArmBone, blend * 0.9);
    }
  }

  private rotateArmJointToward(joint: THREE.Object3D, blend: number): void {
    if (!this.leftHandBone) return;
    joint.updateMatrixWorld(true);
    this.leftHandBone.updateMatrixWorld(true);
    joint.getWorldPosition(this.supportJoint);
    this.leftHandBone.getWorldPosition(this.supportEffector);
    this.supportToEffector.subVectors(this.supportEffector, this.supportJoint);
    this.supportToTarget.subVectors(this.supportTarget, this.supportJoint);
    const effectorLength = this.supportToEffector.length();
    const targetLength = this.supportToTarget.length();
    if (effectorLength < 0.0001 || targetLength < 0.0001) return;

    const cosine = THREE.MathUtils.clamp(
      this.supportToEffector.dot(this.supportToTarget) / (effectorLength * targetLength),
      -1,
      1,
    );
    const angle = Math.acos(cosine);
    this.supportAxis.crossVectors(this.supportToEffector, this.supportToTarget);
    if (this.supportAxis.lengthSq() < 0.000001 || angle < 0.002) return;
    this.supportAxis.normalize();

    this.supportWorldQuaternion.setFromAxisAngle(
      this.supportAxis,
      Math.min(angle, 1.1) * THREE.MathUtils.clamp(blend, 0, 1),
    );
    joint.getWorldQuaternion(this.supportLocalQuaternion);
    this.supportLocalQuaternion.premultiply(this.supportWorldQuaternion);
    if (joint.parent) {
      joint.parent.getWorldQuaternion(this.supportParentQuaternion);
      this.supportParentQuaternion.invert();
      this.supportLocalQuaternion.premultiply(this.supportParentQuaternion);
    }
    joint.quaternion.copy(this.supportLocalQuaternion);
    joint.updateMatrixWorld(true);
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
    for (const root of this.fixtureRoots) root.removeFromParent();
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
      const { root } = cloneModel('player');
      root.name = 'traveling_merchant';
      root.scale.multiplyScalar(0.92);
      root.position.set(this.merchantX, this.world.heightAt(this.merchantX, this.merchantZ), this.merchantZ);
      root.rotation.y = Math.PI;
      this.merchantRoot = root;
      this.world.getFarmActors().add(root);
    }
    this.world.markShadowsDirty();
  }

  private syncBuildings(): void {
    this.homesteadRoot?.removeFromParent();
    this.homesteadRoot = null;
    for (const root of this.buildingRoots.values()) root.removeFromParent();
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
    for (const root of this.bearTrapRoots.values()) root.removeFromParent();
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
    if (!this.nearMarket) return;
    const earned = sellItem(this.gs, id, false);
    if (earned > 0) this.afterSale(id, earned);
  }

  sellStack(id: ItemId): void {
    if (!this.nearMarket) return;
    const earned = sellItem(this.gs, id, true);
    if (earned > 0) this.afterSale(id, earned);
  }

  sellAll(): void {
    if (!this.nearMarket) return;
    const earned = sellEverything(this.gs);
    if (earned > 0) {
      this.recordAction('sale');
      this.economyMetrics.saleTransactions++;
      this.economyMetrics.duckettesEarned += earned;
      setToast(this.gs, `Sold everything for ${earned} duckettes`, 2.5);
      this.popup(`+${earned}₫`, this.playerX, this.playerZ);
      this.persist();
      this.pushHud(true);
    }
  }

  private afterSale(id: ItemId, earned: number): void {
    this.recordAction('sale');
    this.economyMetrics.saleTransactions++;
    this.economyMetrics.duckettesEarned += earned;
    setToast(this.gs, `Sold ${itemInfo(id).name} · +${earned}₫`, 1.5);
    this.popup(`+${earned}₫`, this.playerX, this.playerZ);
    this.persist();
    this.pushHud(true);
  }

  selectSlot(index: number): void {
    if (index < 0 || index >= TOOLBAR_SLOTS) return;
    this.buildingMode = false;
    this.placementAssetId = null;
    this.demolishMode = false;
    this.gs.inventoryOpen = false;
    this.closeContextMenu();
    this.cancelPlayerAction();
    if (index !== SLOT_SHOTGUN) this.clearShots();
    this.gs.toolbarSlot = index;
    this.gs.toolSlotActive = false;
    if (index === SLOT_SHOTGUN) this.gs.weapon = this.gs.weapon === 'bow' ? 'bow' : 'shotgun';
    if (index === SLOT_AXE) this.gs.weapon = 'axe';
    if (index !== SLOT_SHOVEL) this.toolMode = 'farm';
    this.refreshEquippedTool();
    this.pushHud(true);
  }

  selectToolSlot(): void {
    this.buildingMode = false;
    this.placementAssetId = null;
    this.demolishMode = false;
    this.cancelPlayerAction();
    this.clearShots();
    this.gs.toolSlotActive = true;
    this.toolMode = 'farm';
    this.refreshEquippedTool();
    this.pushHud(true);
  }

  toggleBuildMode(): void {
    if (!this.buildingMode && !this.legacyBuildEnabled() && !this.nearMerchant && !this.placementAssetId) {
      setToast(this.gs, 'Visit the Traveling Merchant to buy building deeds', 2);
      return;
    }
    if (!this.buildingMode && !this.legacyBuildEnabled() && this.nearMerchant && !this.placementAssetId) {
      this.openVendor();
      return;
    }
    this.buildingMode = !this.buildingMode;
    this.toolMode = 'farm';
    this.cancelPlayerAction();
    this.clearShots();
    this.gs.toolSlotActive = false;
    this.refreshEquippedTool();
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
    if (index < 0 || index >= PLACEABLE_BUILDINGS.length) return;
    this.placeableBuildingIndex = index;
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
      this.cancelPlayerAction();
    }
    this.pushHud(true);
  }

  toggleInventory(): void {
    this.gs.inventoryOpen = !this.gs.inventoryOpen;
    this.pushHud(true);
  }

  private legacyBuildEnabled(): boolean {
    return new URLSearchParams(window.location.search).has('legacy');
  }

  openVendor(): void {
    if (!this.nearMerchant) {
      setToast(this.gs, 'Stand near the Traveling Merchant to shop', 1.8);
      return;
    }
    this.vendorOpen = true;
    this.vendorMessage = '';
    this.buildingMode = false;
    this.placementAssetId = null;
    this.demolishMode = false;
    this.gs.inventoryOpen = false;
    this.closeContextMenu();
    this.velX = 0;
    this.velZ = 0;
    this.pushHud(true);
  }

  closeVendor(): void {
    this.vendorOpen = false;
    this.vendorMessage = '';
    this.pushHud(true);
  }

  selectVendorTab(tab: AssetCategory): void {
    if (!['Housing', 'Weapons', 'Buildings', 'Upgrades'].includes(tab)) return;
    this.vendorTab = tab;
    this.vendorMessage = '';
    this.pushHud(true);
  }

  buyAsset(id: AssetId): void {
    if (!this.nearMerchant) return;
    const asset = assetDefinition(id);
    if (!asset || asset.fixture || asset.availability === 'debug' || asset.availability === 'fixture') return;
    const itemId = deedItemId(id);
    const freePurchases = !new URLSearchParams(window.location.search).has('paid');
    const reasons: string[] = [];
    if (this.gs.duckettes < asset.price) reasons.push(`need ${asset.price} duckettes`);
    const woodCost = asset.materialCost.wood ?? 0;
    if (woodCount(this.gs) < woodCost) reasons.push(`need ${woodCost} Wood`);
    if (!hasRoomFor(this.gs.inventory, itemId)) reasons.push('inventory has no free slot');
    if (reasons.length && !freePurchases) {
      this.vendorMessage = `Cannot buy ${asset.displayName}: ${reasons.join(' · ')}`;
      setToast(this.gs, this.vendorMessage, 2.2);
      this.pushHud(true);
      return;
    }
    if (!addToInventory(this.gs, itemId, 1)) {
      this.vendorMessage = 'Inventory has no free slot';
      this.pushHud(true);
      return;
    }
    if (!freePurchases) {
      this.gs.duckettes -= asset.price;
      if (woodCost > 0) takeFromInventory(this.gs, ITEM_WOOD, woodCost);
    }
    this.vendorMessage = `${asset.displayName} deed added to inventory`;
    this.recordAction('purchase');
    this.persist();
    this.pushHud(true);
  }

  useInventoryItem(id: ItemId): void {
    const assetId = deedAssetId(id);
    if (!assetId) return;
    const asset = assetDefinition(assetId);
    if (!asset || !this.gs.inventory.some((slot) => slot?.id === id)) return;
    if (asset.id === 'utility:bear-trap') {
      this.gs.bearTrapCooldown = 0;
      if (this.tryBearTrap()) takeFromInventory(this.gs, id, 1);
      this.pushHud(true);
      return;
    }
    if (asset.useType === 'place') {
      this.startPlacement(asset.id);
      return;
    }
    if (asset.useType === 'equip') {
      const equipped = this.equipCatalogAsset(asset);
      if (equipped) takeFromInventory(this.gs, id, 1);
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
      const before = this.gs.boulderCooldown;
      this.tryBoulderRoll();
      if (before === this.gs.boulderCooldown) return;
    }
    takeFromInventory(this.gs, id, 1);
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
    this.placementAssetId = assetId;
    this.buildingMode = true;
    this.demolishMode = false;
    this.toolMode = 'farm';
    this.cancelPlayerAction();
    this.clearShots();
    setToast(this.gs, `${asset.displayName} placement · right-click rotates · Esc cancels`, 2);
    this.pushHud(true);
  }

  private rotatePlacement(): void {
    if (!this.buildingMode || !this.placementAssetId) return;
    this.placementRotation = (this.placementRotation + 1) % 4;
    this.pushHud(true);
  }

  private cancelActiveState(): void {
    if (this.contextMenu.open) {
      this.closeContextMenu();
      return;
    }
    if (this.buildingMode || this.placementAssetId) {
      this.buildingMode = false;
      this.placementAssetId = null;
      this.world.setBuildPreview(null);
      setToast(this.gs, 'Placement cancelled', 1.2);
      this.pushHud(true);
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
    if (this.pauseOpen) {
      this.pauseOpen = false;
      this.pushHud(true);
      return;
    }
    this.pauseOpen = true;
    this.velX = 0;
    this.velZ = 0;
    this.pushHud(true);
  }

  resumeGame(): void {
    if (!this.pauseOpen) return;
    this.pauseOpen = false;
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
    this.syncBuildings();
    this.recalculateEnclosure();
    this.persist();
    setToast(this.gs, `${asset.displayName} demolished · deed returned`, 1.6);
    this.pushHud(true);
  }

  useUltimate(): void {
    this.recordAction('boulder');
    this.tryBoulderRoll();
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
        this.world.syncFarmTiles(this.gs.tiles);
        return n;
      },
      skipDay: () => {
        this.gs.clock = { ...this.gs.clock, day: this.gs.clock.day + 1 };
        const res = onNewDay(this.gs);
        this.clearDeathMarkers();
        this.clearLootMarkers();
        this.clearFeedbackBursts();
        this.world.getFarmTrees()?.rebuildAll();
        this.world.syncFarmTiles(this.gs.tiles);
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
    this.economyMetrics.actions++;
    this.economyMetrics.actionKinds[kind] = (this.economyMetrics.actionKinds[kind] ?? 0) + 1;
  }

  private economySnapshot(): EconomyMetrics & { sessionSeconds: number; inGameSeconds: number; day: number } {
    return {
      ...this.economyMetrics,
      actionKinds: { ...this.economyMetrics.actionKinds },
      sessionSeconds: (performance.now() - this.economyMetrics.sessionStartedAt) / 1000,
      inGameSeconds: this.gs.simTime,
      day: this.gs.clock.day,
    };
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

    this.playerMixer?.update(dt);
    for (const a of this.animals) a.mixer?.update(dt);
    this.world.update(dt);
    this.stepPopups(dt);
    this.stepDeathMarkers(dt);
    this.stepLootMarkers(dt);
    this.stepFeedbackBursts(dt);

    const moving = Math.hypot(this.velX, this.velZ) > 0.4;
    this.updateAnim(moving);

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
    const targetQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.headingTarget,
    );
    this.playerRoot.quaternion.slerp(targetQuat, 1 - Math.exp(-dt * 10));
    this.applySupportHandPose();

    this.world.render();
    this.input.endFrame();
    this.pushHud(false);
  };

  private updateAnim(moving: boolean): void {
    if (!this.idleAction || !this.walkAction) return;
    const oneShot = this.oneShotAction;
    const oneShotActive = oneShot?.isRunning() ?? false;
    this.applyEquippedToolPose(oneShotActive);
    if (oneShotActive) {
      for (const action of Object.values(this.playerActions)) {
        if (action && action !== oneShot) action.setEffectiveWeight(0);
      }
      oneShot?.setEffectiveWeight(1);
      return;
    }
    if (this.oneShotAction) {
      this.oneShotAction.stop();
      this.oneShotAction = null;
    }

    const speed = Math.hypot(this.velX, this.velZ);
    const carry = this.equippedToolRoot !== null;
    const profile = this.equippedToolKey ? TOOL_PROFILES[this.equippedToolKey] : null;
    const carryAction = profile?.runClip === 'walkCarry'
      ? this.playerActions.walkCarry ?? this.walkAction
      : this.playerActions.runCarry ?? this.playerActions.walkCarry ?? this.walkAction;
    const carryIdle = carry ? this.playerActions.walkCarry ?? this.walkAction : null;
    const locomotion = moving
      ? carry
        ? speed > PLAYER_SPEED * 0.72
          ? carryAction
          : this.playerActions.walkCarry ?? this.walkAction
        : this.playerActions.walk ?? this.walkAction
      : carry
        ? carryIdle ?? this.playerActions.idle ?? this.idleAction
        : this.playerActions.idle ?? this.idleAction;
    for (const action of Object.values(this.playerActions)) {
      if (!action) continue;
      action.setEffectiveWeight(action === locomotion ? 1 : 0);
      if (action !== locomotion) action.paused = false;
    }
    locomotion.enabled = true;
    if (!locomotion.isRunning()) locomotion.play();
    // There is no authored Idle_Carry clip. Freeze Walk_Carry at a calm frame
    // while stationary so both arms remain intentionally posed around a tool
    // instead of dropping back to the empty-handed idle.
    if (carry && !moving && locomotion === carryIdle) {
      locomotion.time = locomotion.getClip().duration * 0.34;
      locomotion.paused = true;
    } else {
      locomotion.paused = false;
    }
  }

  private playPlayerAction(clip: PlayerClip): void {
    const action = this.playerActions[clip];
    if (!action) return;
    this.oneShotAction?.stop();
    action.reset();
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.setEffectiveWeight(1);
    action.play();
    this.oneShotAction = action;
    this.applyEquippedToolPose(true);
  }

  private cancelPlayerAction(): void {
    this.oneShotAction?.stop();
    this.oneShotAction = null;
    this.applyEquippedToolPose(false);
  }

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
    if (this.input.justPressed('KeyQ')) this.tryBoulderRoll();
    if (this.input.justPressed('KeyB')) this.tryBearTrap();
    if (this.input.justPressed('KeyI')) this.toggleInventory();
    if (this.input.justPressed('KeyH')) this.toggleHelp();
    if (this.input.justPressed('KeyR')) {
      cycleWeapon(this.gs);
      this.gs.toolbarSlot = this.gs.weapon === 'axe' ? SLOT_AXE : SLOT_SHOTGUN;
      this.gs.toolSlotActive = false;
      this.refreshEquippedTool();
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
      setToast(this.gs, this.debugGrid ? 'Grid debug on' : 'Grid debug off', 1.4);
    }
    if (this.input.justPressed('KeyX')) {
      this.demolishMode = !this.demolishMode;
      this.buildingMode = false;
      this.placementAssetId = null;
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
      this.placeableBuildingIndex = (this.placeableBuildingIndex + 1) % PLACEABLE_BUILDINGS.length;
      setToast(this.gs, `Build: ${PLACEABLE_BUILDINGS[this.placeableBuildingIndex]!.name}`, 1.2);
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
    const b = this.world.getWorldBounds();
    this.movePlayer(dt, b.minX, b.maxX, b.minZ, b.maxZ);

    this.saveTimer += dt;
    if (this.saveTimer >= 15) {
      this.saveTimer = 0;
      this.persist();
    }

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

    if (this.input.consumeRmb() || this.input.justPressed('Space')) {
      if (this.buildingMode) this.rotatePlacement();
      else if (this.demolishMode) this.destroyAtPointer();
      else if (!this.openPlacedContext()) this.useCombatAction();
    }
    if (this.input.consumeLmb()) {
      if (this.buildingMode) this.placeSelectedBuilding();
      else if (this.demolishMode) this.destroyAtPointer();
      else this.useSelectedTool();
    }

    const clock = stepGameClock(this.gs, dt);
    this.world.applyDayNight(this.gs.clock.phase, this.gs.clock.t);

    if (clock.matured.length) {
      this.rebuildCrops();
      this.world.syncFarmTiles(this.gs.tiles);
      for (const m of clock.matured) {
        const c = this.crops.find((x) => x.tx === m.x && x.ty === m.y);
        if (c) c.root.scale.setScalar(c.baseScale * 1.3);
      }
    }
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
      this.economyMetrics.daysReached = this.gs.clock.day;
      this.clearFoxes();
      this.clearDeathMarkers();
      this.clearLootMarkers();
      this.clearFeedbackBursts();
      const { lostTilth, regrown } = onNewDay(this.gs);
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
      this.world.syncFarmTiles(this.gs.tiles);
      this.persist();
      if (checkWin(this.gs) && !this.gs.winShown) this.winShownLocal = false;
    }
  }

  private movePlayer(dt: number, minX: number, maxX: number, minZ: number, maxZ: number): void {
    const stick = this.input.getMoveStick();
    const { forward, right } = this.world.getScreenBasis();
    let wishX = right.x * stick.x + forward.x * stick.y;
    let wishZ = right.z * stick.x + forward.z * stick.y;
    const wlen = Math.hypot(wishX, wishZ);
    if (wlen > 1e-6) {
      wishX /= wlen;
      wishZ /= wlen;
      this.velX += wishX * PLAYER_ACCEL * dt;
      this.velZ += wishZ * PLAYER_ACCEL * dt;
      this.headingTarget = Math.atan2(wishX, wishZ);
    } else {
      const damp = Math.exp(-PLAYER_DAMP * dt);
      this.velX *= damp;
      this.velZ *= damp;
    }
    const sp = Math.hypot(this.velX, this.velZ);
    if (sp > PLAYER_SPEED) {
      this.velX = (this.velX / sp) * PLAYER_SPEED;
      this.velZ = (this.velZ / sp) * PLAYER_SPEED;
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
    if (this.fixtureReservations.has(tileKey(tx, ty))) return true;
    if (occupiedPlacedTiles(this.gs.placedBuildings).has(tileKey(tx, ty))) return true;
    return this.world.distToWater(tx + 0.5, ty + 0.5) < 0.8;
  }

  private recalculateEnclosure(): void {
    const blocked = new Set(this.fixtureReservations);
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
    const occupied = occupiedPlacedTiles(this.gs.placedBuildings);
    if (!occupied.has(tileKey(tile.tx, tile.ty)) && !this.fixtureReservations.has(tileKey(tile.tx, tile.ty))) {
      return true;
    }
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
      const placement = this.buildingPlacementStatus();
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

  private buildingPlacementStatus(): BuildingPlacement {
    const tile = this.pointerTile();
    if (!tile) {
      return {
        tile: null,
        x: this.playerX,
        z: this.playerZ,
        valid: false,
        reason: 'Point at a ground tile',
        asset: null,
        rotation: this.placementRotation,
      };
    }
    const selected = this.selectedPlacementAsset();
    if (!selected) {
      return { tile, x: this.playerX, z: this.playerZ, valid: false, reason: 'No placeable asset selected', asset: null, rotation: this.placementRotation };
    }
    const rotation = this.placementAssetId ? this.placementRotation : normalizeOrientation(this.headingTarget);
    const center = placedCenter(tile, rotation, selected);
    if (Math.hypot(this.playerX - center.x, this.playerZ - center.z) > BEAR_TRAP_PLACE_RANGE) {
      return { tile, x: center.x, z: center.z, valid: false, reason: 'Move closer to place', asset: selected, rotation };
    }
    const status = placementStatus({
      asset: selected,
      origin: tile,
      rotation,
      tiles: this.gs.tiles,
      placed: this.gs.placedBuildings,
      fixtures: this.fixtureReservations,
      playerTile: this.worldToFarmTile(this.playerX, this.playerZ),
      terrainAllowed: (tx, ty) => this.world.distToWater(tx + 0.5, ty + 0.5) >= 2.5,
    });
    if (!status.valid) {
      return { tile, x: center.x, z: center.z, valid: false, reason: status.reason, asset: selected, rotation };
    }
    if (!this.placementAssetId && Math.hypot(center.x - HOMESTEAD_X, center.z - HOMESTEAD_Z) < 5) {
      return { tile, x: center.x, z: center.z, valid: false, reason: 'Leave room around the homestead', asset: selected, rotation };
    }
    const legacyCost = PLACEABLE_BUILDINGS.find((entry) => entry.id === selected.id)?.cost ?? selected.materialCost.wood ?? 0;
    if (!this.placementAssetId && woodCount(this.gs) < legacyCost) {
      return {
        tile,
        x: center.x,
        z: center.z,
        valid: false,
        reason: `Need ${legacyCost} Wood for ${selected.displayName}`,
        asset: selected,
        rotation,
      };
    }
    return { tile, x: center.x, z: center.z, valid: true, reason: 'Ready to place', asset: selected, rotation };
  }

  private selectedPlacementAsset(): PurchasableAsset | null {
    if (this.placementAssetId) return assetDefinition(this.placementAssetId);
    const selected = PLACEABLE_BUILDINGS[this.placeableBuildingIndex];
    return selected ? assetDefinition(selected.id) : null;
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

  private useSelectedTool(): void {
    this.recordAction('tool');
    if (this.gs.toolSlotActive) {
      this.useBucket();
      return;
    }
    switch (this.gs.toolbarSlot) {
      case SLOT_SHOTGUN:
        this.fireWeapon();
        return;
      case SLOT_SHOVEL:
        this.useShovel();
        return;
      case SLOT_AXE:
        this.useAxe();
        return;
      default:
        setToast(this.gs, `Slot ${this.gs.toolbarSlot + 1} is empty`, 1.2);
    }
  }

  /** Combat input must respect the selected toolbar slot. */
  private useCombatAction(): void {
    this.recordAction('combat');
    if (this.gs.toolSlotActive) return;
    if (this.gs.toolbarSlot === SLOT_SHOTGUN) {
      this.fireWeapon();
      return;
    }
    if (this.gs.toolbarSlot === SLOT_AXE) this.meleeSwing(AXE_DAMAGE);
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
    this.recordAction('upgrade');
    this.economyMetrics.upgrades++;
    if (this.economyMetrics.firstUpgradeInGameSeconds === null) {
      this.economyMetrics.firstUpgradeInGameSeconds = this.gs.simTime;
    }
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
    const placement = this.buildingPlacementStatus();
    const selected = placement.asset;
    if (!selected || !placement.valid || !placement.tile) {
      setToast(this.gs, placement.reason, 1.6);
      return;
    }
    const legacyCost = PLACEABLE_BUILDINGS.find((entry) => entry.id === selected.id)?.cost ?? selected.materialCost.wood ?? 0;
    if (!this.placementAssetId) takeFromInventory(this.gs, ITEM_WOOD, legacyCost);
    else if (!takeFromInventory(this.gs, deedItemId(selected.id), 1)) {
      setToast(this.gs, `No ${selected.displayName} deed`, 1.6);
      return;
    }
    this.recordAction('build');
    placeBuilding(this.gs, selected.id, placement.x, placement.z, placement.rotation, false);
    this.economyMetrics.buildingsPlaced++;
    this.playPlayerAction('pickUp');
    this.syncBuildings();
    this.recalculateEnclosure();
    this.persist();
    this.spawnFeedbackBurst(placement.x, placement.z, 0xf2c266, 8, 0.28);
    this.audio.play('build');
    setToast(this.gs, `Built ${selected.displayName}`, 1.6);
    this.buildingMode = false;
    this.placementAssetId = null;
    this.pushHud(true);
  }

  private useBucket(): void {
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) {
      fillBucket(this.gs);
      this.recordAction('fill_bucket');
      this.spawnFeedbackBurst(this.playerX, this.playerZ, 0x69b8dc, 4, 0.22);
      this.audio.play('water');
      setToast(this.gs, `Bucket filled (${this.gs.bucketFill}/${BUCKET_CAPACITY})`, 1.6);
      return;
    }
    const tilePos = this.pointerTile();
    if (!tilePos) return;
    const { tx, ty } = tilePos;
    const tile = getTile(this.gs.tiles, tx, ty);
    const wc = this.farmTileWorld(tx, ty);
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) return;
    this.waterWithBucket(tx, ty, tile?.state === 'planted' && !tile.watered);
  }

  private useAxe(): void {
    if (!this.beginMeleeAction('swordSlash')) return;
    // A tree is a direct click target. Ground aiming remains a fallback for
    // ordinary melee, but the player never has to line up a reticle with timber.
    const tilePos = this.pointerTreeTile() ?? this.pointerTile();
    if (tilePos && this.chopFarmTree(tilePos.tx, tilePos.ty)) return;
    // Nothing to chop — swing at whatever is in front of you instead.
    this.applyMeleeDamage(AXE_DAMAGE);
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
      if (this.meleeCd > 0) return;
      if (digTrench(this.gs.tiles, tx, ty)) {
        this.beginMeleeAction('pickUp');
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
        this.world.syncFarmTiles(this.gs.tiles);
        this.spawnFeedbackBurst(wc.x, wc.z, 0x69b8dc, 5, 0.24);
        this.audio.play('tool');
      }
      return;
    }

    if (this.toolMode === 'breed') {
      if (this.meleeCd > 0) return;
      if (makeBreedingBed(this.gs.tiles, tx, ty)) {
        this.beginMeleeAction('pickUp');
        this.world.syncFarmTiles(this.gs.tiles);
        this.spawnFeedbackBurst(wc.x, wc.z, 0xd79358, 6, 0.26);
        this.audio.play('build');
        setToast(this.gs, 'Breeding bed ready — plant two seeds', 2.5);
      } else if (tile.state === 'breeding' && tile.breedA && tile.breedB) {
        const parents = clearBreedingParents(this.gs.tiles, tx, ty);
        if (parents) {
          this.beginMeleeAction('pickUp');
          const child = crossbreed(parents.a, parents.b, this.gs.rng);
          addSeedToInventory(this.gs, child);
          this.gs.tiles[ty]![tx]!.state = 'tilled';
          this.world.syncFarmTiles(this.gs.tiles);
          this.spawnFeedbackBurst(wc.x, wc.z, 0xf2c266, 7, 0.28);
          this.audio.play('reward');
          setToast(this.gs, `Hybrid: ${child.displayName}!`, 3.5);
        }
      }
      return;
    }

    if (tile.state === 'grass') {
      if (this.meleeCd > 0) return;
      if (this.tileBlockedForTilling(tx, ty)) {
        setToast(this.gs, "This ground can't be worked", 1.4);
        return;
      }
      if (tillTile(this.gs.tiles, tx, ty, this.gs.clock.day)) {
        this.recordAction('till');
        this.beginMeleeAction('pickUp');
        this.world.syncFarmTiles(this.gs.tiles);
        this.spawnFeedbackBurst(wc.x, wc.z, 0x8a5a38, 5, 0.24);
        this.audio.play('tool');
      }
    } else if (tile.state === 'tilled' || tile.state === 'breeding') {
      if (this.meleeCd > 0) return;
      const seed = selectedSeed(this.gs);
      if (!seed) {
        setToast(this.gs, 'No seeds', 1.5);
        return;
      }
      if (plantTile(this.gs.tiles, tx, ty, seed)) {
        this.recordAction('plant');
        this.economyMetrics.cropsPlanted++;
        this.beginMeleeAction('pickUp');
        this.rebuildCrops();
        this.world.syncFarmTiles(this.gs.tiles);
        this.spawnFeedbackBurst(wc.x, wc.z, 0x8ccf6a, 5, 0.2);
        this.audio.play('tool');
      }
    } else if (tile.state === 'planted' && !tile.watered) {
      this.waterWithBucket(tx, ty, true);
    } else if (tile.state === 'mature') {
      if (this.meleeCd > 0) return;
      const res = harvestTile(this.gs.tiles, tx, ty);
      if (res.ok && res.seed) {
        this.beginMeleeAction('pickUp');
        const id = cropItem(res.seed.displayName);
        if (!addToInventory(this.gs, id, res.count)) return;
        this.recordAction('harvest');
        this.economyMetrics.cropsHarvested += res.count;
        this.gs.stats.cropsHarvested += res.count;
        addSeedToInventory(this.gs, { ...res.seed, traits: { ...res.seed.traits } });
        this.rebuildCrops();
        this.world.syncFarmTiles(this.gs.tiles);
        this.popup(`+${res.count} ${res.seed.displayName}`, wc.x, wc.z);
        this.spawnFeedbackBurst(wc.x, wc.z, 0xf2c266, 6, 0.24);
        this.audio.play('reward');
      }
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
      this.world.syncFarmTiles(this.gs.tiles);
      const wc = this.farmTileWorld(tx, ty);
      this.spawnFeedbackBurst(wc.x, wc.z, 0x69b8dc, 4, 0.2);
      this.audio.play('water');
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
    this.economyMetrics.treesFelled++;
    this.world.shake(0.14, 0.12);
    this.spawnFeedbackBurst(wc.x, wc.z, 0xf2c266, 8, 0.32);
    this.audio.play('reward');
    this.popup(`+${FARM_TREE_WOOD} Wood`, wc.x, wc.z);
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
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.065, 6, 4), pelletMaterial);
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
    this.playPlayerAction('shoot');
    this.audio.play('shot');
    this.world.shake(0.06, 0.05);
  }

  private clearShots(): void {
    for (const shot of this.shots) shot.root.removeFromParent();
    this.shots.length = 0;
  }

  private fireBow(): void {
    if (this.shotCd > 0) return;
    const { dx, dz } = this.aimDirection();
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
    this.playPlayerAction('shoot');
    this.audio.play('shot');
  }

  private beginMeleeAction(clip: PlayerClip): boolean {
    if (this.meleeCd > 0) return false;
    // Do not restart a one-shot halfway through its authored motion when the
    // player holds the mouse down. That turns a readable chop/dig into a
    // jittering pose; let the current swing finish before accepting the next.
    if (this.oneShotAction?.isRunning()) return false;
    this.meleeCd = MELEE_COOLDOWN;
    this.playPlayerAction(clip);
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
    if (!this.beginMeleeAction(clip)) return;
    this.applyMeleeDamage(damage);
  }

  private tryBoulderRoll(): void {
    if (this.gs.boulderCooldown > 0) {
      setToast(this.gs, `Boulder ready in ${Math.ceil(this.gs.boulderCooldown)}s`, 1.2);
      return;
    }
    const { dx, dz } = this.aimDirection();
    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(BOULDER_RADIUS, 1),
      new THREE.MeshStandardMaterial({ color: 0x6f6a5e, flatShading: true, roughness: 0.95 }),
    );
    mesh.castShadow = true;
    mesh.position.set(
      this.playerX,
      this.world.heightAt(this.playerX, this.playerZ) + BOULDER_RADIUS,
      this.playerZ,
    );
    this.world.getSharedActors().add(mesh);
    this.boulders.push({
      mesh,
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
        b.mesh.removeFromParent();
        this.boulders.splice(i, 1);
      }
    }
  }

  private tryBearTrap(): boolean {
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
    if (!placeBearTrap(this.gs.tiles, tilePos.tx, tilePos.ty)) {
      setToast(this.gs, 'A trap is already here or the ground is occupied', 1.5);
      return false;
    }
    this.gs.bearTrapCooldown = BEAR_TRAP_COOLDOWN;
    this.playPlayerAction('pickUp');
    this.world.syncFarmTiles(this.gs.tiles);
    this.syncBearTrapModels();
    this.persist();
    this.spawnFeedbackBurst(wc.x, wc.z, 0xd2a86a, 6, 0.26);
    this.audio.play('trap');
    setToast(this.gs, 'Bear trap set', 1.4);
    return true;
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
        s.root.removeFromParent();
        this.shots.splice(i, 1);
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
        s.root.removeFromParent();
        this.shots.splice(i, 1);
      }
    }
  }

  private damageFox(w: Fox, amount: number): void {
    if (w.dead) return;
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
    this.recordAction('fox_felled');
    this.gs.stats.foxesFelled += 1;
    this.economyMetrics.foxesFelled++;
    this.world.shake(0.09, 0.08);
    this.hitPause = 0.05;
    this.spawnFeedbackBurst(w.x, w.z, 0xef7561, 8, 0.32);
    this.audio.play('defeat');
    w.actions.mixer?.stopAllAction();
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
    a.mixer?.stopAllAction();
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
        const copy = material.clone();
        copy.transparent = true;
        copy.opacity = 1;
        materials.push(copy);
        return copy;
      });
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
    for (const material of marker.materials) material.dispose();
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
      this.lootMarkers[0]!.root.removeFromParent();
      this.lootMarkers.shift();
    }
    this.world.markShadowsDirty();
  }

  private clearLootMarkers(): void {
    for (const marker of this.lootMarkers) marker.root.removeFromParent();
    this.lootMarkers = [];
  }

  private stepLootMarkers(dt: number): void {
    for (let i = this.lootMarkers.length - 1; i >= 0; i--) {
      const marker = this.lootMarkers[i]!;
      marker.age += dt;
      if (marker.age >= marker.lifetime) {
        marker.root.removeFromParent();
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
      });
    }
    this.world.markShadowsDirty();
  }

  private clearFoxes(): void {
    for (const w of this.foxes) {
      this.resetFoxTrap(w);
      w.root.removeFromParent();
    }
    this.foxes = [];
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

  private foxSpeed(w: Fox): number {
    if (w.kind === 'nibbler') return NIBBLER_SPEED;
    if (w.kind === 'hauler') return HAULER_SPEED;
    return FOX_SPEED;
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

  /**
   * Move raid animals on the same 8-neighbour tile graph used by enclosure
   * flood-fill. This is deliberately small and cached per fox: the map is
   * static between placement/gate events, so a short-lived BFS is enough to
   * keep foxes from visibly walking through a wall without pathfinding every
   * frame.
   */
  private moveFoxTowardTile(
    w: Fox,
    goalTx: number,
    goalTy: number,
    speed: number,
    dt: number,
  ): { atGoal: boolean; hasPath: boolean } {
    const goalKey = tileKey(goalTx, goalTy);
    const current = this.worldToFarmTile(w.x, w.z);
    if (!current) return { atGoal: false, hasPath: false };
    const goalPosition = this.farmTileWorld(goalTx, goalTy);
    if (
      current.tx === goalTx &&
      current.ty === goalTy &&
      Math.hypot(goalPosition.x - w.x, goalPosition.z - w.z) < 0.46
    ) {
      return { atGoal: true, hasPath: true };
    }
    if (
      w.pathGoalKey !== goalKey ||
      w.pathTimer <= 0 ||
      (w.path.length === 0 && (current.tx !== goalTx || current.ty !== goalTy))
    ) {
      const blocked = new Set(this.fixtureReservations);
      for (const key of occupiedPlacedTiles(this.gs.placedBuildings)) blocked.add(key);
      blocked.delete(tileKey(current.tx, current.ty));
      blocked.delete(goalKey);
      const queue = [{ tx: current.tx, ty: current.ty }];
      const parents = new Map<string, string | null>([[tileKey(current.tx, current.ty), null]]);
      for (let index = 0; index < queue.length; index++) {
        const node = queue[index]!;
        if (node.tx === goalTx && node.ty === goalTy) break;
        for (const [dx, dy] of GRID_DIRECTIONS_8) {
          const tx = node.tx + dx;
          const ty = node.ty + dy;
          if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) continue;
          const key = tileKey(tx, ty);
          if (parents.has(key) || blocked.has(key)) continue;
          parents.set(key, tileKey(node.tx, node.ty));
          queue.push({ tx, ty });
        }
      }
      if (!parents.has(goalKey)) {
        w.path = [];
        w.pathGoalKey = goalKey;
        w.pathTimer = 0.45;
        return { atGoal: false, hasPath: false };
      }
      const path: { tx: number; ty: number }[] = [];
      let cursor: string | null = goalKey;
      while (cursor !== null) {
        const [tx, ty] = cursor.split(',').map(Number);
        path.push({ tx, ty });
        cursor = parents.get(cursor) ?? null;
      }
      path.reverse();
      path.shift();
      w.path = path;
      w.pathGoalKey = goalKey;
      w.pathTimer = 0.45;
    } else {
      w.pathTimer -= dt;
    }

    const next = w.path[0];
    if (!next) {
      const target = this.farmTileWorld(goalTx, goalTy);
      if (Math.hypot(target.x - w.x, target.z - w.z) < 0.46) {
        return { atGoal: true, hasPath: true };
      }
      return { atGoal: false, hasPath: false };
    }
    const target = this.farmTileWorld(next.tx, next.ty);
    const dx = target.x - w.x;
    const dz = target.z - w.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.22) {
      w.path.shift();
      if (w.path.length === 0) return { atGoal: true, hasPath: true };
      return this.moveFoxTowardTile(w, goalTx, goalTy, speed, dt);
    }
    w.x += (dx / dist) * speed * dt;
    w.z += (dz / dist) * speed * dt;
    w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
    w.root.rotation.y = Math.atan2(dx, dz);
    return { atGoal: false, hasPath: true };
  }

  private stepFoxes(dt: number): void {
    const crops = findCropTiles(this.gs.tiles);
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
          this.world.syncFarmTiles(this.gs.tiles);
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
          this.pickTarget(w, crops);
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
            ? this.moveFoxTowardTile(w, playerTile.tx, playerTile.ty, this.foxSpeed(w) * 0.5, dt)
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
          this.pickTarget(w, crops);
          if (w.targetTx < 0) {
            w.state = 'flee';
            continue;
          }
        }

        const route = this.moveFoxTowardTile(w, w.targetTx, w.targetTy, this.foxSpeed(w), dt);
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
                this.world.syncFarmTiles(this.gs.tiles);
              }
            }
            w.state = 'flee';
          } else if (w.kind === 'nibbler') {
            nibbleCrop(this.gs.tiles, w.targetTx, w.targetTy);
            this.world.syncFarmTiles(this.gs.tiles);
            this.rebuildCrops();
            w.targetTx = -1;
            if (this.gs.rng() < 0.4) w.state = 'flee';
          } else if (w.kind === 'hauler') {
            if (destroyCrop(this.gs.tiles, w.targetTx, w.targetTy)) {
              w.haulSeed = true;
              this.world.syncFarmTiles(this.gs.tiles);
              this.rebuildCrops();
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
          destroyCrop(this.gs.tiles, w.targetTx, w.targetTy);
          this.world.syncFarmTiles(this.gs.tiles);
          this.rebuildCrops();
          w.state = 'flee';
          w.root.scale.setScalar(w.baseScale);
        }
        continue;
      }

      if (w.state === 'flee') {
        this.playFoxAction(w, 'walk');
        const edge = nearestEdgePoint(w.x, w.z);
        const sp = this.foxSpeed(w) * (w.haulSeed ? 1.15 : 1.3);
        const edgeTx = THREE.MathUtils.clamp(Math.round(edge.x), 0, WORLD_SIZE - 1);
        const edgeTy = THREE.MathUtils.clamp(Math.round(edge.y), 0, WORLD_SIZE - 1);
        const route = this.moveFoxTowardTile(w, edgeTx, edgeTy, sp, dt);
        const dist = Math.hypot(edge.x - w.x, edge.y - w.z);
        if (route.atGoal || dist < 0.5) {
          w.dead = true;
          w.root.removeFromParent();
        }
      }
    }
    this.separateFoxes();
    this.foxes = this.foxes.filter((w) => !w.dead);
  }

  private separateFoxes(): void {
    for (let i = 0; i < this.foxes.length; i++) {
      const a = this.foxes[i]!;
      if (a.dead || a.state === 'trapped') continue;
      for (let j = i + 1; j < this.foxes.length; j++) {
        const b = this.foxes[j]!;
        if (b.dead || b.state === 'trapped') continue;
        let dx = a.x - b.x;
        let dz = a.z - b.z;
        let distance = Math.hypot(dx, dz);
        if (distance >= FOX_SEPARATION) continue;
        if (distance < 0.001) {
          const angle = (i * 2.17 + j * 1.31) % (Math.PI * 2);
          dx = Math.sin(angle);
          dz = Math.cos(angle);
          distance = 1;
        }
        const push = (FOX_SEPARATION - distance) * 0.52;
        a.x += (dx / distance) * push;
        a.z += (dz / distance) * push;
        b.x -= (dx / distance) * push;
        b.z -= (dz / distance) * push;
      }
    }
    for (const w of this.foxes) {
      if (w.dead || w.state === 'trapped') continue;
      w.x = THREE.MathUtils.clamp(w.x, 2, WORLD_SIZE - 2);
      w.z = THREE.MathUtils.clamp(w.z, 2, WORLD_SIZE - 2);
      w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
    }
  }

  private pickTarget(w: Fox, crops: { x: number; y: number }[]): void {
    const exposed = crops.filter((crop) => !this.isEnclosed(crop.x, crop.y));
    if (!exposed.length) {
      w.targetTx = -1;
      w.targetTy = -1;
      w.path = [];
      w.pathGoalKey = '';
      w.pathTimer = 0;
      return;
    }
    let best = exposed[0]!;
    let bestD = Infinity;
    for (const c of exposed) {
      const wc = this.farmTileWorld(c.x, c.y);
      const d = Math.hypot(w.x - wc.x, w.z - wc.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    w.targetTx = best.x;
    w.targetTy = best.y;
    w.path = [];
    w.pathGoalKey = '';
    w.pathTimer = 0;
  }

  private rebuildCrops(): void {
    for (const c of this.crops) c.root.removeFromParent();
    this.crops = [];
    let n = 0;
    const maxVis = 800;
    for (let ty = 0; ty < GRID_H && n < maxVis; ty++) {
      for (let tx = 0; tx < GRID_W && n < maxVis; tx++) {
        const t = this.gs.tiles[ty]![tx]!;
        if (t.state !== 'planted' && t.state !== 'mature') continue;
        const stage = t.state === 'mature' ? 2 : t.stage;
        const base = CROP_MODEL_BASE[t.seed?.species ?? 'beet'];
        const suffix = stage === 2 ? 4 : stage + 1;
        const key = `${base}_${suffix}` as ModelKey;
        const { root } = cloneModel(key);
        const baseScale = root.scale.x;
        const wc = this.farmTileWorld(tx, ty);
        root.position.set(wc.x, this.world.heightAt(wc.x, wc.z), wc.z);
        const col = t.seed ? CROP_DEFS[t.seed.species]?.color : undefined;
        if (col) {
          root.traverse((o) => {
            if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
              o.material = o.material.clone();
              o.material.color.set(col);
            }
          });
        }
        this.world.getFarmActors().add(root);
        this.crops.push({ root, baseScale, tx, ty, stage });
        n++;
      }
    }
    this.world.markShadowsDirty();
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
      let mixer: THREE.AnimationMixer | null = null;
      if (animations.length) {
        mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(animations[0]!).play();
      }
      this.animals.push({
        root,
        baseScale,
        mixer,
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

  private stepAnimals(dt: number): void {
    for (const a of this.animals) {
      a.timer -= dt;
      a.root.scale.lerp(new THREE.Vector3(a.baseScale, a.baseScale, a.baseScale), 0.1);
      if (a.state === 'hurt') {
        const dx = a.x - this.playerX;
        const dz = a.z - this.playerZ;
        const len = Math.hypot(dx, dz) || 1;
        a.x += (dx / len) * a.speed * 2.2 * dt;
        a.z += (dz / len) * a.speed * 2.2 * dt;
        a.heading = Math.atan2(dx, dz);
        if (a.timer <= 0) {
          a.state = 'walk';
          a.timer = 3;
        }
      } else {
        if (a.timer <= 0) {
          a.state = a.state === 'idle' ? 'walk' : 'idle';
          a.timer = 2 + this.gs.rng() * 4;
          a.targetHeading = this.gs.rng() * Math.PI * 2;
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
      const selected = this.selectedPlacementAsset();
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
    if (!this.onHud) return;

    const seed = selectedSeed(this.gs);
    const hint = this.interactionHint(seed);

    const inventory: HudSlot[] = this.gs.inventory.map((slot) => {
      if (!slot) return { id: null, name: '', glyph: '', model: null, count: 0, price: 0, blurb: '' };
      const info = itemInfo(slot.id);
      return {
        id: slot.id,
        name: info.name,
        glyph: info.glyph,
        model: itemIconModel(slot.id),
        count: slot.count,
        price: info.price,
        blurb: info.blurb,
      };
    });
    while (inventory.length < INVENTORY_SLOTS) {
      inventory.push({ id: null, name: '', glyph: '', model: null, count: 0, price: 0, blurb: '' });
    }

    const buildPlacement = this.buildingMode
      ? this.buildingPlacementStatus()
      : {
          valid: false,
          reason: 'Open build mode to preview a structure',
          asset: null,
          rotation: this.placementRotation,
        };

    const toolbar: HudToolbarSlot[] = TOOLBAR.map((t, i) => ({
      index: i,
      name: t.name,
      glyph: t.glyph,
      model: t.model,
      empty: t.empty,
      selected: !this.gs.toolSlotActive && this.gs.toolbarSlot === i,
    }));

    const marketItems = occupiedSlots(this.gs.inventory).map((s) => {
      const info = itemInfo(s.id);
      return {
        id: s.id,
        name: info.name,
        glyph: info.glyph,
        model: itemIconModel(s.id),
        count: s.count,
        price: info.price,
      };
    });

    const snap: HudSnapshot = {
      day: this.gs.clock.day,
      phase: this.gs.clock.phase,
      phaseT: this.gs.clock.t,
      hint,
      inventory,
      inventoryOpen: this.gs.inventoryOpen,
      duckettes: this.gs.duckettes,
      toolbar,
      build: {
        active: this.buildingMode,
        selectedIndex: this.placeableBuildingIndex,
        wood: woodCount(this.gs),
        options: PLACEABLE_BUILDINGS.map((entry, index) => ({
          index,
          name: entry.name,
          model: entry.model,
          cost: entry.cost,
          canAfford: woodCount(this.gs) >= entry.cost,
        })),
        placement: {
          valid: buildPlacement.valid,
          reason: buildPlacement.reason,
        },
      },
      toolSlot: {
        name: 'Bucket',
        glyph: '🪣',
        model: null,
        selected: this.gs.toolSlotActive,
        fill: this.gs.bucketFill,
        capacity: BUCKET_CAPACITY,
      },
      ultimate: {
        name: 'Boulder',
        glyph: '',
        model: 'rock_2',
        ready: this.gs.boulderCooldown <= 0,
        cooldown: Math.ceil(this.gs.boulderCooldown),
        max: BOULDER_COOLDOWN,
      },
      bearTrap: {
        name: 'Bear Trap',
        glyph: '',
        model: 'bear_trap_open',
        ready: this.gs.bearTrapCooldown <= 0,
        cooldown: Math.ceil(this.gs.bearTrapCooldown),
        max: BEAR_TRAP_COOLDOWN,
      },
      helpOpen: this.helpOpen,
      market: {
        open: this.nearMarket,
        items: marketItems,
        total: marketItems.reduce((n, i) => n + i.price * i.count, 0),
      },
      vendor: {
        open: this.vendorOpen,
        tab: this.vendorTab,
        tabs: ['Housing', 'Weapons', 'Buildings', 'Upgrades'],
        items: shopAssets(this.vendorTab).map((asset) => ({
          id: asset.id,
          name: asset.displayName,
          description: asset.description,
          footprint: `${asset.footprint.width}×${asset.footprint.height}`,
          useType: asset.useType,
          gate: asset.gate,
          model: asset.modelKey,
          price: asset.price,
          material: Object.entries(asset.materialCost)
            .map(([name, cost]) => `${cost} ${name}`)
            .join(', ') || '—',
        })),
        message: this.vendorMessage,
      },
      contextMenu: { ...this.contextMenu },
      demolishMode: this.demolishMode,
      paused: this.pauseOpen,
      marketAngle: this.world.screenAngleTo(this.playerX, this.playerZ, this.stallX, this.stallZ),
      marketDistance: Math.round(
        Math.hypot(this.playerX - this.stallX, this.playerZ - this.stallZ),
      ),
      popups: this.popups.map((p) => ({ ...p })),
      toast: this.gs.toast,
      win:
        this.gs.clock.day >= WIN_DAY && !this.gs.winShown && !this.winShownLocal
          ? {
              daysSurvived: Math.max(this.gs.stats.daysSurvived, this.gs.clock.day),
              cropsHarvested: this.gs.stats.cropsHarvested,
              woodGathered: this.gs.stats.woodGathered,
              trophies: this.gs.stats.trophies,
            }
          : null,
    };

    const json = JSON.stringify(snap);
    if (!force && json === this.lastHudJson) return;
    this.lastHudJson = json;
    this.onHud(snap);
  }
}
