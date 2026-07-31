/** All tuning constants. Sim imports from here. */

export const TILE = 1;
/** Entire world is the tillable grid. */
export const WORLD_SIZE = 240;
export const GRID_W = WORLD_SIZE;
export const GRID_H = WORLD_SIZE;
export const FARM_W = GRID_W * TILE;
export const FARM_H = GRID_H * TILE;
export const FARM_ORIGIN_X = 0;
export const FARM_ORIGIN_Z = 0;

export const VIEW_W = 1280;
export const VIEW_H = 720;

// Clock
export const DAY_LENGTH = 180;
export const NIGHT_LENGTH = 60;
export const WIN_DAY = 5;

// Player
export const PLAYER_SPEED = 5.5;
export const PLAYER_ACCEL = 28;
export const PLAYER_DAMP = 14;
export const TOOL_RANGE = 1.6;

// Clock-derived durations
/** One full day = daylight + night. */
export const FULL_DAY = DAY_LENGTH + NIGHT_LENGTH;
/** Every plant takes exactly two days to grow. */
export const PLANT_GROW_TIME = FULL_DAY * 2;

// Legacy single-crop constant (farm still uses per-species grow times)
export const CROP_GROW_TIME = PLANT_GROW_TIME;
export const CROP_STAGES = 3;
export const CROP_SELL_VALUE = 0;

// Weasels
export const WEASEL_BASE_COUNT = 3;
export const WEASEL_PER_NIGHT = 1;
export const WEASEL_MAX = 10;
export const WEASEL_SPEED = 3.2;
export const WEASEL_EAT_TIME = 3;
export const WEASEL_HP = 1;
export const WEASEL_BURROW_TIME = 1.2;
export const NIBBLER_SPEED = 4.4;
export const HAULER_SPEED = 3.6;

// Weapons
export const SHOT_SPEED = 14;
export const SHOT_COOLDOWN = 0.4;
export const SHOT_LIFETIME = 1.2;
export const BOW_COOLDOWN = 0.55;
export const BOW_SPEED = 18;
export const BLUNDER_COOLDOWN = 1.1;
export const BLUNDER_SPREAD = 0.28;
export const BLUNDER_PELLETS = 5;

// Woods
export const WOODS_W = 48;
export const WOODS_H = 48;
export const LANTERN_FUEL = 120;
export const LANTERN_DISTANCE_MAX = 7.4;
export const LANTERN_DISTANCE_MIN = 2.5;
export const TREE_CHOPS = 3;
export const TREE_WOOD = 1;
export const TREE_COUNT = 36;

// Overworld (farm) trees — choppable, respawning
/** Share of world tiles that carry a tree. */
export const FARM_TREE_FRACTION = 0.25;
/** Chops to fell an overworld tree. */
export const FARM_TREE_CHOPS = 3;
/** Wood added to the inventory per felled overworld tree. */
export const FARM_TREE_WOOD = 2;
/** Days before a chopped tile grows a tree back. */
export const TREE_RESPAWN_DAYS = 2;
/**
 * Chunk radius kept live for overworld trees. Smaller than the scatter radius:
 * a quarter of every tile is a tree, so each chunk is ~64 of them and the draw
 * call count adds up fast. Two chunks still covers well past the camera.
 */
export const TREE_CHUNK_RADIUS = 2;
export const BAG_SIZE_BASE = 6;
export const BAG_SIZE_UPGRADED = 12;
export const BAG_SIZE_CABIN = 16;
export const STALKER_SPAWN_FUEL = 40;
/** World-unit speeds (faster than player when bag full). */
export const STALKER_SPEED_EMPTY = 4.2; // ~150 in old px terms relative
export const STALKER_SPEED_FULL = 6.2; // ~210
export const STALKER_DESPAWN_ON_EXIT = true;

// Homestead tiers: 0 Lean-To, 1 Market Stall, 2 Cabin
export const SHACK_COST = 40; // wood
/** The tier-1 build is the market stall — same cost, clearer name. */
export const STALL_COST = SHACK_COST;
export const CABIN_COST_WOOD = 20;
export const CABIN_COST_DARKWOOD = 30;
/** @deprecated use SHACK_COST — kept for old win check path */
export const SHED_COST = SHACK_COST;

