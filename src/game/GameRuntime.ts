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
import { cropItem, cropName, itemInfo, ITEM_WOOD, trophyItem, type ItemId } from '../sim/items';
import { rollDrop, TROPHY_ODDS } from '../sim/luck';
import {
  generateWave,
  nearestEdgePoint,
  type FoxType,
} from '../sim/raid';
import { cloneModel, preloadAll, initAssetLoaders, type ModelKey } from './Assets';
import { InputController } from './InputController';
import { buildMarketStall } from './MarketStall';
import { WorldRenderer } from './WorldRenderer';
import type { BuildingId, PlacedBuilding } from '../sim/save';

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

export type HudMarket = {
  open: boolean;
  items: { id: ItemId; name: string; glyph: string; model: ModelKey | null; count: number; price: number }[];
  total: number;
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
    scale: 1.15,
    carryPosition: [0.02, -0.34, 0.03],
    carryRotation: [0, 0, -0.55],
    actionPosition: [0.25, 0.1, -0.3],
    actionRotation: [0, 0, -0.55],
    actionScale: 1.25,
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
    scale: 0.4,
    // The Survival shotgun's source origin is at the rear of the stock. A
    // neutral hand attachment leaves it hanging at the knees and reads upside
    // down during the carry clips. Raise it into the hand/chest silhouette and
    // roll it across the body so the barrel, receiver, and stock stay legible.
    carryPosition: [0.02, 0.12, 0.08],
    carryRotation: [0, 0, 0.7],
    actionPosition: [0.02, 0.12, 0.08],
    actionRotation: [0, 0, 0.7],
    actionScale: 1,
    runClip: 'runCarry',
  },
  shovel: {
    // Carry it across the body so the blade and shaft stay readable while
    // idle or running; the source's vertical default disappears inside the
    // cowboy's torso from the isometric camera.
    scale: 1,
    carryPosition: [0.16, -0.02, -0.18],
    carryRotation: [0, 0, -0.62],
    actionPosition: [0.2, 0, -0.25],
    actionRotation: [0, 0, -0.62],
    actionScale: 1,
    runClip: 'runCarry',
  },
};

const HOMESTEAD_MODEL_KEYS = [
  'house_1',
  'house_2',
  'house_3',
  'house_4',
  'house_5',
] as const;

const PLACEABLE_BUILDINGS: {
  id: BuildingId;
  model: ModelKey;
  name: string;
  cost: number;
}[] = [
  { id: 'well', model: 'well', name: 'Well', cost: 3 },
  { id: 'chicken_coop', model: 'chicken_coop', name: 'Chicken Coop', cost: 5 },
  { id: 'silo', model: 'silo', name: 'Silo', cost: 7 },
  { id: 'windmill', model: 'windmill', name: 'Windmill', cost: 8 },
  { id: 'tower_windmill', model: 'tower_windmill', name: 'Tower Windmill', cost: 12 },
  { id: 'water_tower', model: 'water_tower', name: 'Water Tower', cost: 10 },
  { id: 'fence', model: 'fence', name: 'Fence', cost: 1 },
  { id: 'fence2', model: 'fence2', name: 'Fence 2', cost: 1 },
  { id: 'small_barn', model: 'small_barn', name: 'Small Barn', cost: 5 },
  { id: 'open_barn', model: 'open_barn', name: 'Open Barn', cost: 7 },
  { id: 'barn', model: 'barn', name: 'Barn', cost: 10 },
  { id: 'silo_house', model: 'silo_house', name: 'Silo House', cost: 14 },
  { id: 'big_barn', model: 'big_barn', name: 'Big Barn', cost: 18 },
];

const HOMESTEAD_X = HOMESTEAD_MIN_X + 8;
const HOMESTEAD_Z = HOMESTEAD_MIN_Z + 8;
const HOMESTEAD_UPGRADE_WOOD = [0, 6, 12, 24, 48];

/**
 * Bottom toolbar. Slot 1 is the brown shotgun, slot 2 the shovel you work the
 * ground with, slot 3 the red axe. The bucket has its own water slot, and Boulder
 * Roll its own ability slots to the left.
 */
const SLOT_SHOTGUN = 0;
const SLOT_SHOVEL = 1;
const SLOT_AXE = 2;

