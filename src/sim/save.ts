import type { Phase } from './clock';
import type { Tile } from './farm';
import type { CodexEntry, Seed } from './genetics';
import {
  addItem,
  createInventory,
  normalizeInventory,
  type Inventory,
} from './inventory';
import { cropItem, ITEM_WOOD, trophyItem } from './items';
import type { PityState } from './luck';
import { assetDefinition, type AssetId } from '../content/purchasables';

export const SAVE_VERSION = 8;

export interface GameStats {
  cropsHarvested: number;
  woodGathered: number;
  daysSurvived: number;
  trophies: number;
  hybridsDiscovered: number;
  foxesFelled: number;
}

export type WeaponId = 'shotgun' | 'bow' | 'axe';

/** Stable gameplay IDs from the purchasable asset catalog. */
export type BuildingId = AssetId;

export interface PlacedBuilding {
  id: BuildingId;
  x: number;
  z: number;
  rotation: number;
  gateOpen?: boolean;
}

/** Chopped trees: "tx,ty" → day it was felled. */
export type ChoppedTrees = Record<string, number>;

export interface SaveData {
  version: number;
  seed: number;
  day: number;
  phase: Phase;
  elapsed: number;
  tiles: Tile[][];
  playerX: number;
  playerZ: number;
  weapon: WeaponId;
  unlockedWeapons: WeaponId[];
  homesteadTier: number;
  placedBuildings: PlacedBuilding[];
  irrigationTier: number;
  bucketFill: number;
  selectedCrop: string;
  inventory: Inventory;
  inventoryOpen: boolean;
  duckettes: number;
  choppedTrees: ChoppedTrees;
  clearedStumps: Record<string, boolean>;
  dropPity: PityState;
  toolbarSlot: number;
  toolSlotActive: boolean;
  seedInventory: Seed[];
  codex: CodexEntry[];
  stats: GameStats;
  simTime: number;
  winShown: boolean;
  trophies: string[];
}

export function defaultStats(): GameStats {
  return {
    cropsHarvested: 0,
    woodGathered: 0,
    daysSurvived: 1,
    trophies: 0,
    hybridsDiscovered: 0,
    foxesFelled: 0,
  };
}

export function serialize(data: SaveData): string {
  return JSON.stringify(data);
}

/** v4 moved the old counters and bag map into the current 24-slot inventory. */
function migrateInventory(data: Record<string, unknown>, incomingVersion: number): Inventory {
  const raw = data.inventory;
  if (Array.isArray(raw)) {
    const inv = normalizeInventory(raw);
    // Pre-v5 saves kept trophies in a separate list. Current saves already
    // include them in the inventory, so only fold the list in for older data.
    if (incomingVersion < 5 && Array.isArray(data.trophies)) {
      for (const t of data.trophies as string[]) {
        if (typeof t === 'string') addItem(inv, trophyItem(t), 1);
      }
    }
    return inv;
  }

  const inv = createInventory();
  const wood = typeof data.wood === 'number' ? data.wood : 0;
  if (wood > 0) addItem(inv, ITEM_WOOD, wood);
  if (raw && typeof raw === 'object') {
    for (const [name, count] of Object.entries(raw as Record<string, number>)) {
      if (typeof count === 'number' && count > 0) addItem(inv, cropItem(name), count);
    }
  }
  if (Array.isArray(data.trophies)) {
    for (const t of data.trophies as string[]) {
      if (typeof t === 'string') addItem(inv, trophyItem(t), 1);
    }
  }
  return inv;
}

function migrateWeapon(w: unknown): WeaponId {
  if (w === 'shotgun') return 'shotgun';
  if (w === 'bow' || w === 'axe') return w;
  return 'shotgun';
}

function migrateStats(raw: unknown): GameStats {
  const stats = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const number = (key: keyof GameStats, fallback: number): number =>
    typeof stats[key] === 'number' && Number.isFinite(stats[key]) ? (stats[key] as number) : fallback;
  return {
    cropsHarvested: number('cropsHarvested', 0),
    woodGathered: number('woodGathered', 0),
    daysSurvived: number('daysSurvived', 1),
    trophies: number('trophies', 0),
    hybridsDiscovered: number('hybridsDiscovered', 0),
    foxesFelled: number('foxesFelled', 0),
  };
}

