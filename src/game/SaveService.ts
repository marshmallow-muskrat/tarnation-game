import {
  BUCKET_CAPACITY,
  CROP_DEFS,
  DAY_LENGTH,
  GRID_H,
  GRID_W,
  INVENTORY_SLOTS,
  NIGHT_LENGTH,
  SAVE_KEY,
  TOOLBAR_SLOTS,
  WORLD_SIZE,
} from '../content';
import { loadFromSaveData, saveToString, type GameState } from '../sim/gameState';
import { deserialize, SAVE_SIZE_BUDGETS, SAVE_VERSION, type SaveData } from '../sim/save';
import type { Seed, SeedPacket } from '../sim/genetics';
import type { Tile, TileState } from '../sim/farm';
import { assetDefinition } from '../content/purchasables';

export type SaveSlot = 'a' | 'b';

export const SAVE_SERVICE_KEYS = {
  pointer: 'tarnation.save.current',
  a: 'tarnation.save.a',
  b: 'tarnation.save.b',
} as const;

export const SAVE_ENVELOPE_VERSION = 1;

export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export type SaveStatus = 'ok' | 'quota_exceeded' | 'corrupt' | 'migration_failed' | 'unavailable';

export interface SaveReadResult {
  status: SaveStatus;
  state: GameState | null;
  hasSave: boolean;
  recovered: boolean;
  migrated: boolean;
  slot?: SaveSlot;
  message?: string;
}

export interface SaveWriteResult {
  status: SaveStatus;
  revision?: number;
  slot?: SaveSlot;
  migrated?: boolean;
  message?: string;
}

export interface SaveExportResult {
  status: SaveStatus;
  json?: string;
  message?: string;
}

interface SaveEnvelope {
  version: number;
  revision: number;
  checksum: string;
  payload: string;
}

type SlotRead =
  | { status: 'empty'; slot: SaveSlot }
  | { status: 'valid'; slot: SaveSlot; envelope: SaveEnvelope; state: GameState }
  | { status: 'corrupt' | 'migration_failed'; slot: SaveSlot; message: string };

interface SlotSnapshot {
  pointer: SaveSlot | null;
  a: SlotRead;
  b: SlotRead;
}

const TILE_STATES: readonly TileState[] = [
  'grass',
  'tilled',
  'planted',
  'mature',
  'trench',
  'breeding',
];

const WEAPONS = new Set(['shotgun', 'bow', 'axe']);
const HYBRID_MECHANICS = new Set([
  'repel_foxes',
  'portable_light',
  'ironroot',
  'ricochet',
  'greed_crop',
  'none',
]);
const MAX_SAVED_ENTRIES = GRID_W * GRID_H;

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

function isQuotaError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || error.code === 22 || error.code === 1014;
}

