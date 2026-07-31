import type { Phase } from './clock';
import type { Tile } from './farm';
import type { CodexEntry, Seed } from './genetics';

export const SAVE_VERSION = 3;

export interface GameStats {
  cropsHarvested: number;
  woodGathered: number;
  darkwoodGathered: number;
  stalkerCaught: number;
  daysSurvived: number;
  trophies: number;
  hybridsDiscovered: number;
}

export type WeaponId = 'slingshot' | 'bow' | 'blunderbuss';
export type HomesteadTier = 0 | 1 | 2;

export interface SaveData {
  version: number;
  seed: number;
  day: number;
  phase: Phase;
  elapsed: number;
  tiles: Tile[][];
  wood: number;
  darkwood: number;
  bagSize: number;
  /** @deprecated use homesteadTier >= 1 */
  shedBuilt: boolean;
  homesteadTier: HomesteadTier;
  weapon: WeaponId;
  unlockedWeapons: WeaponId[];
  irrigationTier: number; // 1-3
  bucketFill: number;
  selectedCrop: string;
  inventory: Record<string, number>;
  seedInventory: Seed[];
  codex: CodexEntry[];
  attentionFloor: number;
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
    stalkerCaught: 0,
    daysSurvived: 1,
    trophies: 0,
    hybridsDiscovered: 0,
  };
}

export function serialize(data: SaveData): string {
  return JSON.stringify(data);
}

export function deserialize(raw: string): SaveData | null {
  try {
    const data = JSON.parse(raw) as SaveData;
    if (!data || typeof data !== 'object') return null;
    if (typeof data.seed !== 'number') return null;
    if (typeof data.day !== 'number') return null;
    if (data.phase !== 'day' && data.phase !== 'night') return null;
    if (!Array.isArray(data.tiles)) return null;
    if (typeof data.wood !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function createNewSave(seed: number, bagSize: number): SaveData {
  return {
    version: SAVE_VERSION,
    seed,
    day: 1,
    phase: 'day',
    elapsed: 0,
    tiles: [],
    wood: 0,
    darkwood: 0,
    bagSize,
    shedBuilt: false,
    homesteadTier: 0,
    weapon: 'slingshot',
    unlockedWeapons: ['slingshot'],
    irrigationTier: 1,
    bucketFill: 0,
    selectedCrop: 'turnip',
    inventory: {},
    seedInventory: [],
    codex: [],
    attentionFloor: 0,
    stats: defaultStats(),
    simTime: 0,
    winShown: false,
    trophies: [],
  };
}
