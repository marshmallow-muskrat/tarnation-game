import type { Phase } from './clock';
import { CROP_DEFS, GRID_H, GRID_W } from '../content';
import { createEmptyGrid, emptyTile, type Tile, type TileState } from './farm';
import type { CodexEntry, HybridMech, Seed, SeedPacket } from './genetics';
import { normalizeSeedPackets } from './seedInventory';
import {
  addItem,
  createInventory,
  normalizeInventory,
  type Inventory,
} from './inventory';
import { cropItem, ITEM_WOOD, trophyItem } from './items';
import type { PityState } from './luck';
import { assetDefinition, deedAssetId, type AssetId } from '../content/purchasables';

/**
 * Current compact wire format. Versions 3–8 remain readable through
 * migration; pre-counted v9 seed indexes are also upgraded to packet counts.
 */
export const SAVE_VERSION = 9;

/** Storage budgets used by the save service and release checks. */
export const SAVE_SIZE_BUDGETS = {
  fresh: 250_000,
  typical: 1_000_000,
  warning: 4_000_000,
} as const;

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
  seedInventory: SeedPacket[];
  codex: CodexEntry[];
  stats: GameStats;
  simTime: number;
  winShown: boolean;
  trophies: string[];
}

interface CompactSeed {
  /** species */
  s: string;
  /** yield, vigor, thirst, hardiness, weirdness */
  t: [number, number, number, number, number];
  /** display name */
  n: string;
  /** hybrid */
  h: boolean;
  /** mechanic */
  m: HybridMech;
  /** lineage */
  l?: string[];
}

interface CompactTile {
  x: number;
  y: number;
  /** tile state */
  s: TileState;
  /** non-default plantedAt, watered, stage, growth */
  p?: number;
  w?: 1;
  g?: number;
  r?: number;
  /** seed, breedA, breedB table references */
  a?: number;
  b?: number;
  c?: number;
  /** non-default structureHp */
  h?: number;
  /** bearTrap and bearTrapClosed */
  t?: 1;
  q?: 1;
  /** non-default tilledDay */
  d?: number;
}

interface CompactTiles {
  w: number;
  h: number;
  r: CompactTile[];
}

interface CompactCodexEntry {
  id: string;
  s: number;
  d: number;
}

interface CompactSeedInventoryEntry {
  /** seed genotype table reference */
  s: number;
  /** counted packets in this genotype stack */
  c: number;
}

const TILE_STATES: readonly TileState[] = [
  'grass',
  'tilled',
  'planted',
  'mature',
  'trench',
  'breeding',
];

