# TARNATION — Masterplan ALPHA (Draft 0)

> ## ⚠️ HISTORICAL — not build instruction
>
> This document predates the current design. It is kept for its systems thinking, which is
> still useful, but **do not build from it**. Two things in it are dead:
>
> 1. **The Dark Woods, the Woodsman, the Attention meter, the bag-drop stake, and the "no jokes
>    past the treeline" tonal contract** — all removed. Replaced by multiple maps of varying
>    difficulty with triggered secret zones and boss/challenge/treasure zones.
> 2. **Phaser, Electron, Steam SDK, the `packages/` layout** — the stack is Three.js + React +
>    Vite on Cloudflare Pages.
>
> **Current design authority: [`../CLAUDE.md`](../CLAUDE.md), [`../ASSETS.md`](../ASSETS.md),
> [`../IDEAS.md`](../IDEAS.md).**


**This is a build spec for an AI agent, not a design doc.** Execute it in order. Every number here
is deliberate — use it as written. Where this document is silent, choose the simplest thing that
works and move on.

**Goal:** go from zero to a deployed, playable game with a complete core loop in one pass.
Browser build on Cloudflare — a URL you can send someone. Electron/`.exe` comes later and reuses
this exact build.

**Audience:** the two developers. Never shown to players. Programmer art is expected and fine.

**Design authority for everything beyond this file:** `masterplan.md`. This alpha is a deliberate
subset of it. Do not import features from it that aren't listed here.

---

## 1. What this is and is not

**Build exactly this loop:**

> Farm by day → defend crops from weasels at night → risk the woods for wood → spend wood on one
> upgrade → repeat → survive to Day 5 with the Shed built → "Draft Complete" screen.

All four design pillars appear at their simplest: **Grow, Defend, Venture, Upgrade.**

**DO NOT BUILD ANY OF THIS.** It is all deferred to later masterplans, and building it will break
the one-shot:

| Cut | Cut | Cut |
|---|---|---|
| Crop genetics / crossbreeding | Seed Codex | More than 1 crop type |
| More than 1 weasel type | Weasel boss | Mushroom traps |
| Guns beyond the slingshot | Hunt Mode / Duck Hunt camera | Animals, trophies, trophy wall |
| Irrigation beyond a bucket | Trenches, aqueducts, elephant | Donkeys, carts |
| Homestead tiers beyond 1 | Seasons, weather, merchant, money | Dialogue, story, NPCs |
| Steam SDK / achievements | Settings menu, accessibility, remapping | Multiple woods depths |
| Image files | Audio files | Save migrations |

If you finish early, **stop.** Do not add features. Polish what exists.

---

## 2. Tech setup

**Stack:** TypeScript (strict) + Phaser 3 + Vite. Static web build, deployed to Cloudflare.
No monorepo — a single project. **No Electron in Draft 0.**

```
tarnation/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.jsonc       # Cloudflare config
├── index.html
└── src/
    ├── main.ts          # Phaser boot
    ├── content.ts       # ★ ALL tuning constants (§4). Nothing tunable lives elsewhere.
    ├── sim/             # ★ Pure logic. No Phaser imports, no DOM, no window.
    │   ├── rng.ts       # mulberry32 seeded PRNG
    │   ├── clock.ts     # day/night state machine
    │   ├── farm.ts      # tile grid, crop growth
    │   ├── raid.ts      # weasel wave generation
    │   └── save.ts      # serialize / deserialize (pure — storage I/O lives in scenes)
    └── scenes/
        ├── FarmScene.ts
        ├── WoodsScene.ts
        └── HudScene.ts  # runs in parallel, always on top
```

**Dependencies — these only:** `phaser`, `vite`, `typescript`, `wrangler` (dev dep).

**Scripts:**

```json
"dev":     "vite",
"build":   "tsc && vite build",
"preview": "vite preview",
"deploy":  "npm run build && wrangler pages deploy dist --project-name tarnation"
```

### Deployment

- `vite.config.ts`: `base: './'`, `build.outDir: 'dist'`.
- Deploy with **Cloudflare Pages**: `npx wrangler pages deploy dist --project-name tarnation`.
  First run creates the project and prompts for login. Output is a `*.pages.dev` URL.