const TOOLBAR: { name: string; glyph: string; model: ModelKey | null; empty: boolean }[] = [
  { name: 'Shotgun', glyph: '', model: 'shotgun_2', empty: false },
  { name: 'Shovel', glyph: '', model: 'shovel', empty: false },
  { name: 'Axe', glyph: '', model: 'axe', empty: false },
  { name: '', glyph: '', model: null, empty: true },
  { name: '', glyph: '', model: null, empty: true },
];

const CROP_ICON_MODELS: Record<string, ModelKey> = {
  Grass: 'grasscrop_4',
  Dandelion: 'dandelion_4',
  Beet: 'beet_4',
  Carrot: 'carrot_4',
  Lettuce: 'lettuce_4',
};

function itemIconModel(id: ItemId): ModelKey | null {
  if (id === ITEM_WOOD) return 'wood_log';
  const crop = cropName(id);
  if (crop !== null) return CROP_ICON_MODELS[crop] ?? null;
  if (id.startsWith('trophy:')) return 'trophy';
  return null;
}

export class GameRuntime {
  private gs!: GameState;
  private world!: WorldRenderer;
  private input = new InputController();
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
  private placeableBuildingIndex = 0;

  private foxes: Fox[] = [];
  private shots: Shot[] = [];
  private boulders: Boulder[] = [];
  private shotCd = 0;
  private meleeCd = 0;
  private crops: CropActor[] = [];
  private stallRoot: THREE.Object3D | null = null;
  private stallX = 0;
  private stallZ = 0;
  private nearMarket = false;
  private homesteadRoot: THREE.Object3D | null = null;
  private buildingRoots = new Map<string, THREE.Object3D>();
  private bearTrapRoots = new Map<string, THREE.Object3D>();
  /** In-progress chops, keyed "tx,ty". */
  private treeChops = new Map<string, number>();

  private animals: PlainsAnimal[] = [];
  private animalsSeeded = false;

