/**
 * Shared mutable game state — pure, no renderer/DOM.
 */
import {
  BAG_SIZE_BASE,
  BAG_SIZE_CABIN,
  BAG_SIZE_UPGRADED,
  BUCKET_CAPACITY,
  CABIN_COST_DARKWOOD,
  CABIN_COST_WOOD,
  GRID_H,
  GRID_W,
  STALL_COST,
  TOOLBAR_SLOTS,
  TREE_RESPAWN_DAYS,
  WIN_DAY,
} from '../content';
import { createClock, type ClockState, stepClock, type ClockStepResult } from './clock';
import {
  cloneGrid,
  createEmptyGrid,
  stepCrops,
  type Tile,
} from './farm';
import type { CodexEntry, Seed } from './genetics';
import { makeSeed, seedId } from './genetics';
import {
  addItem,
  cloneInventory,
  countItem,
  createInventory,
  normalizeInventory,
  removeAll,
  removeItem,
  type Inventory,
} from './inventory';
import { itemInfo, ITEM_DARKWOOD, ITEM_WOOD, type ItemId } from './items';
import { mulberry32, type Rng } from './rng';
import {
  createNewSave,
  defaultStats,
  type ChoppedTrees,
  type GameStats,
  type HomesteadTier,
  type SaveData,
  type WeaponId,
  serialize,
  deserialize,
} from './save';

export interface GameState {
  seed: number;
  rng: Rng;
  clock: ClockState;
  tiles: Tile[][];
  bagWood: number;
  bagDarkwood: number;
  bagSize: number;
  shedBuilt: boolean;
  homesteadTier: HomesteadTier;
  weapon: WeaponId;
  unlockedWeapons: WeaponId[];
  irrigationTier: number;
  bucketFill: number;
  selectedCrop: string;
  /** 24 slots, unlimited stack size */
  inventory: Inventory;
  /** Currency earned at the market stall */
  ducketts: number;
  /** "tx,ty" → day the overworld tree was felled */
  choppedTrees: ChoppedTrees;
  /** Selected toolbar slot 0..TOOLBAR_SLOTS-1 */
  toolbarSlot: number;
  /** Dedicated water tool (bucket) selected instead of a numbered slot */
  toolSlotActive: boolean;
  /** Plantable seeds (including hybrids) */
  seedInventory: Seed[];
  codex: CodexEntry[];
  attention: number;
  attentionFloor: number;
  stats: GameStats;
  simTime: number;
  winShown: boolean;
  toast: string;
  toastTimer: number;
  stalkerHintShown: boolean;
  trophies: string[];
  selectedSeedIndex: number;
}

export function createGameState(seed?: number): GameState {
  const s = seed ?? (Date.now() >>> 0);
  const starter: Seed[] = [
    makeSeed('grass'),
    makeSeed('dandelion'),
    makeSeed('turnip'),
    makeSeed('carrot'),
    makeSeed('onion'),
  ];
  return {
    seed: s,
    rng: mulberry32(s),
    clock: createClock(1, 'day', 0),
    tiles: createEmptyGrid(),
    bagWood: 0,
    bagDarkwood: 0,
    bagSize: BAG_SIZE_BASE,
    shedBuilt: false,
    homesteadTier: 0,
    weapon: 'rock',
    unlockedWeapons: ['rock'],
    irrigationTier: 1,
    bucketFill: 0,
    selectedCrop: 'turnip',
    inventory: createInventory(),
    ducketts: 0,
    choppedTrees: {},
    toolbarSlot: 0,
    toolSlotActive: false,
    seedInventory: starter,
    codex: [],
    attention: 0,
    attentionFloor: 0,
    stats: defaultStats(),
    simTime: 0,
    winShown: false,
    toast: '',
    toastTimer: 0,
    stalkerHintShown: false,
    trophies: [],
    selectedSeedIndex: 2, // turnip
  };
}