/** Deterministic, browser-safe checksum for the serialized save payload. */
export function saveChecksum(payload: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < payload.length; index++) {
    hash ^= payload.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function validSeed(seed: unknown): seed is Seed {
  if (!isRecord(seed)) return false;
  if (typeof seed.species !== 'string' || !Object.prototype.hasOwnProperty.call(CROP_DEFS, seed.species)) return false;
  const traits = seed.traits;
  if (!isRecord(traits)) return false;
  if (!['yield', 'vigor', 'thirst', 'hardiness', 'weirdness'].every((key) => isFiniteNumber(traits[key]) && traits[key] >= 0 && traits[key] <= 100)) return false;
  if (typeof seed.displayName !== 'string' || seed.displayName.length === 0 || typeof seed.hybrid !== 'boolean') return false;
  if (typeof seed.mech !== 'string' || !HYBRID_MECHANICS.has(seed.mech)) return false;
  return seed.lineage === undefined || (Array.isArray(seed.lineage) && seed.lineage.every((entry) => typeof entry === 'string'));
}

function validSeedPacket(packet: unknown): packet is SeedPacket {
  return isRecord(packet) && isIntegerInRange(packet.count, 1, Number.MAX_SAFE_INTEGER) && validSeed(packet.seed);
}

function validTile(tile: unknown): tile is Tile {
  if (!isRecord(tile)) return false;
  return (
    isTileState(tile.state) &&
    isFiniteNumber(tile.plantedAt) &&
    typeof tile.watered === 'boolean' &&
    isFiniteNumber(tile.stage) &&
    isFiniteNumber(tile.growth) &&
    (tile.seed === null || validSeed(tile.seed)) &&
    (tile.breedA === null || validSeed(tile.breedA)) &&
    (tile.breedB === null || validSeed(tile.breedB)) &&
    isFiniteNumber(tile.structureHp) &&
    typeof tile.bearTrap === 'boolean' &&
    typeof tile.bearTrapClosed === 'boolean' &&
    isFiniteNumber(tile.tilledDay)
  );
}

function validSaveData(data: SaveData, allowEmptyLegacyGrid: boolean): boolean {
  if (data.version !== SAVE_VERSION) return false;
  if (!isFiniteNumber(data.seed) || !isIntegerInRange(data.day, 1, 1_000_000)) return false;
  if (!isFiniteNumber(data.elapsed) || data.elapsed < 0 || data.elapsed > DAY_LENGTH + NIGHT_LENGTH) return false;
  if (!isFiniteNumber(data.playerX) || data.playerX < 0 || data.playerX > WORLD_SIZE) return false;
  if (!isFiniteNumber(data.playerZ) || data.playerZ < 0 || data.playerZ > WORLD_SIZE) return false;
  if (!WEAPONS.has(data.weapon) || !Array.isArray(data.unlockedWeapons) || data.unlockedWeapons.some((weapon) => !WEAPONS.has(weapon))) return false;
  if (!isIntegerInRange(data.homesteadTier, 1, 5)) return false;
  if (!Array.isArray(data.placedBuildings) || data.placedBuildings.length > MAX_SAVED_ENTRIES) return false;
  for (const building of data.placedBuildings) {
    if (!isRecord(building) || typeof building.id !== 'string' || !assetDefinition(building.id)) return false;
    if (!isFiniteNumber(building.x) || !isFiniteNumber(building.z) || !isFiniteNumber(building.rotation)) return false;
    if (building.gateOpen !== undefined && typeof building.gateOpen !== 'boolean') return false;
  }
  if (!isIntegerInRange(data.irrigationTier, 1, 5) || !isFiniteNumber(data.bucketFill) || data.bucketFill < 0 || data.bucketFill > BUCKET_CAPACITY) return false;
  if (typeof data.selectedCrop !== 'string' || data.selectedCrop.length === 0) return false;
  if (!Array.isArray(data.inventory) || data.inventory.length !== INVENTORY_SLOTS) return false;
  for (const slot of data.inventory) {
    if (slot === null) continue;
    if (!isRecord(slot) || typeof slot.id !== 'string' || slot.id.length === 0 || !isIntegerInRange(slot.count, 1, Number.MAX_SAFE_INTEGER)) return false;
  }
  if (typeof data.inventoryOpen !== 'boolean' || !isFiniteNumber(data.duckettes) || data.duckettes < 0) return false;
  if (!isRecord(data.choppedTrees) || Object.keys(data.choppedTrees).length > MAX_SAVED_ENTRIES) return false;
  for (const [key, day] of Object.entries(data.choppedTrees)) {
    const [x, z] = key.split(',').map(Number);
    if (!isIntegerInRange(x, 0, GRID_W - 1) || !isIntegerInRange(z, 0, GRID_H - 1) || !isIntegerInRange(day, 0, 1_000_000)) return false;
  }
  if (!isRecord(data.clearedStumps) || Object.keys(data.clearedStumps).length > MAX_SAVED_ENTRIES) return false;
  if (Object.values(data.clearedStumps).some((value) => typeof value !== 'boolean')) return false;
  if (!isRecord(data.dropPity) || Object.keys(data.dropPity).length > MAX_SAVED_ENTRIES) return false;
  if (Object.values(data.dropPity).some((value) => !isFiniteNumber(value) || value < 0)) return false;
  if (!isIntegerInRange(data.toolbarSlot, 0, TOOLBAR_SLOTS - 1) || typeof data.toolSlotActive !== 'boolean') return false;

  const fullGrid = data.tiles.length === GRID_H && data.tiles.every((row) => Array.isArray(row) && row.length === GRID_W);
  if (!fullGrid && !(allowEmptyLegacyGrid && data.tiles.length === 0)) return false;
  if (fullGrid && data.tiles.some((row) => row.some((tile) => !validTile(tile)))) return false;

  if (!Array.isArray(data.seedInventory) || data.seedInventory.length > MAX_SAVED_ENTRIES || data.seedInventory.some((packet) => !validSeedPacket(packet))) return false;
  if (!Array.isArray(data.codex) || data.codex.length > MAX_SAVED_ENTRIES) return false;
  if (data.codex.some((entry) => !isRecord(entry) || typeof entry.id !== 'string' || entry.id.length === 0 || !validSeed(entry.seed) || !isIntegerInRange(entry.discoveredDay, 1, 1_000_000))) return false;
  if (!isRecord(data.stats)) return false;
  if (Object.values(data.stats).some((value) => !isFiniteNumber(value) || value < 0)) return false;
  if (!isFiniteNumber(data.simTime) || data.simTime < 0 || typeof data.winShown !== 'boolean') return false;
  if (data.trophies !== undefined && (!Array.isArray(data.trophies) || data.trophies.length > MAX_SAVED_ENTRIES || data.trophies.some((trophy) => typeof trophy !== 'string'))) return false;
  return true;
}

function parseEnvelope(raw: string): SaveEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (
      !isRecord(parsed) ||
      parsed.version !== SAVE_ENVELOPE_VERSION ||
      !isIntegerInRange(parsed.revision, 1, Number.MAX_SAFE_INTEGER) ||
      typeof parsed.checksum !== 'string' ||
      !/^[0-9a-f]{8}$/.test(parsed.checksum) ||
      typeof parsed.payload !== 'string' ||
      parsed.payload.length === 0 ||
      parsed.payload.length > SAVE_SIZE_BUDGETS.warning
    ) {
      return null;
    }
    return {
      version: parsed.version,
      revision: parsed.revision,
      checksum: parsed.checksum,
      payload: parsed.payload,
    };
  } catch {
    return null;
  }
}

