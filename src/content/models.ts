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
  merchant: {
    path: 'characters/merchant.glb',
    height: 1.6,
    note: 'Runs the market stall.',
  },

  // ── Animals ───────────────────────────────────────────────────────────────
  // The crop raider is a FOX, not a weasel — the pack has no weasel, and a tinted
  // fox pretending to be one looks worse than just using the fox. Key stays 'weasel'
  // until the call sites are renamed.
  weasel: {
    path: 'animals/fox.glb',
    height: 0.38,
    note: 'Fox. Quaternius Ultimate Animated Animals — animated, untinted.',
  },
  donkey: { path: 'animals/donkey.glb', height: 0.95 },
  cow: { path: 'animals/cow.glb', height: 1.0 },
  bull: { path: 'animals/bull.glb', height: 1.05 },
  horse: { path: 'animals/horse.glb', height: 1.2 },
  alpaca: { path: 'animals/alpaca.glb', height: 0.9 },
  deer: { path: 'animals/deer.glb', height: 1.0 },
  stag: { path: 'animals/stag.glb', height: 1.15 },
  fox: { path: 'animals/fox.glb', height: 0.38 },
  wolf: { path: 'animals/wolf.glb', height: 0.6 },
  husky: { path: 'animals/husky.glb', height: 0.5 },

  // ── Fish — ambient only, see ASSETS.md ───────────────────────────────────
  fish_a: { path: 'fish/fish_a.glb', height: 0.25, note: 'Ambient river/lake life. Not catchable.' },
  fish_b: { path: 'fish/fish_b.glb', height: 0.3 },
  fish_c: { path: 'fish/fish_c.glb', height: 0.2 },

  // ── Crops — one entry per species per stage ──────────────────────────────
  // 4 stages per species (_1.._4), named for the models that exist. The crop roster
  // follows the art rather than the other way round — no forcing a turnip when the
  // pack ships a beet.
  beet_1: { path: 'crops/beet_1.glb', height: 0.18 },
  beet_2: { path: 'crops/beet_2.glb', height: 0.3 },
  beet_3: { path: 'crops/beet_3.glb', height: 0.42 },
  beet_4: { path: 'crops/beet_4.glb', height: 0.5 },
  carrot_1: { path: 'crops/carrot_1.glb', height: 0.18 },
  carrot_2: { path: 'crops/carrot_2.glb', height: 0.3 },
  carrot_3: { path: 'crops/carrot_3.glb', height: 0.42 },
  carrot_4: { path: 'crops/carrot_4.glb', height: 0.5 },
  lettuce_1: { path: 'crops/lettuce_1.glb', height: 0.18 },
  lettuce_2: { path: 'crops/lettuce_2.glb', height: 0.3 },
  lettuce_3: { path: 'crops/lettuce_3.glb', height: 0.42 },
  lettuce_4: { path: 'crops/lettuce_4.glb', height: 0.5 },
  dandelion_1: { path: 'crops/flower_1.glb', height: 0.15 },
  dandelion_2: { path: 'crops/flower_2.glb', height: 0.25 },
  dandelion_3: { path: 'crops/flower_3.glb', height: 0.35 },
  dandelion_4: { path: 'crops/flower_4.glb', height: 0.4 },
  grasscrop_1: { path: 'crops/grass_1.glb', height: 0.15 },
  grasscrop_2: { path: 'crops/grass_2.glb', height: 0.25 },
  grasscrop_3: { path: 'crops/grass_3.glb', height: 0.32 },
  grasscrop_4: { path: 'crops/grass_4.glb', height: 0.38 },
  // Spare species, already converted and ready to wire up
  corn_4: { path: 'crops/corn_4.glb', height: 0.9 },
  wheat_4: { path: 'crops/wheat_4.glb', height: 0.7 },
  pumpkin_4: { path: 'crops/pumpkin_4.glb', height: 0.5 },
  tomato_4: { path: 'crops/tomato_4.glb', height: 0.6 },

  // ── Nature — scatter. Keep these INSTANCED, see ASSETS.md ────────────────
  tree_oak: { path: 'nature/common_tree_1.glb', height: 3.4 },
  tree_oak_2: { path: 'nature/common_tree_2.glb', height: 4.8 },
  tree_oak_3: { path: 'nature/common_tree_3.glb', height: 4.2 },
  tree_birch: { path: 'nature/birch_tree_1.glb', height: 4.6 },
  tree_birch_2: { path: 'nature/birch_tree_2.glb', height: 4.3 },
  tree_stump: { path: 'nature/wood_log.glb', height: 0.45 },
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
  barn: { path: 'buildings/barn.glb', height: 4.0 },

  // ── Items & tools ─────────────────────────────────────────────────────────
  slingshot: { path: 'items/slingshot.glb', height: 0.4 },
  bow: { path: 'items/bow.glb', height: 1.0 },
  axe: { path: 'items/axe.glb', height: 0.8 },
  bucket: { path: 'items/bucket.glb', height: 0.35 },

  // ── Zone entities — bosses, challenge zones, guardians ───────────────────
  // Quaternius Ultimate Monsters. Silhouette treatment is per-zone: full black for
  // anything meant to read as a threat you can't resolve, normal for a fair fight.
  guardian_a: { path: 'monsters/guardian_a.glb', height: 2.2 },
  guardian_b: { path: 'monsters/guardian_b.glb', height: 2.6 },

  // ── LEGACY ────────────────────────────────────────────────────────────────
  // Keys the current code already calls, pointing at the flat files in
  // public/models/. Kept so nothing breaks while the Quaternius assets land.
  // Migrate call sites to the categorised keys above, then delete this block.
  crop1: { path: 'crops/beet_1.glb', height: 0.18 },
  crop2: { path: 'crops/beet_2.glb', height: 0.3 },
  crop3: { path: 'crops/beet_4.glb', height: 0.5 },
  tree_farm: { path: 'nature/common_tree_1.glb', height: 4.5 },
  tree_woods: { path: 'nature/birch_tree_dead_1.glb', height: 4.2 },
  house1: { path: 'buildings/small_barn.glb', height: 2.6 },
  house2: { path: 'buildings/barn.glb', height: 4.4 },
  animal_a: { path: 'animals/deer.glb', height: 1.0, tint: 0x8a6a4a, tintStrength: 0.55 },
  animal_b: { path: 'animals/fox.glb', height: 0.38, tint: 0x6a7a5a, tintStrength: 0.55 },
  scatter: { path: 'scatter.glb', height: 0.4 },
  stalker: { path: 'monsters/guardian_a.glb', height: 1.75, silhouette: true },
} satisfies Record<string, ModelDef>;

export type ModelKey = keyof typeof MODELS;

/** Every key, for preloading or validation. */
export const MODEL_KEYS = Object.keys(MODELS) as ModelKey[];

export function modelDef(key: ModelKey): ModelDef {
  return MODELS[key];
}
