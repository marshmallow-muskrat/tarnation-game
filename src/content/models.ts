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
  weasel: {
    path: 'animals/weasel.glb',
    height: 0.45,
    rotateX: 12,
    tint: 0x8b5e3c,
    note: 'Quaternius Ultimate Animated Animals. Pitched forward so it runs low.',
  },
  donkey: { path: 'animals/donkey.glb', height: 1.35 },
  cow: { path: 'animals/cow.glb', height: 1.4 },
  chicken: { path: 'animals/chicken.glb', height: 0.4 },
  pig: { path: 'animals/pig.glb', height: 0.8 },
  sheep: { path: 'animals/sheep.glb', height: 0.9 },
  deer: { path: 'animals/deer.glb', height: 1.5 },
  fox: { path: 'animals/fox.glb', height: 0.9 },

  // ── Fish — ambient only, see ASSETS.md ───────────────────────────────────
  fish_a: { path: 'fish/fish_a.glb', height: 0.25, note: 'Ambient river/lake life. Not catchable.' },
  fish_b: { path: 'fish/fish_b.glb', height: 0.3 },
  fish_c: { path: 'fish/fish_c.glb', height: 0.2 },

  // ── Crops — one entry per species per stage ──────────────────────────────
  turnip_1: { path: 'crops/turnip_1.glb', height: 0.2 },
  turnip_2: { path: 'crops/turnip_2.glb', height: 0.35 },
  turnip_3: { path: 'crops/turnip_3.glb', height: 0.5 },
  carrot_1: { path: 'crops/carrot_1.glb', height: 0.2 },
  carrot_2: { path: 'crops/carrot_2.glb', height: 0.35 },
  carrot_3: { path: 'crops/carrot_3.glb', height: 0.5 },
  onion_1: { path: 'crops/onion_1.glb', height: 0.2 },
  onion_2: { path: 'crops/onion_2.glb', height: 0.35 },
  onion_3: { path: 'crops/onion_3.glb', height: 0.5 },

  // ── Nature — scatter. Keep these INSTANCED, see ASSETS.md ────────────────
  tree_oak: { path: 'nature/tree_oak.glb', height: 4.5 },
  tree_pine: { path: 'nature/tree_pine.glb', height: 5.5 },
  tree_birch: { path: 'nature/tree_birch.glb', height: 4.0 },
  rock_a: { path: 'nature/rock_a.glb', height: 0.6 },
  rock_b: { path: 'nature/rock_b.glb', height: 0.9 },
  bush_a: { path: 'nature/bush_a.glb', height: 0.7 },
  grass_tuft: { path: 'nature/grass_tuft.glb', height: 0.3 },

  // ── Buildings ─────────────────────────────────────────────────────────────
  house_1: { path: 'buildings/house_1.glb', height: 2.2, note: 'Lean-To' },
  house_2: { path: 'buildings/house_2.glb', height: 3.0, note: 'Clapboard Shack' },
  house_3: { path: 'buildings/house_3.glb', height: 4.5, note: 'Homestead' },
  house_4: { path: 'buildings/house_4.glb', height: 5.0, note: 'Roadhouse' },
  house_5: { path: 'buildings/house_5.glb', height: 6.5, note: 'The Victorian' },
  market_stall: { path: 'buildings/market_stall.glb', height: 2.4 },
  silo: { path: 'buildings/silo.glb', height: 6.0 },
  windmill: { path: 'buildings/windmill.glb', height: 7.0 },
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
  crop1: { path: 'crop1.glb', height: 0.25 },
  crop2: { path: 'crop2.glb', height: 0.45 },
  crop3: { path: 'crop3.glb', height: 0.7 },
  tree_farm: { path: 'tree_farm.glb', height: 4.0 },
  tree_woods: { path: 'tree_woods.glb', height: 4.0 },
  house1: { path: 'house1.glb', height: 2.2 },
  house2: { path: 'house2.glb', height: 3.0 },
  animal_a: { path: 'animals/deer.glb', height: 1.1, tint: 0x8a6a4a, tintStrength: 0.55 },
  animal_b: { path: 'animals/fox.glb', height: 1.0, tint: 0x6a7a5a, tintStrength: 0.55 },
  scatter: { path: 'scatter.glb', height: 0.4 },
  stalker: { path: 'monsters/guardian_a.glb', height: 1.75, silhouette: true },
} satisfies Record<string, ModelDef>;

export type ModelKey = keyof typeof MODELS;

/** Every key, for preloading or validation. */
export const MODEL_KEYS = Object.keys(MODELS) as ModelKey[];

export function modelDef(key: ModelKey): ModelDef {
  return MODELS[key];
}
