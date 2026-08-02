# Tarnation handoff

This is the current truth for the game. The active product, technical, quality, and release plan is
[`masterplan-v2.md`](masterplan-v2.md). Earlier plans are non-authoritative history in
[`docs/history/`](docs/history/).

## 1. Current game

Tarnation is a Three.js + React + Vite cartoon-Americana economic sandbox with a fixed isometric
camera, deployed to Cloudflare Pages. The player farms, gathers, sells goods, explores the map,
defends crops from foxes, upgrades the homestead, and places buildings. The design supports
non-linear progression and future maps/challenge spaces, but the current work is refinement of the
existing loop.

Run locally with `npm install && npm run dev`; open `http://localhost:5173/picker.html` for the
asset preview grid. Run `npx tsc --noEmit` for the typecheck, `npm run assetcheck` to verify the
manifest paths and inspect referenced GLBs, and `npm run economyreport` to print the current tuning
baseline. The production page exposes no runtime debug handle; use deterministic tests and local
development tooling for inspection.

## 2. Current implementation

- Cowboy player rig with idle, walk, run, carry, pickup, shooting, slash, and punch clips.
- Farm terrain, river, lake, day/night, chunked scatter, crops, trees, economy, genetics, market,
  inventory, save/load, and homestead progression.
- Trees from **Textured Stylized Trees — May 2020**, instanced with manifest height `2.5`.
- Grass, plants, flowers, bushes, and rocks from the accepted Ultimate Nature set, instanced in
  `ScatterChunks.ts`.
- Crop roster: Grass, Dandelion, Beet, Carrot, Lettuce.
- Survival Pack shotgun, shovel, and red axe in the toolbar; bucket uses a small authored stylized
  held prop with fill/use posing.
- Bear traps on `B` with open/closed models and fox capture; `Q` remains the separate boulder.
- Weapon progression is asset-led: ranged shotgun/bow work, with axe/melee as the close option.
- Farm building models are wired to homestead tiers and the first placeable building set.
- Foxes and horses use a shared readable animal-scale pass (`0.75` manifest height × `1.3` source
  scale); crop stages are camera-readable, and animal defeats leave short-lived grounded remains
  markers; rare trophies also show a floating world marker.
- Held tools use a neutral hand socket with measured grip pivots and optional support-hand targets;
  locomotion and one-shot clips crossfade without repeatedly restarting. Merchant and ambient animals
  select deliberate named clips. Construction reservations are separate from physical camp obstacles,
  so the fresh player spawn remains movable while placement still preserves the camp approach.
- Building mode now previews the selected model over the hovered tile with valid/blocked colour and a
  specific placement reason; `H` opens a pausing field guide for movement, tools, combat, and building.
- Shared short-lived low-poly feedback bursts now mark hits, defeats, chopping, farming, watering,
  trap catches, construction, and rewards without adding permanent scene clutter.
- Shovel and axe targets now show an in-world hover state, while the HUD explains range limits,
  blocked tiles, required tools, planting, watering, harvesting, and chopping results.
- `+ / −` adjusts bounded camera zoom and `M` toggles persisted reduced motion, including camera
  shake suppression; both are documented in the pausing field guide.
- Optional synthesized Web Audio feedback covers UI, tools, shots, hits, defeats, water, traps,
  construction, and rewards; `V` toggles persisted mute without adding an asset dependency.

## 3. Asset rules that save time

1. Add models in `src/content/models.ts`, not with code branches in `Assets.ts`.
2. Preserve supplied glTF for animated packs. Convert FBX with `scripts/convert-fbx.mjs` only when
   needed.
3. Optimise textured models with WebP textures, 256px texture size, and meshopt compression. Never
   use texture `copy` for shared pack textures.
4. Use manifest `height` for scale. Animals must be intentionally smaller than life size.
5. Keep primitive fallbacks so missing assets cannot stop the game.
6. Keep scatter instanced; use `FarmTrees.ts` and `Assets.instancedParts()` as the pattern.

## 4. Current quality work

The completed vendor/deed sequence is preserved as
[`docs/history/vendor-deed-system-plan.md`](docs/history/vendor-deed-system-plan.md). The former
local-only economy metrics console handle was removed in UX-02; economy behavior remains covered by
deterministic diagnostics and tests, including four-way attempted/rejected/cancelled/completed
outcome counts and first-completion game times for planting, harvest, sale, purchase, building, fox
defense, and the settlement goal. The 2026-08-01 audit found that the vendor/deed foundation exists, but the
game is not release-ready. The active priorities are the P0 blockers and dependency order in
[`masterplan-v2.md`](masterplan-v2.md):

- CORE-01 through CORE-08 and the M5 release gate are complete on the current integration branch
  after the ACT-01/02/03/04/05 and PERF-05 responsibility extractions; M6 Defense is complete.