- The game is **fully static** — no Worker script, no API, no backend, no database.

### The offline rule — keep this even on the web

**After the page loads, the game makes zero network requests.** All code and assets are in the
bundle; there are no runtime fetches, no CDN fonts, no analytics, no telemetry. Verify with an
empty Network tab after load.

This is not busywork. It is what makes the same build droppable into an Electron shell later
with no rework — the static `dist/` output *is* the desktop payload. Draft 0 skips Electron; it
does not design itself out of it.

### Saves

`localStorage` under the key `tarnation.save`. `src/sim/save.ts` stays pure — it serializes and
deserializes plain objects; the actual `localStorage` read/write happens in the scene layer. That
keeps `sim/` portable to a file-based save when Electron arrives.

### Architecture rule (the one that matters)

**`src/sim/` never imports Phaser and never touches the DOM.** Game logic lives there as pure
functions; scenes read from it and render. This is the only rule from `masterplan.md` that must
survive the alpha — it's what makes the code testable and extendable later. Everything else in the
full masterplan's architecture (monorepo, packages, Vitest) is deferred.

### Art and audio: none

**Zero asset files.** Every visual is a Phaser `Graphics` primitive or a texture generated at
runtime via `Graphics.generateTexture()`. Rectangles, circles, triangles. Use the §4 palette.

**No audio files.** Optional, only if everything else works: synthesize simple tones with the Web
Audio API for chop/plant/hit, plus a 4-note looping arpeggio on the farm that **stops completely in
the woods**. If this risks the build, skip it entirely — silence is acceptable for Draft 0.

---

## 3. Build order

Each step ends with something runnable. **Commit after each.** If you run out of budget, the game
still works at whatever step you reached.

| # | Step | Done when |
|---|---|---|
| 1 | Project scaffold, Phaser boots, green rectangle, **deployed to Cloudflare** | A live `*.pages.dev` URL loads it |
| 2 | Player: movement, camera follow, squash-and-stretch | You can walk around |
| 3 | Farm grid: till, plant, water, grow, harvest | Full crop lifecycle works |
| 4 | Clock: day/night cycle, HUD showing day + time | Cycle visibly runs |
| 5 | Weasels + slingshot: night raid, combat | Night is a threat you can answer |
| 6 | Woods: zone transition, lantern, chopping, bag, death-drop | The risk loop works |
| 7 | Shed upgrade, win condition, Draft Complete screen | Game has an ending |
| 8 | Save/load | State survives a restart |
| 9 | Feel pass (§6) | It feels good |

**If budget runs short, cut in this order:** save/load (step 8) → the Stalker (§5.6) → the Shed
upgrade (step 7). **Never cut** the feel pass or the Cloudflare deploy.

---

## 4. Tuning constants

Put all of this in `src/content.ts` and import from there. Every value is a placeholder chosen to
make the loop testable fast — the developers will retune. Nothing tunable may be hardcoded elsewhere.

