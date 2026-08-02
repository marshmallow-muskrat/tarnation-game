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
manifest paths, and `npm run economyreport` to print the current tuning baseline. `window.tarn`
exposes the runtime for browser debugging.

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
[`docs/history/vendor-deed-system-plan.md`](docs/history/vendor-deed-system-plan.md). The runtime
exposes local-only economy metrics through `window.tarnation.debug().economy()`, including four-way
attempted/rejected/cancelled/completed outcome counts and first-completion game times for planting,
harvest, sale, purchase, building, fox defense, and the settlement goal. The 2026-08-01 audit found
that the vendor/deed foundation exists, but the
game is not release-ready. The active priorities are the P0 blockers and dependency order in
[`masterplan-v2.md`](masterplan-v2.md):

- Continue the player-control phase from ACT-05, after the completed ACT-01/02/03/04 and
  PERF-05 runtime responsibility extractions.
- Add unit, migration, browser E2E, visual, performance, and CI release gates.
- Finish the visible genetics, seed, irrigation, building, fox, onboarding, accessibility, audio,
  and ending loops before expanding content.
- BASE-02 characterization is integrated with Vitest: the original baseline had 109 deterministic
  tests across 16 files, compact fixed-seed fresh/midgame/dense-farm/corrupt-save fixtures, and
  migration fixtures for released save versions 3 through 7. PR #3 merged into the integration
  branch as `5ff922b`.
  `npm run test:ci` is part of the main deployment verification workflow before asset validation
  and build.

The characterization baseline intentionally preserves current behavior for later, scoped follow-up:

- v4 migration can duplicate a trophy already present in the inventory, and v3/v4 top-level
  `darkwood` is currently discarded because that retired item no longer has a current registry entry.
- SAVE-01 now emits a compact v9 sparse-tile wire format with a deduplicated seed table: the fixed
  fresh fixture is 1,084 bytes, the representative midgame fixture is about 1.5 KB, and the dense
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
  opened the field guide without observed console warnings or errors; ACT-05 remains separate.

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
  as evidence and remains a tooling limitation, not a gameplay defect. ACT-05 remains separate.

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
- ECON-04 intentionally leaves the parallel `U` homestead shortcut in place until CORE-05 makes
  merchant/deeds the single progression authority. Homestead deed rows now have finite legacy costs
  but remain unreleased, so existing saves can render/use them without presenting a duplicate or
  nonfunctional progression purchase to new players. The 30-day diagnostic still shows one rare
  runaway boundary hit because current released sinks are intentionally small; functional buildings
  are a later CORE-06 dependency, not silently invented here.

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