function validatePayload(payload: string): { status: 'valid'; state: GameState } | { status: 'corrupt' | 'migration_failed'; message: string } {
  let rawVersion: number | undefined;
  let compact = false;
  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (!isRecord(parsed)) return { status: 'migration_failed', message: 'Save payload is not an object.' };
    rawVersion = typeof parsed.version === 'number' ? parsed.version : undefined;
    compact = rawVersion === SAVE_VERSION && isRecord(parsed.tiles) && !Array.isArray(parsed.tiles);
  } catch {
    return { status: 'migration_failed', message: 'Save payload is not valid JSON.' };
  }
  const data = deserialize(payload);
  if (!data) return { status: 'migration_failed', message: 'Save payload could not be migrated.' };
  if (!validSaveData(data, !compact && (rawVersion === undefined || rawVersion < SAVE_VERSION))) {
    return { status: 'corrupt', message: 'Save payload failed bounds or content validation.' };
  }
  return { status: 'valid', state: loadFromSaveData(data) };
}

function slotKey(slot: SaveSlot): string {
  return slot === 'a' ? SAVE_SERVICE_KEYS.a : SAVE_SERVICE_KEYS.b;
}

function readPointer(storage: SaveStorage): SaveSlot | null {
  const pointer = storage.getItem(SAVE_SERVICE_KEYS.pointer);
  return pointer === 'a' || pointer === 'b' ? pointer : null;
}

function readSlot(storage: SaveStorage, slot: SaveSlot): SlotRead {
  const raw = storage.getItem(slotKey(slot));
  if (raw === null) return { status: 'empty', slot };
  const envelope = parseEnvelope(raw);
  if (!envelope || saveChecksum(envelope.payload) !== envelope.checksum) {
    return { status: 'corrupt', slot, message: 'Save slot checksum or envelope is invalid.' };
  }
  const validated = validatePayload(envelope.payload);
  if (validated.status !== 'valid') return { status: validated.status, slot, message: validated.message };
  return { status: 'valid', slot, envelope, state: validated.state };
}

function readSnapshot(storage: SaveStorage): SlotSnapshot {
  return {
    pointer: readPointer(storage),
    a: readSlot(storage, 'a'),
    b: readSlot(storage, 'b'),
  };
}

function validSlots(snapshot: SlotSnapshot): Extract<SlotRead, { status: 'valid' }>[] {
  return [snapshot.a, snapshot.b].filter((slot): slot is Extract<SlotRead, { status: 'valid' }> => slot.status === 'valid');
}

function newestSlot(snapshot: SlotSnapshot): Extract<SlotRead, { status: 'valid' }> | null {
  const slots = validSlots(snapshot);
  slots.sort((left, right) => right.envelope.revision - left.envelope.revision);
  return slots[0] ?? null;
}

function candidateSlot(snapshot: SlotSnapshot): SaveSlot {
  const slots = validSlots(snapshot);
  if (slots.length === 0) return snapshot.a.status === 'empty' ? 'a' : 'b';
  if (slots.length === 1) return slots[0].slot === 'a' ? 'b' : 'a';
  return slots[0].envelope.revision <= slots[1].envelope.revision ? slots[0].slot : slots[1].slot;
}

function statusResult(status: SaveStatus, message: string): SaveReadResult {
  return { status, state: null, hasSave: false, recovered: false, migrated: false, message };
}

