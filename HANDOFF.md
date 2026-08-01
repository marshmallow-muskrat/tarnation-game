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
- Survival Pack shotgun, shovel, and red axe in the toolbar; bucket remains a readable glyph.
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

- Stage the roughly 24 MB active asset load instead of blocking launch on the whole manifest.
- Replace per-icon WebGL renderers and establish complete GPU/runtime disposal ownership.
- Add unit, migration, browser E2E, visual, performance, and CI release gates.
- Finish the visible genetics, seed, irrigation, building, fox, onboarding, accessibility, audio,
  and ending loops before expanding content.
- BASE-02 characterization is now integrated with Vitest: 90 deterministic tests across 10 files,
  compact fixed-seed fresh/midgame/dense-farm/corrupt-save fixtures, and migration fixtures for
  released save versions 3 through 7. PR #3 merged into the integration branch as `5ff922b`.
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
  deterministic tests across 12 files; PERF-01/02 are next.

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
