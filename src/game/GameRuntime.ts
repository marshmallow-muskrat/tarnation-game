import * as THREE from 'three';
import {
  AXE_DAMAGE,
  BOULDER_COOLDOWN,
  BOULDER_DAMAGE,
  BOULDER_RADIUS,
  BOULDER_RANGE,
  BOULDER_SPEED,
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
  SHOT_COOLDOWN,
  SHOT_LIFETIME,
  SHOT_SPEED,
  STUMP_CHOPS,
  TOOLBAR_SLOTS,
  TOOL_RANGE,
  WATER_COLLECT_RANGE,
  WEASEL_BURROW_TIME,
  WEASEL_EAT_TIME,
  WEASEL_SPEED,
  WIN_DAY,
  WORLD_SIZE,
} from '../content';
import {
  addSeedToInventory,
  addToInventory,
  checkWin,
  clearStump,
  createGameState,
  cycleSeed,
  fillBucket,
  isStumpCleared,
  isTreeChopped,
  loadFromString,
  markTreeChopped,
  markWinShown,
  onNewDay,
  saveToString,
  selectedSeed,
  sellEverything,
  sellItem,
  setToast,
  stepGameClock,
  takeFromInventory,
  useBucketWater,
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
  placeTrap,
  plantTile,
  tillTile,
  tileCenter,
  waterTile,
  worldToTile,
  cropValueScore,
  totalWeirdness,
} from '../sim/farm';
import { crossbreed } from '../sim/genetics';
import { findItem, occupiedSlots } from '../sim/inventory';
import { cropItem, cropName, itemInfo, ITEM_WOOD, trophyItem, type ItemId } from '../sim/items';
import { rollDrop, TROPHY_ODDS } from '../sim/luck';
import {
  generateWave,
  nearestEdgePoint,
  rollTrapBehaviour,
  trapBehaviourLabel,
  type WeaselType,
} from '../sim/raid';
import { cloneModel, preloadAll, initAssetLoaders } from './Assets';
import { InputController } from './InputController';
import { buildMarketStall } from './MarketStall';
import { WorldRenderer } from './WorldRenderer';

export type HudSlot = {
  id: ItemId | null;
  name: string;
  glyph: string;
  count: number;
  price: number;
  blurb: string;
};

export type HudToolbarSlot = {
  index: number;
  name: string;
  glyph: string;
  selected: boolean;
  empty: boolean;
};