  private popups: HudPopup[] = [];
  private popupId = 1;
  private hitPause = 0;
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
    buildingsPlaced: 0,
    cropsPlanted: 0,
    cropsHarvested: 0,
    treesFelled: 0,
    foxesFelled: 0,
    daysReached: 1,
  };

  async mount(canvas: HTMLCanvasElement, onHud: (s: HudSnapshot) => void): Promise<void> {
    this.disposed = false;
    this.canvas = canvas;
    this.onHud = onHud;

    // Renderer must exist before preloading: KTX2Loader.detectSupport() needs it.
    this.world = new WorldRenderer(canvas);
    initAssetLoaders(this.world.renderer);
    await preloadAll();
    // React development mode can dispose an effect while the asynchronous
    // asset preload is still in flight. Do not let that abandoned runtime
    // attach input handlers or render over the replacement runtime.
    if (this.disposed) return;

    const raw = localStorage.getItem(SAVE_KEY);
    this.gs = raw ? loadFromString(raw) ?? createGameState() : createGameState();
    this.input.attach(canvas);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('beforeunload', this.persist);

    this.playerX = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2;
    this.playerZ = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE / 2;

    this.world.initFarmTrees({
      heightAt: (x, z) => this.world.heightAt(x, z),
      distToWater: (x, z) => this.world.distToWater(x, z),
      isChopped: (tx, ty) => isTreeChopped(this.gs, tx, ty),
      isStumpCleared: (tx, ty) => isStumpCleared(this.gs, tx, ty),
      tileBlocked: (tx, ty) => (this.gs.tiles[ty]?.[tx]?.state ?? 'grass') !== 'grass',
    });

    this.spawnPlayer();
    this.spawnStall();
    this.syncBuildings();
    this.syncBearTrapModels();
    this.seedPlainsAnimals();
    this.world.syncFarmTiles(this.gs.tiles);
    this.rebuildCrops();
    this.world.snapCamera(this.playerX, this.playerZ);

    if (this.gs.clock.phase === 'night') this.spawnRaid();

    this.running = true;
    this.loop(performance.now());
    this.pushHud(true);

    // Dev handle: lets the browser console drive the game for spot checks.
    (window as unknown as { tarnation?: GameRuntime }).tarnation = this;
  }

  dispose(): void {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.dispose();
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
      // These thin, dark tools otherwise disappear behind the cowboy's torso
      // during the carry and slash clips. They are hand-held presentation
      // props, so draw them after the body while retaining their shadow casters.
      root.renderOrder = 3;
      root.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.renderOrder = 3;
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
          material.depthTest = false;
          material.depthWrite = false;
        }
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

  /** The market stall is the only structure on the map. */
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
      const def = PLACEABLE_BUILDINGS.find((entry) => entry.id === placed.id);
      if (!def) return;
      const root = cloneModel(def.model).root;
      root.name = `placed_${placed.id}_${index}`;
      root.position.set(placed.x, this.world.heightAt(placed.x, placed.z), placed.z);
      root.rotation.y = placed.rotation;
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
      this.economyMetrics.saleTransactions++;
      this.economyMetrics.duckettesEarned += earned;
      setToast(this.gs, `Sold everything for ${earned} duckettes`, 2.5);
      this.popup(`+${earned}₫`, this.playerX, this.playerZ);
      this.persist();
      this.pushHud(true);
    }
  }

  private afterSale(id: ItemId, earned: number): void {
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
    this.cancelPlayerAction();
    this.clearShots();
    this.gs.toolSlotActive = true;
    this.toolMode = 'farm';
    this.refreshEquippedTool();
    this.pushHud(true);
  }

  toggleInventory(): void {
    this.gs.inventoryOpen = !this.gs.inventoryOpen;
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
    const locomotion = moving
      ? carry
        ? speed > PLAYER_SPEED * 0.72
          ? carryAction
          : this.playerActions.walkCarry ?? this.walkAction
        : this.playerActions.walk ?? this.walkAction
      : this.playerActions.idle ?? this.idleAction;
    for (const action of Object.values(this.playerActions)) {
      if (action) action.setEffectiveWeight(action === locomotion ? 1 : 0);
    }
    locomotion.enabled = true;
    if (!locomotion.isRunning()) locomotion.play();
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
    if (this.input.justPressed('KeyR')) {
      cycleWeapon(this.gs);
      this.gs.toolbarSlot = this.gs.weapon === 'axe' ? SLOT_AXE : SLOT_SHOTGUN;
      this.gs.toolSlotActive = false;
      this.refreshEquippedTool();
      setToast(this.gs, `Weapon: ${this.gs.weapon}`, 1.2);
    }
    if (this.input.justPressed('KeyU')) this.tryUpgradeHomestead();
    if (this.input.justPressed('KeyP')) {
      this.buildingMode = !this.buildingMode;
      this.toolMode = 'farm';
      setToast(
        this.gs,
        this.buildingMode
          ? `Build: ${PLACEABLE_BUILDINGS[this.placeableBuildingIndex]!.name} · click to place`
          : 'Build mode off',
        1.6,
      );
    }
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

    const structure: [string, ToolMode, string][] = [
      ['KeyZ', 'trench', 'Tool: trench dig'],
      ['KeyX', 'breed', 'Tool: breeding bed'],
    ];
    for (const [code, mode, label] of structure) {
      if (!this.input.justPressed(code)) continue;
      this.selectSlot(SLOT_SHOVEL);
      this.toolMode = mode;
      setToast(this.gs, label, 1.2);
    }
  }

  private update(dt: number): void {
    const b = this.world.getWorldBounds();
    this.movePlayer(dt, b.minX, b.maxX, b.minZ, b.maxZ);
    this.handleHotkeys();

    if (this.shotCd > 0) this.shotCd -= dt;
    if (this.meleeCd > 0) this.meleeCd -= dt;
    this.stepShots(dt);
    this.stepBoulders(dt);
    this.stepFoxes(dt);
    this.stepAnimals(dt);

    this.nearWater = this.world.distToWater(this.playerX, this.playerZ) <= WATER_COLLECT_RANGE;
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY && this.input.justPressed('KeyE')) {
      fillBucket(this.gs);
      setToast(this.gs, `Bucket filled (${this.gs.bucketFill}/${BUCKET_CAPACITY})`, 2);
    }

    this.nearMarket =
      Math.hypot(this.playerX - this.stallX, this.playerZ - this.stallZ) <= MARKET_RANGE;

    if (this.input.consumeRmb() || this.input.justPressed('Space')) this.useCombatAction();
    if (this.input.consumeLmb()) {
      if (this.buildingMode) this.placeSelectedBuilding();
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
    this.playerX = THREE.MathUtils.clamp(this.playerX + this.velX * dt, minX, maxX);
    this.playerZ = THREE.MathUtils.clamp(this.playerZ + this.velZ * dt, minZ, maxZ);
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
    return this.world.distToWater(tx + 0.5, ty + 0.5) < 0.8;
  }

  /** The grid only lights up for the shovel — the tool that actually works soil. */
  private updateHover(): void {
    if (this.buildingMode) {
      const tile = this.pointerTile();
      if (!tile) {
        this.world.setHover(null, null, false);
        return;
      }
      const wc = this.farmTileWorld(tile.tx, tile.ty);
      const usable =
        Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) <= BEAR_TRAP_PLACE_RANGE &&
        !this.tileBlockedForTilling(tile.tx, tile.ty) &&
        this.world.distToWater(wc.x, wc.z) >= 2.5;
      this.world.setHover(tile.tx, tile.ty, usable);
      return;
    }
    if (this.gs.toolSlotActive || this.gs.toolbarSlot !== SLOT_SHOVEL) {
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
    const usable = dist <= TOOL_RANGE && !this.tileBlockedForTilling(tile.tx, tile.ty);
    this.world.setHover(tile.tx, tile.ty, usable);
  }

  private pointerTile(): { tx: number; ty: number } | null {
    const ndc = this.input.getPointerNdc();
    const hit = this.world.raycastGround(ndc.x, ndc.y);
    if (!hit) return null;
    return this.worldToFarmTile(hit.x, hit.z);
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
    this.economyMetrics.upgrades++;
    const unlocked = nextTier === 2 ? unlockWeapon(this.gs, 'bow') : nextTier === 3 ? unlockWeapon(this.gs, 'axe') : false;
    this.syncBuildings();
    this.persist();
    setToast(
      this.gs,
      unlocked
        ? `Homestead tier ${nextTier} · new weapon: ${this.gs.unlockedWeapons[this.gs.unlockedWeapons.length - 1]}`
        : `Homestead tier ${nextTier}`,
      2.4,
    );
  }

  private placeSelectedBuilding(): void {
    const selected = PLACEABLE_BUILDINGS[this.placeableBuildingIndex]!;
    const tilePos = this.pointerTile();
    if (!tilePos) return;
    const tile = getTile(this.gs.tiles, tilePos.tx, tilePos.ty);
    const wc = this.farmTileWorld(tilePos.tx, tilePos.ty);
    if (!tile || tile.state !== 'grass') {
      setToast(this.gs, 'Buildings need clear grass', 1.4);
      return;
    }
    if (
      Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > BEAR_TRAP_PLACE_RANGE ||
      this.tileBlockedForTilling(tilePos.tx, tilePos.ty) ||
      this.world.distToWater(wc.x, wc.z) < 2.5
    ) {
      setToast(this.gs, 'That ground is not suitable for a building', 1.6);
      return;
    }
    if (
      Math.hypot(wc.x - HOMESTEAD_X, wc.z - HOMESTEAD_Z) < 5 ||
      this.gs.placedBuildings.some((b) => Math.hypot(b.x - wc.x, b.z - wc.z) < 2.2)
    ) {
      setToast(this.gs, 'Leave room around existing buildings', 1.6);
      return;
    }
    if (woodCount(this.gs) < selected.cost) {
      setToast(this.gs, `${selected.name}: need ${selected.cost} Wood`, 1.6);
      return;
    }
    takeFromInventory(this.gs, ITEM_WOOD, selected.cost);
    placeBuilding(this.gs, selected.id, wc.x, wc.z, this.headingTarget);
    this.economyMetrics.buildingsPlaced++;
    this.playPlayerAction('pickUp');
    this.syncBuildings();
    this.persist();
    setToast(this.gs, `Built ${selected.name}`, 1.6);
  }

  private useBucket(): void {
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) {
      fillBucket(this.gs);
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
    const tilePos = this.pointerTile();
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
      }
      return;
    }

    if (this.toolMode === 'breed') {
      if (this.meleeCd > 0) return;
      if (makeBreedingBed(this.gs.tiles, tx, ty)) {
        this.beginMeleeAction('pickUp');
        this.world.syncFarmTiles(this.gs.tiles);
        setToast(this.gs, 'Breeding bed ready — plant two seeds', 2.5);
      } else if (tile.state === 'breeding' && tile.breedA && tile.breedB) {
        const parents = clearBreedingParents(this.gs.tiles, tx, ty);
        if (parents) {
          this.beginMeleeAction('pickUp');
          const child = crossbreed(parents.a, parents.b, this.gs.rng);
          addSeedToInventory(this.gs, child);
          this.gs.tiles[ty]![tx]!.state = 'tilled';
          this.world.syncFarmTiles(this.gs.tiles);
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
        this.beginMeleeAction('pickUp');
        this.world.syncFarmTiles(this.gs.tiles);
      }
    } else if (tile.state === 'tilled' || tile.state === 'breeding') {
      if (this.meleeCd > 0) return;
      const seed = selectedSeed(this.gs);
      if (!seed) {
        setToast(this.gs, 'No seeds', 1.5);
        return;
      }
      if (plantTile(this.gs.tiles, tx, ty, seed)) {
        this.economyMetrics.cropsPlanted++;
        this.beginMeleeAction('pickUp');
        this.rebuildCrops();
        this.world.syncFarmTiles(this.gs.tiles);
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
        this.economyMetrics.cropsHarvested += res.count;
        this.gs.stats.cropsHarvested += res.count;
        addSeedToInventory(this.gs, { ...res.seed, traits: { ...res.seed.traits } });
        this.rebuildCrops();
        this.world.syncFarmTiles(this.gs.tiles);
        this.popup(`+${res.count} ${res.seed.displayName}`, wc.x, wc.z);
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
      this.world.syncFarmTiles(this.gs.tiles);
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
        return true;
      }
      this.treeChops.delete(key);
      clearStump(this.gs, tx, ty);
      trees.invalidateTile(tx, ty);
      this.world.markShadowsDirty();
      setToast(this.gs, 'Stump cleared', 1.2);
      return true;
    }

    if (!trees.hasTree(tx, ty)) return false;

    const chops = (this.treeChops.get(key) ?? 0) + 1;
    this.treeChops.set(key, chops);
    this.world.shake(0.05, 0.04);

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

  private tryBearTrap(): void {
    if (this.gs.bearTrapCooldown > 0) {
      setToast(this.gs, `Bear trap ready in ${Math.ceil(this.gs.bearTrapCooldown)}s`, 1.2);
      return;
    }
    const pointer = this.pointerTile();
    const fallbackX = this.playerX + Math.sin(this.headingTarget) * 1.5;
    const fallbackZ = this.playerZ + Math.cos(this.headingTarget) * 1.5;
    const tilePos = pointer ?? this.worldToFarmTile(fallbackX, fallbackZ);
    if (!tilePos) return;
    const wc = this.farmTileWorld(tilePos.tx, tilePos.ty);
    const tile = getTile(this.gs.tiles, tilePos.tx, tilePos.ty);
    if (
      !tile ||
      Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > BEAR_TRAP_PLACE_RANGE ||
      this.tileBlockedForTilling(tilePos.tx, tilePos.ty) ||
      this.world.distToWater(wc.x, wc.z) < 1.2
    ) {
      setToast(this.gs, 'Place the bear trap on clear ground nearby', 1.5);
      return;
    }
    if (!placeBearTrap(this.gs.tiles, tilePos.tx, tilePos.ty)) {
      setToast(this.gs, 'A trap is already here or the ground is occupied', 1.5);
      return;
    }
    this.gs.bearTrapCooldown = BEAR_TRAP_COOLDOWN;
    this.playPlayerAction('pickUp');
    this.world.syncFarmTiles(this.gs.tiles);
    this.syncBearTrapModels();
    this.persist();
    setToast(this.gs, 'Bear trap set', 1.4);
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
      return;
    }
    w.dead = true;
    this.resetFoxTrap(w);
    this.gs.stats.foxesFelled += 1;
    this.economyMetrics.foxesFelled++;
    this.world.shake(0.09, 0.08);
    this.hitPause = 0.05;
    w.root.removeFromParent();
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
      return;
    }
    a.root.removeFromParent();
    this.animals = this.animals.filter((o) => o !== a);
    this.rollTrophy(`animal:${a.name}`, a.name, a.x, a.z);
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
  }

  // ----------------------------------------------------------------- raids

  private spawnRaid(): void {
    this.clearFoxes();
    const spawns = generateWave(
      this.gs.clock.day,
      this.gs.seed,
      cropValueScore(this.gs.tiles),
      totalWeirdness(this.gs.tiles),
    );
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

  private stepFoxes(dt: number): void {
    const crops = findCropTiles(this.gs.tiles);
    for (const w of [...this.foxes]) {
      if (w.dead) continue;
      w.actions.mixer?.update(dt);

      if (w.state !== 'burrow' && w.state !== 'trapped') {
        const bearTrap = this.nearestOpenBearTrap(w.x, w.z);
        if (bearTrap && triggerBearTrap(this.gs.tiles, bearTrap.tx, bearTrap.ty)) {
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
          }
        } else if (crops.length === 0) {
          // Give each fox a point on an attack ring. Without this, every raid
          // actor seeks the exact player coordinate and the models stack into a
          // single broken-looking pile.
          const radius = FOX_ATTACK_RADIUS + (w.attackSlot % 3) * FOX_ATTACK_SLOT_GAP;
          const targetX = this.playerX + Math.sin(w.attackAngle) * radius;
          const targetZ = this.playerZ + Math.cos(w.attackAngle) * radius;
          const dx = targetX - w.x;
          const dz = targetZ - w.z;
          const len = Math.hypot(dx, dz) || 1;
          if (len > 0.18) {
            w.x += (dx / len) * this.foxSpeed(w) * 0.5 * dt;
            w.z += (dz / len) * this.foxSpeed(w) * 0.5 * dt;
          } else {
            w.state = 'attack';
            w.timer = FOX_ATTACK_PERIOD;
            this.playFoxAction(w, 'attack');
          }
          w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
          w.root.rotation.y = Math.atan2(this.playerX - w.x, this.playerZ - w.z);
          continue;
        } else if (w.targetTx < 0) this.pickTarget(w, crops);

        const wc = this.farmTileWorld(w.targetTx, w.targetTy);
        const dx = wc.x - w.x;
        const dz = wc.z - w.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
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
        } else {
          const sp = this.foxSpeed(w);
          w.x += (dx / dist) * sp * dt;
          w.z += (dz / dist) * sp * dt;
          w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
          w.root.rotation.y = Math.atan2(dx, dz);
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
        const dx = edge.x - w.x;
        const dz = edge.y - w.z;
        const dist = Math.hypot(dx, dz) || 1;
        const sp = this.foxSpeed(w) * (w.haulSeed ? 1.15 : 1.3);
        w.x += (dx / dist) * sp * dt;
        w.z += (dz / dist) * sp * dt;
        w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
        if (dist < 0.5) {
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
    if (!crops.length) {
      w.targetTx = -1;
      w.targetTy = -1;
      return;
    }
    let best = crops[0]!;
    let bestD = Infinity;
    for (const c of crops) {
      const wc = this.farmTileWorld(c.x, c.y);
      const d = Math.hypot(w.x - wc.x, w.z - wc.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    w.targetTx = best.x;
    w.targetTy = best.y;
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

  // ------------------------------------------------------------------- HUD

  private pushHud(force: boolean): void {
    if (!this.onHud) return;

    const seed = selectedSeed(this.gs);
    let hint = `1 shotgun · 2 shovel · 3 axe · 6 bucket · Q boulder · B bear trap · R weapon · U upgrade · P build · I inventory · [ ] seed (${seed?.displayName ?? '—'})`;
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) hint = 'E — fill bucket';
    if (this.toolMode !== 'farm') hint = `Tool: ${this.toolMode} · 2 back to shovel`;
    if (this.buildingMode) {
      const selected = PLACEABLE_BUILDINGS[this.placeableBuildingIndex]!;
      hint = `Build: ${selected.name} · N next · click place · P exit`;
    }
    if (this.nearMarket) hint = 'Market stall — sell for duckettes';

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
      market: {
        open: this.nearMarket,
        items: marketItems,
        total: marketItems.reduce((n, i) => n + i.price * i.count, 0),
      },
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
