/**
 * Model manifest — the single place a 3D asset is described.
 *
 * Adding a model is a DATA edit here, never a code edit in Assets.ts. That's the
 * whole point: with 80+ models a hardcoded union and switch becomes unmaintainable.
 *
 * Files live under public/models/<category>/<name>.glb and are loaded lazily.
 * A missing file is never fatal — Assets.ts substitutes a primitive and logs once,
 * so assets can be added one at a time without ever breaking the build.
 */

export type ModelDef = {
  /** Path under public/models/ */
  path: string;

  // NOTE ON SCALE: height-normalising a quadruped at its real shoulder height makes
  // it read enormous next to the 1.6-unit player, because animals are far longer
  // than they are tall. Stylised values well below life-size look correct here.

  /**
   * Normalise the model to this height in world units.
   *
   * This matters more than anything else in the manifest. Asset packs export at
   * wildly inconsistent scales — one pack's cow can be 100x another pack's cow —
   * and normalising here means scale is fixed in exactly one place instead of
   * being hand-tuned at every call site.
   */
  height?: number;

  /** Lerp the source colour toward this. Omit to keep the pack's own look. */
  tint?: number;
  /** 0..1 strength for `tint`. Default 0.7. */
  tintStrength?: number;
  /** Repeat UVs for source packs that tile their atlas beyond the 0..1 range. */
  textureRepeat?: boolean;

  /** Unlit pure black, fog disabled. For anything that should read as a silhouette. */
  silhouette?: boolean;

  /** Extra rotation in degrees applied after load, e.g. to pitch a runner forward. */
  rotateX?: number;

  /**
   * Clip-name matchers. Packs name animations inconsistently — KayKit uses
   * `Idle` / `Running_A`, Quaternius uses `Armature|Idle` or `Gallop`. Per-model
   * regexes beat one global guess.
   */
  clips?: {
    idle?: RegExp;
    walk?: RegExp;
    run?: RegExp;
    attack?: RegExp;
    death?: RegExp;
  };

  /** Free-text note — where it came from, why it's tuned this way. */
  note?: string;
};

/** Sensible defaults so most entries stay one line. */
export const DEFAULT_CLIPS = {
  idle: /idle/i,
  walk: /walk/i,
  run: /run|gallop|sprint/i,
  attack: /attack|bite|peck/i,
  death: /death|die/i,
} as const;