// Attention
export const ATTENTION_MAX = 100;
export const ATTENTION_IDLE_DECAY = 2.5; // per sec when still
export const ATTENTION_CHOP = 8;
export const ATTENTION_GUN = 18;
export const ATTENTION_BOW = 3;
export const ATTENTION_TIME_FRINGE = 0.4;
export const ATTENTION_TIME_THICKET = 1.0;
export const ATTENTION_TIME_DEEP = 1.8;

// Lake / world dressing (visual)
export const WORLD_HALF = WORLD_SIZE / 2;
export const HOMESTEAD_SIZE = 48;
export const HOMESTEAD_MIN_X = (WORLD_SIZE - HOMESTEAD_SIZE) / 2;
export const HOMESTEAD_MIN_Z = (WORLD_SIZE - HOMESTEAD_SIZE) / 2;
export const HOMESTEAD_MAX_X = HOMESTEAD_MIN_X + HOMESTEAD_SIZE;
export const HOMESTEAD_MAX_Z = HOMESTEAD_MIN_Z + HOMESTEAD_SIZE;
export const LAKE_CX = 168;
export const LAKE_CZ = 100;
export const LAKE_RADIUS = 22;
export const CHUNK_SIZE = 16;
export const CHUNK_COUNT = 15;
export const CHUNK_LOAD_RADIUS = 4;
export const WATER_COLLECT_RANGE = 1.5;
export const WATER_FLOW_SPEED = 0.35;
/** North edge of world for woods entry strip */
export const TREELINE_Z = 2.5;

export const FIXED_DT = 1 / 60;
export const SAVE_KEY = 'tarnation.save';
export const BUCKET_CAPACITY = 10;

// Inventory / toolbar
export const INVENTORY_SLOTS = 24;
export const TOOLBAR_SLOTS = 5;

// Market stall
/** Distance from the stall at which the sell counter opens. */
export const MARKET_RANGE = 3.4;

// Palettes
export const FARM_COLORS = {
  fog: 0xbfd9a8,
  floorA: 0x5e8c3a,
  floorB: 0x74a64a,
  floorC: 0x4f7a32,
  floorD: 0x6b9a48,
  tilled: 0x6b4a2f,
  tilledLight: 0x8a6440,
  watered: 0x3e2b1b,
  crop: 0xc4d64a,
  cropMature: 0xe8c33a,
  house: 0x9a6b42,
  skyHorizon: 0xd8e8c8,
  skyZenith: 0x4a7a88,
  water: 0x2e6e72,
  reed: 0x5a7a3a,
  stone: 0x6a6a58,
  trench: 0x3a5a8a,
};

export const WOODS_COLORS = {
  fog: 0x07110f,
  floorA: 0x18231f,
  floorB: 0x26322d,
  stone: 0x29322f,
  stoneDark: 0x151d1b,
  teal: 0x8dd8c7,
  tealDeep: 0x2f746a,
  amber: 0xf0a24c,
  moon: 0xd8f6ee,
  crimson: 0xd85d4c,
};

/** Base crop catalogue. Every plant grows in exactly two days. */
export const CROP_DEFS = {
  grass: { id: 'grass' as const, name: 'Grass', grow: PLANT_GROW_TIME, waterNeed: 0.25, color: 0x7cb342 },
  dandelion: { id: 'dandelion' as const, name: 'Dandelion', grow: PLANT_GROW_TIME, waterNeed: 0.3, color: 0xf0d060 },
  turnip: { id: 'turnip' as const, name: 'Turnip', grow: PLANT_GROW_TIME, waterNeed: 0.5, color: 0xc4d64a },
  carrot: { id: 'carrot' as const, name: 'Carrot', grow: PLANT_GROW_TIME, waterNeed: 0.55, color: 0xe88a30 },
  onion: { id: 'onion' as const, name: 'Onion', grow: PLANT_GROW_TIME, waterNeed: 0.75, color: 0xd0c0e0 },
};

export type BaseCropId = keyof typeof CROP_DEFS;