```ts
export const TILE = 32;
export const GRID_W = 20, GRID_H = 20;        // farm is 640x640 world px
export const VIEW_W = 1280, VIEW_H = 720;

// Clock (real seconds)
export const DAY_LENGTH = 180;
export const NIGHT_LENGTH = 60;
export const WIN_DAY = 5;

// Player
export const PLAYER_SPEED = 190;              // px/sec
export const TOOL_RANGE = 48;                 // px, for till/plant/water/harvest/chop

// Crop: Turnip (the only crop)
export const CROP_GROW_TIME = 100;            // sec after watering -> mature
export const CROP_STAGES = 3;                 // sprout, growing, mature
export const CROP_SELL_VALUE = 0;             // no economy in alpha

// Weasels (Diggler only)
export const WEASEL_BASE_COUNT = 3;           // night 1
export const WEASEL_PER_NIGHT = 1;            // +1 each night
export const WEASEL_MAX = 8;
export const WEASEL_SPEED = 105;              // slower than player, on purpose
export const WEASEL_EAT_TIME = 3;             // sec to destroy a crop
export const WEASEL_HP = 1;
export const WEASEL_BURROW_TIME = 1.2;        // emerge animation, vulnerable during it

// Slingshot
export const SHOT_SPEED = 420;
export const SHOT_COOLDOWN = 0.4;
export const SHOT_LIFETIME = 1.2;

// Woods
export const LANTERN_FUEL = 120;              // sec
export const LANTERN_RADIUS_MAX = 190;        // px at full fuel
export const LANTERN_RADIUS_MIN = 70;         // px at empty
export const TREE_CHOPS = 3;                  // hits to fell
export const TREE_WOOD = 1;
export const TREE_COUNT = 24;
export const BAG_SIZE_BASE = 6;
export const BAG_SIZE_UPGRADED = 12;
export const STALKER_SPAWN_FUEL = 40;         // stalker appears when fuel drops below this
export const STALKER_SPEED_EMPTY = 150;       // slower than player when bag is empty
export const STALKER_SPEED_FULL = 210;        // FASTER than player when bag is full
export const STALKER_DESPAWN_ON_EXIT = true;

// Shed
export const SHED_COST = 10;                  // wood

// Palette
export const C = {
  farmGrass:  0x6FA84B,
  farmTilled: 0x7A5433,
  farmWatered:0x543B24,
  crop:       0xC4D64A,
  cropMature: 0xE8C33A,
  player:     0xE8D9B0,
  weasel:     0x8B5E3C,
  shot:       0xF2F0E4,
  house:      0x9A6B42,
  sky:        0x8FCB6E,
  // woods — desaturated, cold
  woodsBg:    0x1B2220,
  woodsTree:  0x2E3A34,
  woodsFloor: 0x232B27,
  lantern:    0xFFE9B0,
  stalker:    0x0C0F0E,
};
```

---

## 5. Systems

### 5.1 Player

Circle, radius 12, `C.player`. WASD/arrows to move, 8-directional, `PLAYER_SPEED`. Camera follows
with `startFollow(player, true, 0.1, 0.1)`. Clamped to world bounds.

**Tool use:** left click. The action is contextual on the tile under the cursor, if within
`TOOL_RANGE`:

| Tile state | Click does |
|---|---|
| Grass | Till → Tilled |
| Tilled | Plant → Planted (stage 0) |
| Planted, unwatered | Water → watered, growth timer starts |
| Mature crop | Harvest → +1 to bag, tile → Tilled |
| Tree (woods) | Chop (1 of `TREE_CHOPS`) |

Right click / spacebar fires the slingshot toward the cursor.

### 5.2 Farm grid

`GRID_W × GRID_H` array in `sim/farm.ts`. Each tile: `{ state, plantedAt, watered, stage }`.

Growth: a watered crop advances through `CROP_STAGES` over `CROP_GROW_TIME`, evenly divided.
Unwatered crops do not advance. Watering is once per crop, not per day (kept simple deliberately).

Render each tile as a filled rect. Crops are a small rect on top that grows taller per stage and
shifts to `C.cropMature` at the final stage.

### 5.3 Clock

`sim/clock.ts` — a state machine: `DAY (180s) → NIGHT (60s) → next day`. Exposes
`{ day, phase, elapsed, t }` where `t` is 0..1 through the current phase.

Visual: tint the whole scene by lerping a dark blue overlay 0 → 0.55 alpha across dusk and back at
dawn. HUD shows `Day N` and a phase bar.

**The woods are enterable only during DAY.** At nightfall, if the player is in the woods, they are
force-returned to the farm and **lose their bag** — same as death. Say so in the HUD as dusk nears.

### 5.4 Weasels (Diggler only)

Spawn at the start of NIGHT: `min(WEASEL_BASE_COUNT + (day-1) * WEASEL_PER_NIGHT, WEASEL_MAX)`.
Wave composition comes from `sim/raid.ts` (pure function of day + seed).

Behavior — a 4-state machine, nothing more:

1. **Burrow** — spawn at a random edge tile, play the emerge tell for `WEASEL_BURROW_TIME`.
   Vulnerable but stationary. This tell is what makes them fair to fight.
2. **Seek** — move at `WEASEL_SPEED` toward the nearest planted-or-mature crop tile. Straight-line
   movement, no pathfinding. There are no obstacles in the alpha.