export type HudMarket = {
  open: boolean;
  items: { id: ItemId; name: string; glyph: string; count: number; price: number }[];
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

export type HudSnapshot = {
  day: number;
  phase: 'day' | 'night';
  phaseT: number;
  hint: string;
  inventory: HudSlot[];
  inventoryOpen: boolean;
  duckettes: number;
  toolbar: HudToolbarSlot[];
  toolSlot: { name: string; glyph: string; selected: boolean; fill: number; capacity: number };
  ultimate: { name: string; glyph: string; ready: boolean; cooldown: number; max: number };
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

type WeaselState = 'burrow' | 'seek' | 'eat' | 'flee' | 'trapped';

type Weasel = {
  root: THREE.Object3D;
  x: number;
  z: number;
  state: WeaselState;
  kind: WeaselType;
  hp: number;
  timer: number;
  targetTx: number;
  targetTy: number;
  eatTimer: number;
  dead: boolean;
  haulSeed: boolean;
};

type Shot = {
  mesh: THREE.Mesh;
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
  tx: number;
  ty: number;
  stage: number;
};

type PlainsAnimal = {
  root: THREE.Object3D;
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

type ToolMode = 'farm' | 'trench' | 'breed' | 'trap';

/**
 * Bottom toolbar. Slot 1 is the rock you throw, slot 2 the fist you work the
 * ground with, slot 3 the axe. The bucket has its own water slot, and Boulder
 * Roll its own ultimate slot to the left.
 */
const SLOT_ROCK = 0;
const SLOT_FIST = 1;
const SLOT_AXE = 2;

const TOOLBAR: { name: string; glyph: string; empty: boolean }[] = [
  { name: 'Rock', glyph: '🪨', empty: false },
  { name: 'Fist', glyph: '✊', empty: false },
  { name: 'Axe', glyph: '🪓', empty: false },
  { name: '', glyph: '', empty: true },
  { name: '', glyph: '', empty: true },
];

export class GameRuntime {
  private gs!: GameState;
  private world!: WorldRenderer;
  private input = new InputController();
  private canvas!: HTMLCanvasElement;
  private accum = 0;
  private running = false;
  private raf = 0;

  private playerRoot!: THREE.Object3D;
  private playerMixer: THREE.AnimationMixer | null = null;
  private idleAction: THREE.AnimationAction | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private playerX = WORLD_SIZE / 2;
  private playerZ = WORLD_SIZE / 2;
  private velX = 0;
  private velZ = 0;
  private headingTarget = 0;
  private nearWater = false;
  private toolMode: ToolMode = 'farm';

  private weasels: Weasel[] = [];
  private shots: Shot[] = [];
  private boulders: Boulder[] = [];
  private shotCd = 0;
  private meleeCd = 0;
  private crops: CropActor[] = [];
  private stallRoot: THREE.Object3D | null = null;
  private stallX = 0;
  private stallZ = 0;
  private nearMarket = false;
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

  async mount(canvas: HTMLCanvasElement, onHud: (s: HudSnapshot) => void): Promise<void> {
    this.canvas = canvas;
    this.onHud = onHud;

    // Renderer must exist before preloading: KTX2Loader.detectSupport() needs it.
    this.world = new WorldRenderer(canvas);
    initAssetLoaders(this.world.renderer);
    await preloadAll();

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
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('beforeunload', this.persist);
    this.persist();
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
        animations.find((c) => /walk|run|locomotion/i.test(c.name)) ??
        animations[1] ??
        animations[0]!;
      this.idleAction = this.playerMixer.clipAction(idle);
      this.walkAction = this.playerMixer.clipAction(walk);
      this.idleAction.play();
    }
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
      setToast(this.gs, `Sold everything for ${earned} duckettes`, 2.5);
      this.popup(`+${earned}₫`, this.playerX, this.playerZ);
      this.persist();
      this.pushHud(true);
    }
  }

  private afterSale(id: ItemId, earned: number): void {
    setToast(this.gs, `Sold ${itemInfo(id).name} · +${earned}₫`, 1.5);
    this.popup(`+${earned}₫`, this.playerX, this.playerZ);
    this.persist();
    this.pushHud(true);
  }

  selectSlot(index: number): void {
    if (index < 0 || index >= TOOLBAR_SLOTS) return;
    this.gs.toolbarSlot = index;
    this.gs.toolSlotActive = false;
    if (index !== SLOT_FIST) this.toolMode = 'farm';
    this.pushHud(true);
  }

  selectToolSlot(): void {
    this.gs.toolSlotActive = true;
    this.toolMode = 'farm';
    this.pushHud(true);
  }

  toggleInventory(): void {
    this.gs.inventoryOpen = !this.gs.inventoryOpen;
    this.pushHud(true);
  }

  useUltimate(): void {
    this.tryBoulderRoll();
  }

  /** Console helpers — teleport, hand out items, jump the clock. */
  debug() {
    return {
      state: this.gs,
      world: this.world,
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
        for (const w of this.weasels) {
          w.state = 'seek';
          w.timer = 0;
          w.x = this.playerX + (this.gs.rng() - 0.5) * 5;
          w.z = this.playerZ + (this.gs.rng() - 0.5) * 5;
          w.root.scale.setScalar(1);
          w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
        }
        return this.weasels.length;
      },
      weaselCount: () => this.weasels.length,
      melee: () => {
        this.meleeCd = 0;
        this.meleeSwing(AXE_DAMAGE);
        return this.weasels.length;
      },
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
    if (moving) {
      this.walkAction.enabled = true;
      this.walkAction.setEffectiveWeight(1);
      this.idleAction.setEffectiveWeight(0);
      if (!this.walkAction.isRunning()) this.walkAction.play();
    } else {
      this.idleAction.enabled = true;
      this.idleAction.setEffectiveWeight(1);
      this.walkAction.setEffectiveWeight(0);
      if (!this.idleAction.isRunning()) this.idleAction.play();
    }
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
    if (this.input.justPressed('KeyI')) this.toggleInventory();

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
      ['KeyC', 'trap', 'Tool: mushroom trap'],
    ];
    for (const [code, mode, label] of structure) {
      if (!this.input.justPressed(code)) continue;
      this.selectSlot(SLOT_FIST);
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
    this.stepWeasels(dt);
    this.stepAnimals(dt);

    this.nearWater = this.world.distToWater(this.playerX, this.playerZ) <= WATER_COLLECT_RANGE;
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY && this.input.justPressed('KeyE')) {
      fillBucket(this.gs);
      setToast(this.gs, `Bucket filled (${this.gs.bucketFill}/${BUCKET_CAPACITY})`, 2);
    }

    this.nearMarket =
      Math.hypot(this.playerX - this.stallX, this.playerZ - this.stallZ) <= MARKET_RANGE;

    if (this.input.consumeRmb() || this.input.justPressed('Space')) this.throwRock();
    if (this.input.consumeLmb()) this.useSelectedTool();

    const clock = stepGameClock(this.gs, dt);
    this.world.applyDayNight(this.gs.clock.phase, this.gs.clock.t);

    if (clock.matured.length) {
      this.rebuildCrops();
      this.world.syncFarmTiles(this.gs.tiles);
      for (const m of clock.matured) {
        const c = this.crops.find((x) => x.tx === m.x && x.ty === m.y);
        if (c) c.root.scale.setScalar(1.3);
      }
    }
    for (const c of this.crops) {
      const s = c.root.scale.x;
      c.root.scale.setScalar(
        THREE.MathUtils.lerp(s, 1 + Math.sin(this.gs.simTime * 1.1 + c.tx) * 0.015, 0.08),
      );
    }

    if (clock.becameNight) {
      setToast(this.gs, 'Night falls. Defend the crops!', 3);
      this.spawnRaid();
      this.persist();
    }
    if (clock.becameDay) {
      this.clearWeasels();
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

  /** Rock, tree, stump or open water — all of them stop a hoe. */
  private tileBlockedForTilling(tx: number, ty: number): boolean {
    const trees = this.world.getFarmTrees();
    if (trees?.blocksTilling(tx, ty)) return true;
    return this.world.distToWater(tx + 0.5, ty + 0.5) < 0.8;
  }

  /** The grid only lights up for the fist — the tool that actually works soil. */
  private updateHover(): void {
    if (this.gs.toolSlotActive || this.gs.toolbarSlot !== SLOT_FIST) {
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
    if (this.gs.toolSlotActive) {
      this.useBucket();
      return;
    }
    switch (this.gs.toolbarSlot) {
      case SLOT_ROCK:
        this.throwRock();
        return;
      case SLOT_AXE:
        this.useAxe();
        return;
      case SLOT_FIST:
        this.useFist();
        return;
      default:
        setToast(this.gs, `Slot ${this.gs.toolbarSlot + 1} is empty`, 1.2);
    }
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
    const tilePos = this.pointerTile();
    if (tilePos && this.chopFarmTree(tilePos.tx, tilePos.ty)) return;
    // Nothing to chop — swing at whatever is in front of you instead.
    this.meleeSwing(AXE_DAMAGE);
  }

  private useFist(): void {
    const tilePos = this.pointerTile();
    if (!tilePos) {
      this.meleeSwing(FIST_DAMAGE);
      return;
    }
    const { tx, ty } = tilePos;
    const tile = getTile(this.gs.tiles, tx, ty);
    if (!tile) return;
    const wc = this.farmTileWorld(tx, ty);
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) {
      this.meleeSwing(FIST_DAMAGE);
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
      if (digTrench(this.gs.tiles, tx, ty)) {
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
      if (makeBreedingBed(this.gs.tiles, tx, ty)) {
        this.world.syncFarmTiles(this.gs.tiles);
        setToast(this.gs, 'Breeding bed ready — plant two seeds', 2.5);
      } else if (tile.state === 'breeding' && tile.breedA && tile.breedB) {
        const parents = clearBreedingParents(this.gs.tiles, tx, ty);
        if (parents) {
          const child = crossbreed(parents.a, parents.b, this.gs.rng);
          addSeedToInventory(this.gs, child);
          this.gs.tiles[ty]![tx]!.state = 'tilled';
          this.world.syncFarmTiles(this.gs.tiles);
          setToast(this.gs, `Hybrid: ${child.displayName}!`, 3.5);
        }
      }
      return;
    }

    if (this.toolMode === 'trap') {
      if (placeTrap(this.gs.tiles, tx, ty)) this.world.syncFarmTiles(this.gs.tiles);
      return;
    }

    if (tile.state === 'grass') {
      if (this.tileBlockedForTilling(tx, ty)) {
        setToast(this.gs, "This ground can't be worked", 1.4);
        return;
      }
      if (tillTile(this.gs.tiles, tx, ty, this.gs.clock.day)) {
        this.world.syncFarmTiles(this.gs.tiles);
      }
    } else if (tile.state === 'tilled' || tile.state === 'breeding') {
      const seed = selectedSeed(this.gs);
      if (!seed) {
        setToast(this.gs, 'No seeds', 1.5);
        return;
      }
      if (plantTile(this.gs.tiles, tx, ty, seed)) {
        this.rebuildCrops();
        this.world.syncFarmTiles(this.gs.tiles);
      }
    } else if (tile.state === 'planted' && !tile.watered) {
      this.waterWithBucket(tx, ty, true);
    } else if (tile.state === 'mature') {
      const res = harvestTile(this.gs.tiles, tx, ty);
      if (res.ok && res.seed) {
        const id = cropItem(res.seed.displayName);
        if (!addToInventory(this.gs, id, res.count)) return;
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
    this.world.shake(0.14, 0.12);
    this.popup(`+${FARM_TREE_WOOD} Wood`, wc.x, wc.z);
    return true;
  }

  // ---------------------------------------------------------------- combat

  private throwRock(): void {
    if (this.shotCd > 0) return;
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

    // Special crops act as ammo when you have them; a bare rock costs nothing.
    let ammo: string | null = null;
    const ammoId = findItem(this.gs.inventory, (i) => {
      const n = cropName(i);
      return n === 'Rubber Corn' || n === 'Screaming Cabbage' || n === 'Ironroot Turnip';
    });
    if (ammoId && takeFromInventory(this.gs, ammoId, 1)) ammo = cropName(ammoId);

    const color =
      ammo === 'Screaming Cabbage' ? 0x80ff80 : ammo === 'Ironroot Turnip' ? 0x888899 : 0x8d8578;

    const mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.16, 0),
      new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9 }),
    );
    mesh.position.set(this.playerX, 0.8, this.playerZ);
    mesh.castShadow = true;
    this.world.getSharedActors().add(mesh);
    this.shots.push({
      mesh,
      x: this.playerX,
      z: this.playerZ,
      vx: dx * SHOT_SPEED,
      vz: dz * SHOT_SPEED,
      life: SHOT_LIFETIME,
      ricochet: ammo === 'Rubber Corn' ? 3 : 0,
      dmg: 1,
    });
    this.shotCd = SHOT_COOLDOWN;
  }

  /** Fist / axe swing — hits everything alive inside a short radius. */
  private meleeSwing(damage: number): void {
    if (this.meleeCd > 0) return;
    this.meleeCd = MELEE_COOLDOWN;
    let connected = false;
    for (const w of [...this.weasels]) {
      if (w.dead) continue;
      if (Math.hypot(w.x - this.playerX, w.z - this.playerZ) > MELEE_RANGE) continue;
      this.damageWeasel(w, damage);
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

  private tryBoulderRoll(): void {
    if (this.gs.boulderCooldown > 0) {
      setToast(this.gs, `Boulder Roll ready in ${Math.ceil(this.gs.boulderCooldown)}s`, 1.2);
      return;
    }
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

      for (const w of [...this.weasels]) {
        if (w.dead || b.hit.has(w)) continue;
        if (Math.hypot(w.x - b.x, w.z - b.z) > BOULDER_RADIUS + 0.4) continue;
        b.hit.add(w);
        this.damageWeasel(w, BOULDER_DAMAGE);
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

  private stepShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]!;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      s.mesh.position.set(s.x, 0.8, s.z);
      s.mesh.rotation.x += dt * 9;
      s.mesh.rotation.y += dt * 7;

      if (s.life <= 0) {
        s.mesh.removeFromParent();
        this.shots.splice(i, 1);
        continue;
      }

      let consumed = false;
      for (const w of [...this.weasels]) {
        if (w.dead) continue;
        if (Math.hypot(s.x - w.x, s.z - w.z) > 0.8) continue;
        this.damageWeasel(w, s.dmg);
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
        s.mesh.removeFromParent();
        this.shots.splice(i, 1);
      }
    }
  }

  private damageWeasel(w: Weasel, amount: number): void {
    if (w.dead) return;
    w.hp -= amount;
    if (w.hp > 0) {
      w.root.scale.set(1.25, 0.8, 1.25);
      w.state = 'flee';
      return;
    }
    w.dead = true;
    this.gs.stats.weaselsFelled += 1;
    this.world.shake(0.09, 0.08);
    this.hitPause = 0.05;
    w.root.removeFromParent();
    this.rollTrophy(`weasel:${w.kind}`, `${w.kind[0]!.toUpperCase()}${w.kind.slice(1)}`, w.x, w.z);
    // Dead is dead — drop it now rather than waiting for the next sweep.
    this.weasels = this.weasels.filter((o) => !o.dead);
  }

  private damageAnimal(a: PlainsAnimal, amount: number): void {
    a.hp -= amount;
    a.state = 'hurt';
    a.timer = 1.2;
    if (a.hp > 0) {
      a.root.scale.set(1.1, 0.9, 1.1);
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
    this.clearWeasels();
    const spawns = generateWave(
      this.gs.clock.day,
      this.gs.seed,
      cropValueScore(this.gs.tiles),
      totalWeirdness(this.gs.tiles),
    );
    for (const sp of spawns) {
      const { root, animations } = cloneModel('weasel');
      const x = sp.x;
      const z = sp.y;
      root.position.set(x, this.world.heightAt(x, z), z);
      root.scale.setScalar(0.15);
      if (animations.length) {
        const mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(animations[0]!).play();
        root.userData.mixer = mixer;
      }
      this.world.getFarmActors().add(root);
      this.weasels.push({
        root,
        x,
        z,
        state: 'burrow',
        kind: sp.kind,
        hp: 1,
        timer: WEASEL_BURROW_TIME,
        targetTx: -1,
        targetTy: -1,
        eatTimer: 0,
        dead: false,
        haulSeed: false,
      });
    }
    this.world.markShadowsDirty();
  }

  private clearWeasels(): void {
    for (const w of this.weasels) w.root.removeFromParent();
    this.weasels = [];
  }

  private weaselSpeed(w: Weasel): number {
    if (w.kind === 'nibbler') return NIBBLER_SPEED;
    if (w.kind === 'hauler') return HAULER_SPEED;
    return WEASEL_SPEED;
  }

  private stepWeasels(dt: number): void {
    const crops = findCropTiles(this.gs.tiles);
    for (const w of [...this.weasels]) {
      if (w.dead) continue;
      (w.root.userData.mixer as THREE.AnimationMixer | undefined)?.update(dt);

      const tpos = this.worldToFarmTile(w.x, w.z);
      if (tpos && w.state !== 'burrow' && w.state !== 'trapped') {
        const t = getTile(this.gs.tiles, tpos.tx, tpos.ty);
        if (t?.trap) {
          t.trap = false;
          const b = rollTrapBehaviour(this.gs.rng);
          setToast(this.gs, `Trap: weasel ${trapBehaviourLabel(b)}`, 1.6);
          this.world.syncFarmTiles(this.gs.tiles);
          if (b === 'attack_ally') {
            for (const o of [...this.weasels]) {
              if (o !== w && !o.dead && Math.hypot(o.x - w.x, o.z - w.z) < 4) {
                this.damageWeasel(o, 1);
                break;
              }
            }
          }
          if (b === 'sleep' || b === 'freeze') {
            w.state = 'trapped';
            w.timer = 4;
            continue;
          }
          if (b === 'shrink') w.root.scale.setScalar(0.4);
          if (b === 'grow') w.root.scale.setScalar(1.6);
          w.state = 'flee';
          continue;
        }
      }

      if (tpos && hasRepelNearby(this.gs.tiles, tpos.tx, tpos.ty, 3)) w.state = 'flee';

      if (w.state === 'trapped') {
        w.timer -= dt;
        if (w.timer <= 0) w.state = 'flee';
        continue;
      }

      if (w.state === 'burrow') {
        w.timer -= dt;
        const t = 1 - w.timer / WEASEL_BURROW_TIME;
        w.root.scale.setScalar(0.15 + 0.85 * Math.min(1, t));
        if (w.timer <= 0) {
          w.state = 'seek';
          w.root.scale.setScalar(1);
          this.pickTarget(w, crops);
        }
        continue;
      }

      if (w.state === 'seek') {
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
          const dx = this.playerX - w.x;
          const dz = this.playerZ - w.z;
          const len = Math.hypot(dx, dz) || 1;
          w.x += (dx / len) * this.weaselSpeed(w) * 0.5 * dt;
          w.z += (dz / len) * this.weaselSpeed(w) * 0.5 * dt;
          w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
          w.root.rotation.y = Math.atan2(dx, dz);
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
            w.eatTimer = WEASEL_EAT_TIME;
            w.root.scale.set(1.25, 0.85, 1.25);
          }
        } else {
          const sp = this.weaselSpeed(w);
          w.x += (dx / dist) * sp * dt;
          w.z += (dz / dist) * sp * dt;
          w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
          w.root.rotation.y = Math.atan2(dx, dz);
        }
        continue;
      }

      if (w.state === 'eat') {
        w.eatTimer -= dt;
        w.root.scale.y = 1 + Math.sin(this.gs.simTime * 12) * 0.08;
        if (w.eatTimer <= 0) {
          destroyCrop(this.gs.tiles, w.targetTx, w.targetTy);
          this.world.syncFarmTiles(this.gs.tiles);
          this.rebuildCrops();
          w.state = 'flee';
          w.root.scale.set(1, 1, 1);
        }
        continue;
      }

      if (w.state === 'flee') {
        const edge = nearestEdgePoint(w.x, w.z);
        const dx = edge.x - w.x;
        const dz = edge.y - w.z;
        const dist = Math.hypot(dx, dz) || 1;
        const sp = this.weaselSpeed(w) * (w.haulSeed ? 1.15 : 1.3);
        w.x += (dx / dist) * sp * dt;
        w.z += (dz / dist) * sp * dt;
        w.root.position.set(w.x, this.world.heightAt(w.x, w.z), w.z);
        if (dist < 0.5) {
          w.dead = true;
          w.root.removeFromParent();
        }
      }
    }
    this.weasels = this.weasels.filter((w) => !w.dead);
  }

  private pickTarget(w: Weasel, crops: { x: number; y: number }[]): void {
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
        const key = stage === 0 ? 'crop1' : stage === 1 ? 'crop2' : 'crop3';
        const { root } = cloneModel(key as 'crop1');
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
        this.crops.push({ root, tx, ty, stage });
        n++;
      }
    }
    this.world.markShadowsDirty();
  }

  private seedPlainsAnimals(): void {
    if (this.animalsSeeded) return;
    this.animalsSeeded = true;
    const names = ['Marsh Stag', 'Gloam Boar', 'Pebble Hare', 'Thicket Fox', 'Dust Ram'];
    for (let i = 0; i < 10; i++) {
      const key = i % 2 === 0 ? 'animal_a' : 'animal_b';
      let x = 0;
      let z = 0;
      let tries = 0;
      do {
        x = 20 + this.gs.rng() * (WORLD_SIZE - 40);
        z = 20 + this.gs.rng() * (WORLD_SIZE - 40);
        tries++;
      } while (tries < 40 && this.world.distToWater(x, z) < 4);
      const { root, animations } = cloneModel(key as 'animal_a');
      root.position.set(x, this.world.heightAt(x, z), z);
      this.world.getFarmActors().add(root);
      let mixer: THREE.AnimationMixer | null = null;
      if (animations.length) {
        mixer = new THREE.AnimationMixer(root);
        mixer.clipAction(animations[0]!).play();
      }
      this.animals.push({
        root,
        mixer,
        x,
        z,
        heading: this.gs.rng() * Math.PI * 2,
        targetHeading: this.gs.rng() * Math.PI * 2,
        speed: 1.1 + this.gs.rng() * 0.8,
        timer: 2 + this.gs.rng() * 4,
        hp: 3,
        state: 'idle',
        name: names[i % names.length]!,
      });
    }
  }

  private stepAnimals(dt: number): void {
    for (const a of this.animals) {
      a.timer -= dt;
      a.root.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
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
    let hint = `1 rock · 2 fist · 3 axe · 6 bucket · Q boulder · I inventory · [ ] seed (${
      seed?.displayName ?? '—'
    })`;
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) hint = 'E — fill bucket';
    if (this.toolMode !== 'farm') hint = `Tool: ${this.toolMode} · 2 back to fist`;
    if (this.nearMarket) hint = 'Market stall — sell for duckettes';

    const inventory: HudSlot[] = this.gs.inventory.map((slot) => {
      if (!slot) return { id: null, name: '', glyph: '', count: 0, price: 0, blurb: '' };
      const info = itemInfo(slot.id);
      return {
        id: slot.id,
        name: info.name,
        glyph: info.glyph,
        count: slot.count,
        price: info.price,
        blurb: info.blurb,
      };
    });
    while (inventory.length < INVENTORY_SLOTS) {
      inventory.push({ id: null, name: '', glyph: '', count: 0, price: 0, blurb: '' });
    }

    const toolbar: HudToolbarSlot[] = TOOLBAR.map((t, i) => ({
      index: i,
      name: t.name,
      glyph: t.glyph,
      empty: t.empty,
      selected: !this.gs.toolSlotActive && this.gs.toolbarSlot === i,
    }));

    const marketItems = occupiedSlots(this.gs.inventory).map((s) => {
      const info = itemInfo(s.id);
      return { id: s.id, name: info.name, glyph: info.glyph, count: s.count, price: info.price };
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
        selected: this.gs.toolSlotActive,
        fill: this.gs.bucketFill,
        capacity: BUCKET_CAPACITY,
      },
      ultimate: {
        name: 'Boulder Roll',
        glyph: '🎳',
        ready: this.gs.boulderCooldown <= 0,
        cooldown: Math.ceil(this.gs.boulderCooldown),
        max: BOULDER_COOLDOWN,
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