export const MODELS = {
  // ── Characters ────────────────────────────────────────────────────────────
  player: {
    path: 'characters/player.glb',
    height: 1.6,
    note: 'Cowboy_Male, Quaternius Ultimate Animated Character Pack. Replaces KayKit thorn-ranger.',
  },

  // ── Animals ───────────────────────────────────────────────────────────────
  // Crop raiders use the actual fox model supplied by the animal pack.
  donkey: { path: 'animals/donkey.glb', height: 0.95 },
  cow: { path: 'animals/cow.glb', height: 1.0 },
  bull: { path: 'animals/bull.glb', height: 1.05 },
  horse: { path: 'animals/horse.glb', height: 1.2 },
  alpaca: { path: 'animals/alpaca.glb', height: 0.9 },
  deer: { path: 'animals/deer.glb', height: 1.0 },
  stag: { path: 'animals/stag.glb', height: 1.15 },
  // The source fox is much longer than it is tall. 0.48 keeps its footprint
  // below the player silhouette while making a fox readable at the normal
  // camera distance (0.24 made raid attackers look like tiny sprites).
  fox: { path: 'animals/fox.glb', height: 0.48 },
  wolf: { path: 'animals/wolf.glb', height: 0.6 },
  husky: { path: 'animals/husky.glb', height: 0.5 },

  // ── Crops — one entry per species per stage ──────────────────────────────
  // 4 stages per species (_1.._4), named for the models that exist. The crop roster
  // follows the art rather than the other way round — every listed crop has a
  // matching model in the accepted pack.
  // The first pass was physically plausible but visually lost from the
  // isometric camera. These slightly larger silhouettes preserve tile spacing
  // while making planted rows immediately legible.
  beet_1: { path: 'crops/beet_1.glb', height: 0.28 },
  beet_2: { path: 'crops/beet_2.glb', height: 0.45 },
  beet_3: { path: 'crops/beet_3.glb', height: 0.63 },
  beet_4: { path: 'crops/beet_4.glb', height: 0.78 },
  carrot_1: { path: 'crops/carrot_1.glb', height: 0.28 },
  carrot_2: { path: 'crops/carrot_2.glb', height: 0.45 },
  carrot_3: { path: 'crops/carrot_3.glb', height: 0.63 },
  carrot_4: { path: 'crops/carrot_4.glb', height: 0.78 },
  lettuce_1: { path: 'crops/lettuce_1.glb', height: 0.28 },
  lettuce_2: { path: 'crops/lettuce_2.glb', height: 0.46 },
  lettuce_3: { path: 'crops/lettuce_3.glb', height: 0.66 },
  lettuce_4: { path: 'crops/lettuce_4.glb', height: 0.82 },
  dandelion_1: { path: 'crops/flower_1.glb', height: 0.24 },
  dandelion_2: { path: 'crops/flower_2.glb', height: 0.38 },
  dandelion_3: { path: 'crops/flower_3.glb', height: 0.55 },
  dandelion_4: { path: 'crops/flower_4.glb', height: 0.68 },
  grasscrop_1: { path: 'crops/grass_1.glb', height: 0.24 },
  grasscrop_2: { path: 'crops/grass_2.glb', height: 0.38 },
  grasscrop_3: { path: 'crops/grass_3.glb', height: 0.54 },
  grasscrop_4: { path: 'crops/grass_4.glb', height: 0.68 },
  // Spare species, already converted and ready to wire up
  corn_4: { path: 'crops/corn_4.glb', height: 0.9 },
  wheat_4: { path: 'crops/wheat_4.glb', height: 0.7 },
  pumpkin_4: { path: 'crops/pumpkin_4.glb', height: 0.5 },
  tomato_4: { path: 'crops/tomato_4.glb', height: 0.6 },

  // ── Nature — scatter. Keep these INSTANCED, see ASSETS.md ────────────────
  // Textured Stylized Trees — May 2020. FarmTrees picks a deterministic
  // silhouette per tile, keeping these instanced even at grove scale.
  tree_oak: { path: 'trees/tree_1.glb', height: 2.5, textureRepeat: true },
  tree_oak_2: { path: 'trees/tree_2.glb', height: 2.5, textureRepeat: true },
  tree_oak_3: { path: 'trees/tree_3.glb', height: 2.5, textureRepeat: true },
  tree_oak_4: { path: 'trees/tree_4.glb', height: 2.5, textureRepeat: true },
  tree_oak_5: { path: 'trees/tree_5.glb', height: 2.5, textureRepeat: true },
  tree_oak_6: { path: 'trees/tree_6.glb', height: 2.5, textureRepeat: true },
  tree_oak_7: { path: 'trees/tree_7.glb', height: 2.5, textureRepeat: true },
  tree_oak_8: { path: 'trees/tree_8.glb', height: 2.5, textureRepeat: true },
  tree_oak_9: { path: 'trees/tree_9.glb', height: 2.5, textureRepeat: true },
  tree_oak_10: { path: 'trees/tree_10.glb', height: 2.5, textureRepeat: true },
  tree_birch: { path: 'nature/birch_tree_1.glb', height: 4.6 },
  tree_birch_2: { path: 'nature/birch_tree_2.glb', height: 4.3 },
  tree_stump: { path: 'nature/wood_log.glb', height: 0.45 },
  // Ultimate Nature Pack scatter. These are intentionally separate manifest
  // entries so ScatterChunks can vary the silhouette without hardcoding paths.
  rock_1: { path: 'nature/rock_1.glb', height: 0.42 },
  rock_2: { path: 'nature/rock_2.glb', height: 0.32 },
  rock_3: { path: 'nature/rock_3.glb', height: 0.38 },
  bush_1: { path: 'nature/bush_1.glb', height: 0.7 },
  bush_2: { path: 'nature/bush_2.glb', height: 0.6 },
  plant_1: { path: 'nature/plant_1.glb', height: 0.45 },
  plant_2: { path: 'nature/plant_2.glb', height: 0.6 },
  plant_3: { path: 'nature/plant_3.glb', height: 0.55 },
  plant_4: { path: 'nature/plant_4.glb', height: 0.5 },
  plant_5: { path: 'nature/plant_5.glb', height: 0.65 },
  grass: { path: 'nature/grass.glb', height: 0.3 },
  grass_2: { path: 'nature/grass_2.glb', height: 0.34 },
  grass_short: { path: 'nature/grass_short.glb', height: 0.22 },
  flowers: { path: 'nature/flowers.glb', height: 0.42 },
  rock_a: { path: 'nature/rock_1.glb', height: 0.6 },
  rock_b: { path: 'nature/rock_2.glb', height: 0.9 },
  rock_c: { path: 'nature/rock_3.glb', height: 0.5 },
  bush_a: { path: 'nature/bush_1.glb', height: 0.7 },
  bush_b: { path: 'nature/bush_2.glb', height: 0.6 },
  grass_tuft: { path: 'nature/grass_2.glb', height: 0.3 },

  // ── Buildings ─────────────────────────────────────────────────────────────
  house_1: { path: 'buildings/small_barn.glb', height: 2.6, note: 'Lean-To tier' },
  house_2: { path: 'buildings/open_barn.glb', height: 3.4, note: 'Shack tier' },
  house_3: { path: 'buildings/barn.glb', height: 4.4, note: 'Homestead tier' },
  house_4: { path: 'buildings/silo_house.glb', height: 5.4, note: 'Roadhouse tier' },
  house_5: { path: 'buildings/big_barn.glb', height: 6.4, note: 'Top tier' },
  market_stall: { path: 'buildings/well.glb', height: 2.0, note: 'Placeholder until a stall model exists' },
  silo: { path: 'buildings/silo.glb', height: 6.0 },
  windmill: { path: 'buildings/windmill.glb', height: 7.0 },
  tower_windmill: { path: 'buildings/tower_windmill.glb', height: 8.0 },
  water_tower: { path: 'buildings/water_tower.glb', height: 7.0 },
  well: { path: 'buildings/well.glb', height: 1.6 },
  chicken_coop: { path: 'buildings/chicken_coop.glb', height: 1.8 },
  fence: { path: 'buildings/fence.glb', height: 1.0 },
  fence2: { path: 'buildings/fence2.glb', height: 1.0 },
  small_barn: { path: 'buildings/small_barn.glb', height: 2.6 },
  open_barn: { path: 'buildings/open_barn.glb', height: 3.4 },
  silo_house: { path: 'buildings/silo_house.glb', height: 5.4 },
  barn: { path: 'buildings/barn.glb', height: 4.0 },
  big_barn: { path: 'buildings/big_barn.glb', height: 6.4 },

  // ── Items & tools ─────────────────────────────────────────────────────────
  shotgun_2: { path: 'items/shotgun_2.glb', height: 0.85, note: 'Brown Survival Pack shotgun.' },
  shovel: { path: 'items/shovel.glb', height: 1.1, note: 'Survival Pack shovel.' },
  bow_wooden: { path: 'items/bow_wooden.glb', height: 0.85 },
  arrow: { path: 'items/arrow.glb', height: 0.55 },
  axe: { path: 'items/axe.glb', height: 0.8 },
  axe_small: { path: 'items/axe_small.glb', height: 0.62 },
  axe_double: { path: 'items/axe_double.glb', height: 0.95 },
  hammer_double: { path: 'items/hammer_double.glb', height: 0.95 },
  sword: { path: 'items/sword.glb', height: 0.95 },
  dagger: { path: 'items/dagger.glb', height: 0.55 },
  knife: { path: 'items/knife.glb', height: 0.45 },
  pan: { path: 'items/pan.glb', height: 0.48 },
  backpack: { path: 'items/backpack.glb', height: 0.75 },
  bonfire: { path: 'items/bonfire.glb', height: 0.9 },
  wood_log: { path: 'items/wood_log.glb', height: 0.45 },
  trophy: { path: 'items/crown.glb', height: 0.45 },
  bear_trap_open: { path: 'items/bear_trap_open.glb', height: 0.35 },
  bear_trap_closed: { path: 'items/bear_trap_closed.glb', height: 0.35 },

  // ── Zone entities — bosses, challenge zones, guardians ───────────────────
  // Quaternius Ultimate Monsters. Silhouette treatment is per-zone: full black for
  // anything meant to read as a threat you can't resolve, normal for a fair fight.
  guardian_a: { path: 'monsters/guardian_a.glb', height: 2.2 },

} satisfies Record<string, ModelDef>;

export type ModelKey = keyof typeof MODELS;

/** Every key, for preloading or validation. */
export const MODEL_KEYS = Object.keys(MODELS) as ModelKey[];

export function modelDef(key: ModelKey): ModelDef {
  return MODELS[key];
}
