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
  HOMESTEAD_FOOTPRINT,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SPAWN_X,
  HOMESTEAD_SPAWN_Z,
  HOMESTEAD_SIZE,
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
  FOX_BURROW_TIME,
  FOX_EAT_TIME,
  WORLD_SIZE,
} from '../content';
import {
  addSeedToInventory,
  addToInventory,
  canStoreSeedPacket,
  checkWin,
  clearStump,
  createGameState,
  cycleWeapon,
  cycleSeed,
  fillBucket,
  harvestCropTransaction,
  isStumpCleared,
  isTreeChopped,
  markTreeChopped,
  markWinShown,
  onNewDay,
  placeBuilding,
  plantSeedPacket,
  selectedSeed,
  selectedSeedPacket,
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
import { SEED_RECOVERY_PER_HARVEST } from '../sim/seedInventory';
import {
  seedPacketCapacity,
  waterTowerProvidesWater,
} from '../sim/buildings';
import {
  clearBreedingParents,
  destroyCrop,
  digTrench,
  flowTrenchWater,
  getTile,
  hasPortableLightNearby,
  hasRepelNearby,
  hasRicochetNearby,
  makeBreedingBed,
  nibbleCrop,
  placeBearTrap,
  tillTile,
  tileCenter,
  trenchSourceTiles,
  triggerBearTrap,
  waterTile,
  worldToTile,
  cropValueScore,
  totalWeirdness,
} from '../sim/farm';
import {
  crossbreed,
  PORTABLE_LIGHT_RADIUS,
  REPEL_FOX_RADIUS,
  repellerUsesRemaining,
  RICOCHET_RADIUS,
  seedId,
  seedTraitDescription,
} from '../sim/genetics';
import { hasRoomFor } from '../sim/inventory';
import { cropItem, itemInfo, ITEM_WOOD, trophyItem, type ItemId } from '../sim/items';
import { buildCodexCatalog } from '../sim/codex';
import { purchaseAsset } from '../sim/economy';
import { progressionLockReason } from '../sim/progression';
import {
  dayTwoChoiceHint,
  foxCropLossGuidance,
  foxProduceLossGuidance,
  multiDayArcHint,
  RAID_TELEGRAPH,
  shouldTelegraphRaid,
} from '../sim/gameArc';
import {
  type OutcomeKind,
  type OutcomeStatus,
} from '../sim/outcomes';
import type { FeedbackKind } from '../sim/feedback';
import { rollDrop, TROPHY_ODDS } from '../sim/luck';
import {
  generateWave,
  foxRoleProfile,
  nearestEdgePoint,
  selectRaidTarget,
  type FoxRoleProfile,
  type FoxType,
  type RaidTarget,
} from '../sim/raid';
import {
  EQUIPMENT_PROFILES,
  equipmentActionClipFor,
  equipmentTimingFor,
  type EquipmentKey,
} from '../content/equipment';
import {
  cloneModel,
  initAssetLoaders,
  preloadGroup,
  type AssetLoadProgress,
  type ModelKey,
} from './Assets';
import { AudioFeedback } from './AudioFeedback';
import {
  DEFAULT_GAME_SETTINGS,
  parseGameSettings,
  resetGameSettings,
  serializeGameSettings,
  SETTINGS_STORAGE_KEY,
  updateGameSetting,
  type GameSettingKey,
  type GameSettingValue,
  type GameSettings,
} from './Settings';
import { InputController } from './InputController';
import {
  formatBinding,
  formatKeyCode,
  INPUT_BINDING_DEFINITIONS,
  INPUT_BINDINGS_STORAGE_KEY,
  parseInputBindings,
  rebindInput as rebindInputBinding,
  resetInputBindings,
  serializeInputBindings,
  type InputAction,
} from './InputBindings';
import {
  ActionStateMachine,
  DEFAULT_INTERACT_ACTION_TIMING,
  DEFAULT_RANGED_ACTION_TIMING,
  DEFAULT_TOOL_ACTION_TIMING,
  type ActionEvent,
} from './ActionStateMachine';
import { buildMarketStall } from './MarketStall';
import { buildAuthoredVisual } from './PresentationProps';
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
import { approachHeading, LOCOMOTION_GAIT } from './Locomotion';
import {
  classifyAxeTarget,
  headingToTarget,
  isWithinFacingArc,
  isWithinMeleeContact,
  isMeleeContactObstructed,
  MELEE_FACING_HALF_ANGLE,
  meleeEffectForTarget,
  selectMeleeCandidate,
  type MeleeCandidate,
} from './ToolInteraction';
import { PlayerActionController, type PlayerClip } from './PlayerActionController';
import { PlacementCoordinator, PLACEABLE_BUILDINGS, type PlacementContext } from './PlacementCoordinator';
import { RuntimeMetrics } from './RuntimeMetrics';
import { FeedbackEffectPool } from './FeedbackEffects';
import {
  ACTION_IMPACT_PHASES,
  PresentationTimeline,
  type FeelEvent,
} from './FeelTimeline';
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
import { blocksFor, buildScatterOccupancy } from '../sim/occupancy';
import {
  firstPlotHint as formatFirstPlotHint,
  firstPlotStage,
  isHomesteadFootprintTile,
  isFarmableTile,
} from '../sim/farmBoundary';
import { firstTenMinuteGuide } from '../sim/onboarding';

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

type FoxDamageResult = 'ignored' | 'hit' | 'defeated';

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

type RenderedRoot = {
  root: THREE.Object3D;
  /** Authored props own their geometry/materials; model clones retain cache ownership. */
  owned: boolean;
};

function disposeRenderedRoot(rendered: RenderedRoot): void {
  rendered.root.removeFromParent();
  if (rendered.owned) {
    disposeObjectResources(rendered.root, { geometries: true, materials: true, textures: true });
  } else {
    disposeModelClone(rendered.root);
  }
}

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
  accessoryRoot: THREE.Object3D | null;
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
    const settings = parseGameSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
    if (!settings.muted && localStorage.getItem('tarnation.audioMuted') === '1') settings.muted = true;
    if (!settings.reducedMotion && localStorage.getItem('tarnation.reducedMotion') === '1') settings.reducedMotion = true;
    this.settings = settings;
    this.audio.setVolumes(settings);
    this.audio.setMuted(settings.muted);
    this.audio.setCaptionHandler((caption) => this.showAudioCaption(caption));
    this.input.setBindings(parseInputBindings(localStorage.getItem(INPUT_BINDINGS_STORAGE_KEY)));
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
    useCombatAxe: () => this.useCombatAxe(),
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
    terrainAllowed: (tx, ty) => this.canPlaceOnTile(tx, ty),
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
  private movementIntent = false;
  private playerHeading = 0;
  private headingTarget = 0;
  private nearWater = false;
  private nearWaterTower = false;
  private toolMode: ToolMode = 'farm';
  private buildingMode = false;
  private demolishMode = false;
  private pauseOpen = false;
  private helpOpen = false;
  private codexOpen = false;
  private codexSelectedKey: string | null = null;
  private codexCompareKeys: string[] = [];
  private reducedMotion = false;
  private settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };
  private settingsOpen = false;
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
  private raidTelegraphedRoles = new Set<FoxType>();
  /** Runtime-only: passive repellers soften a raid without clearing every fox. */
  private raidRepelUses = 0;
  private deathMarkers: DeathMarker[] = [];
  private lootMarkers: LootMarker[] = [];
  private feedbackEffects: FeedbackEffectPool | null = null;
  private readonly presentationTimeline = new PresentationTimeline();
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
  private firstPlotGuideActive = false;
  /** Runtime-only onboarding facts; never persisted as a second quest state. */
  private firstTenMinuteMovementStarted = false;
  private firstTenMinuteMerchantSeen = false;
  private raidWarningDay = -1;
  private fixtureRoots: RenderedRoot[] = [];
  private homesteadRoot: THREE.Object3D | null = null;
  private buildingRoots = new Map<string, RenderedRoot>();
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
  private waterObstacleTiles = new Set<string>();
  private waterObstacleTilesReady = false;
  private softOccupancy = new Set<string>();
  private interactionOnlyOccupancy = new Set<string>();
  /** No authored path layer exists yet; the shared policy accepts one without adding gameplay. */
  private pathOccupancy = new Set<string>();
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
    isWalkable: (x, z) => this.canWildlifeOccupy(x, z),
  } satisfies FoxDirectionWorld);
  private enclosedTiles = new Uint8Array(GRID_W * GRID_H) as Uint8Array<ArrayBufferLike>;
  private saveTimer = 0;
  private saveFeedback: SaveFeedback = { state: 'saved', message: 'Save ready' };

  private animals: PlainsAnimal[] = [];
  private animalsSeeded = false;
  private wildlifeExitTiles: { tx: number; ty: number }[] = [];

  private popups: HudPopup[] = [];
  private popupId = 1;
  private hitPause = 0;
  /** Renderer-only randomness; never consume the simulation RNG for decoration. */
  private feedbackSeed = 0x51f15eed;
  private winShownLocal = false;
  private settlementCelebrated = false;
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
    this.feedbackEffects = new FeedbackEffectPool();
    this.applyPresentationSettings();
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
    this.firstPlotGuideActive = options.newAdventure === true;
    this.firstTenMinuteMovementStarted = false;
    this.firstTenMinuteMerchantSeen = false;
    this.winShownLocal = false;
    this.settlementCelebrated = false;
    this.raidWarningDay = -1;
    this.codexOpen = false;
    this.settingsOpen = false;
    this.codexCompareKeys = [];
    this.codexSelectedKey = buildCodexCatalog(this.gs.codex)[0]?.key ?? null;
    this.world.setStarterPlotVisible(this.firstPlotGuideActive);
    this.syncActionMenuState();
    this.input.attach(canvas);
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('beforeunload', this.persist);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.playerX = this.gs.playerX;
    this.playerZ = this.gs.playerZ;
    this.movementIntent = false;
    this.playerHeading = 0;
    this.headingTarget = 0;

    this.world.initFarmTrees({
      heightAt: (x, z) => this.world.heightAt(x, z),
      distToWater: (x, z) => this.world.distToWater(x, z),
      isChopped: (tx, ty) => isTreeChopped(this.gs, tx, ty),
      isStumpCleared: (tx, ty) => isStumpCleared(this.gs, tx, ty),
      tileBlocked: (tx, ty) => (this.gs.tiles[ty]?.[tx]?.state ?? 'grass') !== 'grass',
    });

    this.validatePlayerSpawn(options.newAdventure === true);
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
    this.refreshObstacleTopology();
    this.seedPlainsAnimals();
    this.refreshTrenchWater();
    this.syncWorldTiles();
    this.rebuildCrops();
    this.recalculateEnclosure();
    this.world.snapCamera(this.playerX, this.playerZ);
    this.audio.setPhase(this.gs.clock.phase);

    if (this.gs.clock.phase === 'night') this.spawnRaid();

    this.running = true;
    this.saveTimer = 0;
    this.persist();
    this.loop(performance.now());
    this.pushHud(true);
    this.loadBackgroundAssets(options.onAssetProgress);

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
    this.feedbackEffects?.dispose();
    this.feedbackEffects = null;

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
    for (const rendered of this.fixtureRoots) disposeRenderedRoot(rendered);
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
    for (const rendered of this.buildingRoots.values()) disposeRenderedRoot(rendered);
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
  }

  dismissWin(): void {
    this.winShownLocal = true;
    this.pauseOpen = false;
    this.clearInputState();
    this.syncActionMenuState();
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
    const previousSaveState = this.saveFeedback.state;
    this.saveFeedback = savingFeedback();
    this.pushHud(true);
    const result = this.saveService.save(this.gs);
    if (result.status === 'ok') this.saveTimer = 0;
    this.saveFeedback = completedSaveFeedback(result);
    if (result.status !== 'ok') {
      console.error(`[Save] ${result.status}: ${result.message ?? 'save was not written'}`);
      if (previousSaveState !== 'failed') this.audio.playEvent('save-error');
    } else if (previousSaveState === 'failed') {
      this.audio.playEvent('save-success');
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
    this.playerActions.setReducedMotion(this.reducedMotion);
    this.equipment = new EquipmentController(root, this.playerActions);
    this.equipment.refresh(this.gs);
  }

  /** Keep fresh runs and invalid legacy positions out of the merchant camp. */
  private validatePlayerSpawn(forceFresh: boolean): void {
    const currentTile = this.worldToFarmTile(this.playerX, this.playerZ);
    const currentKey = currentTile ? tileKey(currentTile.tx, currentTile.ty) : '';
    const placedObstacles = occupiedPlacedTiles(this.gs.placedBuildings);
    const currentIsSafe =
      currentTile !== null &&
      !this.fixtureReservations.has(currentKey) &&
      !this.fixtureObstacles.has(currentKey) &&
      !placedObstacles.has(currentKey) &&
      !isHomesteadFootprintTile(currentTile.tx, currentTile.ty) &&
      Number.isFinite(this.playerX) &&
      Number.isFinite(this.playerZ);
    if (!forceFresh && currentIsSafe) return;

    const candidates: { x: number; z: number }[] = [
      { x: HOMESTEAD_SPAWN_X, z: HOMESTEAD_SPAWN_Z },
      { x: HOMESTEAD_SPAWN_X + 1, z: HOMESTEAD_SPAWN_Z },
      { x: HOMESTEAD_SPAWN_X, z: HOMESTEAD_SPAWN_Z + 1 },
      { x: HOMESTEAD_SPAWN_X - 1, z: HOMESTEAD_SPAWN_Z },
      { x: HOMESTEAD_SPAWN_X, z: HOMESTEAD_SPAWN_Z - 1 },
    ];
    for (let radius = 0; radius <= 12; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          candidates.push({
            x: HOMESTEAD_MIN_X + 0.5 + dx + 8,
            z: HOMESTEAD_MIN_Z + 0.5 + dz + 8,
          });
        }
      }
    }

    const candidate = candidates.find((point) => this.isSafeSpawnPoint(point.x, point.z));
    if (!candidate) {
      // The authored region is large enough that this should never be reached;
      // retain a deterministic in-region fallback rather than spawning at camp.
      this.playerX = HOMESTEAD_MIN_X + 1.5;
      this.playerZ = HOMESTEAD_MIN_Z + 1.5;
    } else {
      this.playerX = candidate.x;
      this.playerZ = candidate.z;
    }
    this.gs.playerX = this.playerX;
    this.gs.playerZ = this.playerZ;
  }

  private isSafeSpawnPoint(x: number, z: number): boolean {
    const tile = this.worldToFarmTile(x, z);
    if (!tile || !isFarmableTile(tile.tx, tile.ty)) return false;
    if (isHomesteadFootprintTile(tile.tx, tile.ty)) return false;
    const key = tileKey(tile.tx, tile.ty);
    if (this.fixtureReservations.has(key) || this.fixtureObstacles.has(key)) return false;
    if (occupiedPlacedTiles(this.gs.placedBuildings).has(key)) return false;
    if (this.world.getFarmTrees()?.blocksTilling(tile.tx, tile.ty)) return false;
    return this.world.distToWater(x, z) >= 1.2;
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
    for (const rendered of this.fixtureRoots) disposeRenderedRoot(rendered);
    this.fixtureRoots = [];
    for (const fixture of CENTRAL_CAMP_FIXTURES) {
      const asset = assetDefinition(fixture.id);
      if (!asset) continue;
      const authored = asset.authoredVisual ? buildAuthoredVisual(asset.authoredVisual) : null;
      const root = authored ?? (asset.modelKey ? cloneModel(asset.modelKey).root : null);
      if (!root) continue;
      const center = placedCenter({ tx: fixture.tx, ty: fixture.ty }, fixture.rotation, asset);
      root.name = `fixture_${fixture.id}`;
      root.position.set(center.x, this.world.heightAt(center.x, center.z), center.z);
      root.rotation.y = normalizeOrientation(fixture.rotation) * Math.PI / 2;
      this.world.getFarmActors().add(root);
      this.fixtureRoots.push({ root, owned: authored !== null });
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
    for (let ty = HOMESTEAD_FOOTPRINT.minZ; ty < HOMESTEAD_FOOTPRINT.minZ + HOMESTEAD_FOOTPRINT.height; ty++) {
      for (let tx = HOMESTEAD_FOOTPRINT.minX; tx < HOMESTEAD_FOOTPRINT.minX + HOMESTEAD_FOOTPRINT.width; tx++) {
        this.obstacleTiles.add(tileKey(tx, ty));
      }
    }
    for (const key of occupiedPlacedTiles(this.gs.placedBuildings)) this.obstacleTiles.add(key);
    this.refreshWaterObstacleTiles();
    for (const key of this.waterObstacleTiles) this.obstacleTiles.add(key);
    this.refreshWildlifeExitTiles();
    this.topologyVersion++;
    this.foxDirector.invalidateNavigation();
    this.refreshInteractiveOccupancy();
  }

  /** Build the renderer-only scatter mask from the shared occupancy classes. */
  private refreshInteractiveOccupancy(refreshTrees = true): void {
    this.softOccupancy.clear();
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        const tile = this.gs.tiles[ty]?.[tx];
        if (tile && (tile.state !== 'grass' || tile.bearTrap === true || tile.bearTrapClosed === true)) {
          this.softOccupancy.add(tileKey(tx, ty));
        }
      }
    }
    if (refreshTrees) {
      this.interactionOnlyOccupancy.clear();
      const trees = this.world.getFarmTrees();
      if (trees) {
        for (let ty = 0; ty < GRID_H; ty++) {
          for (let tx = 0; tx < GRID_W; tx++) {
            if (trees.blocksTilling(tx, ty)) this.interactionOnlyOccupancy.add(tileKey(tx, ty));
          }
        }
      }
    }
    this.publishInteractiveOccupancy();
  }

  private refreshInteractionOnlyTile(tx: number, ty: number): void {
    const key = tileKey(tx, ty);
    const trees = this.world.getFarmTrees();
    if (trees?.blocksTilling(tx, ty)) this.interactionOnlyOccupancy.add(key);
    else this.interactionOnlyOccupancy.delete(key);
    this.publishInteractiveOccupancy();
  }

  private publishInteractiveOccupancy(): void {
    this.interactiveOccupancy = buildScatterOccupancy(
      {
        'hard-obstacle': this.obstacleTiles,
        'soft-obstacle': this.softOccupancy,
        'interaction-only': this.interactionOnlyOccupancy,
        reservation: this.fixtureReservations,
        paths: this.pathOccupancy,
      },
      { 'hard-obstacle': 1, 'interaction-only': 1, paths: 1 },
    );
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
      if (occupied) this.softOccupancy.add(key);
      else this.softOccupancy.delete(key);
    }
    this.publishInteractiveOccupancy();
  }

  private syncBuildings(): void {
    if (this.homesteadRoot) {
      this.homesteadRoot.removeFromParent();
      disposeModelClone(this.homesteadRoot);
    }
    this.homesteadRoot = null;
    for (const rendered of this.buildingRoots.values()) disposeRenderedRoot(rendered);
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
      const authored = def.authoredVisual ? buildAuthoredVisual(def.authoredVisual) : null;
      const root = authored ?? (def.modelKey ? cloneModel(def.modelKey).root : null);
      if (!root) return;
      root.name = `placed_${placed.id}_${index}`;
      root.position.set(placed.x, this.world.heightAt(placed.x, placed.z), placed.z);
      root.rotation.y = normalizeOrientation(placed.rotation) * Math.PI / 2;
      if (def.gate && placed.gateOpen) root.rotation.y += Math.PI / 2;
      this.world.getFarmActors().add(root);
      this.buildingRoots.set(`${index}:${placed.id}`, { root, owned: authored !== null });
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
      this.audio.playEvent('merchant');
      this.persist();
      this.pushHud(true);
    } else this.recordOutcome('sale', 'rejected');
  }

  private afterSale(id: ItemId, earned: number): void {
    this.recordOutcome('sale', 'completed');
    this.runtimeMetrics.recordSale(earned);
    setToast(this.gs, `Sold ${itemInfo(id).name} · +${earned}₫`, 1.5);
    this.popup(`+${earned}₫`, this.playerX, this.playerZ);
    this.audio.playEvent('merchant');
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
    if (!this.buildingMode && !this.nearMerchant && !this.placement.activeDeedAssetId) {
      setToast(this.gs, 'Visit the Traveling Merchant to buy building deeds', 2);
      return;
    }
    if (!this.buildingMode && this.nearMerchant && !this.placement.activeDeedAssetId) {
      this.openVendor();
      return;
    }
    const opening = !this.buildingMode;
    if (opening) {
      this.helpOpen = false;
      this.codexOpen = false;
      this.codexCompareKeys = [];
      this.vendorOpen = false;
      this.vendorMessage = '';
      this.gs.inventoryOpen = false;
      this.demolishMode = false;
      this.resetContextMenuState();
    }
    this.buildingMode = opening;
    this.clearInputState();
    this.syncActionMenuState();
    this.toolMode = 'farm';
    this.cancelPlayerActions();
    this.clearShots();
    this.gs.toolSlotActive = false;
    this.equipment.refresh(this.gs);
    setToast(
      this.gs,
      this.buildingMode
        ? `Build mode · choose a structure, then click or use ${this.inputLabel('primary')} on clear ground`
        : 'Build mode off',
      1.6,
    );
    this.pushHud(true);
  }

  selectBuild(index: number): void {
    if (!this.placement.select(index)) return;
    if (!this.buildingMode) {
      this.buildingMode = true;
      this.clearInputState();
      this.syncActionMenuState();
    }
    this.toolMode = 'farm';
    setToast(this.gs, `Build: ${PLACEABLE_BUILDINGS[index]!.name}`, 1.2);
    this.pushHud(true);
  }

  toggleHelp(): void {
    const opening = !this.helpOpen;
    if (opening) {
      this.codexOpen = false;
      this.codexCompareKeys = [];
      this.vendorOpen = false;
      this.vendorMessage = '';
      this.buildingMode = false;
      this.placement.clear();
      this.demolishMode = false;
      this.gs.inventoryOpen = false;
      this.resetContextMenuState();
      this.cancelPlayerActions();
      this.clearShots();
    }
    this.helpOpen = opening;
    this.clearInputState();
    if (opening) {
      this.velX = 0;
      this.velZ = 0;
    }
    this.syncActionMenuState();
    this.pushHud(true);
  }

  toggleCodex(): void {
    if (this.codexOpen) {
      this.codexOpen = false;
      this.clearInputState();
      this.syncActionMenuState();
      this.pushHud(true);
      return;
    }
    this.codexOpen = true;
    this.helpOpen = false;
    this.vendorOpen = false;
    this.vendorMessage = '';
    this.buildingMode = false;
    this.placement.clear();
    this.demolishMode = false;
    this.gs.inventoryOpen = false;
    this.closeContextMenu();
    this.cancelPlayerActions();
    this.clearShots();
    this.velX = 0;
    this.velZ = 0;
    const catalog = buildCodexCatalog(this.gs.codex);
    const first = catalog[0];
    if (!this.codexSelectedKey || !catalog.some((entry) => entry.key === this.codexSelectedKey)) {
      this.codexSelectedKey = first?.key ?? null;
    }
    this.codexCompareKeys = [];
    this.clearInputState();
    this.syncActionMenuState();
    this.pushHud(true);
  }

  selectCodexEntry(key: string): void {
    const catalog = buildCodexCatalog(this.gs.codex);
    if (!this.codexOpen || !catalog.some((entry) => entry.key === key)) return;
    this.codexSelectedKey = key;
    this.pushHud(true);
  }

  toggleCodexCompare(key: string): void {
    if (!this.codexOpen) return;
    const entry = buildCodexCatalog(this.gs.codex).find((candidate) => candidate.key === key);
    if (!entry || entry.kind !== 'discovered') return;
    const index = this.codexCompareKeys.indexOf(key);
    if (index >= 0) {
      this.codexCompareKeys.splice(index, 1);
    } else if (this.codexCompareKeys.length >= 2) {
      setToast(this.gs, 'Compare up to two discovered seeds', 1.6);
    } else {
      this.codexCompareKeys.push(key);
    }
    this.pushHud(true);
  }

  toggleInventory(): void {
    const opening = !this.gs.inventoryOpen;
    if (opening) {
      this.helpOpen = false;
      this.codexOpen = false;
      this.codexCompareKeys = [];
      this.vendorOpen = false;
      this.vendorMessage = '';
      this.buildingMode = false;
      this.placement.clear();
      this.demolishMode = false;
      this.resetContextMenuState();
      this.cancelPlayerActions();
      this.clearShots();
      this.velX = 0;
      this.velZ = 0;
    }
    this.gs.inventoryOpen = opening;
    this.clearInputState();
    this.syncActionMenuState();
    this.pushHud(true);
  }

  toggleSettings(): void {
    if (this.settingsOpen) {
      this.settingsOpen = false;
      this.clearInputState();
      this.syncActionMenuState();
      this.pushHud(true);
      return;
    }

    this.pauseOpen = true;
    this.settingsOpen = true;
    this.helpOpen = false;
    this.codexOpen = false;
    this.codexCompareKeys = [];
    this.vendorOpen = false;
    this.vendorMessage = '';
    this.buildingMode = false;
    this.placement.clear();
    this.world.setBuildPreview(null);
    this.demolishMode = false;
    this.gs.inventoryOpen = false;
    this.resetContextMenuState();
    this.cancelPlayerActions();
    this.clearShots();
    this.velX = 0;
    this.velZ = 0;
    this.clearInputState();
    this.syncActionMenuState();
    this.pushHud(true);
  }

  updateSetting(key: GameSettingKey, value: GameSettingValue): void {
    const next = updateGameSetting(this.settings, key, value);
    this.settings = next;
    this.applyPresentationSettings();
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, serializeGameSettings(next));
    } catch {
      // Device preferences are optional; the current session remains usable.
    }
    this.pushHud(true);
  }

  resetSettings(): void {
    this.settings = resetGameSettings();
    this.applyPresentationSettings();
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, serializeGameSettings(this.settings));
    } catch {
      // Device preferences are optional.
    }
    this.setToastForSettings('Settings restored to defaults');
    this.pushHud(true);
  }

  rebindInput(action: InputAction, code: string): void {
    const result = rebindInputBinding(this.input.getBindings(), action, code);
    if (!result.ok) {
      setToast(this.gs, result.reason, 2.2);
      this.pushHud(true);
      return;
    }
    this.input.setBindings(result.bindings);
    localStorage.setItem(INPUT_BINDINGS_STORAGE_KEY, serializeInputBindings(result.bindings));
    const label = INPUT_BINDING_DEFINITIONS.find((definition) => definition.action === action)?.label ?? action;
    const summary = result.swappedWith
      ? `${label} → ${formatKeyCode(result.bindings[action])} · another action moved to ${formatKeyCode(result.bindings[result.swappedWith])}`
      : `${label} → ${formatKeyCode(result.bindings[action])}`;
    setToast(this.gs, `Control remapped · ${summary}`, 2.4);
    this.pushHud(true);
  }

  resetInputBindings(): void {
    const defaults = resetInputBindings();
    this.input.setBindings(defaults);
    localStorage.setItem(INPUT_BINDINGS_STORAGE_KEY, serializeInputBindings(defaults));
    setToast(this.gs, 'Keyboard controls restored to defaults', 2);
    this.pushHud(true);
  }

  private setToastForSettings(message: string): void {
    if (!this.gs) return;
    setToast(this.gs, message, 1.8);
  }

  private showAudioCaption(caption: string): void {
    if (!this.gs) return;
    setToast(this.gs, caption, 1.2);
    this.pushHud(true);
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
    if (
      this.firstPlotGuideActive &&
      firstPlotStage(this.gs.tiles, this.gs.stats.cropsHarvested, this.gs.duckettes) === 'complete'
    ) {
      this.firstTenMinuteMerchantSeen = true;
    }
    this.vendorMessage = '';
    this.helpOpen = false;
    this.codexOpen = false;
    this.codexCompareKeys = [];
    this.buildingMode = false;
    this.placement.clear();
    this.demolishMode = false;
    this.gs.inventoryOpen = false;
    this.clearInputState();
    this.closeContextMenu();
    this.cancelPlayerActions();
    this.velX = 0;
    this.velZ = 0;
    this.syncActionMenuState();
    this.audio.playEvent('merchant');
    this.pushHud(true);
  }

  closeVendor(): void {
    this.vendorOpen = false;
    this.vendorMessage = '';
    this.clearInputState();
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
      this.audio.playEvent('ui-error');
      return;
    }
    const asset = assetDefinition(id);
    if (!asset || !isVendorAsset(asset)) {
      this.recordOutcome('purchase', 'rejected');
      this.audio.playEvent('ui-error');
      return;
    }
    const result = purchaseAsset(this.gs, asset, this.economyCapability);
    if (!result.ok) {
      this.recordOutcome('purchase', 'rejected');
      this.vendorMessage = `Cannot buy ${asset.displayName}: ${result.quote.reasons.join(' · ')}`;
      this.audio.playEvent('ui-error');
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
    this.vendorMessage = `${asset.displayName} ${asset.progression ? 'permit' : 'deed'} added to inventory${spentSummary}`;
    this.recordOutcome('purchase', 'completed');
    this.audio.playEvent('merchant');
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
    if (asset.progression) {
      const progressionReason = progressionLockReason(asset.progression, this.gs);
      if (progressionReason) {
        setToast(this.gs, progressionReason, 1.8);
        this.pushHud(true);
        return;
      }
      if (!takeFromInventory(this.gs, id, 1)) return;
      if (asset.progression.kind === 'irrigation') {
        this.gs.irrigationTier = asset.progression.targetTier;
        this.recordAction('upgrade_irrigation');
        setToast(this.gs, 'Irrigation upgraded · bucket water is no longer consumed', 2.2);
      } else {
        this.gs.homesteadTier = asset.progression.targetTier;
        this.runtimeMetrics.recordUpgrade(this.gs.simTime);
        const unlocked = asset.progression.targetTier === 2
          ? unlockWeapon(this.gs, 'bow')
          : asset.progression.targetTier === 3
            ? unlockWeapon(this.gs, 'axe')
            : false;
        this.syncBuildings();
        setToast(
          this.gs,
          unlocked
            ? `Homestead tier ${this.gs.homesteadTier} · new weapon: ${this.gs.unlockedWeapons[this.gs.unlockedWeapons.length - 1]}`
            : `Homestead tier ${this.gs.homesteadTier}`,
          2.4,
        );
        this.presentFeel('upgrade-reward', HOMESTEAD_X, HOMESTEAD_Z);
      }
      this.persist();
      this.pushHud(true);
      return;
    }
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
    this.clearInputState();
    this.syncActionMenuState();
    this.cancelPlayerActions();
    this.clearShots();
    setToast(this.gs, `${asset.displayName} placement · ${this.inputLabel('rotateOrCycle')}/${this.inputLabel('secondary')} rotates · ${this.inputLabel('primary')} or click places · ${this.inputLabel('pause')} cancels`, 2);
    this.pushHud(true);
  }

  private rotatePlacement(): void {
    if (!this.buildingMode || !this.placement.activeDeedAssetId) return;
    this.placement.rotate();
    this.pushHud(true);
  }

  private cancelActiveState(): void {
    this.clearInputState();
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
      this.syncActionMenuState();
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
    if (this.codexOpen) {
      this.codexOpen = false;
      this.codexCompareKeys = [];
      this.syncActionMenuState();
      this.pushHud(true);
      return;
    }
    if (this.helpOpen) {
      this.helpOpen = false;
      this.syncActionMenuState();
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
    this.clearInputState();
    this.syncActionMenuState();
    this.pushHud(true);
  }

  closeContextMenu(): void {
    this.resetContextMenuState();
    this.clearInputState();
    this.syncActionMenuState();
    this.pushHud(true);
  }

  private resetContextMenuState(): void {
    this.contextMenu = {
      open: false,
      x: 0,
      y: 0,
      name: '',
      placedIndex: -1,
      gate: false,
      gateOpen: false,
    };
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
    this.clearInputState();
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
      terrainAllowed: (tx, ty) => this.canPlaceOnTile(tx, ty),
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
    const previousSeedCapacity = seedPacketCapacity(this.gs.placedBuildings);
    this.gateCloseTimers.delete(placed);
    this.gs.placedBuildings.splice(index, 1);
    addToInventory(this.gs, deed, 1);
    this.refreshObstacleTopology();
    this.refreshTrenchWater();
    this.syncBuildings();
    this.syncWorldTiles();
    this.recalculateEnclosure();
    this.persist();
    const nextSeedCapacity = seedPacketCapacity(this.gs.placedBuildings);
    const functionNote = asset.id === 'silo'
      ? ` · seed storage ${previousSeedCapacity}→${nextSeedCapacity}`
      : asset.id === 'water_tower'
        ? ' · local water source removed'
        : '';
    setToast(this.gs, `${asset.displayName} demolished · deed returned${functionNote}`, 1.8);
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

  private clearInputState(): void {
    this.input.clearInteractionState();
  }

  private applyPresentationSettings(): void {
    this.reducedMotion = this.settings.reducedMotion;
    this.audio.setVolumes(this.settings);
    this.audio.setMuted(this.settings.muted);
    this.world?.setReducedMotion(this.settings.reducedMotion);
    this.world?.setCameraShakeEnabled(this.settings.cameraShake);
    this.playerActions?.setReducedMotion(this.settings.reducedMotion);
    try {
      localStorage.setItem('tarnation.reducedMotion', this.settings.reducedMotion ? '1' : '0');
    } catch {
      // Device preferences are optional.
    }
  }

  private syncActionMenuState(): void {
    // Placement remains outside the menu state so the fixed-step action boundary
    // can commit a clicked building while the world itself is paused.
    const menuOpen =
      this.pauseOpen ||
      this.helpOpen ||
      this.codexOpen ||
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
    } else if (event.type === ACTION_IMPACT_PHASES[event.kind]) {
      if (event.kind === 'ranged') pending.onFire?.();
      else pending.onContact?.();
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
    this.playerActions.updateLocomotion(this.movementIntent, speed, this.equipment.animationProfile);

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
    this.playerHeading = approachHeading(
      this.playerHeading,
      this.headingTarget,
      LOCOMOTION_GAIT.turnRate * dt,
    );
    this.playerTargetQuaternion.setFromAxisAngle(this.playerUp, this.playerHeading);
    this.playerRoot.quaternion.copy(this.playerTargetQuaternion);
    this.equipment.update(dt);

    this.world.render();
    this.input.endFrame();
    this.pushHud(false);
  };

  private handleHotkeys(): boolean {
    if (this.settlementCelebrated && !this.winShownLocal) {
      if (this.input.justPressed('pause')) this.dismissWin();
      return true;
    }
    if (this.settingsOpen) {
      if (this.input.justPressed('pause')) this.toggleSettings();
      return true;
    }
    if (this.pauseOpen) {
      if (this.input.justPressed('pause')) this.cancelActiveState();
      return true;
    }
    if (this.helpOpen) {
      if (this.input.justPressed('pause') || this.input.justPressed('help')) this.cancelActiveState();
      return true;
    }
    if (this.codexOpen) {
      if (this.input.justPressed('pause') || this.input.justPressed('codex')) this.cancelActiveState();
      return true;
    }
    if (this.vendorOpen) {
      if (this.input.justPressed('pause')) this.cancelActiveState();
      return true;
    }
    if (this.gs.inventoryOpen) {
      if (this.input.justPressed('pause') || this.input.justPressed('inventory')) this.cancelActiveState();
      return true;
    }
    if (this.contextMenu.open) {
      if (this.input.justPressed('pause') || this.input.justPressed('context')) this.cancelActiveState();
      return true;
    }
    if (this.buildingMode) {
      if (this.input.justPressed('pause') || this.input.justPressed('build')) {
        this.cancelActiveState();
        return true;
      }
      if (this.input.justPressed('rotateOrCycle')) this.rotatePlacement();
      if (this.input.justPressed('nextBuild')) {
        const nextIndex = (this.placement.currentIndex + 1) % PLACEABLE_BUILDINGS.length;
        this.placement.select(nextIndex);
        setToast(this.gs, `Build: ${PLACEABLE_BUILDINGS[nextIndex]!.name}`, 1.2);
      }
      return false;
    }
    if (this.input.justPressed('codex')) {
      this.toggleCodex();
      return true;
    }
    const slotActions: readonly InputAction[] = ['slot1', 'slot2', 'slot3'];
    for (const [i, action] of slotActions.entries()) {
      if (!this.input.justPressed(action)) continue;
      this.selectSlot(i);
      const def = TOOLBAR[i]!;
      setToast(this.gs, def.empty ? `Slot ${i + 1} — empty` : def.name, 1.2);
    }
    if (this.input.justPressed('toolSlot')) {
      this.selectToolSlot();
      setToast(this.gs, `Bucket · ${this.gs.bucketFill}/${BUCKET_CAPACITY}`, 1.2);
    }
    if (this.input.justPressed('ultimate')) this.useUltimate();
    if (this.input.justPressed('bearTrap')) this.useBearTrap();
    if (this.input.justPressed('inventory')) {
      this.toggleInventory();
      return true;
    }
    if (this.input.justPressed('help')) {
      this.toggleHelp();
      return true;
    }
    if (this.input.justPressed('context') && !this.buildingMode && !this.demolishMode) {
      if (!this.openPlacedContext()) setToast(this.gs, 'Point at a placed asset to open its context', 1.4);
    }
    if (this.input.justPressed('rotateOrCycle')) {
      cycleWeapon(this.gs);
      this.gs.toolbarSlot = this.gs.weapon === 'axe' ? SLOT_AXE : SLOT_SHOTGUN;
      this.gs.toolSlotActive = false;
      this.equipment.refresh(this.gs);
      setToast(this.gs, `Weapon: ${this.gs.weapon}`, 1.2);
    }
    if (this.input.justPressed('mute')) {
      const muted = this.audio.toggleMuted();
      this.updateSetting('muted', muted);
      setToast(this.gs, muted ? 'Sound muted' : 'Sound on', 1.4);
      if (!muted) this.audio.play('ui');
    }
    if (this.input.justPressed('demolish')) {
      this.demolishMode = !this.demolishMode;
      this.buildingMode = false;
      this.placement.clear();
      this.closeContextMenu();
      setToast(this.gs, this.demolishMode ? `Demolish mode · ${this.inputLabel('primary')} or click an asset · ${this.inputLabel('pause')} exits` : 'Demolish mode off', 1.6);
    }
    if (this.input.justPressed('zoomIn')) {
      const zoom = this.world.adjustZoom(0.1);
      setToast(this.gs, `Camera zoom ${zoom.toFixed(1)}×`, 1.2);
    }
    if (this.input.justPressed('zoomOut')) {
      const zoom = this.world.adjustZoom(-0.1);
      setToast(this.gs, `Camera zoom ${zoom.toFixed(1)}×`, 1.2);
    }
    if (this.input.justPressed('reducedMotion')) {
      this.updateSetting('reducedMotion', !this.settings.reducedMotion);
      setToast(this.gs, this.settings.reducedMotion ? 'Reduced motion on' : 'Reduced motion off', 1.6);
    }
    if (this.input.justPressed('build')) {
      this.toggleBuildMode();
      return true;
    }

    if (this.input.justPressed('seedPrevious')) {
      cycleSeed(this.gs, -1);
      const s = selectedSeed(this.gs);
      const packet = selectedSeedPacket(this.gs);
      if (s) setToast(this.gs, `Seed: ${s.displayName} ×${packet?.count ?? 0}`, 1.2);
    }
    if (this.input.justPressed('seedNext')) {
      cycleSeed(this.gs, 1);
      const s = selectedSeed(this.gs);
      const packet = selectedSeedPacket(this.gs);
      if (s) setToast(this.gs, `Seed: ${s.displayName} ×${packet?.count ?? 0}`, 1.2);
    }

    if (this.input.justPressed('pause')) {
      this.cancelActiveState();
      return true;
    }

    const structure: [InputAction, ToolMode, string][] = [
      ['trench', 'trench', 'Irrigation trench selected'],
      ['breed', 'breed', 'Breeding bed selected'],
    ];
    for (const [action, mode, label] of structure) {
      if (!this.input.justPressed(action)) continue;
      this.selectSlot(SLOT_SHOVEL);
      this.toolMode = mode;
      setToast(this.gs, label, 1.2);
    }
    return false;
  }

  private update(dt: number): void {
    if (this.handleHotkeys()) {
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
      return;
    }
    if (this.actionState.currentState === 'disabled') {
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
      return;
    }
    if (this.helpOpen) {
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
      return;
    }
    if (this.codexOpen) {
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
      return;
    }
    if (this.pauseOpen) {
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
      return;
    }
    if (this.gs.inventoryOpen) {
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
      return;
    }
    if (this.contextMenu.open) {
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
      return;
    }
    this.presentationTimeline.advance(dt);
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

    this.nearWaterTower = waterTowerProvidesWater(this.gs.placedBuildings, this.playerX, this.playerZ);
    this.nearWater =
      this.world.distToWater(this.playerX, this.playerZ) <= WATER_COLLECT_RANGE || this.nearWaterTower;
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY && this.input.justPressed('interact')) {
      fillBucket(this.gs);
      this.recordAction('fill_bucket');
      setToast(this.gs, `Bucket filled (${this.gs.bucketFill}/${BUCKET_CAPACITY})`, 2);
    }

    this.nearMarket =
      Math.hypot(this.playerX - this.stallX, this.playerZ - this.stallZ) <= MARKET_RANGE;
    this.nearMerchant =
      Math.hypot(this.playerX - this.merchantX, this.playerZ - this.merchantZ) <= MARKET_RANGE;
    this.stepGateTimers(dt);
    if (this.nearMerchant && this.input.justPressed('interact')) this.openVendor();
    if (this.vendorOpen && !this.nearMerchant) {
      this.vendorOpen = false;
      this.vendorMessage = '';
      setToast(this.gs, 'You walked away from the Traveling Merchant', 1.5);
    }
    if (this.vendorOpen) {
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
      return;
    }

    // The build catalog pauses the world, but placement confirmation still
    // needs one fixed-step action boundary for its commit callback.
    if (this.buildingMode) {
      this.interaction.process({
        buildingMode: true,
        demolishMode: false,
        toolSlotActive: this.gs.toolSlotActive,
        toolbarSlot: this.gs.toolbarSlot,
      });
      this.actionState.advance(dt);
      this.flushActionEvents();
      this.velX = 0;
      this.velZ = 0;
      this.movementIntent = false;
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
    this.world.setPortableLightActive(this.hasPortableLightSource());
    this.world.applyDayNight(this.gs.clock.phase, this.gs.clock.t);

    if (shouldTelegraphRaid(this.gs.clock, this.raidWarningDay)) {
      this.raidWarningDay = this.gs.clock.day;
      setToast(this.gs, RAID_TELEGRAPH, 4);
    }

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
      if (this.reducedMotion) {
        c.root.scale.setScalar(c.baseScale);
      } else {
        const s = c.root.scale.x;
        const target = c.baseScale * (1 + Math.sin(this.gs.simTime * 1.1 + c.tx) * 0.015);
        c.root.scale.setScalar(
          THREE.MathUtils.lerp(s, target, 0.08),
        );
      }
    }

    if (clock.becameNight) {
      this.audio.setPhase('night');
      this.audio.playEvent('day-transition');
      setToast(this.gs, 'Night falls. Defend the crops!', 3);
      this.spawnRaid();
      this.persist();
    }
    if (clock.becameDay) {
      this.audio.setPhase('day');
      this.audio.playEvent('day-transition');
      this.runtimeMetrics.setDaysReached(this.gs.clock.day);
      this.clearFoxes();
      this.clearDeathMarkers();
      this.clearLootMarkers();
      this.clearFeedbackBursts();
      const { lostTilth, regrown, seedReserveAdded } = onNewDay(this.gs);
      this.refreshCropTargetsFromTiles();
      const dayNotes = [`Day ${this.gs.clock.day}`];
      if (lostTilth.length) dayNotes.push(`${lostTilth.length} bare plots went back to grass`);
      if (this.gs.clock.day === 2) dayNotes.push(dayTwoChoiceHint());
      if (seedReserveAdded) dayNotes.push('reserve Grass seed restored');
      setToast(this.gs, dayNotes.join(' · '), 4);
      if (lostTilth.length || regrown.length) {
        this.world.getFarmTrees()?.rebuildAll();
        this.world.markShadowsDirty();
      }
      this.syncWorldTiles();
      this.persist();
    }
  }

  private maybeShowSettlementGoal(): void {
    if (!checkWin(this.gs)) return;
    if (!this.runtimeMetrics.hasCompleted('settlement_goal')) {
      this.recordOutcome('settlement_goal', 'completed');
    }
    if (this.settlementCelebrated) return;
    this.settlementCelebrated = true;
    this.winShownLocal = false;
    this.pauseOpen = true;
    this.clearInputState();
    this.syncActionMenuState();
    setToast(this.gs, 'Homestead established · all four pillars are yours', 4);
    this.presentFeel('settlement-reward', this.playerX, this.playerZ);
    this.persist();
  }

  private movePlayer(dt: number, minX: number, maxX: number, minZ: number, maxZ: number): void {
    const previousX = this.playerX;
    const previousZ = this.playerZ;
    const stick = this.input.getMoveStick();
    this.movementIntent = Math.hypot(stick.x, stick.y) > 1e-6;
    this.actionState.setMovementIntent(this.movementIntent);
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
      const aimLocksHeading =
        this.actionState.currentState === 'ranged_aim' ||
        this.actionState.currentState === 'ranged_fire';
      if (!aimLocksHeading) this.headingTarget = Math.atan2(wishX, wishZ);
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
    if (
      this.firstPlotGuideActive &&
      Math.hypot(this.playerX - previousX, this.playerZ - previousZ) > 1e-5
    ) {
      this.firstTenMinuteMovementStarted = true;
    }
  }

  private worldToFarmTile(wx: number, wz: number): { tx: number; ty: number } | null {
    const { tx, ty } = worldToTile(wx, wz, 1);
    if (tx < 0 || ty < 0 || tx >= GRID_W || ty >= GRID_H) return null;
    return { tx, ty };
  }

  /** One live ricochet crop arms every projectile fired from nearby. */
  private ricochetChargesForPlayer(): number {
    const tile = this.worldToFarmTile(this.playerX, this.playerZ);
    return tile && hasRicochetNearby(this.gs.tiles, tile.tx, tile.ty, RICOCHET_RADIUS) ? 1 : 0;
  }

  /** Portable light is derived from the held packet or a nearby live crop. */
  private hasPortableLightSource(): boolean {
    const selected = selectedSeed(this.gs);
    if (selected?.mech === 'portable_light') return true;
    const tile = this.worldToFarmTile(this.playerX, this.playerZ);
    return tile
      ? hasPortableLightNearby(this.gs.tiles, tile.tx, tile.ty, PORTABLE_LIGHT_RADIUS)
      : false;
  }

  private farmTileWorld(tx: number, ty: number): { x: number; z: number } {
    const c = tileCenter(tx, ty, 1);
    return { x: c.x, z: c.y };
  }

  /** Recompute visible trench flow from the live world water boundary. */
  private refreshTrenchWater(): number {
    const sources = trenchSourceTiles(this.gs.tiles, (x, z) => {
      const towerSourceDistance = waterTowerProvidesWater(this.gs.placedBuildings, x, z)
        ? 0
        : Number.POSITIVE_INFINITY;
      return Math.min(this.world.distToWater(x, z), towerSourceDistance);
    });
    return flowTrenchWater(
      this.gs.tiles,
      (x, z) => this.world.heightAt(x, z),
      sources,
    );
  }

  /** Rock, tree, stump or open water — all of them stop a shovel. */
  private tileBlockedForTilling(tx: number, ty: number): boolean {
    if (!isFarmableTile(tx, ty)) return true;
    if (isHomesteadFootprintTile(tx, ty)) return true;
    const trees = this.world.getFarmTrees();
    if (blocksFor('interaction-only', 'tools') && trees?.blocksTilling(tx, ty)) return true;
    const key = tileKey(tx, ty);
    if (blocksFor('reservation', 'tools') && this.fixtureReservations.has(key)) return true;
    if (blocksFor('hard-obstacle', 'tools') && this.obstacleTiles.has(key)) return true;
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
    const current = this.worldToFarmTile(this.playerX, this.playerZ);
    const sameCurrentTile = current !== null && current.tx === tile.tx && current.ty === tile.ty;
    if (this.isWaterPoint(x, z) && !this.isWaterPoint(this.playerX, this.playerZ)) return false;
    if (!blocksFor('hard-obstacle', 'player') || !this.obstacleTiles.has(key)) {
      return true;
    }
    // Save/footprint migrations can occasionally load an actor inside a newly
    // solid tile. Permit motion within that one tile so the player can leave,
    // while still refusing entry into any other obstacle.
    if (sameCurrentTile) return true;
    return this.openGateAt(tile.tx, tile.ty);
  }

  private isWaterPoint(x: number, z: number): boolean {
    return this.world.distToWater(x, z) < 0;
  }

  private refreshWaterObstacleTiles(): void {
    if (this.waterObstacleTilesReady) return;
    for (let ty = 0; ty < GRID_H; ty++) {
      for (let tx = 0; tx < GRID_W; tx++) {
        if (this.isWaterTile(tx, ty)) this.waterObstacleTiles.add(tileKey(tx, ty));
      }
    }
    this.waterObstacleTilesReady = true;
  }

  private refreshWildlifeExitTiles(): void {
    this.wildlifeExitTiles = [];
    const addIfSafe = (tx: number, ty: number): void => {
      if (this.canWildlifeOccupy(tx + 0.5, ty + 0.5)) this.wildlifeExitTiles.push({ tx, ty });
    };
    for (let tx = 0; tx < GRID_W; tx++) {
      addIfSafe(tx, 0);
      addIfSafe(tx, GRID_H - 1);
    }
    for (let ty = 1; ty < GRID_H - 1; ty++) {
      addIfSafe(0, ty);
      addIfSafe(GRID_W - 1, ty);
    }
  }

  private nearestWildlifeExit(x: number, z: number): { tx: number; ty: number; x: number; z: number } | null {
    let best: { tx: number; ty: number; x: number; z: number } | null = null;
    let bestDistance = Infinity;
    for (const tile of this.wildlifeExitTiles) {
      const point = this.farmTileWorld(tile.tx, tile.ty);
      const distance = Math.hypot(x - point.x, z - point.z);
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = { ...tile, x: point.x, z: point.z };
    }
    return best;
  }

  private isWaterTile(tx: number, ty: number): boolean {
    return this.isWaterPoint(tx + 0.5, ty + 0.5);
  }

  /** Continuous actor occupancy keeps wildlife from sliding through a hard tile between grid centers. */
  private canWildlifeOccupy(x: number, z: number): boolean {
    const tile = this.worldToFarmTile(x, z);
    if (!tile || this.isWaterPoint(x, z)) return false;
    return !blocksFor('hard-obstacle', 'wildlife') || !this.obstacleTiles.has(tileKey(tile.tx, tile.ty));
  }

  /** Placement keeps the existing water margin and now also rejects live tree/rock interaction tiles. */
  private canPlaceOnTile(tx: number, ty: number): boolean {
    if (this.world.distToWater(tx + 0.5, ty + 0.5) < 2.5) return false;
    const trees = this.world.getFarmTrees();
    return !blocksFor('interaction-only', 'placement') || !trees || !trees.blocksTilling(tx, ty);
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
      this.presentFeel('gate-open', placed.x, placed.z);
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
      if (!placed || !asset || asset.modelKey === null) {
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
      if (placement.asset && placement.asset.modelKey !== null) {
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

  private placeSelectedBuilding(): void {
    this.recordOutcome('building', 'attempted');
    const placement = this.placement.status();
    const selected = placement.asset;
    if (!selected || !placement.valid || !placement.tile) {
      this.recordOutcome('building', 'rejected');
      this.presentFeel('placement-rejected', placement.x, placement.z);
      setToast(this.gs, placement.reason, 1.6);
      return;
    }
    const deedPlacement = this.placement.activeDeedAssetId !== null;
    const legacyCost = PLACEABLE_BUILDINGS.find((entry) => entry.id === selected.id)?.cost ?? selected.materialCost.wood ?? 0;
    if (deedPlacement && !this.gs.inventory.some((slot) => slot?.id === deedItemId(selected.id))) {
      this.recordOutcome('building', 'rejected');
      setToast(this.gs, `No ${selected.displayName} deed`, 1.6);
      return;
    }
    if (!this.beginInteractAction(() => {
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
      const previousSeedCapacity = seedPacketCapacity(this.gs.placedBuildings);
      placeBuilding(this.gs, selected.id, placement.x, placement.z, placement.rotation, false);
      this.runtimeMetrics.recordBuildingPlaced();
      this.refreshObstacleTopology();
      this.refreshTrenchWater();
      this.syncBuildings();
      this.syncWorldTiles();
      this.recalculateEnclosure();
      this.persist();
      this.presentFeel('placement-confirmed', placement.x, placement.z);
      const nextSeedCapacity = seedPacketCapacity(this.gs.placedBuildings);
      const functionNote = selected.id === 'silo'
        ? ` · seed storage ${previousSeedCapacity}→${nextSeedCapacity}`
        : selected.id === 'water_tower'
          ? ' · local bucket and trench water source active'
          : '';
      setToast(this.gs, `Built ${selected.displayName}${functionNote}`, 1.8);
      this.buildingMode = false;
      this.placement.clear();
      this.pushHud(true);
    }, 'build_preview')) this.recordOutcome('building', 'rejected');
  }

  private useBucket(): void {
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) {
      this.beginProfiledToolAction('bucket', () => {
        fillBucket(this.gs);
        this.recordAction('fill_bucket');
        this.presentFeel('water-contact', this.playerX, this.playerZ);
        setToast(this.gs, `Bucket filled (${this.gs.bucketFill}/${BUCKET_CAPACITY})`, 1.6);
        this.persist();
      });
      return;
    }
    const tilePos = this.pointerTile();
    if (!tilePos) {
      setToast(this.gs, 'Point the bucket at a thirsty crop', 1.4);
      return;
    }
    const { tx, ty } = tilePos;
    if (!isFarmableTile(tx, ty)) {
      setToast(this.gs, 'That ground is outside your homestead', 1.6);
      return;
    }
    const tile = getTile(this.gs.tiles, tx, ty);
    const wc = this.farmTileWorld(tx, ty);
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) {
      setToast(this.gs, 'Move closer to use the bucket', 1.4);
      return;
    }
    if (tile?.state !== 'planted' || tile.watered) {
      setToast(this.gs, tile?.state === 'mature' ? 'Harvest is ready — switch to the shovel' : 'Point at a thirsty crop', 1.4);
      return;
    }
    if (this.gs.irrigationTier < 3 && this.gs.bucketFill <= 0) {
      setToast(this.gs, 'Bucket empty — fill at the river or a creek', 2);
      return;
    }
    this.beginFacingToolAction('bucket', wc.x, wc.z, () => {
      this.waterWithBucket(tx, ty, true);
    });
  }

  private useAxe(): void {
    const tilePos = this.pointerTreeTile() ?? this.pointerTile();
    const trees = this.world.getFarmTrees();
    if (!tilePos || !trees) {
      setToast(this.gs, 'Point at a tree, stump, or boulder', 1.4);
      return;
    }
    const target = classifyAxeTarget({
      tree: trees.hasTree(tilePos.tx, tilePos.ty),
      stump: trees.hasStump(tilePos.tx, tilePos.ty),
      boulder: trees.rockSlot(tilePos.tx, tilePos.ty),
    });
    if (target === 'none') {
      setToast(this.gs, 'Point at a tree, stump, or boulder', 1.4);
      return;
    }
    const wc = this.farmTileWorld(tilePos.tx, tilePos.ty);
    const range = EQUIPMENT_PROFILES.axe.interaction.range ?? TOOL_RANGE;
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > range) {
      setToast(this.gs, 'Move closer to use the axe', 1.4);
      return;
    }
    this.beginFacingToolAction('axe', wc.x, wc.z, () => {
      if (target === 'boulder') {
        this.presentFeel('metal-contact', wc.x, wc.z);
        setToast(this.gs, 'The axe clangs off the boulder', 1.4);
        return;
      }
      if (!this.chopFarmTree(tilePos.tx, tilePos.ty)) {
        setToast(this.gs, 'That tree is no longer in reach', 1.4);
      }
    });
  }

  private useShovel(): void {
    const tilePos = this.pointerTile();
    if (!tilePos) {
      setToast(this.gs, 'Point the shovel at a farm tile', 1.4);
      return;
    }
    const { tx, ty } = tilePos;
    if (!isFarmableTile(tx, ty)) {
      setToast(this.gs, 'That ground is outside your homestead', 1.6);
      return;
    }
    const tile = getTile(this.gs.tiles, tx, ty);
    if (!tile) return;
    const wc = this.farmTileWorld(tx, ty);
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) {
      setToast(this.gs, 'Move closer to work this tile', 1.4);
      return;
    }

    const trees = this.world.getFarmTrees();
    if (trees?.hasTree(tx, ty)) {
      setToast(this.gs, `You need the axe for that (${this.inputLabel('slot3')})`, 1.6);
      return;
    }
    if (trees?.hasStump(tx, ty)) {
      setToast(this.gs, `Clear the stump with the axe (${this.inputLabel('slot3')})`, 1.6);
      return;
    }
    if (trees?.rockSlot(tx, ty)) {
      setToast(this.gs, 'A boulder sits here — nothing will grow', 1.6);
      return;
    }

    if (this.toolMode === 'trench') {
      if (tile.state === 'planted' || tile.state === 'mature' || tile.state === 'breeding') return;
      this.beginFacingToolAction('shovel', wc.x, wc.z, () => {
        if (!digTrench(this.gs.tiles, tx, ty)) return;
        const watered = this.refreshTrenchWater();
        this.syncWorldTiles();
        this.presentFeel('soil-contact', wc.x, wc.z);
        setToast(
          this.gs,
          watered > 0
            ? `Irrigation flow reached ${watered} crop${watered === 1 ? '' : 's'}`
            : 'Dry trench · extend it to open water',
          1.8,
        );
        this.persist();
      });
      return;
    }

    if (this.toolMode === 'breed') {
      if (tile.state === 'tilled') {
        this.beginFacingToolAction('shovel', wc.x, wc.z, () => {
          if (!makeBreedingBed(this.gs.tiles, tx, ty)) return;
          this.syncWorldTiles([{ tx, ty }]);
          this.presentFeel('breeding-bed', wc.x, wc.z);
          setToast(this.gs, 'Breeding bed ready — plant two seeds', 2.5);
          this.persist();
        });
      } else if (tile.state === 'breeding' && tile.breedA && tile.breedB) {
        // A full packet inventory must not consume the breeding bed before the
        // child has somewhere to go. The child is deterministic only after the
        // action commits, so conservatively require one available stack slot.
        if (this.gs.seedInventory.length >= seedPacketCapacity(this.gs.placedBuildings)) {
          setToast(this.gs, 'Seed storage full — harvest or discard a packet', 2);
          return;
        }
        this.beginFacingToolAction('shovel', wc.x, wc.z, () => {
          const parents = clearBreedingParents(this.gs.tiles, tx, ty);
          if (!parents) return;
          const child = crossbreed(parents.a, parents.b, this.gs.rng);
          const wasKnown = this.gs.codex.some((entry) => entry.id === seedId(child));
          if (!addSeedToInventory(this.gs, child)) {
            // The preflight above should make this unreachable, but retain the
            // breeding parents if a future capacity rule changes underneath it.
            const restored = getTile(this.gs.tiles, tx, ty);
            if (restored) {
              restored.breedA = parents.a;
              restored.breedB = parents.b;
              restored.state = 'breeding';
            }
            setToast(this.gs, 'Seed storage full — hybrid not harvested', 2);
            return;
          }
          this.gs.tiles[ty]![tx]!.state = 'tilled';
          this.syncWorldTiles([{ tx, ty }]);
          this.presentFeel(wasKnown ? 'hybrid-reward' : 'hybrid-discovery', wc.x, wc.z);
          setToast(
            this.gs,
            wasKnown ? `Hybrid: ${child.displayName}!` : `New Codex entry: ${child.displayName}!`,
            3.5,
          );
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
      this.beginFacingToolAction('shovel', wc.x, wc.z, () => {
        if (!tillTile(this.gs.tiles, tx, ty, this.gs.clock.day)) return;
        this.recordAction('till');
        this.syncWorldTiles([{ tx, ty }]);
        this.presentFeel('soil-contact', wc.x, wc.z);
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
      if (!this.beginFacingToolAction('shovel', wc.x, wc.z, () => {
        if (!plantSeedPacket(this.gs, tx, ty, seed)) {
          this.recordOutcome('plant', 'rejected');
          setToast(this.gs, 'That seed packet is no longer available', 1.4);
          return;
        }
        this.recordOutcome('plant', 'completed');
        this.runtimeMetrics.recordCropPlanted();
        this.refreshTrenchWater();
        this.syncCropTile(tx, ty);
        this.syncWorldTiles();
        this.presentFeel('soil-contact', wc.x, wc.z);
        this.persist();
      })) this.recordOutcome('plant', 'rejected');
    } else if (tile.state === 'planted' && !tile.watered) {
      setToast(this.gs, 'Use the bucket to water this crop', 1.4);
    } else if (tile.state === 'mature') {
      this.recordOutcome('harvest', 'attempted');
      if (!tile.seed) {
        this.recordOutcome('harvest', 'rejected');
        return;
      }
      const matureSeed = tile.seed;
      const matureItem = cropItem(matureSeed.displayName);
      if (!hasRoomFor(this.gs.inventory, matureItem)) {
        this.recordOutcome('harvest', 'rejected');
        setToast(this.gs, 'Inventory full — make room before harvesting', 2);
        return;
      }
      if (!canStoreSeedPacket(this.gs, matureSeed, SEED_RECOVERY_PER_HARVEST)) {
        this.recordOutcome('harvest', 'rejected');
        setToast(this.gs, 'Seed storage full — harvest or discard a packet', 2);
        return;
      }
      if (!this.beginFacingToolAction('shovel', wc.x, wc.z, () => {
        // Re-check both destinations at the fixed contact event. Harvesting is
        // one transaction: a full produce bag or seed store leaves the crop
        // untouched rather than silently deleting it.
        const current = getTile(this.gs.tiles, tx, ty);
        const currentSeed = current?.seed;
        if (!currentSeed) {
          this.recordOutcome('harvest', 'rejected');
          return;
        }
        const currentItem = cropItem(currentSeed.displayName);
        if (
          !hasRoomFor(this.gs.inventory, currentItem) ||
          !canStoreSeedPacket(this.gs, currentSeed, SEED_RECOVERY_PER_HARVEST)
        ) {
          this.recordOutcome('harvest', 'rejected');
          setToast(this.gs, 'Harvest storage is full', 1.8);
          return;
        }
        const wasKnown = this.gs.codex.some((entry) => entry.id === seedId(currentSeed));
        const res = harvestCropTransaction(this.gs, tx, ty);
        if (res.ok && res.seed) {
          this.recordOutcome('harvest', 'completed');
          this.runtimeMetrics.recordCropHarvested(res.count);
          this.gs.stats.cropsHarvested += res.count;
          this.syncCropTile(tx, ty);
          this.syncWorldTiles([{ tx, ty }]);
          this.popup(`+${res.count} ${res.seed.displayName}`, wc.x, wc.z);
          this.presentFeel(wasKnown ? 'harvest-complete' : 'codex-discovery', wc.x, wc.z);
          if (!wasKnown) setToast(this.gs, `New Codex entry: ${res.seed.displayName}!`, 3.5);
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
      this.presentFeel('water-contact', wc.x, wc.z);
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
        this.presentFeel('wood-contact', wc.x, wc.z);
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
      this.refreshInteractionOnlyTile(tx, ty);
      this.world.markShadowsDirty();
      this.presentFeel('wood-contact', wc.x, wc.z);
      this.popup('+1 Wood', wc.x, wc.z);
      setToast(this.gs, 'Stump cleared · +1 Wood', 1.2);
      this.persist();
      return true;
    }

    if (!trees.hasTree(tx, ty)) return false;

    const chops = (this.treeChops.get(key) ?? 0) + 1;
    this.recordAction('chop');
    this.treeChops.set(key, chops);

    if (chops < FARM_TREE_CHOPS) {
      this.presentFeel('wood-contact', wc.x, wc.z);
      setToast(this.gs, `Chopping… ${chops}/${FARM_TREE_CHOPS}`, 0.8);
      return true;
    }

    this.treeChops.delete(key);
    if (!addToInventory(this.gs, ITEM_WOOD, FARM_TREE_WOOD)) return true;
    markTreeChopped(this.gs, tx, ty);
    trees.invalidateTile(tx, ty);
    this.refreshInteractionOnlyTile(tx, ty);
    this.world.markShadowsDirty();
    this.gs.stats.woodGathered += FARM_TREE_WOOD;
    this.runtimeMetrics.recordTreeFelled();
    this.presentFeel('tree-felled', wc.x, wc.z);
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

  /** Secondary axe input is the explicit combat affordance; left click remains farm work. */
  private useCombatAxe(): void {
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
    this.beginRangedAction('shotgun_2', () => {
      const ricochet = this.ricochetChargesForPlayer();
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
          ricochet,
          dmg: 1,
        });
      }
      if (ricochet > 0) {
        setToast(this.gs, 'Ricochet crop armed · each projectile bounces once', 1.5);
      }
      this.shotCd = SHOTGUN_COOLDOWN;
      this.presentFeel('shotgun-fire', this.playerX + dx * 0.45, this.playerZ + dz * 0.45);
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
    this.beginRangedAction('bow_wooden', () => {
      const ricochet = this.ricochetChargesForPlayer();
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
        ricochet,
        dmg: 2,
      });
      if (ricochet > 0) {
        setToast(this.gs, 'Ricochet crop armed · the arrow bounces once', 1.5);
      }
      this.shotCd = BOW_COOLDOWN;
      this.presentFeel('bow-fire', this.playerX + dx * 0.4, this.playerZ + dz * 0.4);
    });
  }

  private beginProfiledToolAction(profileKey: EquipmentKey, onContact: () => void): boolean {
    const profile = EQUIPMENT_PROFILES[profileKey];
    if (profile.interaction.kind !== 'tool') return false;
    if (!this.actionState.isBusy && this.meleeCd > 0) return false;
    if (!this.actionState.isBusy && this.playerActions.isOneShotRunning) return false;
    const admission = this.actionState.request({
      kind: 'tool',
      timing: equipmentTimingFor(profileKey, 'tool') ?? DEFAULT_TOOL_ACTION_TIMING,
      payload: null,
      bufferable: true,
    });
    if (admission.disposition === 'rejected' || admission.actionId === null) return false;
    this.pendingPlayerActions.set(admission.actionId, {
      clip: equipmentActionClipFor(profileKey),
      onContact,
    });
    this.flushActionEvents();
    return true;
  }

  private beginFacingToolAction(
    profileKey: EquipmentKey,
    targetX: number,
    targetZ: number,
    onContact: () => void,
  ): boolean {
    const targetHeading = headingToTarget(this.playerX, this.playerZ, targetX, targetZ);
    this.headingTarget = targetHeading;
    const interaction = EQUIPMENT_PROFILES[profileKey].interaction;
    const halfAngle = interaction.facingHalfAngle;
    return this.beginProfiledToolAction(profileKey, () => {
      if (interaction.range !== null && Math.hypot(this.playerX - targetX, this.playerZ - targetZ) > interaction.range) {
        setToast(this.gs, 'The target moved out of tool range', 1.4);
        return;
      }
      if (isMeleeContactObstructed(this.playerX, this.playerZ, targetX, targetZ, this.obstacleTiles)) {
        setToast(this.gs, 'An obstacle blocks the target', 1.4);
        return;
      }
      if (!isWithinFacingArc(this.playerHeading, targetHeading, halfAngle)) {
        setToast(this.gs, 'Turn toward the target before making contact', 1.4);
        return;
      }
      onContact();
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

  private beginRangedAction(profileKey: EquipmentKey, onFire: () => void): boolean {
    if (!this.actionState.isBusy && this.playerActions.isOneShotRunning) return false;
    const admission = this.actionState.request({
      kind: 'ranged',
      timing: equipmentTimingFor(profileKey, 'ranged') ?? DEFAULT_RANGED_ACTION_TIMING,
      payload: null,
      bufferable: false,
    });
    if (admission.disposition === 'rejected' || admission.actionId === null) return false;
    this.pendingPlayerActions.set(admission.actionId, {
      clip: equipmentActionClipFor(profileKey),
      onFire,
    });
    this.flushActionEvents();
    return true;
  }

  private beginInteractAction(
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
    this.pendingPlayerActions.set(admission.actionId, {
      clip: equipmentActionClipFor(profileKey),
      onContact,
    });
    this.flushActionEvents();
    return true;
  }

  private meleeTargetForHeading(heading: number): MeleeCandidate<Fox | PlainsAnimal> | null {
    return selectMeleeCandidate<Fox | PlainsAnimal>(
      this.playerX,
      this.playerZ,
      heading,
      MELEE_RANGE,
      MELEE_FACING_HALF_ANGLE,
      [
        ...this.foxes
          .filter((target) => !target.dead)
          .map((target) => ({ kind: 'hostile' as const, target, x: target.x, z: target.z })),
        ...this.animals
          .filter((target) => target.state !== 'hurt')
          .map((target) => ({ kind: 'friendly' as const, target, x: target.x, z: target.z })),
      ],
    );
  }

  private applyMeleeDamage(
    damage: number,
    attackHeading: number,
    candidate: MeleeCandidate<Fox | PlainsAnimal>,
  ): void {
    if (!isWithinFacingArc(this.playerHeading, attackHeading, MELEE_FACING_HALF_ANGLE)) {
      setToast(this.gs, 'Turn toward the target before swinging', 1.4);
      return;
    }
    if (
      !isWithinMeleeContact(
        this.playerX,
        this.playerZ,
        candidate.target.x,
        candidate.target.z,
        attackHeading,
        MELEE_RANGE,
        MELEE_FACING_HALF_ANGLE,
      )
    ) {
      setToast(this.gs, 'The target moved out of melee range', 1.4);
      return;
    }
    if (isMeleeContactObstructed(this.playerX, this.playerZ, candidate.target.x, candidate.target.z, this.obstacleTiles)) {
      setToast(this.gs, 'An obstacle blocks the target', 1.4);
      return;
    }
    if (meleeEffectForTarget(candidate.kind) === 'damage') {
      const fox = candidate.target as Fox;
      if (fox.dead) {
        setToast(this.gs, 'The fox is no longer a target', 1.4);
        return;
      }
      const result = this.damageFox(fox, damage);
      if (result === 'defeated') this.presentFeel('fox-defeat', fox.x, fox.z);
      else if (result === 'hit') this.presentFeel('melee-impact', fox.x, fox.z);
    } else {
      const animal = candidate.target as PlainsAnimal;
      if (this.dazeAnimal(animal)) this.presentFeel('melee-impact', animal.x, animal.z);
    }
  }

  /** Combat swing — selects one intended target inside a facing cone at contact. */
  private meleeSwing(
    damage: number,
    clip: PlayerClip = damage === FIST_DAMAGE ? 'punch' : 'swordSlash',
  ): void {
    const { dx, dz } = this.aimDirection();
    const attackHeading = Math.atan2(dx, dz);
    const candidate = this.meleeTargetForHeading(attackHeading);
    if (!candidate) {
      setToast(this.gs, 'No target in front of you', 1.2);
      return;
    }
    if (isMeleeContactObstructed(this.playerX, this.playerZ, candidate.target.x, candidate.target.z, this.obstacleTiles)) {
      setToast(this.gs, 'An obstacle blocks the target', 1.4);
      return;
    }
    this.beginMeleeAction(clip, () => this.applyMeleeDamage(damage, attackHeading, candidate));
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
        const result = this.damageFox(w, BOULDER_DAMAGE);
        if (result === 'defeated') this.presentFeel('fox-defeat', w.x, w.z);
        else if (result === 'hit') this.presentFeel('projectile-impact', w.x, w.z);
      }
      for (const a of [...this.animals]) {
        if (b.hit.has(a)) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) > BOULDER_RADIUS + 0.4) continue;
        b.hit.add(a);
        if (this.dazeAnimal(a)) this.presentFeel('projectile-impact', a.x, a.z);
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
    return this.beginInteractAction(() => {
      if (!placeBearTrap(this.gs.tiles, tilePos.tx, tilePos.ty)) {
        setToast(this.gs, 'A trap is already here or the ground is occupied', 1.5);
        return;
      }
      this.gs.bearTrapCooldown = BEAR_TRAP_COOLDOWN;
      onPlaced?.();
      this.syncWorldTiles([{ tx: tilePos.tx, ty: tilePos.ty }]);
      this.syncBearTrapModels();
      this.presentFeel('trap-set', wc.x, wc.z);
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
        const result = this.damageFox(w, s.dmg);
        if (result === 'defeated') this.presentFeel('fox-defeat', w.x, w.z);
        else if (result === 'hit') this.presentFeel('projectile-impact', w.x, w.z);
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
          if (this.dazeAnimal(a)) this.presentFeel('projectile-impact', a.x, a.z);
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

  private damageFox(w: Fox, amount: number): FoxDamageResult {
    if (w.dead) return 'ignored';
    this.recordOutcome('fox_defense', 'attempted');
    w.hp -= amount;
    if (w.hp > 0) {
      this.clearFoxTarget(w);
      this.setFoxScale(w, 1.25, 0.64);
      w.state = 'flee';
      this.playFoxAction(w, 'walk');
      return 'hit';
    }
    w.dead = true;
    this.clearFoxTarget(w);
    this.resetFoxTrap(w);
    this.recordOutcome('fox_defense', 'completed', 'fox_felled');
    this.gs.stats.foxesFelled += 1;
    this.runtimeMetrics.recordFoxFelled();
    this.stopMixer(w.actions.mixer, w.root);
    this.spawnDeathMarker(
      w.root,
      w.accessoryRoot,
      w.baseScale,
      w.silhouetteScale,
      w.x,
      w.z,
      w.root.rotation.y,
      'fox',
    );
    w.accessoryRoot = null;
    this.rollTrophy(`fox:${w.kind}`, `${w.kind[0]!.toUpperCase()}${w.kind.slice(1)}`, w.x, w.z);
    // Dead is dead — drop it now rather than waiting for the next sweep.
    this.foxes = this.foxes.filter((o) => !o.dead);
    return 'defeated';
  }

  /** Ambient wildlife is friendly scenery: explicit combat can only daze it. */
  private dazeAnimal(a: PlainsAnimal): boolean {
    if (a.state === 'hurt') return false;
    a.state = 'hurt';
    a.timer = 1.2;
    a.root.scale.set(a.baseScale * 1.1, a.baseScale * 0.9, a.baseScale * 1.1);
    setToast(this.gs, `${a.name} is dazed — wildlife is unharmed`, 1.8);
    return true;
  }

  /** Leave a short-lived, grounded carcass marker instead of making a kill pop. */
  private spawnDeathMarker(
    corpse: THREE.Object3D,
    accessoryRoot: THREE.Object3D | null,
    baseScale: number,
    silhouetteScale: { x: number; y: number; z: number },
    x: number,
    z: number,
    heading: number,
    kind: 'fox',
  ): void {
    corpse.removeFromParent();
    corpse.scale.set(
      baseScale * silhouetteScale.x,
      baseScale * silhouetteScale.y,
      baseScale * silhouetteScale.z,
    );
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
    const patchGeometry = new THREE.CircleGeometry(0.48, 12);
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
      accessoryRoot,
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
    if (marker.accessoryRoot) {
      marker.accessoryRoot.removeFromParent();
      disposeObjectResources(marker.accessoryRoot, { geometries: true, materials: true });
      marker.accessoryRoot = null;
    }
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
      marker.root.position.y = this.world.heightAt(marker.x, marker.z) + 0.18 +
        (this.reducedMotion ? 0 : Math.sin(marker.age * 4.2) * 0.06);
      if (!this.reducedMotion) marker.root.rotation.y += dt * 1.8;
    }
  }

  private nextFeedbackRandom(): number {
    this.feedbackSeed = (this.feedbackSeed * 1664525 + 1013904223) >>> 0;
    return this.feedbackSeed / 0x1_0000_0000;
  }

  /** Small, shared semantic feedback for actions that changed the world. */
  private spawnFeedbackBurst(
    x: number,
    z: number,
    kind: FeedbackKind,
  ): void {
    this.feedbackEffects?.spawn(
      this.world.getFarmActors(),
      (worldX, worldZ) => this.world.heightAt(worldX, worldZ),
      x,
      z,
      kind,
      () => this.nextFeedbackRandom(),
      this.reducedMotion,
    );
  }

  /**
   * Dispatch one fixed-step impact bundle. Action animation starts at the
   * state-machine start event; this keeps contact/fire VFX, audio, camera, and
   * hit pause on the same presentation boundary without touching simulation.
   */
  private presentFeel(event: FeelEvent, x: number, z: number): void {
    const timeline = this.presentationTimeline.trigger(event);
    if (!timeline) return;
    if (timeline.feedback) this.spawnFeedbackBurst(x, z, timeline.feedback);
    if (timeline.audio) this.audio.playEvent(timeline.audio);
    if (timeline.shake) this.world.shake(timeline.shake.duration, timeline.shake.amplitude);
    this.hitPause = Math.max(this.hitPause, timeline.hitPause);
  }

  private clearFeedbackBursts(): void {
    this.feedbackEffects?.clear();
    this.presentationTimeline.clear();
  }

  private stepFeedbackBursts(dt: number): void {
    this.feedbackEffects?.update(dt);
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
    this.raidTelegraphedRoles.clear();
    this.raidRepelUses = 0;
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
      const safeSpawn = this.nearestWildlifeExit(sp.x, sp.y);
      const { root, animations } = cloneModel('fox');
      const profile = foxRoleProfile(sp.kind);
      const x = safeSpawn?.x ?? sp.x;
      const z = safeSpawn?.z ?? sp.y;
      const baseScale = root.scale.x;
      this.styleFoxModel(root, profile);
      const accessoryRoot = this.createFoxAccessory(profile);
      root.add(accessoryRoot);
      root.position.set(x, this.world.heightAt(x, z), z);
      root.scale.set(
        baseScale * profile.silhouetteScale.x * 0.15,
        baseScale * profile.silhouetteScale.y * 0.15,
        baseScale * profile.silhouetteScale.z * 0.15,
      );
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
        silhouetteScale: { ...profile.silhouetteScale },
        accessoryRoot,
        approach: null,
        hp: 1,
        timer: FOX_BURROW_TIME,
        targetTx: -1,
        targetTy: -1,
        raidTarget: null,
        eatTimer: 0,
        dead: false,
        carryingProduce: false,
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
      this.disposeFoxActor(w);
    }
    this.foxes = [];
  }

  private disposeFoxActor(w: Fox): void {
    this.foxDirector.releaseApproach(w);
    if (w.accessoryRoot) {
      w.accessoryRoot.removeFromParent();
      disposeObjectResources(w.accessoryRoot, { geometries: true, materials: true });
      w.accessoryRoot = null;
    }
    w.root.removeFromParent();
    disposeModelClone(w.root);
  }

  private styleFoxModel(root: THREE.Object3D, profile: FoxRoleProfile): void {
    const tint = new THREE.Color(profile.tint);
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const source = Array.isArray(object.material) ? object.material : [object.material];
      const copies = source.map((material) => {
        const copy = markMaterialOwner(material.clone(), 'clone');
        const colored = copy as THREE.Material & { color?: THREE.Color };
        if (colored.color) colored.color.lerp(tint, 0.64);
        return copy;
      });
      disposeCloneOwnedMaterials(source);
      object.material = copies.length === 1 ? copies[0]! : copies;
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }

  private createFoxAccessory(profile: FoxRoleProfile): THREE.Group {
    const group = new THREE.Group();
    group.name = `fox_accessory_${profile.accessory}`;
    const material = (color: number): THREE.MeshStandardMaterial =>
      markMaterialOwner(
        new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.02, flatShading: true }),
        'clone',
      );
    const addMesh = (mesh: THREE.Mesh): void => {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    };

    if (profile.accessory === 'dirt_crest') {
      const geometry = new THREE.ConeGeometry(0.11, 0.24, 5);
      addMesh(new THREE.Mesh(geometry, material(0x6f4934)));
      group.children[0]!.position.set(-0.13, 0.25, 0.13);
      const second = new THREE.Mesh(geometry.clone(), material(0x6f4934));
      second.position.set(0.13, 0.25, 0.13);
      second.rotation.z = -0.25;
      addMesh(second);
    } else if (profile.accessory === 'collar') {
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.025, 6, 12),
        material(0xe0bf61),
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.31;
      addMesh(collar);
    } else if (profile.accessory === 'sapper_pack') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.14), material(0xd48345));
      pack.position.set(0, 0.3, -0.2);
      addMesh(pack);
    } else {
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.12), material(0xc08a52));
      left.position.set(-0.21, 0.25, 0.02);
      addMesh(left);
      const right = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.12), material(0xc08a52));
      right.position.set(0.21, 0.25, 0.02);
      addMesh(right);
    }
    return group;
  }

  private setFoxScale(w: Fox, factor = 1, verticalFactor = 1): void {
    w.root.scale.set(
      w.baseScale * w.silhouetteScale.x * factor,
      w.baseScale * w.silhouetteScale.y * factor * verticalFactor,
      w.baseScale * w.silhouetteScale.z * factor,
    );
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

  private clearFoxTarget(w: Fox): void {
    this.foxDirector.releaseApproach(w);
    w.raidTarget = null;
    w.targetTx = -1;
    w.targetTy = -1;
    w.path = [];
    w.pathGoalKey = '';
    w.pathTimer = 0;
  }

  private assignFoxTarget(w: Fox, crops: readonly { x: number; y: number }[]): boolean {
    const target = selectRaidTarget(w.kind, this.raidTargetCandidates(w, crops));
    if (!target) {
      this.clearFoxTarget(w);
      return false;
    }
    if (!this.foxDirector.reserveApproach(w, target)) {
      this.clearFoxTarget(w);
      return false;
    }
    w.raidTarget = target;
    w.targetTx = target.x;
    w.targetTy = target.y;
    w.path = [];
    w.pathGoalKey = '';
    w.pathTimer = 0;
    this.telegraphFoxRole(w);
    return true;
  }

  private telegraphFoxRole(w: Fox): void {
    if (this.raidTelegraphedRoles.has(w.kind)) return;
    const profile = foxRoleProfile(w.kind);
    this.raidTelegraphedRoles.add(w.kind);
    this.presentFeel('fox-telegraph', w.x, w.z);
    this.audio.playFoxCue(profile.audioCue, {
      x: w.x,
      z: w.z,
      listenerX: this.playerX,
      listenerZ: this.playerZ,
    });
    setToast(this.gs, `${profile.label}: ${profile.telegraph} · Counter: ${profile.counter}`, 3);
  }

  private raidTargetCandidates(w: Fox, crops: readonly { x: number; y: number }[]): RaidTarget[] {
    const candidates: RaidTarget[] = [];
    const distanceTo = (tx: number, ty: number): number => {
      const point = this.farmTileWorld(tx, ty);
      return Math.hypot(w.x - point.x, w.z - point.z);
    };

    for (const crop of crops) {
      candidates.push({
        kind: 'crop',
        x: crop.x,
        y: crop.y,
        distance: distanceTo(crop.x, crop.y),
        exposed: !this.isEnclosed(crop.x, crop.y),
      });
    }

    if (w.kind === 'hauler') {
      const storageTile = this.worldToFarmTile(HOMESTEAD_SPAWN_X, HOMESTEAD_SPAWN_Z);
      if (storageTile) {
        for (const slot of this.gs.inventory) {
          if (!slot || slot.count <= 0 || !slot.id.startsWith('crop:')) continue;
          candidates.push({
            kind: 'stored_produce',
            x: storageTile.tx,
            y: storageTile.ty,
            distance: distanceTo(storageTile.tx, storageTile.ty),
            id: slot.id,
            count: slot.count,
            value: itemInfo(slot.id).price,
          });
        }
      }
    }

    if (w.kind === 'sapper') {
      for (let index = 0; index < this.gs.placedBuildings.length; index++) {
        const placed = this.gs.placedBuildings[index]!;
        const asset = assetDefinition(placed.id);
        if (!asset?.gate || placed.gateOpen) continue;
        const origin = placedOrigin(placed, placed.rotation, asset);
        const center = placedCenter(origin, placed.rotation, asset);
        const tx = Math.floor(center.x);
        const ty = Math.floor(center.z);
        candidates.push({
          kind: 'structure',
          x: tx,
          y: ty,
          distance: distanceTo(tx, ty),
          structure: 'gate',
          index,
        });
      }
      for (let ty = 0; ty < GRID_H; ty++) {
        for (let tx = 0; tx < GRID_W; tx++) {
          const tile = getTile(this.gs.tiles, tx, ty);
          if (tile?.bearTrap && !tile.bearTrapClosed) {
            candidates.push({
              kind: 'structure',
              x: tx,
              y: ty,
              distance: distanceTo(tx, ty),
              structure: 'trap',
              index: -1,
            });
          }
          if (tile?.state === 'trench' && tile.structureHp > 0) {
            candidates.push({
              kind: 'structure',
              x: tx,
              y: ty,
              distance: distanceTo(tx, ty),
              structure: 'trench',
              index: -1,
            });
          }
        }
      }
    }

    return candidates;
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
          this.clearFoxTarget(w);
          w.state = 'trapped';
          w.timer = 5;
          w.trappedTx = bearTrap.tx;
          w.trappedTy = bearTrap.ty;
          w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
          w.root.rotation.y = Math.atan2(this.playerX - w.x, this.playerZ - w.z);
          this.playFoxAction(w, 'idle');
          this.syncWorldTiles([{ tx: bearTrap.tx, ty: bearTrap.ty }]);
          this.syncBearTrapModels();
          this.presentFeel('fox-trapped', w.x, w.z);
          setToast(this.gs, 'Fox caught in the bear trap!', 2.2);
          continue;
        }
      }

      const tpos = this.worldToFarmTile(w.x, w.z);
      if (
        w.state !== 'trapped' &&
        tpos &&
        hasRepelNearby(this.gs.tiles, tpos.tx, tpos.ty, REPEL_FOX_RADIUS) &&
        repellerUsesRemaining(this.raidRepelUses) > 0 &&
        w.state !== 'flee'
      ) {
        this.raidRepelUses += 1;
        this.clearFoxTarget(w);
        w.state = 'flee';
        this.playFoxAction(w, 'walk');
        this.presentFeel('fox-threat', w.x, w.z);
        const remaining = repellerUsesRemaining(this.raidRepelUses);
        setToast(
          this.gs,
          `Repeller crop drove off a fox · ${remaining} repeller use${remaining === 1 ? '' : 's'} left this raid`,
          1.4,
        );
      }

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
        this.setFoxScale(w, 0.15 + 0.85 * Math.min(1, t));
        if (w.timer <= 0) {
          w.state = 'seek';
          this.setFoxScale(w);
          this.playFoxAction(w, 'walk');
          if (!this.assignFoxTarget(w, crops)) w.state = 'flee';
        }
        continue;
      }

      if (w.state === 'seek') {
        this.playFoxAction(w, 'walk');
        if (!w.raidTarget && !this.assignFoxTarget(w, crops)) {
          w.state = 'flee';
          continue;
        }
        const target = w.raidTarget;
        if (!target) {
          w.state = 'flee';
          continue;
        }
        const approach = w.approach;
        if (!approach) {
          this.clearFoxTarget(w);
          w.state = 'flee';
          continue;
        }
        const route = this.foxDirector.moveTowardTile(
          w,
          approach.tx,
          approach.ty,
          this.foxDirector.speedFor(w.kind),
          dt,
        );
        if (!route.hasPath) {
          this.clearFoxTarget(w);
          w.state = 'flee';
          continue;
        }
        if (route.atGoal) {
          if (target.kind === 'stored_produce') {
            if (takeFromInventory(this.gs, target.id, 1)) {
              w.carryingProduce = true;
              setToast(this.gs, foxProduceLossGuidance(itemInfo(target.id).name), 2.8);
              this.recordAction('fox_theft');
              this.audio.play('hit');
              this.persist();
              this.pushHud(true);
            }
            this.clearFoxTarget(w);
            w.state = 'flee';
          } else if (target.kind === 'structure') {
            if (target.structure === 'gate') {
              const placed = this.gs.placedBuildings[target.index];
              const asset = placed ? assetDefinition(placed.id) : null;
              if (placed && asset?.gate && !placed.gateOpen) {
                placed.gateOpen = true;
                this.gateCloseTimers.set(placed, 3.5);
                this.refreshObstacleTopology();
                this.syncBuildings();
                this.recalculateEnclosure();
                this.presentFeel('fox-structure-hit', w.x, w.z);
                setToast(this.gs, 'A sapper forced the gate open', 2.2);
                this.persist();
              }
              this.clearFoxTarget(w);
              w.state = 'flee';
            } else if (target.structure === 'trap') {
              const trap = getTile(this.gs.tiles, target.x, target.y);
              if (!trap?.bearTrap || trap.bearTrapClosed) {
                this.clearFoxTarget(w);
                w.state = 'flee';
              }
              // Leave an active trap target in place. The next fixed step runs
              // the normal trap capture boundary before any fox consequence.
            } else {
              const trench = getTile(this.gs.tiles, target.x, target.y);
              if (trench?.state === 'trench' && trench.structureHp > 0) {
                trench.structureHp -= 1;
                if (trench.structureHp <= 0) {
                  trench.state = 'grass';
                  this.refreshTrenchWater();
                  this.syncWorldTiles([{ tx: target.x, ty: target.y }]);
                  setToast(this.gs, 'A sapper broke a trench', 1.8);
                } else {
                  this.syncWorldTiles([{ tx: target.x, ty: target.y }]);
                  setToast(this.gs, 'A sapper weakened a trench', 1.5);
                }
                this.persist();
              }
              this.clearFoxTarget(w);
              w.state = 'flee';
            }
          } else if (w.kind === 'nibbler') {
            const before = getTile(this.gs.tiles, w.targetTx, w.targetTy);
            const cropName = before?.seed?.displayName ?? 'crop';
            const nibbled = nibbleCrop(this.gs.tiles, w.targetTx, w.targetTy);
            if (nibbled) {
              this.syncCropTile(w.targetTx, w.targetTy);
              const after = getTile(this.gs.tiles, w.targetTx, w.targetTy);
              const cropStillLives = after?.state === 'planted' || after?.state === 'mature';
              setToast(
                this.gs,
                foxCropLossGuidance(w.kind, cropName, cropStillLives ? 'nibbled' : 'destroyed'),
                2.8,
              );
            } else if (getTile(this.gs.tiles, w.targetTx, w.targetTy)?.seed?.mech === 'ironroot') {
              const wc = this.farmTileWorld(w.targetTx, w.targetTy);
              this.spawnFeedbackBurst(wc.x, wc.z, 'damage');
              setToast(this.gs, 'Ironroot resisted the fox bite', 1.5);
            }
            this.syncWorldTiles([{ tx: w.targetTx, ty: w.targetTy }]);
            this.clearFoxTarget(w);
            if (this.gs.rng() < 0.4) w.state = 'flee';
          } else if (w.kind === 'hauler') {
            const before = getTile(this.gs.tiles, w.targetTx, w.targetTy);
            const cropName = before?.seed?.displayName ?? 'crop';
            if (destroyCrop(this.gs.tiles, w.targetTx, w.targetTy)) {
              w.carryingProduce = true;
              this.syncCropTile(w.targetTx, w.targetTy);
              this.syncWorldTiles([{ tx: w.targetTx, ty: w.targetTy }]);
              setToast(this.gs, foxCropLossGuidance(w.kind, cropName, 'taken_before_harvest'), 2.8);
              this.persist();
            } else if (getTile(this.gs.tiles, w.targetTx, w.targetTy)?.seed?.mech === 'ironroot') {
              const wc = this.farmTileWorld(w.targetTx, w.targetTy);
              this.spawnFeedbackBurst(wc.x, wc.z, 'damage');
              setToast(this.gs, 'Ironroot held against the fox', 1.5);
            }
            this.clearFoxTarget(w);
            w.state = 'flee';
          } else {
            w.state = 'eat';
            w.eatTimer = FOX_EAT_TIME;
            this.setFoxScale(w, 1.25, 0.68);
            this.playFoxAction(w, 'attack');
          }
        }
        continue;
      }

      if (w.state === 'eat') {
        this.playFoxAction(w, 'attack');
        w.eatTimer -= dt;
        w.root.scale.y = w.baseScale * w.silhouetteScale.y * (1 + Math.sin(this.gs.simTime * 12) * 0.08);
        if (w.eatTimer <= 0) {
          const before = getTile(this.gs.tiles, w.targetTx, w.targetTy);
          const cropName = before?.seed?.displayName ?? 'crop';
          if (destroyCrop(this.gs.tiles, w.targetTx, w.targetTy)) {
            this.syncCropTile(w.targetTx, w.targetTy);
            setToast(this.gs, foxCropLossGuidance(w.kind, cropName, 'destroyed'), 2.8);
            this.persist();
          } else if (getTile(this.gs.tiles, w.targetTx, w.targetTy)?.seed?.mech === 'ironroot') {
            const wc = this.farmTileWorld(w.targetTx, w.targetTy);
            this.spawnFeedbackBurst(wc.x, wc.z, 'damage');
            setToast(this.gs, 'Ironroot held against the fox', 1.5);
          }
          this.syncWorldTiles([{ tx: w.targetTx, ty: w.targetTy }]);
          this.clearFoxTarget(w);
          w.state = 'flee';
          this.setFoxScale(w);
        }
        continue;
      }

      if (w.state === 'flee') {
        this.playFoxAction(w, 'walk');
        const edge = nearestEdgePoint(w.x, w.z);
        const exit = this.nearestWildlifeExit(edge.x, edge.y);
        if (!exit) continue;
        const sp = this.foxDirector.speedFor(w.kind) * (w.carryingProduce ? 1.15 : 1.3);
        const route = this.foxDirector.moveTowardTile(w, exit.tx, exit.ty, sp, dt);
        const dist = Math.hypot(exit.x - w.x, exit.z - w.z);
        if (route.atGoal || dist < 0.5) {
          w.dead = true;
          this.stopMixer(w.actions.mixer, w.root);
          this.disposeFoxActor(w);
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
      } while (tries < 40 && !this.canWildlifeOccupy(x, z));
      if (!this.canWildlifeOccupy(x, z)) {
        outer: for (let fallbackZ = 4; fallbackZ < WORLD_SIZE - 4; fallbackZ += 4) {
          for (let fallbackX = 4; fallbackX < WORLD_SIZE - 4; fallbackX += 4) {
            if (!this.canWildlifeOccupy(fallbackX + 0.5, fallbackZ + 0.5)) continue;
            x = fallbackX + 0.5;
            z = fallbackZ + 0.5;
            break outer;
          }
        }
      }
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

  /** Move an ambient animal without allowing a continuous step through water or a building. */
  private moveAmbientAnimal(a: PlainsAnimal, dx: number, dz: number, dt: number, speed = a.speed): boolean {
    const distance = Math.hypot(dx, dz);
    if (distance <= 0) return true;
    const stepX = (dx / distance) * speed * dt;
    const stepZ = (dz / distance) * speed * dt;
    const candidates = [
      [a.x + stepX, a.z + stepZ],
      [a.x + stepX, a.z],
      [a.x, a.z + stepZ],
    ] as const;
    for (const [x, z] of candidates) {
      if (!this.canWildlifeOccupy(x, z)) continue;
      a.x = x;
      a.z = z;
      return true;
    }
    a.targetHeading += Math.PI * 0.75;
    a.timer = Math.min(a.timer, 0.8);
    return false;
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
        const fleeSpeed = a.speed * 2.2;
        this.moveAmbientAnimal(a, dx, dz, dt, fleeSpeed);
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
          this.moveAmbientAnimal(a, Math.sin(a.heading), Math.cos(a.heading), dt);
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

  private inputLabel(action: InputAction): string {
    return formatBinding(this.input.getBindings(), action);
  }

  private interactionHint(
    seed: ReturnType<typeof selectedSeed>,
    packet: ReturnType<typeof selectedSeedPacket>,
  ): string {
    const key = (action: InputAction): string => this.inputLabel(action);
    if (this.buildingMode) {
      const selected = this.placement.selectedAsset();
      return `Build: ${selected?.displayName ?? 'asset'} · ${key('rotateOrCycle')}/${key('secondary')} rotate · ${key('primary')} or click place · ${key('pause')} exit`;
    }
    if (this.firstPlotGuideActive) {
      const stage = firstPlotStage(this.gs.tiles, this.gs.stats.cropsHarvested, this.gs.duckettes);
      if (stage !== 'complete' && !this.nearMerchant && !this.nearMarket && !this.nearWater) {
        return formatFirstPlotHint(stage, seed?.displayName, {
          shovel: key('slot2'),
          bucket: key('toolSlot'),
          previousSeed: key('seedPrevious'),
          nextSeed: key('seedNext'),
          primary: key('primary'),
        });
      }
    }
    const arcHint = multiDayArcHint({
      day: this.gs.clock.day,
      cropsHarvested: this.gs.stats.cropsHarvested,
      codex: this.gs.codex,
      placedBuildings: this.gs.placedBuildings,
    });
    if (arcHint && !this.nearMerchant && !this.nearMarket && !this.nearWater) return arcHint;
    if (this.nearMerchant) return `${key('interact')} — open the Traveling Merchant shop`;
    if (this.nearMarket) return 'Market stall — sell for duckettes';
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) {
      return this.nearWaterTower ? `${key('interact')} — fill bucket at the water tower` : `${key('interact')} — fill bucket`;
    }
    if (this.toolMode === 'trench') return 'Irrigation trench selected · point at a homestead tile';
    if (this.toolMode === 'breed') return 'Breeding bed selected · choose a prepared plot';
    if (this.toolMode !== 'farm') return 'Choose a tool and point at the homestead';

    const tile = this.pointerTile();
    if (this.gs.toolSlotActive) {
      const irrigationNote = this.gs.irrigationTier >= 3 ? ' · irrigation active' : '';
      if (!tile) return `${key('toolSlot')} bucket · point at a planted tile to water${irrigationNote}`;
      const target = getTile(this.gs.tiles, tile.tx, tile.ty);
      if (target?.state === 'planted' && !target.watered) return `${key('toolSlot')} bucket · ${key('primary')} or click to water${irrigationNote}`;
      if (target?.state === 'mature') return `Harvest is ready · switch to ${key('slot2')}`;
      return `${key('toolSlot')} bucket · point at a thirsty crop`;
    }

    if (this.gs.toolbarSlot === SLOT_SHOVEL) {
      if (!tile) return `${key('slot2')} shovel · point at a farm tile`;
      const target = getTile(this.gs.tiles, tile.tx, tile.ty);
      const wc = this.farmTileWorld(tile.tx, tile.ty);
      if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) return 'Move closer to work this tile';
      const trees = this.world.getFarmTrees();
      if (trees?.hasTree(tile.tx, tile.ty)) return `Axe required here · switch to ${key('slot3')}`;
      if (trees?.hasStump(tile.tx, tile.ty)) return `Clear the stump with the axe · ${key('slot3')}`;
      if (trees?.rockSlot(tile.tx, tile.ty)) return 'Boulder occupies this tile';
      if (!target) return 'Point at a farm tile';
      if (target.state === 'grass') return `${key('primary')} or click to till this tile`;
      if (target.state === 'tilled' || target.state === 'breeding') {
        return seed
          ? `${key('primary')} or click to plant ${seed.displayName} ×${packet?.count ?? 0} · ${seedTraitDescription(seed)}`
          : 'No seed selected';
      }
      if (target.state === 'planted' && !target.watered) return `Use ${key('toolSlot')} to water this crop`;
      if (target.state === 'mature') return `${key('primary')} or click to harvest`;
    }

    if (this.gs.toolbarSlot === SLOT_AXE) {
      const trees = tile ? this.world.getFarmTrees() : null;
      if (tile && trees?.hasTree(tile.tx, tile.ty)) return `${key('primary')} or click to chop this tree`;
      if (tile && trees?.hasStump(tile.tx, tile.ty)) return `${key('primary')} or click to clear this stump`;
      return `${key('slot3')} axe · ${key('primary')} or click a tree to chop`;
    }

    if (this.gs.toolbarSlot === SLOT_SHOTGUN) return `${key('slot1')} shotgun · ${key('primary')}/click or ${key('secondary')} to fire`;
    return `Explore the homestead · ${key('help')} for the field guide`;
  }

  // ------------------------------------------------------------------- HUD

  private pushHud(force: boolean): void {
    if (!this.gs || !this.hudPresenter.hasListener) return;
    this.maybeShowSettlementGoal();
    const selected = selectedSeed(this.gs);
    const onboarding = this.firstPlotGuideActive
      ? firstTenMinuteGuide({
          movementStarted: this.firstTenMinuteMovementStarted,
          firstPlotStage: firstPlotStage(this.gs.tiles, this.gs.stats.cropsHarvested, this.gs.duckettes),
          merchantSeen: this.firstTenMinuteMerchantSeen,
          seedName: selected?.displayName,
        })
      : null;
    this.hudPresenter.push(force, {
      state: this.gs,
      hint: this.interactionHint(selected, selectedSeedPacket(this.gs)),
      buildingMode: this.buildingMode,
      selectedBuildIndex: this.placement.currentIndex,
      placement: () => {
        const status = this.placement.status();
        return { valid: status.valid, reason: status.reason };
      },
      helpOpen: this.helpOpen,
      settingsOpen: this.settingsOpen,
      settings: this.settings,
      bindings: this.input.getBindings(),
      codexOpen: this.codexOpen,
      codexSelectedKey: this.codexSelectedKey,
      codexCompareKeys: this.codexCompareKeys,
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
      onboarding,
      winShownLocal: this.winShownLocal,
    });
  }
}