function migrateBuildings(raw: unknown): PlacedBuilding[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== 'string' || !assetDefinition(e.id)) {
      console.warn(`[Save] Skipping unknown placed asset id: ${String(e.id)}`);
      return [];
    }
    if (typeof e.x !== 'number' || typeof e.z !== 'number') return [];
    return [
      {
        id: e.id,
        x: e.x,
        z: e.z,
        rotation: typeof e.rotation === 'number' ? e.rotation : 0,
        gateOpen: e.gateOpen === true,
      },
    ];
  });
}

export function deserialize(raw: string): SaveData | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.seed !== 'number') return null;
    if (typeof parsed.day !== 'number') return null;
    if (parsed.phase !== 'day' && parsed.phase !== 'night') return null;
    if (!Array.isArray(parsed.tiles)) return null;

    const unlocked = Array.isArray(parsed.unlockedWeapons)
      ? (parsed.unlockedWeapons as unknown[]).map(migrateWeapon)
      : ['shotgun' as const];

    // Capture the incoming version before stamping: `data` aliases `parsed`.
    const incoming = typeof parsed.version === 'number' ? parsed.version : 0;
    const data = parsed as unknown as SaveData;
    data.version = SAVE_VERSION;
    data.inventory = migrateInventory(parsed, incoming);
    data.weapon = migrateWeapon(parsed.weapon);
    data.unlockedWeapons = Array.from(new Set(['shotgun' as WeaponId, ...unlocked]));
    const savedTier = typeof parsed.homesteadTier === 'number' ? parsed.homesteadTier : 1;
    data.homesteadTier = Math.min(Math.max(savedTier, 1), 5);
    data.placedBuildings = migrateBuildings(parsed.placedBuildings);
    data.playerX = typeof parsed.playerX === 'number' ? parsed.playerX : 120;
    data.playerZ = typeof parsed.playerZ === 'number' ? parsed.playerZ : 120;
    // "Ducketts" was a typo — v5 spells it duckettes.
    data.duckettes =
      typeof parsed.duckettes === 'number'
        ? parsed.duckettes
        : typeof parsed.ducketts === 'number'
          ? (parsed.ducketts as number)
          : 0;
    data.inventoryOpen = parsed.inventoryOpen !== false;
    data.choppedTrees =
      parsed.choppedTrees && typeof parsed.choppedTrees === 'object'
        ? (parsed.choppedTrees as ChoppedTrees)
        : {};
    data.clearedStumps =
      parsed.clearedStumps && typeof parsed.clearedStumps === 'object'
        ? (parsed.clearedStumps as Record<string, boolean>)
        : {};
    data.dropPity =
      parsed.dropPity && typeof parsed.dropPity === 'object'
        ? (parsed.dropPity as PityState)
        : {};
    data.stats = migrateStats(parsed.stats);
    // v4 used slot 0 for the original unarmed action. v5 introduced the ranged
    // slot at index 0; that meaning remains stable with the shotgun asset.
    const preV5 = incoming < 5;
    data.toolbarSlot =
      !preV5 && typeof parsed.toolbarSlot === 'number' ? parsed.toolbarSlot : preV5 ? 1 : 0;
    data.toolSlotActive = parsed.toolSlotActive === true;
    return data;
  } catch {
    return null;
  }
}

export function createNewSave(seed: number): SaveData {
  return {
    version: SAVE_VERSION,
    seed,
    day: 1,
    phase: 'day',
    elapsed: 0,
    tiles: [],
    playerX: 120,
    playerZ: 120,
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
    toolbarSlot: 0,
    toolSlotActive: false,
    seedInventory: [],
    codex: [],
    stats: defaultStats(),
    simTime: 0,
    winShown: false,
    trophies: [],
  };
}