export function browserSaveStorage(): SaveStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export class SaveService {
  constructor(private readonly storage: SaveStorage | null) {}

  read(): SaveReadResult {
    if (!this.storage) return statusResult('unavailable', 'Browser storage is unavailable.');
    try {
      const snapshot = readSnapshot(this.storage);
      const winner = newestSlot(snapshot);
      if (winner) {
        return {
          status: 'ok',
          state: winner.state,
          hasSave: true,
          recovered: snapshot.pointer !== winner.slot,
          migrated: false,
          slot: winner.slot,
        };
      }

      const legacy = this.storage.getItem(SAVE_KEY);
      if (legacy !== null) {
        const validated = validatePayload(legacy);
        if (validated.status === 'valid') {
          return { status: 'ok', state: validated.state, hasSave: true, recovered: false, migrated: true };
        }
        return statusResult(validated.status, validated.message);
      }

      const slots = [snapshot.a, snapshot.b];
      const failed = slots.find(
        (slot): slot is Exclude<SlotRead, { status: 'empty' | 'valid' }> =>
          slot.status === 'migration_failed' || slot.status === 'corrupt',
      );
      if (failed) return statusResult(failed.status, failed.message);
      return { status: 'ok', state: null, hasSave: false, recovered: false, migrated: false };
    } catch {
      return statusResult('unavailable', 'Browser storage could not be read.');
    }
  }

  save(state: GameState): SaveWriteResult {
    if (!this.storage) return { status: 'unavailable', message: 'Browser storage is unavailable.' };
    let payload: string;
    try {
      payload = saveToString(state);
    } catch {
      return { status: 'corrupt', message: 'Game state could not be serialized.' };
    }
    if (payload.length > SAVE_SIZE_BUDGETS.warning) {
      return { status: 'quota_exceeded', message: 'Save exceeds the configured storage warning limit.' };
    }

    try {
      const snapshot = readSnapshot(this.storage);
      const slot = candidateSlot(snapshot);
      const current = newestSlot(snapshot);
      const revision = (current?.envelope.revision ?? 0) + 1;
      const envelope: SaveEnvelope = {
        version: SAVE_ENVELOPE_VERSION,
        revision,
        checksum: saveChecksum(payload),
        payload,
      };
      this.storage.setItem(slotKey(slot), JSON.stringify(envelope));
      const written = readSlot(this.storage, slot);
      if (written.status !== 'valid' || written.envelope.revision !== revision) {
        return { status: written.status === 'migration_failed' ? 'migration_failed' : 'corrupt', message: 'Candidate save failed validation.' };
      }
      this.storage.setItem(SAVE_SERVICE_KEYS.pointer, slot);
      if (this.storage.getItem(SAVE_SERVICE_KEYS.pointer) !== slot) {
        return { status: 'unavailable', message: 'Save pointer could not be advanced.' };
      }
      // A validated compact slot supersedes the released v8 raw key. Removing
      // it prevents an old 10 MB payload from consuming the browser quota.
      try {
        this.storage.removeItem?.(SAVE_KEY);
      } catch {
        // The new two-slot save is already committed; a stale legacy key is harmless.
      }
      return { status: 'ok', revision, slot };
    } catch (error) {
      return {
        status: isQuotaError(error) ? 'quota_exceeded' : 'unavailable',
        message: isQuotaError(error) ? 'Browser storage quota was exceeded.' : 'Browser storage could not be written.',
      };
    }
  }

  recover(): SaveReadResult {
    const result = this.read();
    if (result.status !== 'ok' || !result.slot || !result.recovered || !this.storage) return result;
    try {
      this.storage.setItem(SAVE_SERVICE_KEYS.pointer, result.slot);
      return this.read();
    } catch (error) {
      return statusResult(isQuotaError(error) ? 'quota_exceeded' : 'unavailable', 'Recovered save pointer could not be advanced.');
    }
  }

  exportJson(): SaveExportResult {
    const result = this.read();
    if (result.status !== 'ok' || !this.storage) return { status: result.status, message: result.message };
    try {
      if (result.slot) {
        const json = this.storage.getItem(slotKey(result.slot));
        return json === null ? { status: 'corrupt', message: 'Selected save slot disappeared.' } : { status: 'ok', json };
      }
      const legacy = this.storage.getItem(SAVE_KEY);
      return legacy === null ? { status: 'ok' } : { status: 'ok', json: legacy };
    } catch {
      return { status: 'unavailable', message: 'Browser storage could not be read.' };
    }
  }

  importJson(json: string): SaveWriteResult {
    // Released v8 saves were verbose full-grid JSON. Allow those known legacy
    // payloads through the migration path even though new writes stay compact.
    if (typeof json !== 'string' || json.length > SAVE_SIZE_BUDGETS.warning * 4) {
      return { status: 'corrupt', message: 'Imported save is too large.' };
    }
    let payload = json;
    const envelope = parseEnvelope(json);
    if (envelope) {
      if (saveChecksum(envelope.payload) !== envelope.checksum) return { status: 'corrupt', message: 'Imported save checksum is invalid.' };
      payload = envelope.payload;
    }
    const validated = validatePayload(payload);
    if (validated.status !== 'valid') return { status: validated.status, message: validated.message, migrated: false };
    const result = this.save(validated.state);
    return { ...result, migrated: true };
  }
}