3. **Eat** — on arrival, consume for `WEASEL_EAT_TIME`, then the tile reverts to Tilled.
4. **Flee** — after eating, run to the nearest edge and despawn.

`WEASEL_HP = 1`, so one slingshot hit kills. On death: squash flat, spin, fade out over 0.3s.

If no crops exist, weasels wander toward the player, get bored, and leave. Never let them softlock.

### 5.5 Slingshot

Small circle projectile, `SHOT_SPEED`, destroyed on hit or after `SHOT_LIFETIME`.
`SHOT_COOLDOWN` between shots. Infinite ammo in the alpha. Overlap check against weasels only.

### 5.6 The Woods

A **separate scene** with its own 1600×1600 world. Enter by walking into the treeline strip at the
top edge of the farm. Exit the same way. **Entry is always voluntary** — never forced, never
required to progress, but the Shed needs wood and wood only exists here.

**This zone must feel different.** Enforce all of these — they are the point of the whole alpha:

| | Farm | Woods |
|---|---|---|
| Background | `C.sky` / `C.farmGrass` | `C.woodsBg`, near-black |
| Music | arpeggio loop (if built) | **silence — hard stop, no fade** |
| Camera | tight follow, lerp 0.1 | lerp 0.04, so it lags behind you |
| Visibility | full screen | lantern radius only |
| HUD | full | fuel bar and bag only |

**Lantern:** a `RenderTexture` the size of the viewport filled with near-black at 0.94 alpha, with a
soft radial gradient `erase()`d at the player position each frame. Radius lerps from
`LANTERN_RADIUS_MAX` to `LANTERN_RADIUS_MIN` as fuel drains over `LANTERN_FUEL` seconds. Add a ±3%
flicker. Draw above the world, below the HUD.

**Trees:** `TREE_COUNT` placed with the seeded RNG, min 100px apart. `TREE_CHOPS` clicks to fell,
yields `TREE_WOOD`. Felled trees leave a stump and do not respawn within a session.

**Bag:** capacity `BAG_SIZE_BASE`. Wood goes in the bag, not straight to storage. **Walking out
through the treeline banks it. Nothing else does.**

**The Stalker** — the signature mechanic, do not simplify it further:

- Spawns when lantern fuel drops below `STALKER_SPAWN_FUEL`, at the far edge of the lantern radius.
- A featureless black shape, `C.stalker`, slightly darker than the background.
- **Its speed depends on how full your bag is:** lerp `STALKER_SPEED_EMPTY` → `STALKER_SPEED_FULL`
  by `bag.length / bag.capacity`. Full bag means it is *faster than the player*. Empty means slower.
- On contact: screen cuts to black, the player wakes at the farm at dawn, **bag emptied**. No death
  animation, no sound, no message beyond a plain "You dropped everything."
- **Press `Q` to dump the bag instantly.** This is the whole design in one button: drop your haul
  and outrun it, or keep it and gamble. Make sure the player can discover this — one line of HUD
  text when the Stalker first appears: `Q — drop bag`.

Lantern hitting zero also ends the run: fade to black, wake at the farm, bag lost.

### 5.7 Shed upgrade

The house is a rectangle on the farm. Walk into it with `SHED_COST` wood banked to upgrade:
bag `BAG_SIZE_BASE` → `BAG_SIZE_UPGRADED`, and the house rectangle gets visibly bigger. One
upgrade, that's all.

### 5.8 Win condition

Reach `WIN_DAY` with the Shed built → **"DRAFT COMPLETE"** screen showing days survived, crops
harvested, wood gathered, times the Stalker got you. Then allow free play.

An ending, however small, is what makes this a game instead of a sandbox.

### 5.9 Save/load

One JSON in `localStorage` under `tarnation.save`: `{ version: 1, seed, day, phase, elapsed, tiles, wood, bagSize,
shedBuilt, stats }`. Autosave on phase change and on quit. Load on boot if a save exists.
No migrations — `version` is written but unused in the alpha.

---

## 6. The feel budget — do not skip

Content was cut so this could survive. These are cheap and they are the entire difference between
"a working prototype" and "oh, this is actually a game." Budget real effort here.