const HYBRID_MECHANICS: readonly HybridMech[] = [
  'repel_foxes',
  'portable_light',
  'ironroot',
  'ricochet',
  'greed_crop',
  'none',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isTileState(value: unknown): value is TileState {
  return typeof value === 'string' && TILE_STATES.includes(value as TileState);
}

function isHybridMechanic(value: unknown): value is HybridMech {
  return typeof value === 'string' && HYBRID_MECHANICS.includes(value as HybridMech);
}

function cloneSeed(seed: Seed): Seed {
  return {
    ...seed,
    traits: { ...seed.traits },
    lineage: seed.lineage ? [...seed.lineage] : undefined,
  };
}

function seedKey(seed: Seed): string {
  return JSON.stringify([
    seed.species,
    seed.traits.yield,
    seed.traits.vigor,
    seed.traits.thirst,
    seed.traits.hardiness,
    seed.traits.weirdness,
    seed.displayName,
    seed.hybrid,
    seed.mech,
    seed.lineage ?? null,
  ]);
}

function encodeSeed(seed: Seed): CompactSeed {
  return {
    s: seed.species,
    t: [
      seed.traits.yield,
      seed.traits.vigor,
      seed.traits.thirst,
      seed.traits.hardiness,
      seed.traits.weirdness,
    ],
    n: seed.displayName,
    h: seed.hybrid,
    m: seed.mech,
    ...(seed.lineage ? { l: [...seed.lineage] } : {}),
  };
}

function encodeSeedReference(
  seed: Seed | null,
  seeds: CompactSeed[],
  indexes: Map<string, number>,
): number | undefined {
  if (!seed) return undefined;
  const key = seedKey(seed);
  const existing = indexes.get(key);
  if (existing !== undefined) return existing;
  const index = seeds.length;
  indexes.set(key, index);
  seeds.push(encodeSeed(seed));
  return index;
}

function isDefaultTile(tile: Tile): boolean {
  return (
    tile.state === 'grass' &&
    tile.plantedAt === -1 &&
    !tile.watered &&
    tile.stage === 0 &&
    tile.growth === 0 &&
    tile.seed === null &&
    tile.breedA === null &&
    tile.breedB === null &&
    tile.structureHp === 0 &&
    !tile.bearTrap &&
    !tile.bearTrapClosed &&
    tile.tilledDay === -1
  );
}

function encodeTile(
  tile: Tile,
  x: number,
  y: number,
  seeds: CompactSeed[],
  indexes: Map<string, number>,
): CompactTile {
  const record: CompactTile = { x, y, s: tile.state };
  if (tile.plantedAt !== -1) record.p = tile.plantedAt;
  if (tile.watered) record.w = 1;
  if (tile.stage !== 0) record.g = tile.stage;
  if (tile.growth !== 0) record.r = tile.growth;
  const seed = encodeSeedReference(tile.seed, seeds, indexes);
  if (seed !== undefined) record.a = seed;
  const breedA = encodeSeedReference(tile.breedA, seeds, indexes);
  if (breedA !== undefined) record.b = breedA;
  const breedB = encodeSeedReference(tile.breedB, seeds, indexes);
  if (breedB !== undefined) record.c = breedB;
  if (tile.structureHp !== 0) record.h = tile.structureHp;
  if (tile.bearTrap) record.t = 1;
  if (tile.bearTrapClosed) record.q = 1;
  if (tile.tilledDay !== -1) record.d = tile.tilledDay;
  return record;
}

function encodeCompact(data: SaveData): Record<string, unknown> {
  const seeds: CompactSeed[] = [];
  const indexes = new Map<string, number>();
  const records: CompactTile[] = [];

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const tile = data.tiles[y]?.[x];
      if (!tile || isDefaultTile(tile)) continue;
      records.push(encodeTile(tile, x, y, seeds, indexes));
    }
  }

  const seedInventory = data.seedInventory.map((packet): CompactSeedInventoryEntry => {
    const index = encodeSeedReference(packet.seed, seeds, indexes);
    if (index === undefined) throw new Error('Save seed inventory contained an empty seed');
    if (!Number.isInteger(packet.count) || packet.count <= 0) {
      throw new Error('Save seed inventory contained an invalid packet count');
    }
    return { s: index, c: packet.count };
  });
  const codex = data.codex.map((entry): CompactCodexEntry => {
    const index = encodeSeedReference(entry.seed, seeds, indexes);
    if (index === undefined) throw new Error('Save Codex entry contained an empty seed');
    return { id: entry.id, s: index, d: entry.discoveredDay };
  });

  return {
    version: SAVE_VERSION,
    seed: data.seed,
    day: data.day,
    phase: data.phase,
    elapsed: data.elapsed,
    tiles: { w: GRID_W, h: GRID_H, r: records } satisfies CompactTiles,
    playerX: data.playerX,
    playerZ: data.playerZ,
    weapon: data.weapon,
    unlockedWeapons: [...data.unlockedWeapons],
    homesteadTier: data.homesteadTier,
    placedBuildings: data.placedBuildings.map((building) => ({ ...building })),
    irrigationTier: data.irrigationTier,
    bucketFill: data.bucketFill,
    selectedCrop: data.selectedCrop,
    inventory: data.inventory.map((slot) => (slot ? { ...slot } : null)),
    inventoryOpen: data.inventoryOpen,
    duckettes: data.duckettes,
    choppedTrees: { ...data.choppedTrees },
    clearedStumps: { ...data.clearedStumps },
    dropPity: { ...data.dropPity },
    toolbarSlot: data.toolbarSlot,
    toolSlotActive: data.toolSlotActive,
    seedInventory,
    codex,
    seeds,
    stats: { ...data.stats },
    simTime: data.simTime,
    winShown: data.winShown,
    trophies: [...data.trophies],
  };
}

function decodeSeed(raw: unknown): Seed | null {
  if (
    !isRecord(raw) ||
    typeof raw.s !== 'string' ||
    !Object.prototype.hasOwnProperty.call(CROP_DEFS, raw.s)
  ) {
    return null;
  }
  if (
    !Array.isArray(raw.t) ||
    raw.t.length !== 5 ||
    !raw.t.every(isFiniteNumber) ||
    typeof raw.n !== 'string' ||
    typeof raw.h !== 'boolean' ||
    !isHybridMechanic(raw.m)
  ) {
    return null;
  }
  if (raw.l !== undefined && (!Array.isArray(raw.l) || !raw.l.every((value) => typeof value === 'string'))) {
    return null;
  }
  return {
    species: raw.s as Seed['species'],
    traits: {
      yield: raw.t[0]!,
      vigor: raw.t[1]!,
      thirst: raw.t[2]!,
      hardiness: raw.t[3]!,
      weirdness: raw.t[4]!,
    },
    displayName: raw.n,
    hybrid: raw.h,
    mech: raw.m,
    lineage: raw.l ? [...raw.l] : undefined,
  };
}

