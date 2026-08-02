/**
 * Shared mutable game state — pure, no renderer/DOM.
 */
import {
  BUCKET_CAPACITY,
  GRID_H,
  GRID_W,
  HOMESTEAD_SPAWN_X,
  HOMESTEAD_SPAWN_Z,
  TOOLBAR_SLOTS,
  TREE_RESPAWN_DAYS,
  WIN_DAY,
} from '../content';
import { createClock, type ClockState, stepClock, type ClockStepResult } from './clock';
import {
  canPlantTile,
  cloneGrid,
  createEmptyGrid,
  decayUnplantedTilth,
  getTile,
  harvestTile,
  plantTile,
  stepCrops,
  type HarvestResult,
  type Tile,
} from './farm';
import type { CodexEntry, Seed, SeedPacket } from './genetics';
import { makeSeed, seedId } from './genetics';
import {
  addSeedPacket,
  canAddSeedPacket,
  cloneSeedPacket,
  consumeSeedPacket,
  discardSeedPacket,
  normalizeSeedPackets,
  seedPacketAt,
  SEED_RECOVERY_PER_HARVEST,
  sortSeedPackets,
} from './seedInventory';
import {
  addItem,
  cloneInventory,
  countItem,
  createInventory,
  hasRoomFor,
  normalizeInventory,
  removeAll,
  removeItem,
  type Inventory,
} from './inventory';
import { cropItem, itemInfo, ITEM_WOOD, type ItemId } from './items';
import type { PityState } from './luck';
import { mulberry32, type Rng } from './rng';
import {
  createNewSave,
  defaultStats,
  SAVE_VERSION,
  type ChoppedTrees,
  type BuildingId,
  type GameStats,
  type PlacedBuilding,
  type SaveData,
  type WeaponId,
  serialize,
  deserialize,
} from './save';
import type { AssetId } from '../content/purchasables';
import { seedPacketCapacity } from './buildings';

export interface GameState {
  seed: number;
  rng: Rng;
  clock: ClockState;
  tiles: Tile[][];
  playerX: number;
  playerZ: number;
  weapon: WeaponId;
  unlockedWeapons: WeaponId[];
  irrigationTier: number;
  bucketFill: number;
  selectedCrop: string;
  /** 24 slots, unlimited stack size */
  inventory: Inventory;
  /** Inventory panel visibility — toggled with I */
  inventoryOpen: boolean;
  /** Currency earned at the market stall */
  duckettes: number;
  /** "tx,ty" → day the tree was felled (a stump stands until it respawns) */
  choppedTrees: ChoppedTrees;
  /** Stumps the player has cleared: "tx,ty" → true */
  clearedStumps: Record<string, boolean>;
  /** Bad-luck protection counters, keyed by loot table entry */
  dropPity: PityState;
  /** Selected toolbar slot 0..TOOLBAR_SLOTS-1 */
  toolbarSlot: number;
  /** Dedicated water tool (bucket) selected instead of a numbered slot */
  toolSlotActive: boolean;
  /** Seconds until the boulder ability is ready again. */
  boulderCooldown: number;
  /** Seconds until the B-slot bear trap is ready again. */
  bearTrapCooldown: number;
  homesteadTier: number;
  placedBuildings: PlacedBuilding[];
  /** Counted plantable packets (including hybrids), one stack per full genotype. */
  seedInventory: SeedPacket[];
  codex: CodexEntry[];
  stats: GameStats;
  simTime: number;
  winShown: boolean;
  toast: string;
  toastTimer: number;
  trophies: string[];
  selectedSeedIndex: number;
}