- FOX-01 is integrated as merge `109a07b` (PR #40), FOX-02 as merge `82a9900` (PR #41), FOX-03
  as merge `4c0244b` (PR #42), and FOX-04 as merge `86c9efb` (PR #43). Foxes select deterministic
  world targets: haulers can steal stored
  crop produce, sappers can force gates or damage active defenses, and ordinary roles pursue exposed
  crops; the player-centered attack ring and all player-health implications remain removed. Each
  released fox role has a distinct pure profile plus clone-owned tint, bounded silhouette, procedural
  accessory, movement/target preference, telegraph, counter, and existing audio cue; live actors and
  defeat markers explicitly dispose those renderer-owned resources. Shared navigation now rejects
  diagonal corner cuts, reserves distinct target approach tiles, carries fixed-step movement across
  waypoints, and resolves ten-fox overlap to the configured spacing gap. The integrated baseline is
  now 241 deterministic tests across 35 files.
  Repeller crops now drive off at most two foxes per raid, while active shotgun/bow/melee/boulder/trap
  roles retain distinct typed targets, cooldowns, and recovery cues. Crop and stored-produce loss
  feedback names the fox role and the next defensive choice. `npm run test:ci` already runs before
  asset validation and build in the deployment workflow. M6 is released as PR #44 merge `2cce059`;
  M7 Presentation is now released as PR #50 merge `76b9efd`; M8 UX/accessibility is in progress.
  UX-01 through UX-04 are complete; UX-05's authored implementation is integrated on the task branch,
  while its five-person external study remains required before the milestone can close.
- Add unit, migration, browser E2E, visual, performance, and CI release gates.
- Finish the visible genetics, seed, irrigation, building, fox, onboarding, accessibility, audio,
  and ending loops before expanding content.
- BASE-02 characterization is integrated with Vitest: the original baseline had 109 deterministic
  tests across 16 files, compact fixed-seed fresh/midgame/dense-farm/corrupt-save fixtures, and
  migration fixtures for released save versions 3 through 7. PR #3 merged into the integration
  branch as `5ff922b`.
  `npm run test:ci` is part of the main deployment verification workflow before asset validation
  and build.

- ART-01 and ART-02 are complete on the M7 task branch. The typed model metadata resolver derives
  rigged or static structure, expected clips, source-space axes and pivot, target heights, catalog
  footprints, load groups, primitive fallbacks, held-marker source, icon framing, and CC0 provenance.
  ART-02 removes the well-backed `market_stall` manifest alias, makes authored visuals explicit in
  the catalog, centralizes the bucket prop, and adds owned procedural caravan, barrel, and haystack
  silhouettes. Fixed camp rendering now disposes authored props separately from cached GLB clones;
  every visible vendor/build row remains backed by an active accepted model. The presentation picker
  now loads 16 active sold-building, camp-fixture, market-stall, and bucket views through the same
  loader and shadowed lighting profile. The pure GLB validator checks all 97 unique active files;
  the deterministic baseline is now 258 tests across 37 files. `npm run test`, `npm run test:ci`,
  `npm run check`, `npm run assetcheck`, the production build, strict unused-symbol TypeScript,
  `git diff --check`, and `npm audit --omit=dev` pass. ART-03 and ART-04 are integrated below;
  ART-05 is integrated; the M7 production release and live evidence are recorded below.

- ART-03 establishes the shared five-class occupancy policy in `src/sim/occupancy.ts`: hard
  obstacles block player and wildlife actors, soft worked ground remains traversable but is excluded
  from clear-ground tools, interaction-only trees/rocks remain tool and placement targets without
  becoming walls, reservations protect camp land without changing actor pathing or enclosure, and
  decorative content stays non-authoritative. Runtime topology now includes water, fixtures,
  homestead, closed placed structures, and safe boundary exits for fox routing; ambient animals use
  continuous water/building checks; placement rejects live tree/rock tiles; and scatter masks worked
  land, fixtures, interaction props, structures, and future authored paths with deterministic
  clearance. The deterministic baseline is now 266 tests across 38 files. `npm run test`,
  `npm run test:ci`, `npm run check`, `npm run assetcheck`, the production build, strict unused-symbol
  TypeScript, `git diff --check`, and `npm audit --omit=dev` pass. A fresh local browser smoke reached
  Day 1/daylight and Saved status with no console errors. The deployment workflow already runs
  `npm run test:ci` before asset validation and build.

- ART-04 extracts camera policy into the pure `src/sim/camera.ts` module. The fixed orthographic
  composition retains a `0.78–1.3` zoom range, a five-unit vertical half-frustum, finite resize
  fallbacks, a four-unit world-edge target margin that keeps a corner player readable at maximum
  zoom, and quarter-tile shadow-anchor quantization. The existing day/night light-intensity and fog
  curve is characterized with readable minimum levels; runtime movement, fixed-step timing, saves,
  and the production asset path are unchanged. Local visual captures covered default/day framing,
  minimum zoom, the homestead approach, the full HUD/status/toolbar, and the pausing field guide
  modal. The fresh tier-1 world view and active picker views for tiers 2–5 were reviewed under the
  same lighting profile; no player occlusion required a transparency fade. The current game retains
  no weather state. The deterministic baseline is now 275 tests across 39 files. `npm run test`,
  `npm run test:ci`, `npm run check`, `npm run assetcheck`, the production build, strict unused-symbol
  TypeScript, `git diff --check`, and `npm audit --omit=dev` pass. The deployment workflow already
  runs `npm run test:ci` before asset validation and build.

- ART-05 establishes the shared VFX grammar in pure `src/sim/feedback.ts`: valid/invalid placement,
  work contact, water, reward, damage, threat, and discovery each have a bounded typed profile with
  distinct colors. `FeedbackEffectPool` owns 24 reusable renderer-only slots, one shared octahedron
  geometry, and slot-owned materials; it recycles the oldest active slot, never consumes simulation
  RNG, suppresses transient particles under reduced motion, and disposes resources exactly once.
  Existing feedback call sites now use semantic kinds, invalid placement gets an explicit red contact
  cue, and minor boulder/tree-contact shake no longer stacks with the same small event. The current
  deterministic baseline is 284 tests across 41 files. `npm run test`, `npm run test:ci`, `npm run check`,
  `npm run assetcheck`, the production build, strict unused-symbol TypeScript, `git diff --check`, and
  `npm audit --omit=dev` pass. Local visual smoke reached Day 1/daylight with HUD, player, homestead,
  grounded shadows, and controls visible; no console warnings or errors were observed. UX-01 later
  removes the legacy `?legacy` and F12 grid-debug copy from the player-facing Help panel; the hidden
  developer-only runtime paths remain deferred to UX-02's full scaffolding cleanup. The deployment
  workflow already runs `npm run test:ci` before asset validation and build.

- M7 Presentation is released as PR #50 merge `76b9efd` after the integrated 284-test suite, simulation
  checks, asset validation, production build, strict unused-symbol TypeScript, diff check, and production
  audit passed. Automatic workflow [30741246426](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30741246426)
  verified the exact merge SHA and deployed <https://tarnation.pages.dev/>. Fresh production smoke passed
  Continue, Day 1/daylight, Saved status, the visible settlement objective, starter defense controls,
  and Help modal open/close; no console warnings or errors were observed. UX-01 is now complete on
  `agent/ux-01-input-contract`: the typed remappable keyboard contract, deterministic conflict swap,
  safe malformed-settings fallback, non-pointer world/inventory routes, synchronized HUD labels, and
  explicit inventory use/delete controls are covered by 293 deterministic tests across 42 files.
  The exact production-preview smoke reached Day 1/daylight, opened Help and its remapping controls,
  and recorded no console warnings or errors. The deployment workflow already runs `npm run test:ci`
  before asset validation and build.

- UX-02 is complete on `agent/ux-02-information-hierarchy`. The deterministic baseline is 294 tests
  across 42 files. `npm run test`, `npm run test:ci`, `npm run check`, `npm run assetcheck`, the
  production build, strict unused-symbol TypeScript, `git diff --check`, and `npm audit --omit=dev`
  pass. Production-preview smoke reached Day 1/daylight, showed the persistent resource/objective HUD,
  empty occupied-only inventory, focused Help/inventory panels with no simultaneous overlays, title
  `Tarnation`, and no console warnings/errors. The deployment workflow already runs `npm run test:ci`
  before asset validation and build. Legacy v3/v4 saves without panel state intentionally retain an
  open inventory for compatibility; UX-05's external study remains pending.

- UX-02 closes fresh inventory while preserving explicit saved panel state and the legacy v3/v4
  missing-field open default for compatibility. It renders occupied inventory stacks only, makes
  catalog results/cost/footprint/lock/capacity explicit, and enforces one focused panel at a time.
  The visible `?legacy`, F12 grid toggle, and `window.tarn` runtime paths are removed. Settings and
  scaling/contrast are complete in UX-04; the authored onboarding guide is implemented in UX-05 and its external study remains pending.
  Alternate arrow, T, comma/period, and numpad bindings remain reserved for their current actions so
  remapping cannot create duplicate routes; this is the explicit UX-01 conflict policy. The first-ten-
  minutes onboarding study is tracked in [`docs/ux-05-first-ten-minutes-study.md`](docs/ux-05-first-ten-minutes-study.md).

- UX-03 is complete on `agent/ux-03-modal-accessibility`. Launch, pause, Help, Codex, inventory,
  merchant, build, context, and settlement overlays now use labeled dialog/menu semantics with
  deterministic focus entry, wraparound trapping, Escape close behavior, and opener restoration.
  Toasts and vendor messages expose status text; modal transitions clear held keyboard/pointer state;
  and build mode pauses the world while preserving a single fixed-step placement commit boundary.
  Settlement presentation now pauses until dismissal. The deterministic baseline is 299 tests across
  43 files. `npm run test`, `npm run test:ci`, `npm run check`, `npm run assetcheck`, the production
  build, strict unused-symbol TypeScript, `git diff --check`, and `npm audit --omit=dev` pass.
  Production-preview smoke verified fresh launch, Help focus restoration, inventory semantics, and
  no browser warnings/errors. UX-04 is now complete; UX-05's external study remains pending.

- UX-04 is complete on agent/ux-04-settings-accessibility. The pausing Settings dialog stores
  typed browser preferences outside the save schema: master/music/effects/ambience levels, mute,
  reduced motion, independent camera shake, UI/text scale, high-contrast UI, and the existing
  conflict-safe keyboard rebinding/reset contract. Audio gains are applied at the master and typed
  music/effects/ambience buses; the current synthesized fallback has no authored music or ambience
  source and remains on effects until AUD-01. Day/night pacing remains fixed because it is coupled
  to crop growth, raids, cooldowns, and the economy. The deterministic baseline is 303 tests across
  44 files. npm run test, npm run test:ci, npm run check, npm run assetcheck, the production build,
  strict unused-symbol TypeScript, git diff --check, and npm audit --omit=dev pass. Production-preview
  smoke verified the labeled Settings dialog, focus trap/restoration, scale and contrast controls,
  and no browser warnings/errors. UX-05's implementation is next in review; the external study remains pending.

- UX-05 authors the first ten minutes as a derived, non-saved eight-beat guide: launch copy and
  immediate movement, starter-plot shovel/plant/water/grow/harvest transitions with active-binding
  prompt copy, early fox-risk
  guidance, market sale, merchant next-goal, Save status, and concise Help/Settings discovery.
  The guide ends after the first merchant visit and never adds quest fields to the save schema. The
  deterministic baseline is now 315 tests across 45 files. `npm run test`, `npm run test:ci`,
  `npm run check`, `npm run assetcheck`, the production build, strict unused-symbol TypeScript,
  `git diff --check`, and `npm audit --omit=dev` pass. Production-preview smoke reached fresh Day 1/
  daylight, showed the non-modal First steps card and Saved status, opened Help, and reached Settings
  through the pause menu with no browser warnings/errors. The five-person external study and any
  resulting copy/flow revision remain required evidence; UX-05 and M8 are not yet release-complete.

The characterization baseline intentionally preserves current behavior for later, scoped follow-up:

- v4 migration can duplicate a trophy already present in the inventory, and v3/v4 top-level
  `darkwood` is currently discarded because that retired item no longer has a current registry entry.
- ART-02 intentionally does not introduce new external art: accepted packs have no honest mesh for
  the market stall, caravan, barrel, haystack, or bucket, so the authored props remain the source of
  truth. The current held-tool GLBs have no embedded grip/support marker nodes, so the typed
  equipment profiles remain the honest marker source; hardcoded tool-icon framing and broader
  presentation cleanup remains later UX cleanup.
- Before ART-03, the actor obstacle set excluded water and ambient animals selected unconstrained
  headings, so fox routes/flee exits and friendly wildlife could cross water or physical structures.
  This was a genuine collision-policy defect and is now corrected without adding a save field. Soft
  worked ground remains intentionally traversable by actors, interaction-only trees/rocks do not
  become walls, and the empty central camp reservation remains walkable; those are deliberate policy
  contracts rather than unfinished collision.
- Before ART-04, camera follow used the player position directly even at the authored world edges,
  and projection/shadow/lighting math lived only in `WorldRenderer`. The edge target now stops just
  far enough inside the `[2, 238]` movement bounds to keep a corner player in frame at maximum zoom;
  the player’s movement bounds are unchanged. No weather variant or tall-building fade was invented
  because neither is present or required by the current authored content. Generated visual captures
  remain review evidence rather than committed binary assets.
- SAVE-01 now emits a compact v9 sparse-tile wire format with a deduplicated seed table: the fixed
  fresh fixture is 1,361 bytes, the representative midgame fixture is about 1.5 KB, and the dense
  48×48 farm fixture is about 147 KB. Fresh and typical budgets are 250 KB and 1 MB, with a 4 MB
  warning threshold; v8 full-grid saves remain readable and migrate explicitly. PR #5 is integrated
  on `agent/masterplan-v2-implementation`. SAVE-02 now routes runtime persistence through a checksummed
  atomic two-slot SaveService with structured failure statuses, legacy migration, recovery, and JSON
  import/export; production-build smoke confirmed validated Continue after reload. PR #6 is integrated
  on `agent/masterplan-v2-implementation`. PR #7 adds boundary and 15-second fallback timing,
  best-effort visibility/unload flushes, and accessible persistent save feedback. The integrated M1
  gate has 83 deterministic tests; representative midgame round-trip measured 4.48 ms average and
  11.64 ms maximum over 24 samples. Local browser smoke passed fresh New Adventure, reload/Continue,
  HUD Saved status, and a visible v7 Import JSON flow preserving Day 4/night, resources, buildings,
  and inventory crops. Corrupt-slot recovery remains covered by the deterministic service fixtures;
  local storage was not manipulated from the browser. M1 release PR #8 merged as `f343e4a`; the
  automatic workflow [30721616462](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30721616462)
  passed all verification and deployment steps, and the canonical live smoke passed the M1 launch,
  reload/Continue, HUD Saved status, and console-health journeys.
- ECON-01 now uses a typed Vite build capability: production builds always charge catalog costs, the
  development-only free sandbox is visibly labeled in the merchant panel, and public query
  parameters cannot change purchase policy. Pure quote/transaction coverage verifies exact
  deduction and atomic failed purchases. ECON-02 now requires explicit starter, merchant, upgrade,
  debug, unreleased, and fixture availability; starter tools and empty toolbar slots no longer
  appear as merchant/build choices, and nonfunctional building entries remain loadable for legacy
  save rendering/use without appearing as new choices. ECON-03 adds local-only outcome counters and
  a pure fixed-seed diagnostic cohort: 16 seeds × 30 days, with current crop, wood, sale, and paid
  purchase rules. ECON-04 then tuned tree yield from 2 to 1 wood per felled tree (the existing stump
  clear still adds one), reduced base crop prices to 4–12₫, corrected finite legacy homestead costs,
  and hid cosmetic/nonfunctional fence and homestead deed rows from new production choices. Across
  the cohort, the first crop sale is day 3 for every run, irrigation is acquired by day 5 in 16/16
  runs (median day 3.5, range 3–5), and no dead or malformed purchase remains. The 30-day diagnostic
  reports startup resource starvation in 16/16 runs and one long-horizon runaway boundary hit; that
  boundary remains visible for later functional-building sinks. The integrated baseline is now 97
  deterministic tests across 12 files; PERF-01 is now integrated below.

- PERF-01 stages the 109-model manifest into typed `boot`, `first_play`, `nearby`, `catalog`, and
  `optional` groups. Boot and first-play use a bounded four-worker loader, while nearby/catalog/
  optional groups continue after the world is controllable. The loading surface reports group
  progress, shows primitive-fallback failures with a retry action, and exposes a retryable startup
  error screen. Catalog icons and build previews refresh when their real model becomes ready. The
  local production preview showed `first-play` progress at 25/66 on a cold launch and 52/66 after a
  warm reload; both reached Day 1/daylight with Saved HUD state and no console warnings/errors.
  Asset group validation and the integrated deterministic baseline now total 101 tests across 13
  files. PERF-02 is now integrated below; PERF-03 completes the remaining GPU/runtime disposal
  ownership work.

- PERF-02 replaces the per-`ModelIcon` WebGL renderer with one shared offscreen renderer and a
  bounded 32-entry least-recently-used cache of 96px thumbnails. Visible icon canvases are 2D
  displays of those thumbnails, so repeated toolbar, inventory, merchant, and building icons do
  not allocate additional WebGL contexts. App teardown clears the cache and disposes the shared
  renderer. The built local preview reached Day 1/daylight with the starter icon set and no console
  warnings/errors; the source-level renderer audit leaves only the game renderer, this one shared
  icon renderer, and the intentionally separate asset-picker renderer. The integrated baseline is
  now 103 deterministic tests across 14 files. PERF-03 follows as the completed lifecycle/disposal
  slice below.

- PERF-03 gives the runtime, world renderer, procedural scatter/tree owners, dynamic effects, animation
  mixers, input/audio listeners, shared icon renderer, and model cache idempotent teardown paths.
  Asset-cache geometry/material/texture ownership is separated from clone-owned materials, and a
  retired fallback remains valid until its last active clone releases it. Stale async loads are
  generation-guarded so React development cleanup cannot repopulate a torn-down cache. The built
  production preview completed three fresh Continue/remount cycles and three New Adventure cycles to
  Day 1/daylight with Saved HUD state and no console warnings/errors. The deterministic baseline is
  now 106 tests across 15 files;
  `npm run test:ci`, `npm run check`, `npm run assetcheck`, the build, strict unused-symbol TypeScript,
  `git diff --check`, and `npm audit --omit=dev` all pass. PERF-04 follows as the completed incremental
  world-update slice below.

- PERF-04 replaces per-fox full-grid BFS with shared reverse route fields keyed by target and topology
  version, expanded under a fixed 4,096-node budget per simulation step. Crop state now reconciles by
  dirty tile and batches compatible species/stage/tint models through `InstancedMesh`, while primitive
  fallbacks remain available. Interactive camp/building/farm occupancy masks only the affected live
  scatter chunks. World raycasters, screen vectors, day/night colours, tree picking scratch state, and
  shadow anchors are reused; shadow maps follow quantized 0.25-unit anchors rather than every render
  frame. Asset cloning now uses `SkeletonUtils.clone()` only for scenes containing `SkinnedMesh`.
  The integrated deterministic baseline is 109 tests across 16 files. The built preview reached Day 1
  daylight through Continue and New Adventure with no console errors or warnings. All required unit,
  smoke, asset, build, strict TypeScript, diff, and production-audit checks pass. PERF-05 follows below.

- PERF-05's first extraction slice moves player animation transitions and held-tool selection/socket
  posing out of `GameRuntime` into `PlayerActionController` and `EquipmentController`. The fixed-step
  movement authority, existing clip names, measured grip profiles, support-hand solve, and tool-slot
  behavior are unchanged; the controllers are renderer-facing and keep `src/sim` pure. Five focused
  characterization tests cover bucket hiding, toolbar/weapon model mapping, unsupported slots, empty
  locomotion, and the carry idle/run threshold. The integrated deterministic baseline is now 114 tests
  across 17 files.

- PERF-05's second extraction slice moves pointer priority and selected-tool/combat dispatch into the
  renderer-facing `InteractionSystem`. Build rotation/place, demolish, placed-asset context menus,
  combat fallback, bucket/tool selection, and attempt metrics retain their existing order and callbacks;
  `GameRuntime` remains the composition root for gameplay effects. Seven focused routing tests cover the
  player-visible tool mapping and build/context/demolish/combat/Space priority rules. The integrated
  deterministic baseline is now 121 tests across 18 files.

- PERF-05's third extraction slice moves fox target selection, bounded route following, role speeds,
  navigation-field ownership, and actor separation into `FoxDirector`; the raid state machine and
  gameplay callbacks remain in `GameRuntime`. Four focused tests cover exposed-target choice, role
  speeds, blocked-tile routing, and the current overlap/separation behavior. The integrated
  deterministic baseline is now 125 tests across 19 files.

- PERF-05's fourth extraction slice moves placeable catalog selection, deed/legacy rotation state,
  placement preview coordinates, and player-visible validation reasons into `PlacementCoordinator`.
  Placement commit, demolition, gates, and save/economy mutations remain in `GameRuntime`; the
  coordinator has no DOM, Three.js, or simulation mutation dependency. Five focused tests cover
  heading/deed orientation, cancellation state, distance/reservation/terrain/player-footprint
  rejection, occupied assets, and the legacy wood-versus-deed payment boundary. The deterministic
  baseline is now 130 tests across 20 files. The remaining PERF-05 slices are metrics and HUD
  responsibility extraction.

- PERF-05's fifth extraction slice moves local economy/action counters and debug snapshot copying into
  `RuntimeMetrics`. `GameRuntime` remains the owner of when gameplay events occur, while the metrics
  object owns aggregation, first-completion timing, progression totals, and isolated snapshots. Four
  focused tests cover outcome/action separation, progression aggregation, deterministic session-time
  snapshots, and settlement completion. The deterministic baseline is now 134 tests across 21 files;
  the remaining PERF-05 slice is HUD responsibility extraction.

- PERF-05's final extraction slice moves the typed HUD snapshot contract, inventory/market/vendor/build
  view-model mapping, JSON deduplication, and transient-array copying into `HudPresenter`. `GameRuntime`
  remains the composition root and supplies live placement, world, save, economy, and interaction
  callbacks; React continues to render the same snapshot shape. Four focused tests cover fresh HUD
  mapping, item/market totals, tab normalization with pause/ending state, and deduplication. The
  deterministic baseline is now 138 tests across 22 files. PERF-05 is complete, and M3 release
  evidence is recorded below.

- Known current fox behavior is preserved for a later focused follow-up: when two active foxes start at
  exactly the same position, the existing separation fallback treats them as one unit apart before
  calculating the push, producing only a small deterministic nudge (0.052 units at the current 1.05
  unit nominal gap) rather than fully separating them. No gameplay rule was changed in PERF-05.

- ACT-01 adds the renderer-independent `ActionStateMachine` with explicit idle/move, tool windup/contact/
  recovery, ranged aim/fire, interaction, menu, and disabled states. Eight focused tests cover delayed
  contact/fire events, recovery, one-slot same-kind buffering, cross-kind rejection, movement scales,
  interaction completion, menu cancellation, and focus restoration. Farming, melee, projectiles,
  construction, bucket work, and bear traps now apply their effects from fixed-step action callbacks;
  the current deterministic baseline is 146 tests across 23 files. The local production preview reached
  Day 1/daylight with Saved status, field-guide and inventory modal checks, and no observed console
  warnings or errors. ACT-03–05 remain separate control/animation follow-up tasks.

- ACT-02 moves held-equipment ownership into the typed `src/content/equipment.ts` table. Seven records
  cover axe, bow, shotgun, shovel, bucket, bear trap, and build previews with measured axes, grip/socket
  transforms, support-hand targets, locomotion/action metadata, fixed-step timings, feedback cues, icon
  framing, readability bounds, and debug colours. The current four Survival Pack glTFs have no authored
  grip/socket marker nodes, so the measured values remain the intentional source of truth. The runtime
  consumes the table for held transforms, support solving, action timing, and opt-in F12 axis/support
  visualization; `npm run assetcheck` validates all records. Eight focused tests characterize the table,
  preserve the existing four transforms, and identify invalid fields. The deterministic baseline is now
  154 tests across 24 files. Production-preview smoke reached Day 1/daylight and opened the field guide
  without observed console warnings or errors; ACT-03 was the next separate control/animation task.

- ACT-03 adds a pure locomotion policy with intent-aware idle start/stop thresholds, walk/run hysteresis,
  authored empty-hand and carry clip mapping, measured in-place gait cadence, and a bounded shortest-path
  heading turn. Aim/fire preserves the aim heading while movement strafes; ordinary movement turns toward
  its wish direction. The existing 0.14-second crossfade remains the restrained transition because the
  player asset has no authored start/stop clips. Reduced motion now removes camera shake plus nonessential
  crop, loot-marker, and ambient-mote motion without changing fixed-step timing. Six focused tests cover
  the boundaries, hysteresis, residual velocity, clip mapping, cadence, and turn cap. The deterministic
  baseline is now 160 tests across 25 files. Production-preview smoke reached fresh Day 1/daylight and
  opened the field guide without observed console warnings or errors; ACT-04 was the next separate
  control/animation task.

- ACT-04 gives each held or placement profile a typed contact contract and routes action clips/timings
  through that data. Shovel work now faces valid farm targets and rejects out-of-range or wrong-tool
  targets without a false pickup/fist action. Selected-axe work classifies trees, stumps, and boulders,
  applies a bounded facing arc, and gives boulders a distinct clang response instead of radial damage.
  The bucket now mounts an authored low-poly prop with a fill/use tilt and retains fixed contact water
  feedback. Shotgun/bow projectiles and release feedback occur at the fire event; placement and trap
  interactions keep their preview/confirmation path with the existing non-melee `PickUp` clip. Three
  pure targeting tests plus the updated equipment/selection characterization bring the deterministic
  baseline to 163 tests across 26 files. The built preview reached Day 1/daylight with Saved status and
  visibly mounted the bucket prop; the browser harness's stale New Adventure confirmation was not used
  as evidence and remains a tooling limitation, not a gameplay defect. ACT-05 followed as a separate
  target-domain task.

- ACT-05 separates primary work from explicit combat and friendly wildlife. Work actions keep their
  authored farm/tree/boulder target selection and never include ambient animals. Secondary axe combat
  now selects one intended target inside a deterministic facing cone before the swing and rechecks
  range/facing at the fixed contact event, reporting empty, turned-away, or moved targets without a
  false hit. Foxes retain the existing damage/defeat/defense-reward path; ambient animals can only be
  briefly dazed by explicit melee, ranged, or boulder contact, with no health depletion, death marker,
  trophy, or reward. Four new pure targeting/policy tests bring the deterministic baseline to 167 tests
  across 26 files. Production-preview smoke reached Day 1/daylight with Saved status; selecting the
  axe and issuing an empty-field secondary click surfaced the player-facing `No target in front of you`
  rejection. CORE-01 is next.

- CORE-01 now defines one typed 48×48 homestead farm region instead of treating the full 240×240
  world as tillable. A low renderer-only boundary marks that region, the 10×8 starter plot is kept
  clear of deterministic decorative scatter and marked during New Adventure, and the short guide
  advances through tilling, planting, watering, growth, harvesting, and selling from existing tile
  and progression state. Shovel, bucket, trap, and debug till paths reject new work outside the
  region; camp reservations, the visible homestead footprint, placed-building obstacles, trees,
  boulders, and water remain separate blockers. Fresh runs and camp-invalid legacy positions choose
  the first deterministic safe approach point; existing saves retain out-of-region tile data rather
  than silently deleting it, but cannot create new work there. The baseline is now 179 deterministic
  tests across 28 files. Production-preview smoke reached fresh Day 1/daylight with the first-plot
  guide and Saved status, and browser logs contained no warnings or errors.

- CORE-02 replaces the old effectively infinite seed list with counted packets stacked by a full
  genotype key. Planting consumes exactly one matching packet at the fixed shovel contact, while a
  mature crop transaction returns its produce and one genotype-preserving packet; full produce or
  seed storage leaves the crop untouched. Sorting, deletion, capacity, legacy overflow, and Codex
  discovery are pure deterministic rules. Compact v9 writes use seed-table references plus counts;
  old bare v9 indexes and released v8 Seed[] entries migrate explicitly and merge only identical
  genotypes. The separate seed packet store remains distinct from sellable produce. The baseline is
  now 189 deterministic tests across 29 files. `npm run test`, `npm run test:ci`, `npm run check`,
  `npm run assetcheck`, the production build, strict unused-symbol TypeScript, `git diff --check`,
  and `npm audit --omit=dev` pass. CORE-03 follows as the separate trait-effects task documented
  immediately below.

- CORE-03 makes every released seed trait earn a player-visible decision. Vigor changes the base
  grow duration by ±25% around trait 50; species water need plus Thirst changes watered growth by
  0.80–1.25×; Hardiness scales fox bite damage from 1.5× at 0 to 0.5× at 100; and Greed crops
  return one additional produce unit plus four raid-attraction score points. Repel, Ricochet, and
  Portable Light are local boolean effects with authored caps of 3, 8, and 6 tiles respectively;
  multiple sources do not stack, and projectiles receive at most one bounce. Ironroot keeps its
  existing mature-crop immunity and bite resistance, now with explicit feedback. The planting HUD
  describes all numeric traits and mechanisms; repels, blocked bites, ricochet arming, and harvest
  results provide runtime feedback. Effects are derived from the already-saved Seed genotype, so
  no save schema or migration changes were needed. Pure tests cover each magnitude, active-tile
  rule, cap, non-stacking boolean, and deterministic crop/raid outcome. The baseline is now 196
  deterministic tests across 30 files. `npm run test`, `npm run test:ci`, `npm run check`,
  `npm run assetcheck`, the production build, strict unused-symbol TypeScript, `git diff --check`,
  and `npm audit --omit=dev` pass. CORE-04 followed as the separate Codex task.

- CORE-04 completes the Seed Codex without changing the v9 save schema. Fresh game state seeds the
  five authored base species as day-1 discoveries; the pure catalog deduplicates saved IDs, keeps
  discovered hybrids with their parentage, all five numeric traits, and mechanism explanation, and
  supplies stable undiscovered silhouettes for absent base species. First-time hybrid recovery and
  harvest discoveries produce brief player-facing toasts. The modal is a pausing screen with
  explicit keyboard/focusable select and compare buttons, a two-entry comparison limit, and a
  polite live status sentence for screen readers. Codex selection/comparison is transient UI state;
  discovery data continues to use the existing compact v9 representation. Duplicate discovery,
  deterministic catalog ordering, v8 migration preservation, round-trip data, and presenter status
  are covered by the new characterization tests. The baseline is now 201 deterministic tests across
  31 files. `npm run test`, `npm run test:ci`, `npm run check`, `npm run assetcheck`, the production
  build, strict unused-symbol TypeScript, `git diff --check`, and `npm audit --omit=dev` pass.
  Production-preview smoke reached Day 1/daylight, opened the Codex, verified the accessible dialog
  status and `K` toggle, and showed stable unknown silhouettes when continuing a pre-Codex save.
  Pre-Codex saves intentionally do not invent discovery history: their empty Codex remains rendered
  as undiscovered silhouettes until a seed is recovered or otherwise discovered.

- CORE-05 makes irrigation flow an authored, deterministic rule. Trench tiles touching open water
  become wet sources, flow only across connected downhill/flat trench topology, water adjacent
  planted crops, and are recomputed so disconnected trenches visibly return to a dry state. The
  renderer distinguishes dry and wet trenches, while bucket watering remains the simple fallback;
  tier-three irrigation removes bucket consumption rather than promising an unimplemented automatic
  crop effect. The merchant is now the sole player-facing homestead progression authority: sequential
  tier 2–5 permits are typed apply assets, consume on use, unlock the existing bow/axe thresholds,
  persist through the existing `homesteadTier` field, and replace the production `U` shortcut. Legacy
  placeable homestead deed IDs remain loadable for compatibility but are not new merchant choices.
  The first-plot completion hint, help guide, merchant copy, inventory labels, and purchase locks all
  describe the same permit path. The compact save schema is unchanged; a permit round-trip and
  progression quote coverage were added. The deterministic baseline is now 205 tests across 31 files.
  `npm run test`, `npm run test:ci`, `npm run check`, `npm run assetcheck`, the production build,
  strict unused-symbol TypeScript, `git diff --check`, and `npm audit --omit=dev` pass. Production
  preview smoke reached a saved Day 6 session, opened the field guide, verified the Z trench and E
  merchant-permit controls, and recorded no console warnings or errors. The economy diagnostic now
  reports 112 completed purchases across 16 seeds, no dead or malformed rows, first irrigation by
  day 5 in 16/16 runs, 16/16 resource-starvation runs, and one existing long-horizon runaway boundary
  hit; that calibration follow-up remains separate from CORE-05.

- CORE-06 releases a small functional building portfolio without changing the save schema. The
  existing fence/gate path remains the physical collision, enclosure, routing, rotation, and refund
  authority; the silo adds eight distinct seed-packet slots per placed instance, derived directly
  from saved buildings, and the HUD reports used/capacity. The water tower supplies bucket filling
  for the player and a deterministic local trench source within six tiles; placement and demolition
  recompute obstacle, enclosure, world-tile, and trench-flow state. Silo and water-tower descriptions
  now match their runtime effects and are merchant choices; coop, barn, windmill, and other cosmetic
  buildings remain unreleased until their loops exist. Compact typed fixtures cover the new saved
  building portfolio, while legacy overflow remains preserved rather than silently discarded. The
  deterministic baseline is now 210 tests across 32 files. `npm run test`, `npm run test:ci`,
  `npm run check`, `npm run assetcheck`, the production build, strict unused-symbol TypeScript,
  `git diff --check`, and `npm audit --omit=dev` pass. The existing deployment workflow already runs
  `npm run test:ci` before asset validation and build; no deployment was performed for this task.

- CORE-07 makes the existing first-plot onboarding and market route an explicit multi-day arc. Day 2
  now surfaces a deliberate Silo/Water Tower, crop-strategy, or fence/gate choice; dusk warns once
  before the first and later fox raids; after the first sale, the guide names the missing genetics or
  functional-building pillar. Dawn restores one deterministic Grass packet when seed storage is empty,
  preventing a poor purchase or crop loss from permanently removing the planting route without adding
  a save field. The existing wood sale keeps the Day 1 market route available; the economy diagnostic
  intentionally still models generic two-day crops and reports the first crop sale on day 3, which is
  deferred as an opening-pacing calibration rather than changed here. The deterministic baseline is
  now 214 tests across 33 files. `npm run test`, `npm run test:ci`, `npm run check`, `npm run assetcheck`,
  the production build, strict unused-symbol TypeScript, `git diff --check`, and `npm audit --omit=dev`
  pass. Production-preview smoke reached fresh Day 1/daylight with Saved status and no console
  warnings or errors. No save schema, raid damage, or economy price changed in CORE-07; the authored
  ending replacement is recorded separately under CORE-08.

- CORE-08 replaces the day-five prototype boundary with the derived `Establish the homestead`
  objective. Grow requires a harvested crop, Experiment requires a discovered hybrid in the Codex,
  Defend requires a fence, gate, or existing trophy outcome, and Develop requires homestead tier 2+
  or a Silo/Water Tower. Progress is visible in the HUD and the completed objective opens a
  `Homestead Established` overlay with the existing counters, a bounded feedback burst, and the
  existing reward sound; `Keep playing` preserves continued play. The existing `winShown` dismissal
  field remains the only save representation, so no schema or migration changed. The deterministic
  baseline is now 223 tests across 34 files. `npm run test`, `npm run test:ci`, `npm run check`,
  `npm run assetcheck`, the production build, strict unused-symbol TypeScript, `git diff --check`,
  and `npm audit --omit=dev` pass. Production-preview smoke reached saved Day 1/daylight, showed
  all four objective steps, and recorded no console warnings or errors. The existing deployment
  workflow already runs `npm run test:ci` before asset validation and build; no deployment was
  performed for this task.

- Use measured session actions, sales, crop throughput, upgrades, buildings, tree work, foxes, and
  day progression to calibrate the first-session economy.
- Continue fox/trap telegraphs and audio hooks, then calibrate the first-session economy against
  measured play.
- The current baseline is reproducible with `npm run economyreport`: 240 seconds per day, 5 axe
  swings for 1 wood plus 1 stump wood, 4–12₫ base crops, 60₫ trophies with 1% pity steps, and 6/12/24/48 wood
  homestead upgrades. Workbook-only fish, boss, quadrant, and seed-cost rows remain future targets.
- Active repository terminology, historical plans, asset credits, and current source were reconciled
  in Masterplan V2. Superseded Phaser/2D plans remain history; salvaged ideas are recorded explicitly.
- Calibrate the first-session economy against measured play. The workbook in
  `/Users/shanebaker/Downloads/tarnation_economy_base.xlsx` is a reference hypothesis, not a
  runtime authority; its outdated raid terminology is represented as foxes in project notes.
- Keep the active code and documentation vocabulary aligned with the accepted crop, wildlife, and
  building assets; obsolete prototype entries have been removed while save loading remains safe.
- CORE-05 has removed the parallel `U` homestead shortcut from production and moved new progression
  purchases to sequential merchant permits. Legacy homestead deed rows remain loadable with their
  finite historical costs, while the 30-day diagnostic still shows one rare runaway boundary hit
  because current released sinks are intentionally small; CORE-06 adds bounded silo and water-tower
  sinks/utilities without claiming to solve long-horizon economy calibration.
- The economy diagnostic intentionally continues to model generic two-day base-crop lots; it does
  not simulate genotype-specific vigor, thirst, greed, or raid effects. That is a calibration
  follow-up, not a reason to weaken the released runtime trait contracts in CORE-03.
- M6 production smoke passed fresh New Adventure, Day 1/daylight HUD launch, Saved status, the
  settlement objective, Help modal, and visible Q/B/weapon defense controls with no console errors
  or warnings. The production Help copy still exposes legacy `?legacy` build and F12 grid-debug
  instructions; this pre-existing presentation/UX defect is deferred to the appropriate later task
  and was not changed in M6.

## 5. Release procedure

Before each commit: check `git status`, run `npx tsc --noEmit`, and build when the change affects
production. Every push to `main` automatically runs `npm run check`, `npm run test:ci`, `npm run assetcheck`, and
`npm run build`, then deploys the verified `dist/` bundle through
`.github/workflows/deploy.yml`. A failed check prevents deployment. Do not use `npm run deploy`; recovery
must go through a focused, verified `main` change, followed by live smoke testing and a record here.

Last known production target: <https://tarnation.pages.dev/> (the canonical Cloudflare Pages URL;
the release preview and commit are recorded below).

Deployment record:

- `fb4d5f7` — direct tree/catalog/save foundation — <https://4b009596.tarnation.pages.dev>
- `75b69c7` — stationary merchant, fixed encampment, stacked deeds, shop tabs, launch scaffolding —
  <https://c98d7f82.tarnation.pages.dev>
- `1c09257` — placement preview, rotation, demolish mode, and context actions —
  <https://5ed8ffee.tarnation.pages.dev>
- `2625c1a` — gates, cached enclosure calculation, and fox pathing —
  <https://2307ce5a.tarnation.pages.dev>
- `97eac34` — save compatibility, migration coverage, and launch validation —
  <https://8adc4535.tarnation.pages.dev>
- `9c71e65` — completed vendor/deed plan, final QA, and release documentation —
  <https://174a94e2.tarnation.pages.dev>
- `b84d1fb` — M0 trusted baseline: BASE-02 characterization suite and deployment gate —
  <https://tarnation.pages.dev/>; GitHub Actions run
  [30719858155](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30719858155)
  passed all verification and deployment steps. Fresh production smoke test passed New Adventure,
  Day 1 startup, keyboard movement before and after the field guide, and produced no console
  warnings or errors.
- `f343e4a` — M1 save safety: compact v9 saves, SaveService recovery boundary, save timing, and
  accessible save feedback — <https://tarnation.pages.dev/>; GitHub Actions run
  [30721616462](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30721616462)
  passed all verification and deployment steps. Live smoke passed fresh New Adventure, reload/
  Continue, HUD Saved status, and produced no console warnings or errors.
- `ae4ee73` — M2 honest economy: ECON-01–04 production purchase policy, explicit catalog
  availability, local outcome diagnostics, and fixed-seed first-session calibration —
  <https://tarnation.pages.dev/>; GitHub Actions run
  [30723636941](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30723636941)
  passed simulation checks, the deterministic unit suite, asset validation, build, and deployment.
  Fresh live smoke passed New Adventure, Day 1/daylight HUD launch, Saved status, starter controls,
  and produced no console warnings or errors.
- `d8a4362` — M3 runtime health: staged loading, shared icon rendering, disposal ownership, incremental
  world updates, and all PERF-05 responsibility extractions — <https://836e92f3.tarnation.pages.dev>
  (canonical <https://tarnation.pages.dev/>); GitHub Actions run
  [30728223190](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30728223190)
  passed simulation checks, the deterministic 138-test suite, asset validation, build, and automatic
  deployment. Live smoke passed launch, Continue, Day 1/daylight, Saved status, market cue, and
  starter controls with no observed console errors or warnings.
- `7ae1417` — M5 complete core loop: CORE-01–08 — <https://tarnation.pages.dev/>; GitHub Actions run
  [30735477015](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30735477015)
  passed simulation checks, the 223-test deterministic suite in both local and CI-style modes, asset
  validation, production build, and automatic deployment. Live smoke passed Continue, Day 1/daylight,
  Saved status, the visible four-pillar settlement objective, starter controls, and no console
  warnings or errors. At that release the production title remained `Tarnation — Draft 0.3`; the later
  UX-02 branch removes the scaffolding suffix. The removed `Draft Complete` text is no longer presented
  as the player-facing ending.
- `2cce059` — M6 defense: FOX-01–04 — <https://tarnation.pages.dev/>; GitHub Actions run
  [30737391871](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30737391871)
  passed simulation checks, the deterministic 241-test suite in both local and CI-style modes, asset
  validation, production build, and automatic deployment. Live smoke passed fresh New Adventure,
  Day 1/daylight HUD launch, Saved status, settlement objective, Help modal, and visible Q/B/weapon
  defense controls with no console errors or warnings. Existing legacy/F12 debug copy in the Help
  modal remained a documented later presentation/UX follow-up at that release.
- `76b9efd` — M7 presentation: ART-01–05 — <https://tarnation.pages.dev/>; GitHub Actions run
  [30741246426](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30741246426)
  verified the exact merge commit, ran simulation checks, the 284-test deterministic suite, asset
  validation, and production build, then deployed automatically. Fresh production smoke passed
  Continue, Day 1/daylight, Saved status, settlement objective, starter defense controls, and Help
  modal open/close with no console warnings or errors.