function decodeLegacySeed(raw: unknown): Seed | null {
  if (
    !isRecord(raw) ||
    typeof raw.species !== 'string' ||
    !Object.prototype.hasOwnProperty.call(CROP_DEFS, raw.species)
  ) {
    return null;
  }
  const traits = raw.traits;
  if (
    !isRecord(traits) ||
    !['yield', 'vigor', 'thirst', 'hardiness', 'weirdness'].every(
      (key) => isFiniteNumber(traits[key]) && traits[key] >= 0 && traits[key] <= 100,
    ) ||
    typeof raw.displayName !== 'string' ||
    raw.displayName.length === 0 ||
    typeof raw.hybrid !== 'boolean' ||
    !isHybridMechanic(raw.mech)
  ) {
    return null;
  }
  if (raw.lineage !== undefined && (!Array.isArray(raw.lineage) || !raw.lineage.every((value) => typeof value === 'string'))) {
    return null;
  }
  return {
    species: raw.species as Seed['species'],
    traits: {
      yield: traits.yield as number,
      vigor: traits.vigor as number,
      thirst: traits.thirst as number,
      hardiness: traits.hardiness as number,
      weirdness: traits.weirdness as number,
    },
    displayName: raw.displayName,
    hybrid: raw.hybrid,
    mech: raw.mech,
    lineage: raw.lineage ? [...(raw.lineage as string[])] : undefined,
  };
}

function seedAt(seeds: Seed[], value: unknown): Seed | null {
  if (!isIntegerInRange(value, 0, seeds.length - 1)) return null;
  return cloneSeed(seeds[value]);
}