1. **Squash and stretch.** Scale-tween every actor on every state change. Player squashes on
   footfall (scaleY 0.92 / scaleX 1.08, 120ms, yoyo). Weasels stretch when they lunge, flatten when
   killed. Crops pop (scale 1.3 → 1.0, `Back.easeOut`) when they hit maturity.
2. **Screen shake.** `camera.shake(90, 0.004)` on weasel kill, `(140, 0.008)` on tree fell,
   `(300, 0.02)` on Stalker contact.
3. **Hit pause.** Freeze the scene 60ms on a weasel kill. Two lines of code, enormous impact.
4. **Tweened everything.** No value ever snaps. Lantern radius, day/night tint, camera, HUD numbers
   — all lerped.
5. **Particles.** Dirt puff on till, water droplets on watering, wood chips on chop, dust on weasel
   burrow. Phaser's particle emitter with generated 2px square textures.
6. **The silence.** When entering the woods, audio stops instantly with no fade. If audio is built
   at all, this is the single most important audio decision in the alpha.

---

## 7. Acceptance checklist

The build is done when every line is true. Verify each one by actually running it.

- [ ] `npm run deploy` publishes to Cloudflare Pages and the live URL loads the game
- [ ] After initial page load the game makes **zero network requests** (empty Network tab)
- [ ] Works offline once loaded (kill wifi mid-session, keep playing)
- [ ] Player walks, camera follows, movement feels responsive
- [ ] Full crop lifecycle: till → plant → water → 3 visible growth stages → harvest
- [ ] Day/night cycle runs, tint transitions smoothly, HUD shows day and phase
- [ ] Weasels burrow up at night, telegraph before acting, seek crops, eat them, flee
- [ ] Slingshot fires toward the cursor and kills a weasel in one hit
- [ ] Woods are enterable by walking into the treeline, and only during day
- [ ] Woods look and sound *categorically* different from the farm
- [ ] Lantern radius visibly shrinks as fuel drains
- [ ] Trees take 3 chops and yield wood into a capacity-limited bag
- [ ] Wood banks **only** by walking out through the treeline
- [ ] The Stalker appears at low fuel and is faster than the player with a full bag
- [ ] `Q` dumps the bag and lets you escape
- [ ] Dying in the woods loses the bag and returns you to the farm at dawn
- [ ] 10 wood builds the Shed; bag capacity doubles; the house visibly changes
- [ ] Reaching Day 5 with the Shed shows DRAFT COMPLETE with stats
- [ ] Save persists across a full app restart
- [ ] All six items in §6 are present
- [ ] `src/sim/` contains no Phaser imports — verify with a grep
- [ ] No image or audio files exist in the repo
- [ ] Runs at 60fps with 8 weasels and full particles
- [ ] No console errors during a full 5-day playthrough

---

## 8. Where this goes next

This alpha deliberately builds the **skeleton the full game hangs on**. Each cut system has a
designed slot waiting for it:

| Alpha has | Grows into (`masterplan.md`) |
|---|---|
| 1 crop, no breeding | Genetics system, Weirdness tiers, Seed Codex (§8.2) |
| 1 weasel type | 6 types incl. Hauler and the Duke, mushroom traps (§8.5) |
| Slingshot only | 5 gun tiers, crops-as-ammo, Hunt Mode (§10) |
| 1 woods, 1 stalker | 4 depth tiers, Attention system, the Woodsman (§9) |
| Bucket-free watering | Bucket → trench → aqueduct → elephant (§8.3) |
| Shed | 5 homestead tiers, trophy wall (§8.4) |
| Programmer art | AI illustration + cutout puppet rigs (§6) |
| Single project | Monorepo, `packages/sim`, Vitest balance sims (§5.3) |

**After playing this, write `masterplan_II.md`** covering what actually felt good, what didn't, and
which system to deepen first. Do not deepen more than one at a time.

The question this alpha exists to answer: **is the walk back to the treeline with a full bag
genuinely tense?** If yes, the game works and everything else is content. If no, that's the thing to
fix before building anything else.

---

*Masterplan ALPHA — Marshmallow Muskrat. Subset of `masterplan.md`. Supersedes nothing.*