function gridMatches(tiles: Tile[][]): boolean {
  return tiles.length === GRID_H && tiles.every((row) => row.length === GRID_W);
}

export function loadFromSaveData(data: SaveData): GameState {
  const tiles =
    data.tiles.length && gridMatches(data.tiles) ? cloneGrid(data.tiles) : createEmptyGrid();
  const base = createGameState(data.seed);
  return {
    ...base,
    clock: createClock(data.day, data.phase, data.elapsed),
    tiles,
    bagSize: data.bagSize,
    shedBuilt: data.shedBuilt || (data.homesteadTier ?? 0) >= 1,
    homesteadTier: data.homesteadTier ?? (data.shedBuilt ? 1 : 0),
    weapon: data.weapon ?? 'rock',
    unlockedWeapons: data.unlockedWeapons ?? ['rock'],
    irrigationTier: data.irrigationTier ?? 1,
    bucketFill: Math.min(data.bucketFill ?? 0, BUCKET_CAPACITY),
    selectedCrop: data.selectedCrop ?? 'turnip',
    inventory: normalizeInventory(data.inventory),
    ducketts: data.ducketts ?? 0,
    choppedTrees: { ...(data.choppedTrees ?? {}) },
    toolbarSlot: Math.min(Math.max(data.toolbarSlot ?? 0, 0), TOOLBAR_SLOTS - 1),
    toolSlotActive: data.toolSlotActive ?? false,
    seedInventory: data.seedInventory?.length ? data.seedInventory : base.seedInventory,
    codex: data.codex ?? [],
    attentionFloor: data.attentionFloor ?? 0,
    stats: { ...defaultStats(), ...data.stats },
    simTime: data.simTime ?? 0,
    winShown: data.winShown ?? false,
    trophies: data.trophies ?? [],
  };
}

export function toSaveData(gs: GameState): SaveData {
  return {
    version: 4,
    seed: gs.seed,
    day: gs.clock.day,
    phase: gs.clock.phase,
    elapsed: gs.clock.elapsed,
    tiles: cloneGrid(gs.tiles),
    wood: woodCount(gs),
    darkwood: darkwoodCount(gs),
    bagSize: gs.bagSize,
    shedBuilt: gs.homesteadTier >= 1,
    homesteadTier: gs.homesteadTier,
    weapon: gs.weapon,
    unlockedWeapons: [...gs.unlockedWeapons],
    irrigationTier: gs.irrigationTier,
    bucketFill: gs.bucketFill,
    selectedCrop: gs.selectedCrop,
    inventory: cloneInventory(gs.inventory),
    ducketts: gs.ducketts,
    choppedTrees: { ...gs.choppedTrees },
    toolbarSlot: gs.toolbarSlot,
    toolSlotActive: gs.toolSlotActive,
    seedInventory: gs.seedInventory.map((s) => ({
      ...s,
      traits: { ...s.traits },
      lineage: s.lineage ? [...s.lineage] : undefined,
    })),
    codex: gs.codex.map((c) => ({
      ...c,
      seed: { ...c.seed, traits: { ...c.seed.traits } },
    })),
    attentionFloor: gs.attentionFloor,
    stats: { ...gs.stats },
    simTime: gs.simTime,
    winShown: gs.winShown,
    trophies: [...gs.trophies],
  };
}

export function saveToString(gs: GameState): string {
  return serialize(toSaveData(gs));
}

export function loadFromString(raw: string): GameState | null {
  const data = deserialize(raw);
  if (!data) return null;
  return loadFromSaveData(data);
}

export interface GameStepResult extends ClockStepResult {
  matured: { x: number; y: number }[];
}

export function stepGameClock(gs: GameState, dt: number): GameStepResult {
  gs.simTime += dt;
  const result = stepClock(gs.clock, dt);
  gs.clock = result.clock;
  if (result.becameDay) {
    gs.stats.daysSurvived = gs.clock.day;
  }
  const matured = stepCrops(gs.tiles, dt);
  if (gs.toastTimer > 0) {
    gs.toastTimer -= dt;
    if (gs.toastTimer <= 0) gs.toast = '';
  }
  return { ...result, matured };
}