export function createGameState(seed?: number): GameState {
  const s = seed ?? (Date.now() >>> 0);
  const starter: SeedPacket[] = [
    { seed: makeSeed('grass'), count: 1 },
    { seed: makeSeed('dandelion'), count: 1 },
    { seed: makeSeed('beet'), count: 1 },
    { seed: makeSeed('carrot'), count: 1 },
    { seed: makeSeed('lettuce'), count: 1 },
  ];
  return {
    seed: s,
    rng: mulberry32(s),
    clock: createClock(1, 'day', 0),
    tiles: createEmptyGrid(),
    playerX: HOMESTEAD_SPAWN_X,
    playerZ: HOMESTEAD_SPAWN_Z,
    weapon: 'shotgun',
    unlockedWeapons: ['shotgun'],
    homesteadTier: 1,
    placedBuildings: [],
    irrigationTier: 2,
    bucketFill: 0,
    selectedCrop: 'beet',
    inventory: createInventory(),
    inventoryOpen: true,
    duckettes: 0,
    choppedTrees: {},
    clearedStumps: {},
    dropPity: {},
    toolbarSlot: 0, // start on the Survival Pack shotgun for visual testing
    toolSlotActive: false,
    boulderCooldown: 0,
    bearTrapCooldown: 0,
    seedInventory: starter,
    codex: starterCodexEntries(starter.map((packet) => packet.seed)),
    stats: defaultStats(),
    simTime: 0,
    winShown: false,
    toast: '',
    toastTimer: 0,
    trophies: [],
    selectedSeedIndex: 2, // beet
  };
}

function gridMatches(tiles: Tile[][]): boolean {
  return tiles.length === GRID_H && tiles.every((row) => row.length === GRID_W);
}

function starterCodexEntries(starter: readonly Seed[]): CodexEntry[] {
  return starter.map((seed) => ({
    id: seedId(seed),
    seed: {
      ...seed,
      traits: { ...seed.traits },
      lineage: seed.lineage ? [...seed.lineage] : undefined,
    },
    discoveredDay: 1,
  }));
}

export function loadFromSaveData(data: SaveData): GameState {
  const tiles =
    data.tiles.length && gridMatches(data.tiles) ? cloneGrid(data.tiles) : createEmptyGrid();
  const base = createGameState(data.seed);
  return {
    ...base,
    clock: createClock(data.day, data.phase, data.elapsed),
    tiles,
    playerX: Number.isFinite(data.playerX) ? data.playerX : base.playerX,
    playerZ: Number.isFinite(data.playerZ) ? data.playerZ : base.playerZ,
    weapon: data.weapon ?? 'shotgun',
    unlockedWeapons: data.unlockedWeapons ?? ['shotgun'],
    homesteadTier: Math.min(Math.max(data.homesteadTier ?? 1, 1), 5),
    placedBuildings: (data.placedBuildings ?? []).map((b) => ({ ...b })),
    irrigationTier: Math.max(data.irrigationTier ?? 2, 2),
    bucketFill: Math.min(data.bucketFill ?? 0, BUCKET_CAPACITY),
    selectedCrop: data.selectedCrop ?? 'beet',
    inventory: normalizeInventory(data.inventory),
    inventoryOpen: data.inventoryOpen ?? true,
    duckettes: data.duckettes ?? 0,
    choppedTrees: { ...(data.choppedTrees ?? {}) },
    clearedStumps: { ...(data.clearedStumps ?? {}) },
    dropPity: { ...(data.dropPity ?? {}) },
    toolbarSlot: Math.min(Math.max(data.toolbarSlot ?? 0, 0), TOOLBAR_SLOTS - 1),
    toolSlotActive: data.toolSlotActive ?? false,
    seedInventory: normalizeSeedPackets(
      data.seedInventory?.length ? data.seedInventory : base.seedInventory,
    ),
    codex: data.codex ?? [],
    stats: { ...defaultStats(), ...data.stats },
    simTime: data.simTime ?? 0,
    winShown: data.winShown ?? false,
    trophies: data.trophies ?? [],
  };
}

