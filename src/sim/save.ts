import type { Phase } from './clock';
import type { Tile } from './farm';
import type { CodexEntry, Seed } from './genetics';
import {
  addItem,
  createInventory,
  normalizeInventory,
  type Inventory,
} from './inventory';
import { cropItem, ITEM_DARKWOOD, ITEM_WOOD, trophyItem } from './items';
import type { PityState } from './luck';

export const SAVE_VERSION = 5;

export interface GameStats {
  cropsHarvested: number;
  woodGathered: number;
  darkwoodGathered: number;
  daysSurvived: number;
  trophies: number;
  hybridsDiscovered: number;
  weaselsFelled: number;
}

export type WeaponId = 'rock' | 'bow' | 'blunderbuss';

/** Chopped trees: "tx,ty" → day it was felled. */
export type ChoppedTrees = Record<string, number>;

export interface SaveData {
  version: number;
  seed: number;
  day: number;
  phase: Phase;
  elapsed: number;
  tiles: Tile[][];
  weapon: WeaponId;
  unlockedWeapons: WeaponId[];
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
    darkwoodGathered: 0,
    daysSurvived: 1,
    trophies: 0,
    hybridsDiscovered: 0,
    weaselsFelled: 0,
  };
}

export function serialize(data: SaveData): string {
  return JSON.stringify(data);
}

/**
 * v3 kept wood/darkwood as bare counters and the inventory as a name→count map.
 * v4 moved all of it into 24 slots. Fold either shape in on load.
 */
function migrateInventory(data: Record<string, unknown>): Inventory {
  const raw = data.inventory;
  if (Array.isArray(raw)) return normalizeInventory(raw);

  const inv = createInventory();
  const wood = typeof data.wood === 'number' ? data.wood : 0;
  const darkwood = typeof data.darkwood === 'number' ? data.darkwood : 0;
  if (wood > 0) addItem(inv, ITEM_WOOD, wood);
  if (darkwood > 0) addItem(inv, ITEM_DARKWOOD, darkwood);
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
  // The slingshot became the starting rock in v4.
  if (w === 'bow' || w === 'blunderbuss') return w;
  return 'rock';
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
      : ['rock' as const];

    const data = parsed as unknown as SaveData;
    data.version = SAVE_VERSION;
    data.inventory = migrateInventory(parsed);
    data.weapon = migrateWeapon(parsed.weapon);
    data.unlockedWeapons = Array.from(new Set(['rock' as WeaponId, ...unlocked]));
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
    data.toolbarSlot = typeof parsed.toolbarSlot === 'number' ? parsed.toolbarSlot : 1;
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
    weapon: 'rock',
    unlockedWeapons: ['rock'],
    irrigationTier: 2,
    bucketFill: 0,
    selectedCrop: 'turnip',
    inventory: createInventory(),
    inventoryOpen: true,
    duckettes: 0,
    choppedTrees: {},
    clearedStumps: {},
    dropPity: {},
    toolbarSlot: 1,
    toolSlotActive: false,
    seedInventory: [],
    codex: [],
    stats: defaultStats(),
    simTime: 0,
    winShown: false,
    trophies: [],
  };
}