export function setToast(gs: GameState, msg: string, duration = 3): void {
  gs.toast = msg;
  gs.toastTimer = duration;
}

// ---------------------------------------------------------------- inventory

export function addToInventory(gs: GameState, id: ItemId, n = 1): boolean {
  const ok = addItem(gs.inventory, id, n);
  if (!ok) setToast(gs, 'Inventory full!', 2);
  return ok;
}

export function takeFromInventory(gs: GameState, id: ItemId, n = 1): boolean {
  return removeItem(gs.inventory, id, n);
}

export function woodCount(gs: GameState): number {
  return countItem(gs.inventory, ITEM_WOOD);
}

export function darkwoodCount(gs: GameState): number {
  return countItem(gs.inventory, ITEM_DARKWOOD);
}

/** Sell one item stack (or a single unit) for ducketts. Returns ducketts earned. */
export function sellItem(gs: GameState, id: ItemId, all: boolean): number {
  const have = countItem(gs.inventory, id);
  if (have <= 0) return 0;
  const n = all ? have : 1;
  if (!removeItem(gs.inventory, id, n)) return 0;
  const earned = itemInfo(id).price * n;
  gs.ducketts += earned;
  return earned;
}

export function sellEverything(gs: GameState): number {
  let earned = 0;
  for (const slot of [...gs.inventory]) {
    if (!slot) continue;
    const n = removeAll(gs.inventory, slot.id);
    earned += itemInfo(slot.id).price * n;
  }
  gs.ducketts += earned;
  return earned;
}

// ------------------------------------------------------------------ hauling

export function bankBag(gs: GameState): number {
  const n = gs.bagWood;
  const d = gs.bagDarkwood;
  if (n > 0) addToInventory(gs, ITEM_WOOD, n);
  if (d > 0) addToInventory(gs, ITEM_DARKWOOD, d);
  gs.stats.woodGathered += n;
  gs.stats.darkwoodGathered += d;
  gs.bagWood = 0;
  gs.bagDarkwood = 0;
  return n + d;
}

export function dumpBag(gs: GameState): number {
  const n = gs.bagWood + gs.bagDarkwood;
  gs.bagWood = 0;
  gs.bagDarkwood = 0;
  return n;
}

export function tryUpgradeHomestead(gs: GameState): boolean {
  if (gs.homesteadTier === 0) {
    if (woodCount(gs) < STALL_COST) return false;
    removeItem(gs.inventory, ITEM_WOOD, STALL_COST);
    gs.homesteadTier = 1;
    gs.shedBuilt = true;
    gs.bagSize = BAG_SIZE_UPGRADED;
    if (!gs.unlockedWeapons.includes('bow')) gs.unlockedWeapons.push('bow');
    return true;
  }
  if (gs.homesteadTier === 1) {
    if (woodCount(gs) < CABIN_COST_WOOD || darkwoodCount(gs) < CABIN_COST_DARKWOOD) return false;
    removeItem(gs.inventory, ITEM_WOOD, CABIN_COST_WOOD);
    removeItem(gs.inventory, ITEM_DARKWOOD, CABIN_COST_DARKWOOD);
    gs.homesteadTier = 2;
    gs.bagSize = BAG_SIZE_CABIN;
    if (!gs.unlockedWeapons.includes('blunderbuss')) gs.unlockedWeapons.push('blunderbuss');
    gs.irrigationTier = Math.max(gs.irrigationTier, 2);
    return true;
  }
  return false;
}

/** @deprecated */
export function tryBuildShed(gs: GameState): boolean {
  if (gs.homesteadTier >= 1) return false;
  return tryUpgradeHomestead(gs);
}

// --------------------------------------------------------------------- trees

