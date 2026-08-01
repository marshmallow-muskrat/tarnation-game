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

// Foxes
export const FOX_BASE_COUNT = 3;
export const FOX_PER_NIGHT = 1;
export const FOX_MAX = 10;
export const FOX_SPEED = 3.2;
export const FOX_EAT_TIME = 3;
export const FOX_HP = 1;
export const FOX_BURROW_TIME = 1.2;
/** Foxes stop at the player’s edge instead of converging into the same point. */
export const FOX_ATTACK_RADIUS = 1.55;
/** Minimum visual spacing between raid actors. */
export const FOX_SEPARATION = 1.05;
/** Additional radius between attack-ring slots. */
export const FOX_ATTACK_SLOT_GAP = 0.55;
/** Time for a fox's readable lunge/pause before it resumes the ring. */
export const FOX_ATTACK_PERIOD = 1.05;
/** Inward movement during the attack lunge, kept outside the player capsule. */
export const FOX_ATTACK_LUNGE = 0.22;
export const NIBBLER_SPEED = 4.4;
export const HAULER_SPEED = 3.6;

// Weapons
export const SHOT_SPEED = 14;
export const SHOT_COOLDOWN = 0.4;
export const SHOT_LIFETIME = 1.2;
export const SHOTGUN_COOLDOWN = 0.7;
export const SHOTGUN_SPEED = 18;
export const SHOTGUN_PELLETS = 6;
export const SHOTGUN_SPREAD = 0.09;
export const BOW_COOLDOWN = 0.55;
export const BOW_SPEED = 18;
/** B-slot bear trap placement cooldown. */
export const BEAR_TRAP_COOLDOWN = 4;
/** Radius around the trap model that catches a fox. */
export const BEAR_TRAP_RADIUS = 0.85;
/** How far ahead the B-slot can place a trap. */
export const BEAR_TRAP_PLACE_RANGE = 3.2;

// Overworld trees — choppable, respawning, clustered into groves
/** Share of world tiles that carry a tree, averaged over the whole map. */
export const FARM_TREE_FRACTION = 0.055;
/**
 * Trees clump: a low-frequency grove field decides where woodland is, and the
 * per-tile roll is biased by it. Same average coverage, far more open ground.
 */
export const GROVE_CELL = 34;
/** Inside a copse / out on open ground. Both derive from the map-wide average. */
export const GROVE_DENSE = FARM_TREE_FRACTION * 2.2;
export const GROVE_SPARSE = FARM_TREE_FRACTION * 0.06;
/** Axe swings to fell a tree. */
export const FARM_TREE_CHOPS = 5;
/** Wood added to the inventory per felled tree. */
export const FARM_TREE_WOOD = 2;
/** Stumps clear in one swing and give nothing. */
export const STUMP_CHOPS = 1;
/** Share of tiles carrying a boulder. Boulders can't be tilled through. */
export const ROCK_TILE_FRACTION = 0.035;
/** Days before a chopped tile grows a tree back. */
export const TREE_RESPAWN_DAYS = 2;
/**
 * Chunk radius kept live for overworld trees. Smaller than the scatter radius:
 * a quarter of every tile is a tree, so each chunk is ~64 of them and the draw
 * call count adds up fast. Two chunks still covers well past the camera.
 */
export const TREE_CHUNK_RADIUS = 2;
// Market stall — the only structure on the map for now.
export const STALL_COST = 0;

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

export const FIXED_DT = 1 / 60;
export const SAVE_KEY = 'tarnation.save';
export const BUCKET_CAPACITY = 10;

// Inventory / toolbar
export const INVENTORY_SLOTS = 24;
export const TOOLBAR_SLOTS = 5;

// Abilities — their own slots to the left of the toolbar
export const BOULDER_COOLDOWN = 12;
export const BOULDER_DAMAGE = 5;
export const BOULDER_SPEED = 9;
export const BOULDER_RADIUS = 1.15;
export const BOULDER_RANGE = 16;

// Melee
export const MELEE_RANGE = 1.9;
export const MELEE_COOLDOWN = 0.35;
export const FIST_DAMAGE = 1;
export const AXE_DAMAGE = 2;

// Loot
/** Base chance a creature drops its trophy when killed. */
export const TROPHY_DROP_CHANCE = 0.01;
/** Added to the chance for every kill of that creature since the last drop. */
export const TROPHY_PITY_STEP = 0.01;

/** Tilled ground left unplanted is reclaimed by grass after this many days. */
export const TILL_DECAY_DAYS = 1;

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

/** Base crop catalogue. Every plant grows in exactly two days. */
export const CROP_DEFS = {
  grass: { id: 'grass' as const, name: 'Grass', grow: PLANT_GROW_TIME, waterNeed: 0.25, color: 0x7cb342 },
  dandelion: { id: 'dandelion' as const, name: 'Dandelion', grow: PLANT_GROW_TIME, waterNeed: 0.3, color: 0xf0d060 },
  beet: { id: 'beet' as const, name: 'Beet', grow: PLANT_GROW_TIME, waterNeed: 0.5, color: 0xc4d64a },
  carrot: { id: 'carrot' as const, name: 'Carrot', grow: PLANT_GROW_TIME, waterNeed: 0.55, color: 0xe88a30 },
  lettuce: { id: 'lettuce' as const, name: 'Lettuce', grow: PLANT_GROW_TIME, waterNeed: 0.75, color: 0xd0c0e0 },
};

export type BaseCropId = keyof typeof CROP_DEFS;
