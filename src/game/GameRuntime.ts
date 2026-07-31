import * as THREE from 'three';
import {
  BAG_SIZE_BASE,
  BOW_COOLDOWN,
  BOW_SPEED,
  BLUNDER_COOLDOWN,
  BLUNDER_PELLETS,
  BLUNDER_SPREAD,
  BUCKET_CAPACITY,
  CROP_DEFS,
  FIXED_DT,
  GRID_H,
  GRID_W,
  HAULER_SPEED,
  HOMESTEAD_MIN_X,
  HOMESTEAD_MIN_Z,
  HOMESTEAD_SIZE,
  LANTERN_FUEL,
  NIBBLER_SPEED,
  PLAYER_ACCEL,
  PLAYER_DAMP,
  PLAYER_SPEED,
  SAVE_KEY,
  SHACK_COST,
  SHOT_COOLDOWN,
  SHOT_LIFETIME,
  SHOT_SPEED,
  STALKER_SPAWN_FUEL,
  STALKER_SPEED_EMPTY,
  STALKER_SPEED_FULL,
  TOOL_RANGE,
  TREE_CHOPS,
  TREE_COUNT,
  TREELINE_Z,
  WATER_COLLECT_RANGE,
  WEASEL_BURROW_TIME,
  WEASEL_EAT_TIME,
  WEASEL_SPEED,
  WIN_DAY,
  WOODS_H,
  WOODS_W,
  WORLD_SIZE,
} from '../content';
import {
  addSeedToInventory,
  addToInventory,
  bankBag,
  checkWin,
  createGameState,
  cycleSeed,
  cycleWeapon,
  dumpBag,
  fillBucket,
  forceDawn,
  forceDawnAfterStalker,
  loadFromString,
  markWinShown,
  saveToString,
  selectedSeed,
  setToast,
  stepGameClock,
  takeFromInventory,
  tryUpgradeHomestead,
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
import {
  generateWave,
  nearestEdgePoint,
  rollTrapBehaviour,
  trapBehaviourLabel,
  type WeaselType,
} from '../sim/raid';
import { mulberry32, randRange } from '../sim/rng';
import {
  attentionOnChop,
  attentionOnShot,
  depthAt,
  stepAttention,
  woodYieldForDepth,
  woodsmanShouldHunt,
  type WoodsDepth,
} from '../sim/woods';
import { cloneModel, preloadAll, initAssetLoaders } from './Assets';
import { InputController } from './InputController';
import { WorldRenderer } from './WorldRenderer';

export type HudSnapshot = {
  day: number;
  phase: 'day' | 'night';
  phaseT: number;
  wood: number;
  darkwood: number;
  bagWood: number;
  bagSize: number;
  lanternFuel: number;
  zone: 'farm' | 'woods';
  hint: string;
  feed: string[];
  stalkerActive: boolean;
  shedBuilt: boolean;
  bucketFull: boolean;
  bucketFill: number;
  nearWater: boolean;
  weapon: string;
  seedName: string;
  homesteadTier: number;
  irrigationTier: number;
  attention: number;
  woodsDepth: string;
  codexCount: number;
  trophies: string[];
  inventorySummary: string;
  win: null | {
    daysSurvived: number;
    cropsHarvested: number;
    woodGathered: number;
    stalkerCaught: number;
  };
};

type WeaselState = 'burrow' | 'seek' | 'eat' | 'flee' | 'dead' | 'trapped';

type Weasel = {
  root: THREE.Object3D;
  x: number;
  z: number;
  state: WeaselState;
  kind: WeaselType;
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

type Tree = {
  root: THREE.Object3D;
  x: number;
  z: number;
  chops: number;
  felled: boolean;
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
  state: 'idle' | 'walk' | 'dazed';
  name: string;
};

type ToolMode = 'farm' | 'trench' | 'breed' | 'trap';

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
  private shotCd = 0;
  private crops: CropActor[] = [];
  private houseRoot: THREE.Object3D | null = null;

  private trees: Tree[] = [];
  private fuel = LANTERN_FUEL;
  private stalkerRoot: THREE.Object3D | null = null;
  private stalkerX = 0;
  private stalkerZ = 0;
  private stalkerActive = false;
  private woodsSeeded = false;
  private animals: PlainsAnimal[] = [];
  private animalsSeeded = false;

  private feed: string[] = [];
  private lastToast = '';
  private hitPause = 0;
  private onHud: ((s: HudSnapshot) => void) | null = null;
  private lastHudJson = '';
  private winShownLocal = false;
  private stillTimer = 0;

  async mount(canvas: HTMLCanvasElement, onHud: (s: HudSnapshot) => void): Promise<void> {
    this.canvas = canvas;
    this.onHud = onHud;

    // Renderer must exist before preloading: KTX2Loader.detectSupport() needs it to
    // choose a GPU transcode target, and without the KTX2 + meshopt decoders every
    // model silently falls back to a primitive.
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

    this.spawnPlayer();
    this.spawnHouse();
    this.seedPlainsAnimals();
    this.world.syncFarmTiles(this.gs.tiles);
    this.rebuildCrops();
    this.world.snapCamera(this.playerX, this.playerZ);

    if (this.gs.clock.phase === 'night') this.spawnRaid();

    this.running = true;
    this.loop(performance.now());
    this.pushHud(true);
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

  private spawnHouse(): void {
    if (this.houseRoot) {
      this.world.getFarmActors().remove(this.houseRoot);
      this.houseRoot = null;
    }
    const key = this.gs.homesteadTier >= 2 ? 'house2' : 'house1';
    const { root } = cloneModel(key);
    const hx = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2;
    const hz = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE - 6;
    root.position.set(hx, this.world.heightAt(hx, hz), hz);
    if (this.gs.homesteadTier === 0) root.scale.setScalar(0.75);
    if (this.gs.homesteadTier >= 2) root.scale.setScalar(1.15);
    this.houseRoot = root;
    this.world.getFarmActors().add(root);
    this.world.markShadowsDirty();
  }

  private last = 0;
  private loop = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;

    if (this.hitPause > 0) {
      this.hitPause -= dt;
      this.world.render();
      return;
    }

    this.accum += dt;
    while (this.accum >= FIXED_DT) {
      this.fixedUpdate(FIXED_DT);
      this.accum -= FIXED_DT;
    }

    this.playerMixer?.update(dt);
    for (const a of this.animals) a.mixer?.update(dt);
    this.world.update(dt);

    const moving = Math.hypot(this.velX, this.velZ) > 0.4;
    this.updateAnim(moving);

    let leadX = 0;
    let leadZ = 0;
    if (this.world.getZone() === 'farm') {
      const sp = Math.hypot(this.velX, this.velZ);
      if (sp > 0.1) {
        leadX = (this.velX / sp) * 1.2;
        leadZ = (this.velZ / sp) * 1.2;
      }
    }
    this.world.followPlayer(this.playerX, this.playerZ, leadX, leadZ, dt);
    this.updateHover();

    const py =
      this.world.getZone() === 'farm' ? this.world.heightAt(this.playerX, this.playerZ) : 0;
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

  private fixedUpdate(dt: number): void {
    if (this.world.getZone() === 'farm') this.updateFarm(dt);
    else this.updateWoods(dt);
  }

  private handleHotkeys(): void {
    if (this.input.justPressed('KeyR')) {
      cycleWeapon(this.gs);
      setToast(this.gs, `Weapon: ${this.gs.weapon}`, 1.5);
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
    if (this.input.justPressed('Digit1')) this.toolMode = 'farm';
    if (this.input.justPressed('Digit2')) {
      this.toolMode = 'trench';
      setToast(this.gs, 'Tool: trench dig', 1.2);
    }
    if (this.input.justPressed('Digit3')) {
      this.toolMode = 'breed';
      setToast(this.gs, 'Tool: breeding bed', 1.2);
    }
    if (this.input.justPressed('Digit4')) {
      this.toolMode = 'trap';
      setToast(this.gs, 'Tool: mushroom trap', 1.2);
    }
    if (this.input.justPressed('KeyV') && this.gs.irrigationTier < 3 && this.gs.homesteadTier >= 2) {
      if (this.gs.wood >= 15 && this.gs.darkwood >= 5) {
        this.gs.wood -= 15;
        this.gs.darkwood -= 5;
        this.gs.irrigationTier = 3;
        setToast(this.gs, 'Aqueduct tier unlocked!', 3);
      }
    }
  }

  private updateFarm(dt: number): void {
    const b = this.world.getWorldBounds();
    this.movePlayer(dt, b.minX, b.maxX, b.minZ, b.maxZ);
    this.handleHotkeys();

    if (this.shotCd > 0) this.shotCd -= dt;
    this.stepShots(dt);
    this.stepWeasels(dt);
    this.stepAnimals(dt);

    this.nearWater = this.world.distToWater(this.playerX, this.playerZ) <= WATER_COLLECT_RANGE;
    if (this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY && this.input.justPressed('KeyE')) {
      fillBucket(this.gs);
      setToast(this.gs, `Bucket filled (${this.gs.bucketFill}/${BUCKET_CAPACITY})`, 2);
      this.pushFeed('Bucket filled');
    }

    if (this.input.consumeRmb() || this.input.justPressed('Space')) this.tryShoot();
    if (this.input.consumeLmb()) this.tryTool();

    const clock = stepGameClock(this.gs, dt);
    this.world.applyDayNight(this.gs.clock.phase, this.gs.clock.t);

    if (clock.matured.length) {
      this.rebuildCrops();
      this.world.syncFarmTiles(this.gs.tiles);
      for (const m of clock.matured) {
        this.pushFeed('Crop matured');
        const c = this.crops.find((x) => x.tx === m.x && x.ty === m.y);
        if (c) c.root.scale.setScalar(1.3);
      }
    }
    for (const c of this.crops) {
      const s = c.root.scale.x;
      c.root.scale.setScalar(THREE.MathUtils.lerp(s, 1 + Math.sin(this.gs.simTime * 1.1 + c.tx) * 0.015, 0.08));
    }

    if (clock.becameNight) {
      setToast(this.gs, 'Night falls. Defend the crops!', 3);
      this.pushFeed('Night falls');
      this.spawnRaid();
      this.persist();
    }
    if (clock.becameDay) {
      this.clearWeasels();
      setToast(this.gs, `Day ${this.gs.clock.day}`, 2);
      this.pushFeed(`Day ${this.gs.clock.day}`);
      this.persist();
      if (checkWin(this.gs) && !this.gs.winShown) this.winShownLocal = false;
    }

    // Woods entry: north edge of world during day
    if (this.gs.clock.phase === 'day' && this.playerZ < TREELINE_Z) {
      this.enterWoods();
    } else if (this.gs.clock.phase === 'night' && this.playerZ < TREELINE_Z) {
      this.playerZ = TREELINE_Z + 0.2;
    }

    // Homestead upgrade
    if (this.houseRoot && this.gs.homesteadTier < 2) {
      const hx = this.houseRoot.position.x;
      const hz = this.houseRoot.position.z;
      if (Math.hypot(this.playerX - hx, this.playerZ - hz) < 2.2) {
        if (tryUpgradeHomestead(this.gs)) {
          this.spawnHouse();
          const name = this.gs.homesteadTier === 1 ? 'Shack' : 'Cabin';
          setToast(this.gs, `${name} built!`, 3.5);
          this.pushFeed(`${name} built`);
          this.persist();
        }
      }
    }
  }

  private updateWoods(dt: number): void {
    const clock = stepGameClock(this.gs, dt);
    if (clock.becameNight) {
      this.dieInWoods('nightfall');
      return;
    }

    this.movePlayer(dt, 0.4, WOODS_W - 0.4, 0.4, WOODS_H - 0.4);
    this.handleHotkeys();

    const moving = Math.hypot(this.velX, this.velZ) > 0.35;
    if (!moving) this.stillTimer += dt;
    else this.stillTimer = 0;

    const depth = depthAt(this.playerZ);
    this.gs.attention = stepAttention(this.gs.attention, dt, {
      depth,
      moving,
      floor: this.gs.attentionFloor,
    });

    this.fuel = Math.max(0, this.fuel - dt);
    this.world.setLanternFuel(this.fuel / LANTERN_FUEL);
    if (this.fuel <= 0) {
      this.dieInWoods('fuel');
      return;
    }

    // Portable light hybrid in inventory slows fuel drain slightly
    if ((this.gs.inventory['Glowshroom Gourd'] ?? 0) > 0) {
      this.fuel = Math.min(LANTERN_FUEL, this.fuel + dt * 0.15);
    }

    const wantHunt = woodsmanShouldHunt(this.gs.attention, depth) || this.fuel < STALKER_SPAWN_FUEL;
    if (!this.stalkerActive && wantHunt && depth !== 'fringe') {
      this.spawnStalker();
    }

    if (this.input.justPressed('KeyQ')) {
      const n = dumpBag(this.gs);
      if (n > 0) {
        setToast(this.gs, `Dropped ${n} wood!`, 2);
        this.pushFeed(`Dropped ${n} wood`);
      }
    }

    if (this.input.consumeLmb()) this.tryChop();
    if (this.input.consumeRmb() || this.input.justPressed('Space')) {
      this.tryShoot();
      this.gs.attention = attentionOnShot(this.gs.attention, this.gs.weapon === 'bow');
    }

    if (this.stalkerActive && this.stalkerRoot) {
      const fill = this.gs.bagSize > 0 ? (this.gs.bagWood + this.gs.bagDarkwood) / this.gs.bagSize : 0;
      const speed =
        STALKER_SPEED_EMPTY + (STALKER_SPEED_FULL - STALKER_SPEED_EMPTY) * fill;
      const dx = this.playerX - this.stalkerX;
      const dz = this.playerZ - this.stalkerZ;
      const dist = Math.hypot(dx, dz) || 1;
      this.stalkerX += (dx / dist) * speed * dt;
      this.stalkerZ += (dz / dist) * speed * dt;
      this.stalkerRoot.position.set(this.stalkerX, 0, this.stalkerZ);
      this.stalkerRoot.rotation.y = Math.atan2(dx, dz);
      (this.stalkerRoot.userData.mixer as THREE.AnimationMixer | undefined)?.update(dt);
      if (dist < 0.85) {
        this.world.shake(0.3, 0.35);
        this.dieInWoods('stalker');
        return;
      }
    }

    if (this.playerZ > WOODS_H - 0.6) this.exitWoods();
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

  private updateHover(): void {
    if (this.world.getZone() !== 'farm') {
      this.world.setHover(null, null, false);
      return;
    }
    const ndc = this.input.getPointerNdc();
    const hit = this.world.raycastGround(ndc.x, ndc.y);
    if (!hit) {
      this.world.setHover(null, null, false);
      return;
    }
    const tile = this.worldToFarmTile(hit.x, hit.z);
    if (!tile) {
      this.world.setHover(null, null, false);
      return;
    }
    const wc = this.farmTileWorld(tile.tx, tile.ty);
    const dist = Math.hypot(this.playerX - wc.x, this.playerZ - wc.z);
    this.world.setHover(tile.tx, tile.ty, dist <= TOOL_RANGE);
  }

  private tryTool(): void {
    const ndc = this.input.getPointerNdc();
    const hit = this.world.raycastGround(ndc.x, ndc.y);
    if (!hit) return;
    const tilePos = this.worldToFarmTile(hit.x, hit.z);
    if (!tilePos) return;
    const { tx, ty } = tilePos;
    const tile = getTile(this.gs.tiles, tx, ty);
    if (!tile) return;
    const wc = this.farmTileWorld(tx, ty);
    if (Math.hypot(this.playerX - wc.x, this.playerZ - wc.z) > TOOL_RANGE) return;

    if (this.toolMode === 'trench') {
      if (this.gs.irrigationTier < 2) {
        setToast(this.gs, 'Need Shack (irrigation tier 2) for trenches', 2);
        return;
      }
      if (digTrench(this.gs.tiles, tx, ty)) {
        this.world.syncFarmTiles(this.gs.tiles);
        this.pushFeed('Trench dug');
        // Auto-flow if near water
        if (this.world.distToWater(wc.x, wc.z) < 3) {
          // water adjacent crops via simple pass
          for (const [dx, dy] of [
            [0, 0],
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ] as const) {
            const t2 = getTile(this.gs.tiles, tx + dx, ty + dy);
            if (t2?.state === 'planted' && !t2.watered) {
              t2.watered = true;
              t2.growth = Math.max(t2.growth, 0);
            }
          }
          this.world.syncFarmTiles(this.gs.tiles);
        }
      }
      return;
    }

    if (this.toolMode === 'breed') {
      if (makeBreedingBed(this.gs.tiles, tx, ty)) {
        this.world.syncFarmTiles(this.gs.tiles);
        this.pushFeed('Breeding bed');
        setToast(this.gs, 'Breeding bed ready — plant two seeds', 2.5);
      } else if (tile.state === 'breeding' && tile.breedA && tile.breedB) {
        const parents = clearBreedingParents(this.gs.tiles, tx, ty);
        if (parents) {
          const child = crossbreed(parents.a, parents.b, this.gs.rng);
          addSeedToInventory(this.gs, child);
          this.gs.tiles[ty]![tx]!.state = 'tilled';
          this.world.syncFarmTiles(this.gs.tiles);
          setToast(this.gs, `Hybrid: ${child.displayName}!`, 3.5);
          this.pushFeed(`Discovered ${child.displayName}`);
        }
      }
      return;
    }

    if (this.toolMode === 'trap') {
      if (placeTrap(this.gs.tiles, tx, ty)) {
        this.world.syncFarmTiles(this.gs.tiles);
        this.pushFeed('Trap set');
      }
      return;
    }

    // Farm mode — entire map tillable
    if (tile.state === 'grass') {
      if (tillTile(this.gs.tiles, tx, ty)) {
        this.world.syncFarmTiles(this.gs.tiles);
        this.pushFeed('Tilled');
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
        this.pushFeed(`Planted ${seed.displayName}`);
      }
    } else if (tile.state === 'planted' && !tile.watered) {
      if (this.gs.bucketFill > 0 || this.gs.irrigationTier >= 3) {
        if (this.gs.irrigationTier < 3 && !useBucketWater(this.gs)) {
          setToast(this.gs, 'Bucket empty — fill at river/lake (E)', 2);
          return;
        }
        if (waterTile(this.gs.tiles, tx, ty, this.gs.simTime)) {
          this.world.syncFarmTiles(this.gs.tiles);
          this.pushFeed('Watered');
        }
      } else {
        setToast(this.gs, 'Need water in bucket (E at river/lake)', 2);
      }
    } else if (tile.state === 'mature') {
      const res = harvestTile(this.gs.tiles, tx, ty);
      if (res.ok && res.seed) {
        this.gs.stats.cropsHarvested += res.count;
        addToInventory(this.gs, res.seed.displayName, res.count);
        // also keep a plantable seed copy
        addSeedToInventory(this.gs, { ...res.seed, traits: { ...res.seed.traits } });
        this.rebuildCrops();
        this.world.syncFarmTiles(this.gs.tiles);
        setToast(this.gs, `Harvested ${res.seed.displayName} ×${res.count}`, 1.5);
        this.pushFeed(`+${res.count} ${res.seed.displayName}`);
      }
    }
  }

  private tryShoot(): void {
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

    const weapon = this.gs.weapon;
    let cd = SHOT_COOLDOWN;
    let speed = SHOT_SPEED;
    let pellets = 1;
    let spread = 0;
    let ricochet = 0;
    // Crops as ammo for special effects
    let ammoKey: string | null = null;
    if (weapon !== 'slingshot') {
      // prefer special hybrids
      for (const k of Object.keys(this.gs.inventory)) {
        if (this.gs.inventory[k]! > 0) {
          ammoKey = k;
          break;
        }
      }
      if (ammoKey && !takeFromInventory(this.gs, ammoKey, 1)) ammoKey = null;
    }

    if (weapon === 'bow') {
      cd = BOW_COOLDOWN;
      speed = BOW_SPEED;
    } else if (weapon === 'blunderbuss') {
      cd = BLUNDER_COOLDOWN;
      pellets = BLUNDER_PELLETS;
      spread = BLUNDER_SPREAD;
      if (this.gs.rng() < 0.08) {
        setToast(this.gs, 'Blunderbuss backfired!', 2);
        this.world.shake(0.12, 0.1);
      }
    }

    if (ammoKey === 'Rubber Corn') ricochet = 3;
    const color =
      ammoKey === 'Screaming Cabbage'
        ? 0x80ff80
        : ammoKey === 'Ironroot Turnip'
          ? 0x888899
          : 0xf2f0e4;

    for (let p = 0; p < pellets; p++) {
      const ang = (this.gs.rng() - 0.5) * spread * 2;
      const c = Math.cos(ang);
      const s = Math.sin(ang);
      const vx = (dx * c - dz * s) * speed;
      const vz = (dx * s + dz * c) * speed;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 8, 8),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.set(this.playerX, 0.8, this.playerZ);
      this.world.getSharedActors().add(mesh);
      this.shots.push({
        mesh,
        x: this.playerX,
        z: this.playerZ,
        vx,
        vz,
        life: SHOT_LIFETIME,
        ricochet,
        dmg: 1,
      });
    }
    this.shotCd = cd;
  }

  private stepShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]!;
      s.x += s.vx * dt;
      s.z += s.vz * dt;
      s.life -= dt;
      s.mesh.position.set(s.x, 0.8, s.z);
      if (s.life <= 0) {
        s.mesh.removeFromParent();
        this.shots.splice(i, 1);
        continue;
      }
      // animals
      for (const a of this.animals) {
        if (a.state === 'dazed') continue;
        if (Math.hypot(s.x - a.x, s.z - a.z) < 0.7) {
          a.state = 'dazed';
          a.timer = 2.5;
          this.gs.trophies.push(a.name);
          this.gs.stats.trophies += 1;
          setToast(this.gs, `Trophy: ${a.name}!`, 2);
          this.pushFeed(`Trophy ${a.name}`);
          if (s.ricochet > 0) {
            s.ricochet--;
            s.vx *= -1;
            s.vz *= -0.8;
          } else {
            s.mesh.removeFromParent();
            this.shots.splice(i, 1);
          }
          break;
        }
      }
      for (const w of this.weasels) {
        if (w.dead) continue;
        if (Math.hypot(s.x - w.x, s.z - w.z) < 0.55) {
          this.killWeasel(w);
          if (s.ricochet > 0) {
            s.ricochet--;
            s.vx = -s.vx + (this.gs.rng() - 0.5) * 4;
            s.vz = -s.vz + (this.gs.rng() - 0.5) * 4;
          } else {
            s.mesh.removeFromParent();
            this.shots.splice(i, 1);
          }
          break;
        }
      }
    }
  }

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
        timer: WEASEL_BURROW_TIME,
        targetTx: -1,
        targetTy: -1,
        eatTimer: 0,
        dead: false,
        haulSeed: false,
      });
    }
    this.world.markShadowsDirty();
    this.pushFeed(`${this.weasels.length} weasels (${spawns.map((s) => s.kind[0]).join('')})`);
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
    for (const w of this.weasels) {
      if (w.dead) continue;
      (w.root.userData.mixer as THREE.AnimationMixer | undefined)?.update(dt);

      // Trap check
      const tpos = this.worldToFarmTile(w.x, w.z);
      if (tpos && w.state !== 'burrow' && w.state !== 'trapped') {
        const t = getTile(this.gs.tiles, tpos.tx, tpos.ty);
        if (t?.trap) {
          t.trap = false;
          const b = rollTrapBehaviour(this.gs.rng);
          this.pushFeed(`Trap: weasel ${trapBehaviourLabel(b)}`);
          this.world.syncFarmTiles(this.gs.tiles);
          if (b === 'walk_off' || b === 'flee_fast' || b === 'backflip') {
            w.state = 'flee';
            continue;
          }
          if (b === 'attack_ally') {
            for (const o of this.weasels) {
              if (o !== w && !o.dead && Math.hypot(o.x - w.x, o.z - w.z) < 4) {
                this.killWeasel(o);
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

      // Repel
      if (tpos && hasRepelNearby(this.gs.tiles, tpos.tx, tpos.ty, 3)) {
        w.state = 'flee';
      }

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
          // Seek nearby trenches / structures
          // fallback to player then flee
          if (w.targetTx < 0) {
            // find trench
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
          w.timer -= dt;
          if (w.timer <= -2) w.state = 'flee';
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
                this.pushFeed('Sapper wrecked a trench');
              }
            }
            w.state = 'flee';
          } else if (w.kind === 'nibbler') {
            nibbleCrop(this.gs.tiles, w.targetTx, w.targetTy);
            this.world.syncFarmTiles(this.gs.tiles);
            this.rebuildCrops();
            w.targetTx = -1;
            // keep seeking other crops briefly
            w.timer = 1;
            if (this.gs.rng() < 0.4) w.state = 'flee';
          } else if (w.kind === 'hauler') {
            if (destroyCrop(this.gs.tiles, w.targetTx, w.targetTy)) {
              w.haulSeed = true;
              this.world.syncFarmTiles(this.gs.tiles);
              this.rebuildCrops();
              this.pushFeed('Hauler stole a plant!');
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
          this.pushFeed('Crop eaten');
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

  private killWeasel(w: Weasel): void {
    if (w.dead) return;
    w.dead = true;
    w.state = 'dead';
    this.world.shake(0.09, 0.08);
    this.hitPause = 0.06;
    this.pushFeed(`${w.kind} down`);
    const root = w.root;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 300;
      if (t >= 1) {
        root.removeFromParent();
        return;
      }
      root.scale.set(1.4, 0.2, 1.4);
      root.rotation.y += 0.2;
      requestAnimationFrame(tick);
    };
    tick();
  }

  private rebuildCrops(): void {
    for (const c of this.crops) c.root.removeFromParent();
    this.crops = [];
    // Cap visual crops for performance
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
        // tint by species if possible
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
      } while (
        tries < 40 &&
        (this.world.distToWater(x, z) < 4 ||
          (x > HOMESTEAD_MIN_X &&
            x < HOMESTEAD_MIN_X + HOMESTEAD_SIZE &&
            z > HOMESTEAD_MIN_Z &&
            z < HOMESTEAD_MIN_Z + HOMESTEAD_SIZE))
      );
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
        state: 'idle',
        name: names[i % names.length]!,
      });
    }
  }

  private stepAnimals(dt: number): void {
    for (const a of this.animals) {
      a.timer -= dt;
      if (a.state === 'dazed') {
        a.root.rotation.z = Math.sin(this.gs.simTime * 8) * 0.2;
        if (a.timer <= 0) {
          a.state = 'walk';
          a.timer = 3;
          a.root.rotation.z = 0;
        }
        continue;
      }
      if (a.timer <= 0) {
        a.state = a.state === 'idle' ? 'walk' : 'idle';
        a.timer = 2 + this.gs.rng() * 4;
        a.targetHeading = this.gs.rng() * Math.PI * 2;
      }
      if (a.state === 'walk') {
        a.heading = THREE.MathUtils.damp(a.heading, a.targetHeading, 3, dt);
        a.x += Math.sin(a.heading) * a.speed * dt;
        a.z += Math.cos(a.heading) * a.speed * dt;
        a.x = THREE.MathUtils.clamp(a.x, 4, WORLD_SIZE - 4);
        a.z = THREE.MathUtils.clamp(a.z, 4, WORLD_SIZE - 4);
      }
      a.root.position.set(a.x, this.world.heightAt(a.x, a.z), a.z);
      a.root.rotation.y = a.heading;
    }
  }

  private enterWoods(): void {
    this.persist();
    this.world.setZone('woods');
    this.fuel = LANTERN_FUEL;
    this.stalkerActive = false;
    this.gs.attention = this.gs.attentionFloor;
    if (this.stalkerRoot) {
      this.stalkerRoot.removeFromParent();
      this.stalkerRoot = null;
    }
    if (!this.woodsSeeded) {
      this.seedWoods();
      this.woodsSeeded = true;
    }
    this.playerX = WOODS_W / 2;
    this.playerZ = WOODS_H - 2;
    this.velX = 0;
    this.velZ = 0;
    this.world.snapCamera(this.playerX, this.playerZ);
    this.pushFeed('Entered the woods');
    setToast(this.gs, 'Fringe is safe. Deeper is not.', 3);
  }

  private seedWoods(): void {
    const rng = mulberry32((this.gs.seed ^ 0x74726565) >>> 0);
    const placed: { x: number; z: number }[] = [];
    let attempts = 0;
    while (placed.length < TREE_COUNT && attempts < 600) {
      attempts++;
      const x = randRange(rng, 2, WOODS_W - 2);
      const z = randRange(rng, 2, WOODS_H - 3);
      if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < 2.0)) continue;
      placed.push({ x, z });
      const { root } = cloneModel('tree_woods');
      root.position.set(x, 0, z);
      this.world.getWoodsActors().add(root);
      this.trees.push({ root, x, z, chops: 0, felled: false });
    }
    this.world.markShadowsDirty();
  }

  private tryChop(): void {
    const ndc = this.input.getPointerNdc();
    const hit = this.world.raycastGround(ndc.x, ndc.y);
    if (!hit) return;
    let best: Tree | null = null;
    let bestD = Infinity;
    for (const t of this.trees) {
      if (t.felled) continue;
      const d = Math.hypot(hit.x - t.x, hit.z - t.z);
      if (d < 1.2 && d < bestD) {
        bestD = d;
        best = t;
      }
    }
    if (!best) return;
    if (Math.hypot(this.playerX - best.x, this.playerZ - best.z) > TOOL_RANGE + 0.6) return;

    best.chops += 1;
    const att = attentionOnChop(this.gs.attention, this.gs.attentionFloor);
    this.gs.attention = att.attention;
    this.gs.attentionFloor = att.floor;

    if (best.chops >= TREE_CHOPS) {
      best.felled = true;
      this.world.shake(0.14, 0.12);
      best.root.visible = false;
      const depth = depthAt(best.z);
      const yield_ = woodYieldForDepth(depth);
      const space = this.gs.bagSize - (this.gs.bagWood + this.gs.bagDarkwood);
      if (space <= 0) {
        setToast(this.gs, 'Bag full! Exit to bank, or Q to dump.', 2);
        return;
      }
      const addW = Math.min(yield_.wood, space);
      this.gs.bagWood += addW;
      let rem = space - addW;
      const addD = Math.min(yield_.darkwood, rem);
      this.gs.bagDarkwood += addD;
      setToast(
        this.gs,
        `+${addW} wood` + (addD ? ` +${addD} darkwood` : '') + ` (${depth})`,
        1.4,
      );
      this.pushFeed(`Chopped (${depth})`);
    }
  }

  private spawnStalker(): void {
    this.stalkerActive = true;
    const angle = this.gs.rng() * Math.PI * 2;
    const r = 5;
    this.stalkerX = this.playerX + Math.cos(angle) * r;
    this.stalkerZ = this.playerZ + Math.sin(angle) * r;
    const { root, animations } = cloneModel('stalker');
    root.position.set(this.stalkerX, 0, this.stalkerZ);
    this.stalkerRoot = root;
    this.world.getWoodsActors().add(root);
    if (animations.length) {
      const mixer = new THREE.AnimationMixer(root);
      mixer.clipAction(animations.find((c) => /walk|run/i.test(c.name)) ?? animations[0]!).play();
      root.userData.mixer = mixer;
    }
    if (!this.gs.stalkerHintShown) {
      this.gs.stalkerHintShown = true;
      setToast(this.gs, 'Q — drop bag  (Woodsman is faster with a full bag)', 5);
    }
    this.pushFeed('The Woodsman is hunting');
    this.world.markShadowsDirty();
  }

  private exitWoods(): void {
    const banked = bankBag(this.gs);
    this.world.setZone('farm');
    this.playerX = WORLD_SIZE / 2;
    this.playerZ = TREELINE_Z + 2;
    this.velX = 0;
    this.velZ = 0;
    if (this.stalkerRoot) {
      this.stalkerRoot.removeFromParent();
      this.stalkerRoot = null;
    }
    this.stalkerActive = false;
    this.gs.attention = this.gs.attentionFloor;
    this.world.snapCamera(this.playerX, this.playerZ);
    if (banked > 0) {
      setToast(this.gs, `Banked haul (${banked}).`, 2.5);
      this.pushFeed(`Banked ${banked}`);
    }
    this.persist();
  }

  private dieInWoods(reason: 'stalker' | 'fuel' | 'nightfall'): void {
    if (reason === 'stalker') forceDawnAfterStalker(this.gs);
    else {
      this.gs.bagWood = 0;
      this.gs.bagDarkwood = 0;
      forceDawn(this.gs);
      setToast(
        this.gs,
        reason === 'fuel'
          ? 'Lantern died. You dropped everything.'
          : 'Night fell. You dropped everything.',
        4,
      );
    }
    this.pushFeed('You dropped everything');
    if (this.stalkerRoot) {
      this.stalkerRoot.removeFromParent();
      this.stalkerRoot = null;
    }
    this.stalkerActive = false;
    this.world.setZone('farm');
    this.playerX = HOMESTEAD_MIN_X + HOMESTEAD_SIZE / 2;
    this.playerZ = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE / 2;
    this.velX = 0;
    this.velZ = 0;
    this.clearWeasels();
    this.world.snapCamera(this.playerX, this.playerZ);
    this.persist();
  }

  private pushFeed(msg: string): void {
    this.feed.unshift(msg);
    if (this.feed.length > 8) this.feed.pop();
  }

  private pushHud(force: boolean): void {
    if (!this.onHud) return;
    if (this.gs.toast && this.gs.toast !== this.lastToast) {
      this.lastToast = this.gs.toast;
      this.pushFeed(this.gs.toast);
    }

    const zone = this.world.getZone();
    const depth: WoodsDepth | '' = zone === 'woods' ? depthAt(this.playerZ) : '';
    const seed = selectedSeed(this.gs);
    let hint =
      zone === 'woods'
        ? `LMB chop · RMB shoot · Q dump · ${depth || 'woods'}`
        : `LMB farm (whole map) · RMB shoot · [ ] seed · R weapon · 2 trench · 3 breed · 4 trap`;
    if (zone === 'farm' && this.nearWater && this.gs.bucketFill < BUCKET_CAPACITY) {
      hint = 'E — fill bucket';
    }
    if (zone === 'farm' && this.toolMode !== 'farm') {
      hint = `Tool: ${this.toolMode} · 1 back to farm tool`;
    }

    const inv = Object.entries(this.gs.inventory)
      .slice(0, 4)
      .map(([k, v]) => `${k}×${v}`)
      .join(' · ');

    const snap: HudSnapshot = {
      day: this.gs.clock.day,
      phase: this.gs.clock.phase,
      phaseT: this.gs.clock.t,
      wood: this.gs.wood,
      darkwood: this.gs.darkwood,
      bagWood: this.gs.bagWood + this.gs.bagDarkwood,
      bagSize: this.gs.bagSize,
      lanternFuel: zone === 'woods' ? this.fuel / LANTERN_FUEL : 1,
      zone,
      hint,
      feed: [...this.feed],
      stalkerActive: this.stalkerActive,
      shedBuilt: this.gs.homesteadTier >= 1,
      bucketFull: this.gs.bucketFill >= BUCKET_CAPACITY,
      bucketFill: this.gs.bucketFill,
      nearWater: this.nearWater,
      weapon: this.gs.weapon,
      seedName: seed?.displayName ?? '—',
      homesteadTier: this.gs.homesteadTier,
      irrigationTier: this.gs.irrigationTier,
      attention: Math.round(this.gs.attention),
      woodsDepth: depth || '—',
      codexCount: this.gs.codex.length,
      trophies: this.gs.trophies.slice(-5),
      inventorySummary: inv || 'empty',
      win:
        this.gs.clock.day >= WIN_DAY &&
        this.gs.homesteadTier >= 1 &&
        !this.gs.winShown &&
        !this.winShownLocal
          ? {
              daysSurvived: Math.max(this.gs.stats.daysSurvived, this.gs.clock.day),
              cropsHarvested: this.gs.stats.cropsHarvested,
              woodGathered: this.gs.stats.woodGathered,
              stalkerCaught: this.gs.stats.stalkerCaught,
            }
          : null,
    };

    const json = JSON.stringify(snap);
    if (!force && json === this.lastHudJson) return;
    this.lastHudJson = json;
    this.onHud(snap);
  }
}

void BAG_SIZE_BASE;
void SHACK_COST;