export function treeKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function isTreeChopped(gs: GameState, tx: number, ty: number): boolean {
  return treeKey(tx, ty) in gs.choppedTrees;
}

export function markTreeChopped(gs: GameState, tx: number, ty: number): void {
  gs.choppedTrees[treeKey(tx, ty)] = gs.clock.day;
}

/**
 * Grow felled trees back after TREE_RESPAWN_DAYS — but never onto worked ground,
 * or a farm laid out over a clearing would re-forest itself under the player.
 */
export function respawnTrees(gs: GameState): { tx: number; ty: number }[] {
  const back: { tx: number; ty: number }[] = [];
  for (const [key, day] of Object.entries(gs.choppedTrees)) {
    if (gs.clock.day - day < TREE_RESPAWN_DAYS) continue;
    const [tx, ty] = key.split(',').map(Number) as [number, number];
    const tile = gs.tiles[ty]?.[tx];
    if (!tile || tile.state !== 'grass') continue;
    delete gs.choppedTrees[key];
    back.push({ tx, ty });
  }
  return back;
}

export function checkWin(gs: GameState): boolean {
  return gs.clock.day >= WIN_DAY && gs.homesteadTier >= 1 && !gs.winShown;
}

export function markWinShown(gs: GameState): void {
  gs.winShown = true;
}

export function forceDawn(gs: GameState): void {
  if (gs.clock.phase === 'night') {
    gs.clock = createClock(gs.clock.day + 1, 'day', 0);
  } else {
    gs.clock = createClock(gs.clock.day, 'day', 0);
  }
  gs.stats.daysSurvived = gs.clock.day;
  gs.bagWood = 0;
  gs.bagDarkwood = 0;
  gs.attention = gs.attentionFloor;
}

export function forceDawnAfterStalker(gs: GameState): void {
  gs.stats.stalkerCaught += 1;
  forceDawn(gs);
  setToast(gs, 'You dropped everything.', 4);
}

export function canEnterWoods(gs: GameState): boolean {
  return gs.clock.phase === 'day';
}

export function discoverSeed(gs: GameState, seed: Seed): boolean {
  const id = seedId(seed);
  if (gs.codex.some((c) => c.id === id)) return false;
  gs.codex.push({ id, seed: { ...seed, traits: { ...seed.traits } }, discoveredDay: gs.clock.day });
  gs.stats.hybridsDiscovered += seed.hybrid ? 1 : 0;
  return true;
}

export function addSeedToInventory(gs: GameState, seed: Seed): void {
  gs.seedInventory.push(seed);
  discoverSeed(gs, seed);
}

export function fillBucket(gs: GameState): boolean {
  if (gs.bucketFill >= BUCKET_CAPACITY) return false;
  gs.bucketFill = BUCKET_CAPACITY;
  return true;
}

export function useBucketWater(gs: GameState): boolean {
  if (gs.bucketFill <= 0) return false;
  gs.bucketFill -= 1;
  return true;
}

export function selectedSeed(gs: GameState): Seed | null {
  return gs.seedInventory[gs.selectedSeedIndex] ?? gs.seedInventory[0] ?? null;
}

export function cycleSeed(gs: GameState, dir: number): void {
  if (!gs.seedInventory.length) return;
  gs.selectedSeedIndex =
    (gs.selectedSeedIndex + dir + gs.seedInventory.length) % gs.seedInventory.length;
  const s = selectedSeed(gs);
  if (s) gs.selectedCrop = s.species;
}

export function cycleWeapon(gs: GameState): void {
  const list = gs.unlockedWeapons;
  const i = list.indexOf(gs.weapon);
  gs.weapon = list[(i + 1) % list.length]!;
}

export function newGameFromSeed(seed: number): GameState {
  const save = createNewSave(seed, BAG_SIZE_BASE);
  save.tiles = createEmptyGrid();
  return loadFromSaveData(save);
}