export function toSaveData(gs: GameState): SaveData {
  return {
    version: SAVE_VERSION,
    seed: gs.seed,
    day: gs.clock.day,
    phase: gs.clock.phase,
    elapsed: gs.clock.elapsed,
    tiles: cloneGrid(gs.tiles),
    playerX: gs.playerX,
    playerZ: gs.playerZ,
    weapon: gs.weapon,
    unlockedWeapons: [...gs.unlockedWeapons],
    homesteadTier: gs.homesteadTier,
    placedBuildings: gs.placedBuildings.map((b) => ({ ...b })),
    irrigationTier: gs.irrigationTier,
    bucketFill: gs.bucketFill,
    selectedCrop: gs.selectedCrop,
    inventory: cloneInventory(gs.inventory),
    inventoryOpen: gs.inventoryOpen,
    duckettes: gs.duckettes,
    choppedTrees: { ...gs.choppedTrees },
    clearedStumps: { ...gs.clearedStumps },
    dropPity: { ...gs.dropPity },
    toolbarSlot: gs.toolbarSlot,
    toolSlotActive: gs.toolSlotActive,
    seedInventory: gs.seedInventory.map(cloneSeedPacket),
    codex: gs.codex.map((c) => ({
      ...c,
      seed: { ...c.seed, traits: { ...c.seed.traits } },
    })),
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
  if (gs.boulderCooldown > 0) gs.boulderCooldown = Math.max(0, gs.boulderCooldown - dt);
  if (gs.bearTrapCooldown > 0) gs.bearTrapCooldown = Math.max(0, gs.bearTrapCooldown - dt);
  return { ...result, matured };
}

export function setToast(gs: GameState, msg: string, duration = 3): void {
  gs.toast = msg;
  gs.toastTimer = duration;
}

/** Dawn housekeeping: bare soil goes back to grass, felled trees come back. */
export function onNewDay(gs: GameState): {
  lostTilth: { x: number; y: number }[];
  regrown: { tx: number; ty: number }[];
  seedReserveAdded: boolean;
} {
  const seedReserveAdded = gs.seedInventory.length === 0 && addSeedToInventory(gs, makeSeed('grass'));
  return {
    lostTilth: decayUnplantedTilth(gs.tiles, gs.clock.day),
    regrown: respawnTrees(gs),
    seedReserveAdded,
  };
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

/** Sell one item stack (or a single unit) for duckettes. Returns what was earned. */
export function sellItem(gs: GameState, id: ItemId, all: boolean): number {
  const have = countItem(gs.inventory, id);
  if (have <= 0) return 0;
  const n = all ? have : 1;
  if (!removeItem(gs.inventory, id, n)) return 0;
  const earned = itemInfo(id).price * n;
  gs.duckettes += earned;
  return earned;
}

export function sellEverything(gs: GameState): number {
  let earned = 0;
  for (const slot of [...gs.inventory]) {
    if (!slot) continue;
    const n = removeAll(gs.inventory, slot.id);
    earned += itemInfo(slot.id).price * n;
  }
  gs.duckettes += earned;
  return earned;
}

// --------------------------------------------------------------------- trees

export function treeKey(tx: number, ty: number): string {
  return `${tx},${ty}`;
}

export function isTreeChopped(gs: GameState, tx: number, ty: number): boolean {
  return treeKey(tx, ty) in gs.choppedTrees;
}

export function isStumpCleared(gs: GameState, tx: number, ty: number): boolean {
  return gs.clearedStumps[treeKey(tx, ty)] === true;
}

export function markTreeChopped(gs: GameState, tx: number, ty: number): void {
  gs.choppedTrees[treeKey(tx, ty)] = gs.clock.day;
  delete gs.clearedStumps[treeKey(tx, ty)];
}

export function clearStump(gs: GameState, tx: number, ty: number): boolean {
  if (isStumpCleared(gs, tx, ty)) return false;
  gs.clearedStumps[treeKey(tx, ty)] = true;
  return true;
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
    delete gs.clearedStumps[key];
    back.push({ tx, ty });
  }
  return back;
}

export function checkWin(gs: GameState): boolean {
  return gs.clock.day >= WIN_DAY && !gs.winShown;
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
}

export function discoverSeed(gs: GameState, seed: Seed): boolean {
  const id = seedId(seed);
  if (gs.codex.some((c) => c.id === id)) return false;
  gs.codex.push({ id, seed: { ...seed, traits: { ...seed.traits } }, discoveredDay: gs.clock.day });
  gs.stats.hybridsDiscovered += seed.hybrid ? 1 : 0;
  return true;
}

export function addSeedToInventory(gs: GameState, seed: Seed, count = 1): boolean {
  if (!addSeedPacket(gs.seedInventory, seed, count, seedPacketCapacity(gs.placedBuildings))) return false;
  discoverSeed(gs, seed);
  return true;
}

export function canStoreSeedPacket(gs: GameState, seed: Seed, count = 1): boolean {
  return canAddSeedPacket(gs.seedInventory, seed, count, seedPacketCapacity(gs.placedBuildings));
}

function failedHarvest(): HarvestResult {
  return { ok: false, seed: null, count: 0, hybridChild: null };
}

/**
 * Harvest a mature crop and commit its produce plus one recovered packet as a
 * single pure transaction. A full destination leaves the tile untouched.
 */
export function harvestCropTransaction(gs: GameState, tx: number, ty: number): HarvestResult {
  const tile = getTile(gs.tiles, tx, ty);
  if (!tile || tile.state !== 'mature' || !tile.seed) return failedHarvest();
  const seed = tile.seed;
  const produce = cropItem(seed.displayName);
  if (!hasRoomFor(gs.inventory, produce) || !canStoreSeedPacket(gs, seed, SEED_RECOVERY_PER_HARVEST)) {
    return failedHarvest();
  }

  const before = { ...tile };
  const result = harvestTile(gs.tiles, tx, ty);
  if (!result.ok || !result.seed || !addItem(gs.inventory, produce, result.count)) {
    Object.assign(tile, before);
    return failedHarvest();
  }
  if (!addSeedToInventory(gs, result.seed, SEED_RECOVERY_PER_HARVEST)) {
    removeItem(gs.inventory, produce, result.count);
    Object.assign(tile, before);
    return failedHarvest();
  }
  return result;
}

/** Consume one exact genotype only after the farm predicate has passed. */
export function plantSeedPacket(gs: GameState, tx: number, ty: number, seed: Seed): boolean {
  if (!canPlantTile(gs.tiles, tx, ty)) return false;
  if (!consumeSeedPacket(gs.seedInventory, seed, 1)) return false;
  if (!plantTile(gs.tiles, tx, ty, seed)) {
    // The predicate and mutation share the same pure tile rules. Keep the
    // rollback explicit so a future rule change cannot erase a packet.
    addSeedPacket(gs.seedInventory, seed, 1, seedPacketCapacity(gs.placedBuildings));
    return false;
  }
  if (gs.selectedSeedIndex >= gs.seedInventory.length) {
    gs.selectedSeedIndex = Math.max(0, gs.seedInventory.length - 1);
  }
  return true;
}

export function discardSeedFromInventory(gs: GameState, index: number, count = 1): boolean {
  const ok = discardSeedPacket(gs.seedInventory, index, count);
  if (!ok) return false;
  if (!gs.seedInventory.length) gs.selectedSeedIndex = 0;
  else gs.selectedSeedIndex = Math.min(gs.selectedSeedIndex, gs.seedInventory.length - 1);
  const seed = selectedSeed(gs);
  if (seed) gs.selectedCrop = seed.species;
  return true;
}

export function sortSeedInventory(gs: GameState): void {
  gs.selectedSeedIndex = sortSeedPackets(gs.seedInventory, gs.selectedSeedIndex);
  const seed = selectedSeed(gs);
  if (seed) gs.selectedCrop = seed.species;
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

export function selectedSeedPacket(gs: GameState): SeedPacket | null {
  return seedPacketAt(gs.seedInventory, gs.selectedSeedIndex);
}

export function selectedSeed(gs: GameState): Seed | null {
  return selectedSeedPacket(gs)?.seed ?? null;
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

export function unlockWeapon(gs: GameState, weapon: WeaponId): boolean {
  if (gs.unlockedWeapons.includes(weapon)) return false;
  gs.unlockedWeapons.push(weapon);
  return true;
}

export function placeBuilding(
  gs: GameState,
  id: BuildingId | AssetId,
  x: number,
  z: number,
  rotation = 0,
  gateOpen = false,
): void {
  gs.placedBuildings.push({ id, x, z, rotation, gateOpen });
}

export function newGameFromSeed(seed: number): GameState {
  const save = createNewSave(seed);
  save.tiles = createEmptyGrid();
  return loadFromSaveData(save);
}
