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

export const SAVE_VERSION = 6;

export interface GameStats {
  cropsHarvested: number;
  woodGathered: number;
  darkwoodGathered: number;
  daysSurvived: number;
  trophies: number;
  hybridsDiscovered: number;
  weaselsFelled: number;
}

export type WeaponId = 'rock' | 'shotgun' | 'bow' | 'axe';

export type BuildingId =
  | 'silo'
  | 'windmill'
  | 'tower_windmill'
  | 'water_tower'
  | 'well'
  | 'chicken_coop'
  | 'fence'
  | 'fence2'
  | 'small_barn'
  | 'open_barn'
  | 'barn'
  | 'silo_house'
  | 'big_barn';

export interface PlacedBuilding {
  id: BuildingId;
  x: number;
  z: number;
  rotation: number;
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
  // The old rock placeholder is now the Survival Pack shotgun. Keep rock in
  // the type only so older serialized saves can be read safely.
  if (w === 'shotgun') return 'shotgun';
  if (w === 'bow' || w === 'axe') return w;
  if (w === 'blunderbuss') return 'axe';
  return 'shotgun';
}

function migrateBuildings(raw: unknown): PlacedBuilding[] {
  if (!Array.isArray(raw)) return [];
  const ids = new Set<BuildingId>([
    'silo',
    'windmill',
    'tower_windmill',
    'water_tower',
    'well',
    'chicken_coop',
    'fence',
    'fence2',
    'small_barn',
    'open_barn',
    'barn',
    'silo_house',
    'big_barn',
  ]);
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    if (!ids.has(e.id as BuildingId)) return [];
    if (typeof e.x !== 'number' || typeof e.z !== 'number') return [];
    return [
      {
        id: e.id as BuildingId,
        x: e.x,
        z: e.z,
        rotation: typeof e.rotation === 'number' ? e.rotation : 0,
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
    data.inventory = migrateInventory(parsed);
    data.weapon = migrateWeapon(parsed.weapon);
    data.unlockedWeapons = Array.from(new Set(['shotgun' as WeaponId, ...unlocked]));
    const savedTier = typeof parsed.homesteadTier === 'number' ? parsed.homesteadTier : 1;
    data.homesteadTier = Math.min(Math.max(savedTier, 1), 5);
    data.placedBuildings = migrateBuildings(parsed.placedBuildings);
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
    // v4 used slot 0 for the fist. v5 introduced the ranged slot at index 0;
    // that meaning remains stable now that the ranged asset is a shotgun.
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