function decodeCompactSeedPacket(raw: unknown, seeds: Seed[]): SeedPacket | null {
  // v9 compact saves before counted packets stored a bare genotype index.
  if (isIntegerInRange(raw, 0, seeds.length - 1)) {
    const seed = seedAt(seeds, raw);
    return seed ? { seed, count: 1 } : null;
  }
  if (!isRecord(raw) || !isIntegerInRange(raw.s, 0, seeds.length - 1) || !isIntegerInRange(raw.c, 1, Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  const seed = seedAt(seeds, raw.s);
  return seed ? { seed, count: raw.c } : null;
}

/** Migrate old full-grid Seed[] entries and current packet entries together. */
function migrateSeedInventory(raw: unknown): SeedPacket[] | null {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) return null;
  const packets: SeedPacket[] = [];
  for (const entry of raw) {
    if (isRecord(entry) && 'seed' in entry) {
      const seed = decodeLegacySeed(entry.seed);
      if (!seed || !isIntegerInRange(entry.count, 1, Number.MAX_SAFE_INTEGER)) return null;
      packets.push({ seed, count: entry.count });
      continue;
    }
    const seed = decodeLegacySeed(entry);
    if (!seed) return null;
    packets.push({ seed, count: 1 });
  }
  return normalizeSeedPackets(packets);
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined | null {
  if (!(key in record)) return undefined;
  return isFiniteNumber(record[key]) ? record[key] : null;
}

function decodeCompactSave(parsed: Record<string, unknown>): Record<string, unknown> | null {
  const rawTiles = parsed.tiles;
  const rawSeeds = parsed.seeds;
  if (
    !isRecord(rawTiles) ||
    rawTiles.w !== GRID_W ||
    rawTiles.h !== GRID_H ||
    !Array.isArray(rawTiles.r) ||
    !Array.isArray(rawSeeds)
  ) {
    return null;
  }
  const seeds: Seed[] = [];
  for (const rawSeed of rawSeeds) {
    const seed = decodeSeed(rawSeed);
    if (!seed) return null;
    seeds.push(seed);
  }

  const tiles = createEmptyGrid();
  const seen = new Set<string>();
  for (const rawRecord of rawTiles.r) {
    if (!isRecord(rawRecord)) return null;
    if (!isIntegerInRange(rawRecord.x, 0, GRID_W - 1) || !isIntegerInRange(rawRecord.y, 0, GRID_H - 1)) {
      return null;
    }
    const key = `${rawRecord.x},${rawRecord.y}`;
    if (seen.has(key) || !isTileState(rawRecord.s)) return null;
    seen.add(key);

    const plantedAt = optionalNumber(rawRecord, 'p');
    const stage = optionalNumber(rawRecord, 'g');
    const growth = optionalNumber(rawRecord, 'r');
    const structureHp = optionalNumber(rawRecord, 'h');
    const tilledDay = optionalNumber(rawRecord, 'd');
    if (plantedAt === null || stage === null || growth === null || structureHp === null || tilledDay === null) {
      return null;
    }
    if (
      (rawRecord.w !== undefined && rawRecord.w !== 1) ||
      (rawRecord.t !== undefined && rawRecord.t !== 1) ||
      (rawRecord.q !== undefined && rawRecord.q !== 1)
    ) {
      return null;
    }

    const tile = emptyTile();
    tile.state = rawRecord.s;
    if (plantedAt !== undefined) tile.plantedAt = plantedAt;
    tile.watered = rawRecord.w === 1;
    if (stage !== undefined) tile.stage = stage;
    if (growth !== undefined) tile.growth = growth;
    if (structureHp !== undefined) tile.structureHp = structureHp;
    if (tilledDay !== undefined) tile.tilledDay = tilledDay;
    tile.bearTrap = rawRecord.t === 1;
    tile.bearTrapClosed = rawRecord.q === 1;

    if (rawRecord.a !== undefined) {
      const seed = seedAt(seeds, rawRecord.a);
      if (!seed) return null;
      tile.seed = seed;
    }
    if (rawRecord.b !== undefined) {
      const seed = seedAt(seeds, rawRecord.b);
      if (!seed) return null;
      tile.breedA = seed;
    }
    if (rawRecord.c !== undefined) {
      const seed = seedAt(seeds, rawRecord.c);
      if (!seed) return null;
      tile.breedB = seed;
    }
    tiles[rawRecord.y]![rawRecord.x] = tile;
  }

  if (!Array.isArray(parsed.seedInventory) || !Array.isArray(parsed.codex)) return null;
  const seedInventory: SeedPacket[] = [];
  for (const rawEntry of parsed.seedInventory) {
    const packet = decodeCompactSeedPacket(rawEntry, seeds);
    if (!packet) return null;
    seedInventory.push(packet);
  }
  const codex: CodexEntry[] = [];
  for (const rawEntry of parsed.codex) {
    if (!isRecord(rawEntry) || typeof rawEntry.id !== 'string' || !isFiniteNumber(rawEntry.d)) return null;
    const seed = seedAt(seeds, rawEntry.s);
    if (!seed) return null;
    codex.push({ id: rawEntry.id, seed, discoveredDay: rawEntry.d });
  }

  const expanded = { ...parsed };
  delete expanded.seeds;
  expanded.tiles = tiles;
  expanded.seedInventory = seedInventory;
  expanded.codex = codex;
  return expanded;
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
  return JSON.stringify(encodeCompact(data));
}

/** v4 moved the old counters and bag map into the current 24-slot inventory. */
function migrateInventory(data: Record<string, unknown>, incomingVersion: number): Inventory {
  const raw = data.inventory;
  if (Array.isArray(raw)) {
    const inv = normalizeInventory(raw);
    for (let index = 0; index < inv.length; index++) {
      const slot = inv[index];
      const assetId = slot ? deedAssetId(slot.id) : null;
      if (assetId && !assetDefinition(assetId)) {
        console.warn(`[Save] Skipping unknown deed asset id: ${assetId}`);
        inv[index] = null;
      }
    }
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
    const input = JSON.parse(raw) as Record<string, unknown>;
    if (!input || typeof input !== 'object') return null;
    if (typeof input.version === 'number' && input.version > SAVE_VERSION) {
      console.error(`[Save] Save version ${input.version} is newer than supported version ${SAVE_VERSION}`);
      return null;
    }
    const incoming = typeof input.version === 'number' ? input.version : 0;
    // Accept a canonical full-grid object at the current version as well. This
    // keeps callers that already stamped data before serialization on the safe
    // migration path; new writes always use the compact tile envelope.
    const parsed = incoming === SAVE_VERSION && !Array.isArray(input.tiles) ? decodeCompactSave(input) : input;
    if (!parsed) return null;
    if (typeof parsed.seed !== 'number') return null;
    if (typeof parsed.day !== 'number') return null;
    if (parsed.phase !== 'day' && parsed.phase !== 'night') return null;
    if (!Array.isArray(parsed.tiles)) return null;
    const seedInventory = migrateSeedInventory(parsed.seedInventory);
    if (!seedInventory) return null;

    const unlocked = Array.isArray(parsed.unlockedWeapons)
      ? (parsed.unlockedWeapons as unknown[]).map(migrateWeapon)
      : ['shotgun' as const];

    // Capture the incoming version before stamping: `data` aliases `parsed`.
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
    data.seedInventory = seedInventory;
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
