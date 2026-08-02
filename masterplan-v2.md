# Tarnation Masterplan V2

> **Status:** Active product, technical, quality, and release plan
> **Authority:** This document supersedes every earlier masterplan and feature plan. Historical
> documents are evidence, not instructions.
> **Current stack:** TypeScript, Three.js, React, Vite, Cloudflare Pages
> **Primary implementation agent:** GPT-5.6 Luna Max, working in small verified slices
> **Last full audit:** 2026-08-01

## 0. How to use this plan

This is not a promise of an IGN score. No plan can guarantee a critic's taste or a cultural moment.
It is a plan to reach a review-ready standard: a distinctive game, a complete and comprehensible
core loop, excellent feel, reliable saves, consistent art and audio, accessible controls, stable
performance, and no visible development scaffolding.

Implementation must follow these rules:

1. Treat the task IDs and dependency order in this document as authoritative.
2. Complete one cohesive slice at a time. Do not ask an agent to "do Phase 4" in one pass.
3. Begin every slice by reading this document, `CLAUDE.md`, `HANDOFF.md`, and the relevant source.
4. Preserve the pure `src/sim/` boundary, fixed timestep, seeded simulation RNG, and asset manifest.
5. Characterize existing behavior before restructuring it. Avoid whole-system rewrites.
6. A feature is not complete until its tests, error handling, accessibility, telemetry, and cleanup
   paths are complete.
7. Never hide a broken production rule behind a query parameter, silent catch, placeholder asset,
   or debug-only message.
8. Do not begin a later phase while an earlier phase's exit gate is red.
9. Update this plan's status table and `HANDOFF.md` in the same PR as each completed slice.
10. Deploy only from a green, reviewed commit. Record the deployment and smoke test in `HANDOFF.md`.

## 1. Product north star

### 1.1 Recommended identity

**Tarnation is a weird frontier homestead game where the things you grow become the tools you use
to protect and transform the land.**

The current build's strongest compatible pillars are:

- **Grow:** tactile farming with art-backed crop stages and meaningful water decisions.
- **Experiment:** discover and breed strange plant traits; make the Seed Codex legible and useful.
- **Defend:** prepare the homestead, then survive readable fox raids using crops, tools, and layout.
- **Develop:** convert harvests and gathered materials into a visibly more capable settlement.

Every major system must feed at least two pillars. Crops that exist only to sell, buildings that
exist only to decorate, weapons with no tactical role, and traits with no runtime effect weaken the
game into parallel checklists.

### 1.2 Signature system

The most achievable signature is **breeding as loadout design**:

```text
plant and crossbreed -> discover a trait -> use its crop or seed effect
        ^                                             |
        |                                             v
improve farm and Codex <- survive raids / earn resources
```

The genetics system already exists but several advertised traits have no meaningful consumer. V2
makes this interlock real before adding more maps or content.

### 1.3 Tone and audience

The release tone is stylized cartoon-Americana with warmth, oddness, and physical comedy. Violence
on the farm must follow cartoon rules: wildlife is startled or dazed, not killed. Foxes are a clear
threat to crops and defenses, not gore targets. The game should be approachable to cozy players but
offer opt-in tactical depth.

The historic farm-versus-Dark-Woods horror contrast remains a strong expansion concept, but it is
not permission to bolt a second unfinished game onto the current one. It may enter production only
after the Core Release Gate in Section 17 and a dedicated prototype proves it improves the game.

### 1.4 Intended release shape

The current web build should become a polished, complete vertical slice before platform expansion.
The near-term target is:

- desktop browsers, keyboard and mouse first;
- one authored homestead map;
- a satisfying multi-day arc with an explicit short-form ending or demo endpoint;
- five coherent crop families and a small set of functional buildings;
- one complete fox-defense ruleset;
- save/load that can be trusted for long play;
- no placeholder, debug, or "testing scaffolding" presentation in production.

Touch, gamepad, Steam packaging, multiple maps, the Dark Woods, full seasons, and a year-long
campaign are later decisions, not implied commitments.

## 2. Source-of-truth hierarchy

When documents or code disagree, resolve them in this order:

1. A current decision explicitly recorded in `DECISIONS.md`.
2. This Masterplan V2.
3. Current validated runtime behavior and typed content definitions.
4. `HANDOFF.md`, which must describe the last verified build.
5. Historical plans in `docs/history/`, used only for idea provenance.

Current implementation terms win over obsolete prototypes:

| Superseded concept | Current authority |
|---|---|
| Phaser 2D / Electron-first architecture | Three.js + React + Vite web build |
| Weasel raids | Fox raids |
| AI sprite/cutout asset pipeline | Quaternius CC0 GLB manifest and procedural fallback |
| Prototype crop roster | Grass, Dandelion, Beet, Carrot, Lettuce |
| Historic full-game scope | The gated release shape in this plan |
| Completed vendor plan as active roadmap | Historical implementation record only |

## 3. Executive audit

### 3.1 What is genuinely strong

- The simulation/render separation exists and `src/sim/` remains free of Three.js, React, and DOM
  imports.
- TypeScript strict mode, a fixed simulation step, seeded RNG, save migrations, primitive asset
  fallbacks, and data-driven model definitions are sound foundations.
- The fixed isometric camera, low-poly CC0 model family, terrain, water, horizon, instanced scatter,
  and day/night system form a coherent visual base.
- Farming, crop stages, inventory, selling, genetics data, trees, fox raids, traps, homestead tiers,
  deeds, building placement, gates, and enclosure calculation are connected enough for a real
  vertical slice.
- The current movement/tool patch separates camp reservations from physical obstacles, resets lost
  pointer state, uses stable hand sockets and measured grip pivots, crossfades locomotion, and gives
  player, merchant, and ambient animals deliberate clip selection.
- The repository builds, typechecks, passes the simulation check, and validates referenced assets.
- Production dependencies currently report no known audit vulnerabilities.

### 3.2 Release blockers found by this audit

| ID | Finding | Why it blocks release |
|---|---|---|
| P0-SAVE | A fresh serialized save is about **10.4 MB** because all 57,600 tiles are stored as verbose objects. `localStorage` writes can exceed browser quotas, and failures are silently swallowed. | A player can believe a game was saved and lose the entire run. |
| P0-ECON | Purchases are free unless the URL contains `paid`; normal production therefore defaults to testing economy. | Progression and prices are not actually being tested or shipped. |
| P0-BOOT | Launch blocks on `preloadAll()` for roughly **24 MB** of unique manifest assets. | Slow or failed asset downloads prevent reaching the world. |
| P0-GPU | Every model icon creates its own `WebGLRenderer`; runtime disposal does not release all scene/GPU resources. | Browser context exhaustion, leaks, and instability after remounts or long sessions. |
| P0-TEST | There is no CI, unit-test framework, browser E2E suite, visual regression, save-fixture suite, or production smoke gate. | Regressions reach deployment undetected. |

These are correctness problems, not polish wishes. They must be solved before economy tuning,
content expansion, or marketing claims.

### 3.3 Important partially implemented systems

- Genetics is presented as a pillar, but `portable_light`, `ricochet`, and `greed_crop` are not
  meaningfully wired; vigor, hardiness, and water need do little or nothing; the Seed Codex has no
  complete player-facing loop.
- Seeds are effectively infinite: planting does not consume a counted seed and harvesting creates
  more genotype entries. The economy has no clear seed scarcity or replenishment rule.
- Irrigation data exists, but the historical flow system is not connected. The current trench rule
  is adjacency to water, while the player starts at tier 2.
- Most purchased buildings are cosmetic despite descriptions that promise storage, animal,
  production, or water functions.
- Homestead upgrades are duplicated between a direct `U`-key wood path and merchant deeds.
- Weapon availability and homestead unlock text conflict; starting with a shotgun also makes the bow
  progression unclear.
- Four fox labels share nearly the same presentation and consequences. The player has no health;
  attacks toward the player look dangerous but do nothing.
- Combat applies effects at input time rather than authored contact frames and uses broad radial hit
  volumes. Tool work can accidentally hit ambient animals.
- The Day 5 "Draft Complete" screen is a prototype boundary, not an ending.

### 3.4 Architecture and performance debt

- `GameRuntime.ts` is over 4,000 lines and owns input, actions, AI, animation, rendering coordination,
  economy metrics, building, UI state, and persistence. This makes every polish change risky.
- `WorldRenderer` lacks a comprehensive disposal contract and forces shadow updates every frame,
  defeating its dirty-shadow intent.
- Foxes repeatedly breadth-first-search a 240×240 grid. This scales poorly as actor count rises.
- Crop rebuilding destroys and reclones all visible crop actors/materials rather than updating dirty
  cells or instancing by species/stage.
- Static props are cloned through a rig-safe path even when no skin exists.
- Scatter is deterministic and batched, but does not consistently mask tilled tiles, buildings,
  fixtures, or other interactive occupancy.
- Trees and large rocks affect tool placement but not a coherent actor-collision policy; ambient
  animals can cross water, buildings, and props.
- The production entry chunk is about 1.1 MB minified (about 312 KB gzip) and trips Vite's chunk-size
  warning. This is not catastrophic, but it needs measured code splitting rather than guesswork.

### 3.5 UX, accessibility, and presentation debt

- A fresh game opens with inventory visible, obscuring the world before the player acts.
- Right-click, double-click, small hover tooltips, and keyboard-only movement have no equivalent
  accessible interaction model.
- Modal panels do not consistently provide dialog semantics, focus trapping, focus restoration, or
  live status announcements.
- Many labels use 8–13 px text; focus-visible treatment, contrast, text scaling, reflow, and target
  sizes are unverified.
- Reduced motion and mute are good foundations, but there is no settings screen, rebinding, UI scale,
  separate audio buses, captions for meaningful audio cues, or declared input/platform support.
- Debug keys, empty toolbar slots, placeholder icons/models, free-purchase language, and synthesized
  development audio remain visible to players.
- The HUD has too many simultaneous panels and status messages without a clear information hierarchy.

## 4. Product decisions required before tuning

These are decision gates, not invitations for Luna to guess.

| Decision | Recommended default | Must be decided before |
|---|---|---|
| Farm boundary | Use one clearly authored homestead region; do not imply all 240×240 tiles are farmable. | CORE-01 |
| Seed economy | Count seed packets; planting consumes one; harvest returns produce with a tuned chance/recipe for seed recovery. Preserve genotype identity only where needed. | CORE-02 |
| Menu time | Pause world simulation in modal inventory, shop, build catalog, help, and settings screens. | UX-03 |
| Progression authority | Merchant/deeds are the player-facing authority; remove the parallel `U` shortcut from production. | CORE-05 |
| Wildlife interaction | Nonlethal cartoon daze, no death marker, no reward unless a deliberate hunt system is later approved. | ACT-05 |
| Fox consequence | Foxes damage/steal crops and structures; do not fake player danger until a fair player-health system exists. | FOX-01 |
| Release endpoint | A small authored settlement goal and celebratory wrap-up; no "Draft Complete" language. | CORE-08 |
| Debug exposure | Dev build or explicit developer flag only; never release help text. | REL-02 |
| Supported inputs | Desktop keyboard/mouse for the first quality gate; gamepad/touch only when fully implemented and tested. | UX-01 |

Any decision that changes these defaults must be recorded in `DECISIONS.md` with the player benefit,
scope cost, and systems affected.

## 5. Phase 0 — Freeze a trustworthy baseline

**Goal:** preserve the verified movement/tool fix and make failures reproducible before structural
work.

### BASE-01 — Land the current animation and movement correction

Scope: `GameRuntime.ts`, `InputController.ts`, `placement.ts`, `simcheck.ts`.

- Preserve the distinction between land reserved for construction and physical actor obstacles.
- Preserve pointer-cancel/blur cleanup so a lost release cannot leave an input held.
- Keep held models under a neutral socket with a measured model-space grip; never normalize a held
  prop by moving the animated hand bone.
- Keep named clip selection and crossfades for player, merchant, foxes, and ambient animals.
- Document any per-model rotation as manifest/profile data, not an unexplained runtime constant.

Acceptance:

- WASD works from a fresh spawn and after opening/closing every modal.
- No movement key remains stuck after focus loss or pointer cancellation.
- Shotgun, shovel, axe, and bow pass the animation matrix in Section 14.
- `npm run build`, `npm run check`, and `npm run assetcheck` pass.

### BASE-02 — Establish characterization fixtures

- Add Vitest and create pure tests for clock, farm transitions, inventory, genetics, placement,
  enclosure, economy, raid generation, save serialization, and every supported migration.
- Keep `scripts/simcheck.ts` as a fast smoke check initially; migrate assertions only when equivalent
  coverage is proven.
- Add fixed seeds and save fixtures representing fresh game, midgame, full farm, corrupt save, and
  each prior schema version.
- Record current economy output as a snapshot, not a claim that it is balanced.

Exit gate: baseline behavior is reproducible in one command and failures identify the subsystem.

## 6. Phase 1 — Save integrity and storage safety

**Goal:** make losing progress structurally unlikely and recovery obvious.

### SAVE-01 — Design a compact schema

- Stop serializing 57,600 default tile objects. Store only non-default tile records, using compact
  field names only if a typed codec keeps the format maintainable.
- Separate catalog IDs from mutable state; never duplicate catalog definitions in a save.
- Store seed genotype data once and reference it by stable IDs where possible.
- Define explicit size budgets: fresh save under 250 KB, typical long-session save under 1 MB, and a
  hard warning before the chosen storage ceiling.
- Keep the current version readable through an explicit migration. Never silently reset on failure.

### SAVE-02 — Build a SaveService boundary

- Move persistence policy out of `GameRuntime` into a typed service.
- Return structured results: `ok`, `quota_exceeded`, `corrupt`, `migration_failed`, `unavailable`.
- Use an atomic two-slot browser strategy: write and validate a candidate, then advance the current
  pointer; retain at least one last-known-good backup.
- Add manual export/import JSON and a Recover Save flow before any native/Steam packaging work.
- Validate save content, checksum/version envelope, bounds, IDs, and finite numeric values.
- Make Continue depend on a successful metadata/validation read, not key existence.

### SAVE-03 — Define save timing and UI

- Autosave at meaningful boundaries and a low-frequency interval, never every frame or during an
  incomplete transaction.
- Show saving, saved, and failed states accessibly. A failed save must remain visible until resolved.
- Flush on visibility change/before unload only as a best effort; correctness must not depend on it.

Tests and exit gate:

- Round-trip every fixture and migration deterministically.
- Simulate quota errors, interrupted candidate writes, corrupt primary, corrupt backup, unknown future
  version, and malformed data.
- Playwright proves a fresh run survives reload, a migrated run preserves resources/buildings/crops,
  and recovery works.
- Serialization/deserialization remains below 50 ms on the target midrange device, measured outside
  the render-critical path.

Forbidden shortcut: compression alone. Compressing the current verbose full-grid schema hides the
design error and complicates migrations.

## 7. Phase 2 — Honest production rules and economy

### ECON-01 — Remove free-by-default production behavior

- Replace URL-derived paid/free behavior with a typed environment capability.
- Production builds always charge real costs. A free-purchase sandbox is allowed only in a visibly
  marked development build and must be impossible to activate through a public query parameter.
- Display every cost, owned count, lock reason, and purchase result.
- Add transaction tests proving currency is deducted exactly once and failed purchases are atomic.

### ECON-02 — Make catalog availability explicit

- Add availability fields such as `starter`, `merchant`, `upgrade`, `debug`, and `unreleased`.
- Do not infer shop eligibility from a negative filter.
- Remove starter tools, unfinished entries, empty toolbar slots, and placeholder deeds from production
  surfaces unless they have a complete acquisition path.

### ECON-03 — Instrument successful outcomes

- Metrics must distinguish attempted, rejected, cancelled, and completed actions.
- Track time to first plant, harvest, sale, purchase, building, fox defense, and settlement goal.
- Keep metrics local during development unless a separate privacy decision authorizes telemetry.
- Add a deterministic economy simulation that reports resource starvation, runaway growth, and dead
  purchases across many seeds.

### ECON-04 — Tune only after the rules are real

- Define a target first session, acquisition cadence, meaningful choices, and recovery from mistakes.
- Every purchase must change capability, capacity, convenience, risk, or strategy. Cosmetic items may
  exist later but cannot carry progression descriptions.
- Use playtest distributions, not one designer run, to tune crop prices, wood yields, trophies,
  upgrades, and deeds.

Exit gate: the default production build has a coherent priced path to its first meaningful upgrade,
the path is neither free nor grind-blocked, and reports only successful state changes as successes.

## 8. Phase 3 — Runtime lifecycle, loading, and performance

### PERF-01 — Stage asset loading

- Define manifest load groups: `boot`, `first_play`, `nearby`, `catalog`, and `optional`.
- Boot only the player, terrain-critical models, equipped starter items, initial crops/trees/fox, and
  first-view fixtures.
- Start the world as soon as `first_play` is ready; load catalog assets in bounded background batches.
- Add a real progress/error/retry screen. One failed optional asset uses its fallback and does not
  block play.
- Test cold, warm, throttled, offline-after-cache, missing-model, and decode-failure cases.

### PERF-02 — Use one icon rendering strategy

- Replace one `WebGLRenderer` per `ModelIcon` with one shared offscreen renderer and cached thumbnails,
  or pre-render a checked-in/generated icon atlas.
- Bound cache size and dispose it on app teardown.
- At steady state, target one game WebGL context and at most one explicitly shared icon context.

### PERF-03 — Define disposal ownership

- Every owner of geometry, material, texture, render target, mixer, listener, timer, and renderer gets
  an idempotent `dispose()`.
- Do not dispose shared cached resources from individual clones; use reference/asset ownership.
- Test React development remounts and repeated New Adventure cycles. Renderer/context/resource counts
  must return to baseline.

### PERF-04 — Make expensive world updates incremental

- Replace per-fox full-grid BFS with a shared flow field or cached route field keyed by target and
  topology version. Bound work per tick.
- Update crop actors by dirty tile and batch/instance compatible species-stage-tint groups.
- Mask or rebuild scatter when interactive occupancy changes; do not leave grass or rocks through
  buildings/crops.
- Reuse raycasters, vectors, colors, sets, and scratch arrays in hot paths.
- Update shadows on meaningful movement/light changes with texel-stable thresholds, not every frame.
- Detect static versus skinned assets; use `SkeletonUtils.clone()` only for rigged models.

### PERF-05 — Split the runtime by responsibility

This is an incremental extraction, not a rewrite. Suggested order:

1. `SaveService`
2. `EquipmentController` and `PlayerActionController`
3. `InteractionSystem`
4. `FoxDirector`/navigation
5. `PlacementCoordinator`
6. `RuntimeMetrics`
7. `HudPresenter`

Each extraction begins with characterization tests, preserves public behavior, and lands separately.
`GameRuntime` remains the composition root rather than becoming another god object under a new name.

Performance budgets on a declared midrange desktop profile:

| Metric | Project budget |
|---|---|
| Render frame P95 | <= 16.7 ms during normal play |
| Render frame P99 | <= 33 ms during peak raid/VFX |
| Fixed simulation step P95 | <= 4 ms |
| Cold navigation to controllable world | <= 8 s on representative broadband |
| Warm navigation to controllable world | <= 3 s |
| Long task | No task over 100 ms during active input without a loading state |
| Memory/lifecycle | No monotonic growth across five New Adventure/remount cycles |

Budgets are measured targets, not claims. Record hardware, browser, build mode, scenario, and before /
after traces for each optimization.

## 9. Phase 4 — Player control, tools, and animation polish

### ACT-01 — Formalize the player action state machine

States: `idle`, `move`, `tool_windup`, `tool_contact`, `tool_recover`, `ranged_aim`, `ranged_fire`,
`interact`, `menu`, and `disabled`.

- Define allowed transitions, interruption windows, buffered input, movement scaling, and cancellation.
- Apply gameplay effects at contact/fire events, not at button-down.
- Keep fixed-sim authority separate from visual interpolation.
- Prevent a menu, lost focus, failed target, or clip completion from leaving control disabled.

### ACT-02 — Make equipment data-driven

For each held asset record:

- model forward/up axes;
- right-hand grip point;
- optional left-hand support point;
- carry and action socket rotations;
- scale and camera readability constraints;
- compatible locomotion/action clips;
- audio/VFX/contact event timing;
- icon camera framing.

Prefer authored grip marker nodes in GLB files when available. Until then, keep measured profiles in
one typed content module with debug visualization and validation.

### ACT-03 — Polish locomotion

- Blend idle/walk/run by planar speed with hysteresis so clips do not chatter.
- Rotate toward movement with bounded angular speed; define behavior for aim-versus-move heading.
- Verify foot sliding at each speed and normalize clip playback to actual velocity.
- Add restrained start/stop anticipation only after responsive input is proven.
- Make reduced motion remove camera shake and nonessential bob without changing gameplay timing.

### ACT-04 — Give every tool an authored interaction

- Shovel: face tile, windup, soil contact, result burst, recover.
- Axe: directional contact arc and tree/boulder-specific hit reaction.
- Bucket: real held model or intentionally authored stylized prop, fill/use states, water feedback.
- Shotgun/bow: aim/readiness, muzzle/release event, recoil/recover, clear target direction.
- Trap/building: placement anticipation and confirmation that do not reuse unrelated melee clips.

No tool may silently reuse punch/pickup damage because a target is out of range.

### ACT-05 — Separate work, combat, and wildlife targeting

- Tool interactions select the intended target class before animation.
- Melee uses a facing arc/volume and contact frame, not a full radial hit.
- Friendly ambient animals are excluded from work actions.
- If wildlife can be intentionally hit, use a nonlethal daze policy and explicit input affordance.
- Rejected actions explain range, obstruction, wrong tool, or invalid state without playing a false
  success animation.

Exit gate: the complete animation matrix passes with no inverted tool, detached support hand, pop,
stuck state, false hit, foot slide, or model-axis surprise.

## 10. Phase 5 — Complete the farming and genetics loop

### CORE-01 — Author the farmable space

- Delineate the homestead visually and mechanically. Prevent tilling in decorative wilderness, water,
  camp reservations, building footprints, and collision props.
- Spawn the player at a validated safe point near the homestead, not inside the merchant camp.
- Build one guided first plot that teaches movement, tilling, planting, watering, growth, harvesting,
  and selling without a text wall.

### CORE-02 — Build a real seed inventory

- Choose counted seed packets plus genotype identity.
- Planting is transactional and consumes one valid seed.
- Harvest returns produce; seed recovery comes from a clear tuned rule or station.
- Stacking, sorting, selling, deletion, migration, and full-inventory behavior must preserve genotype
  data and never duplicate or erase silently.

### CORE-03 — Make every released trait real

For every trait, define the exact producer, consumer, magnitude, feedback, UI description, stacking
rule, save representation, and deterministic test.

Recommended first set:

- `ironroot`: stronger crop/defense interaction;
- `repel_foxes`: readable local deterrence with a capped radius;
- `ricochet`: crop-ammunition or defense-projectile behavior;
- `portable_light`: carried/placed light utility;
- `greed_crop`: higher value paired with explicit raid attraction or fragility;
- vigor/hardiness/water need: observable growth, resilience, and watering tradeoffs.

Cut or hide any trait that cannot earn a meaningful decision in the vertical slice. Do not ship dead
numbers because they exist in a type.

### CORE-04 — Finish the Seed Codex

- Show discovered species, parentage, traits, effect explanations, and undiscovered silhouettes.
- Make discovery moments memorable but brief.
- Provide compare/select actions usable without hover or double-click.
- Test deterministic discovery, duplicate handling, save migration, and screen-reader status text.

### CORE-05 — Reconcile water and progression

- Start with the simplest intentional watering rule.
- If trenches remain, implement visible flow from water sources with deterministic topology and clear
  dry/wet states; otherwise remove tier language that promises it.
- Make upgrades remove a meaningful constraint rather than only increasing throughput.
- Use one homestead/deed acquisition path and reflect it in UI, save, tests, and onboarding.

### CORE-06 — Make buildings functional

Release only a small portfolio with one clear job each:

| Building | Minimum shippable function |
|---|---|
| Homestead | progression/menu anchor and visible tier change |
| Silo | increases or organizes produce/seed capacity |
| Coop/barn | only if an animal loop exists; otherwise unreleased |
| Windmill | seed processing or crop conversion |
| Water tower | expands convenient watering/irrigation |
| Fence/gate | reliable fox routing and enclosure |

Descriptions must match runtime effects. Placement, demolition, rotation, collision, enclosure,
refund, save, and upgrade behavior need tests.

### CORE-07 — Produce a meaningful multi-day arc

- Day 1 teaches and produces the first sale.
- Day 2 introduces a deliberate choice between capacity, crop strategy, or defense.
- The first raid is telegraphed early enough to prepare.
- Later days expose genetics and a functional building, not just higher prices.
- Recovery paths prevent one poor purchase or raid from soft-locking progress.

### CORE-08 — Replace the prototype ending

- Set one visible settlement objective that exercises all four pillars.
- Telegraph progress and provide a satisfying visual/audio payoff.
- Allow continued play afterward if desired.
- Remove "Draft Complete," debug framing, and unearned claims of a full campaign.

## 11. Phase 6 — Fox defense and combat fairness

### FOX-01 — Make consequences honest

- Foxes target crops, stored produce, gates, traps, or structures with clear priorities.
- Remove fake attacks on an invulnerable player. Add player health only through a separately approved
  design with telegraphs, recovery, accessibility, and fail-state testing.
- Define raid start, preparation window, victory, retreat, dawn cleanup, and reward rules.

### FOX-02 — Differentiate or simplify types

Each released type needs a unique silhouette/tint/accessory, target preference, movement rule,
telegraph, counter, and audio cue. Suggested roles:

- runner: direct and fast, countered by fences/traps;
- digger: slow bypass with a visible dig channel;
- sapper: attacks one explicit defense class;
- thief: grabs produce and flees, creating a recoverable chase.

If art and behavior cannot support all four, ship fewer honest types.

### FOX-03 — Improve navigation and crowd readability

- Use cached/shared navigation and invalidate it only when topology changes.
- Reserve attack/steal positions without overlap.
- Prevent snapping, oscillation, corner cutting, and impossible routes.
- Keep actors readable at the isometric camera with restrained VFX and grounded shadows.

### FOX-04 — Tune preparation versus action

- Passive defenses reduce pressure but do not play the entire raid.
- Active tools have distinct roles and readable cooldown/recovery.
- Rewards compensate risk without making intentional farm loss optimal.
- Test empty farm, sealed farm, open gate, destroyed route, ten-fox peak, and dawn transition.

Exit gate: a new player can explain why a crop was lost and what they could do differently next time.

## 12. Phase 7 — World, assets, camera, and visual polish

### ART-01 — Expand manifest metadata and validation

Add or derive:

- rigged/static classification and clip names;
- source bounds, ground pivot, forward/up axes, and target height;
- collision footprint and interaction footprint;
- load group and fallback;
- held grip/support markers where relevant;
- icon camera framing;
- source pack/license record.

Enhance `assetcheck` to open GLBs and validate scenes, animations, bounds, finite transforms,
textures, missing files, duplicate catalog IDs, fallbacks, and expected clips.

### ART-02 — Replace presentation placeholders

- Resolve the market stall's duplicated procedural/placeholder definitions.
- Use honest models for caravan, barrel, haystack, bucket, and every sold building.
- Hide unreleased catalog entries rather than showing substitutes.
- Audit pivots, footprints, scale, shadows, tintability, and isometric silhouette in the picker and
  live world.

### ART-03 — Establish an occupancy policy

- Define collision classes: hard obstacle, soft obstacle, decorative, interaction-only, reservation.
- Apply them consistently to player, foxes, ambient animals, tools, placement, and scatter.
- Prevent wildlife from walking through water/buildings unless it has an authored exception.
- Rebuild/mask scatter around tilled land, fixtures, paths, and placed structures.

### ART-04 — Camera and lighting pass

- Keep isometric composition stable and targetable.
- Validate zoom bounds, occlusion, framing at map edges, tall-building transparency/fade if needed,
  and shadow stability.
- Use day/night colors for readability first; do not let mood hide targets, focus rings, or status.
- Add screenshots for dawn/day/dusk/night, each weather state if retained, every building tier, full
  crops, raid peak, and modal overlays.

### ART-05 — VFX grammar

- Define a small palette: valid/invalid placement, work contact, water, reward, damage/threat, and
  discovery.
- Each effect communicates one state, respects reduced motion, pools temporary resources, and cleans
  up deterministically.
- Avoid stacking shake, flash, particles, scale pulse, and floating text for the same small event.

## 13. Phase 8 — UI, onboarding, accessibility, and settings

### UX-01 — Declare and test the input contract

- Ship keyboard/mouse only until another scheme passes the complete game.
- Add remappable bindings with conflict resolution and reset defaults.
- Provide non-pointer equivalents for all inventory, vendor, placement, demolition, Codex, and
  context actions.
- Never require double-click or right-click as the only route.

### UX-02 — Rebuild information hierarchy

- Default fresh inventory closed.
- Keep persistent HUD to time, current objective/status, selected tool, essential resources, and
  contextual prompt.
- Put catalog detail in focused panels, not simultaneous overlays.
- Remove empty slots, debug keys, scaffolding copy, and implementation terminology.
- Show cost, benefit, lock reason, capacity, and result before commitment.

### UX-03 — Make overlays real modals

- Use appropriate dialog/menu semantics, labeled controls, focus trap, Escape behavior, and focus
  restoration.
- Pause simulation according to the decision in Section 4.
- Announce important save, purchase, error, discovery, and raid states through nonvisual status text.
- Ensure pointer capture and keyboard state are cleared on modal/focus transitions.

### UX-04 — Settings and accessibility baseline

- Master, music, effects, and ambience volume controls.
- Reduced motion, camera shake, UI scale/text scale, day length if design allows, and key rebinding.
- Visible keyboard focus, color-independent state cues, sufficient contrast, and targets sized for
  reliable input.
- No essential text below the chosen scalable minimum; target at least 14 px at 1080p unless a tested
  exception is decorative/nonessential.
- Captions/visual equivalents for meaningful audio cues.
- Test DOM UI against WCAG 2.2 AA where applicable, including keyboard, focus appearance, reflow,
  target size, name/role/value, error identification, and status messages.

### UX-05 — Author the first ten minutes

Storyboard and test:

1. launch/loading and immediate control;
2. first movement without an obstructing menu;
3. one successful tool action;
4. plant/water/harvest feedback;
5. merchant/sale introduction;
6. a visible next goal;
7. save confirmation;
8. an early hint of fox risk;
9. settings/help discoverability without a key dump.

Measure completion, confusion, rejected actions, and time per beat with at least five people who did
not build the game. Revise before adding later content.

## 14. Animation and asset QA matrix

Every held tool and weapon must be checked against:

| Dimension | Required cases |
|---|---|
| Equipment | empty hands, shotgun, bow, shovel, axe, bucket, trap/build preview |
| Locomotion | idle, start, walk, run, stop, reverse, strafe/diagonal, turn in place |
| Action | valid target, invalid target, out of range, repeated input, hold/release, interrupt |
| Heading | eight movement/aim directions relative to the fixed camera |
| Transition | equip, unequip, slot switch, menu open/close, focus loss, day transition, save/load |
| Camera | minimum/default/maximum zoom and near all screen edges |
| Options | sound on/off, reduced motion on/off, remapped controls |

For each case verify:

- correct end of the asset points toward the target;
- right hand stays on the grip and support hand does not visibly detach or overtwist;
- no prop intersects the head/torso more than an intentional brief action pass;
- no scale pop, teleport, T-pose, bind-pose flash, animation restart chatter, or foot skating;
- contact VFX/audio/gameplay occur on the visible contact frame;
- interruption returns to a valid locomotion state;
- shadows and remains do not expose hidden duplicate models;
- reload/save preserves the equipped item and action-neutral pose.

Automation:

- Add a development animation gallery that cycles named cases deterministically.
- Capture baseline screenshots/video frames in Playwright for representative headings and actions.
- Validate required clip names and grip metadata in `assetcheck`.
- Keep visual review mandatory; pixel tests cannot judge a convincing hand pose by themselves.

## 15. Phase 9 — Audio and final feel

### AUD-01 — Move synthesis to fallback status

- Keep synthesized feedback as a development/missing-asset fallback, not the final sound identity.
- Build typed audio events and buses: master, music, effects, ambience, UI.
- Author or license a cohesive set for footsteps by surface, tools by material, water, crops, foxes,
  building, UI, rewards, merchant, day transitions, and save/error states.

### AUD-02 — Mix for information

- Prioritize threat, action contact, and UI confirmation; duck ambience/music when necessary.
- Limit simultaneous variants and repetition; randomize only presentation, never simulation.
- Use spatial audio only where direction helps play.
- Provide visual equivalents/captions for meaningful cues and respect all volume settings.
- Maintain a source/license ledger for every shipped file.

### FEEL-01 — Cohesive feedback pass

- Tune animation, audio, VFX, camera, and UI as one event timeline.
- Remove redundant feedback before adding more.
- Test at normal play speed for an hour; premium feel is consistency and restraint, not effect count.

## 16. Phase 10 — Test, CI, observability, and release discipline

### QA-01 — Automated test pyramid

- **Unit:** Vitest for every pure simulation rule and codec.
- **Integration:** runtime controllers with fake clocks/assets/input where practical.
- **E2E:** Playwright against a production build for new game, movement, farm loop, merchant purchase,
  building, raid, save/reload/recovery, settings, and ending.
- **Assets:** GLB metadata/clip/bounds/license validation.
- **Visual:** representative deterministic screenshots with reviewed baselines.
- **Performance:** scripted farm and raid scenarios with stored budgets/traces.

### QA-02 — Continuous integration

Add a GitHub Actions workflow that runs on PRs and main:

1. clean install with lockfile;
2. typecheck;
3. formatting/lint once configured;
4. unit/simulation tests;
5. asset validation;
6. production build;
7. E2E smoke on the built site;
8. dependency audit policy with reviewed exceptions;
9. artifact retention for screenshots and reports on failure.

No deployment proceeds from red CI. Protect `main` and require review once the workflow is stable.

### QA-03 — Production diagnostics

- Keep a sanitized local diagnostics export: version/commit, browser/GPU, save metadata, fixed seed,
  recent action/state transitions, asset failures, and performance summary.
- Never include personal data or the full save without explicit player action.
- Replace `window.tarn` and F12 debug exposure with development-only tooling.

### REL-01 — Dependency and build hygiene

- Upgrade Wrangler 3 through a dedicated deployment PR; the audit currently reports transitive dev
  vulnerabilities in its toolchain. Verify Wrangler 4 configuration and preview/deploy behavior.
- Upgrade Vite/React tooling only in isolated PRs with build, E2E, and deployment verification.
- Pin the supported Node version and use reproducible installs.
- Add `LICENSE`, contribution expectations, changelog/release notes policy, and asset/audio license
  ledgers before public distribution.

### REL-02 — Release checklist

- Production flags and prices verified; no free/debug paths.
- Fresh install, update, corrupt save, offline/cache, slow network, and unsupported WebGL paths tested.
- All links, credits, version strings, help, settings, and controls match reality.
- No console errors, unhandled rejection, missing asset, context warning, or repeated memory growth.
- Full animation matrix and accessibility checklist signed off by a human.
- At least two one-hour external playtests complete without developer intervention.
- Deployment comes from the exact reviewed commit and is smoke-tested afterward.

## 17. Core Release Gate

Content expansion is forbidden until all are true:

- P0 save, production economy, boot, GPU lifecycle, and CI blockers are closed.
- The first ten minutes are tested and understandable.
- One complete multi-day farming/genetics/defense/development arc is satisfying.
- Every visible trait, building, weapon, fox type, and control has a real function.
- The animation matrix passes and no known movement/input lock remains.
- Save recovery, settings, keyboard accessibility, and production smoke are proven.
- Target-device frame/load/memory budgets pass.
- External players can finish the release objective without coaching.

Only then choose one expansion prototype.

## 18. Post-gate roadmap candidates

### EXP-01 — Dark Woods prototype

Prototype only the signature decision: a bounded risk run where a fuller haul increases escape risk
and dropping it permits survival. Test whether it complements the frontier homestead rather than
splitting the audience and production in two. Required prototype elements:

- one small zone and one resource dependency;
- bag stake with a no-loss accessibility option;
- attention conveyed through restrained audio/environment;
- one sincere threat with fair escape math;
- no permanent campaign content until playtests prove the tonal contrast works.

### EXP-02 — Mount and transport

Prototype one whistle-summoned donkey/cart only after world size and resource transport create a
real need. It must improve an existing loop, not justify an oversized empty map.

### EXP-03 — Functional settlement expansion

Add buildings only when each provides a new transformation, capacity, route, or tactical choice.
Use silhouette grammar—height, smoke, light, motion, clutter—to make development visible.

### Explicitly deferred or cut for the current release

- multiplayer/co-op;
- romance and large NPC relationship systems;
- fishing;
- water combat and pirates;
- artillery batteries, castles, colossi, and twelve ultimate abilities;
- multiple shallow biomes/maps or a giant building catalog;
- a separate hunting-camera mode;
- pure cosmetic purchases as progression;
- console/Steam packaging before the web vertical slice is stable;
- restoration of obsolete Phaser/2D implementation plans.

## 19. Historical idea disposition ledger

| Historical idea | Disposition | Reason |
|---|---|---|
| Four pillars: Grow, Defend, Venture, Upgrade | **Adapted** | Grow, Experiment, Defend, Develop fit current code; Venture waits for a proven expansion. |
| Genetics/crossbreeding | **Core** | Best current differentiator, but must be finished. |
| Crops as ammunition | **Core direction** | Strong system interlock; implement narrowly with released traits/tools. |
| Farm/Dark-Woods tonal contrast | **Post-gate prototype** | Distinctive but doubles presentation and content obligations. |
| Full-bag pursuit / drop bag to escape | **Preserve for prototype** | Memorable risk decision with a clear accessibility variant. |
| Attention/heat and rare wrongness | **Preserve, later** | Valuable only if rarity and audio quality can be maintained. |
| 16-week campaign / three endings | **Re-evaluate after slice** | Premature before one complete multi-day arc works. |
| Irrigation tiers | **Simplify and finish** | Current data and behavior disagree; only keep observable tiers. |
| Donkey/mount/whistle | **Post-gate candidate** | Requires a validated transport problem. |
| Functional building silhouettes | **Core principle** | Buildings must show and provide capability. |
| Sign, Decoy Pie, Molasses, Mystery Seed, Fiddle | **Idea backlog** | Potential tactical items; no implementation before the defense loop is balanced. |
| Crop Insurance | **Cut** | Pays the player to opt out of defense. |
| Nonlethal farm wildlife | **Core tone rule** | Resolves cozy-audience conflict and accidental tool harm. |
| Year 1 Steam/Electron packaging | **Deferred** | Current authority is the web build; platform plan follows product proof. |

## 20. Luna Max execution protocol

Use this exact structure for every implementation request.

### 20.1 Prompt template

```text
Implement task [TASK-ID] from masterplan-v2.md only.

Before editing:
1. Read masterplan-v2.md sections [X], CLAUDE.md, HANDOFF.md, and every target file.
2. Inspect git status and preserve unrelated changes.
3. State the root cause/current behavior and the smallest safe design.
4. Add characterization tests before changing behavior when this is a refactor or bug fix.

Constraints:
- Do not implement later task IDs or add unrelated systems.
- Preserve src/sim purity, seeded deterministic simulation, fixed timestep, fallbacks, and saves.
- No public query/debug escape hatch, silent catch, placeholder claim, or broad rewrite.
- Use typed data/config instead of one-off runtime branches.

Verification:
- Run the task-specific tests plus npm run check, npm run assetcheck, and npm run build.
- For UI/runtime work, run the production build in Playwright and capture the specified evidence.
- Report changed files, behavior before/after, tests, screenshots/traces, risks, and follow-ups.
- Update the task status in masterplan-v2.md and HANDOFF.md only if every acceptance criterion passes.

Stop and report instead of guessing if a required product decision is unresolved, a save migration
could lose data, a license/source is unknown, or the change requires a wider task than authorized.
```

### 20.2 PR sizing and order

- One task ID per PR by default; combine only inseparable test/infrastructure work.
- Aim for a reviewable diff, generally 3–7 implementation files plus tests/docs.
- Separate mechanical extraction from behavior changes.
- Separate dependency upgrades from feature work.
- Separate balance changes from rule changes.
- Never mix generated asset churn with runtime logic.

### 20.3 Required evidence by change type

| Change | Evidence |
|---|---|
| Save/data | old/new fixture round trips, size/time, corrupt/quota recovery |
| Animation | matrix cases, representative screenshots/video, state-transition log |
| Performance | named scenario, hardware/build, before/after trace and memory/context counts |
| Economy | deterministic report plus external playtest distribution |
| Accessibility | keyboard path, focus order, semantics snapshot, scaling/contrast review |
| Asset | source/license, bounds/axes/clips report, picker and world screenshot |
| Release | CI run, production smoke, exact commit and deployment URL |

## 21. Milestone sequence and status

| Milestone | Tasks | Depends on | Status |
|---|---|---|---|
| M0 Trusted baseline | BASE-01, BASE-02 | — | Complete: PR #4 merged as `b84d1fb`; verified deployment and live smoke test passed |
| M1 Save safety | SAVE-01–03 | M0 | Complete: PR #8 merged as `f343e4a`; workflow `30721616462` passed verification/deployment and live smoke passed |
| M2 Honest economy | ECON-01–04 | M0, save transaction boundary | Complete: PR #13 merged as `ae4ee73`; workflow `30723636941` passed verification/deployment and live smoke passed |
| M3 Runtime health | PERF-01–05 | M0 | Complete: PR #24 merged as `d8a4362`; workflow `30728223190` passed verification/deployment and live smoke passed |
| M4 Premium control | ACT-01–05 | M0, relevant PERF extraction | Complete: ACT-01–05 integrated with fixed-step action states, contact/fire callbacks, buffering, movement scaling, menu cancellation, focus recovery, validated data-driven equipment profiles, locomotion hysteresis/cadence, bounded heading turns, typed tool interaction contracts, target/facing validation, authored bucket prop, fixed ranged/placement feedback, separate work/combat target domains, deterministic melee cones, and nonlethal ambient wildlife daze |
| M5 Complete core loop | CORE-01–08 | M1–M4 decisions | In progress: CORE-01–03 complete; CORE-04 next |
| M6 Defense | FOX-01–04 | M3–M5 | Not started |
| M7 Presentation | ART-01–05 | M3–M6 | Not started |
| M8 UX/accessibility | UX-01–05 | M1–M7 | Not started |
| M9 Audio/feel | AUD-01–02, FEEL-01 | M4–M8 | Not started |
| M10 Release hardening | QA-01–03, REL-01–02 | All core phases | Not started |
| Expansion decision | EXP-01, EXP-02, or EXP-03 prototype | Core Release Gate | Blocked by gate |

Recommended first implementation order:

1. BASE-02 test harness and save fixtures.
2. SAVE-01 compact schema.
3. SAVE-02/03 recovery and player-visible failure handling.
4. ECON-01/02 production rules and catalog availability.
5. PERF-01 staged boot and PERF-02 icon rendering.
6. PERF-03 lifecycle/disposal.
7. ACT-01 state machine characterization, then ACT-04/05 tool correctness.
8. CORE product decisions and vertical-slice completion.
9. Defense, presentation, UX, audio, and release phases in dependency order.

## 22. Risk register

| Risk | Severity | Early signal | Mitigation |
|---|---|---|---|
| Save loss | Critical | Continue disabled, quota/corrupt error, oversized state | M1 before content; recovery fixtures and visible failure |
| Scope drift across agents/plans | Critical | obsolete terms/stack or new systems in PRs | source hierarchy, one task ID per PR, disposition ledger |
| Attractive but hollow systems | High | descriptions without runtime effects | function-first catalog and Core Release Gate |
| Animation regression | High | per-tool magic offsets and clip restarts | equipment metadata, state machine, visual matrix |
| Runtime monolith | High | unrelated regressions from small edits | incremental extraction with characterization tests |
| GPU/context/memory failure | High | context warnings or degradation after remount | shared icon renderer, disposal ownership, lifecycle tests |
| Asset/startup weight | High | blank/loading screen or decode failure | staged load groups, retry/fallback, performance budgets |
| Inaccessible UI | High | mouse-only action or lost modal focus | UX phase and WCAG-informed DOM testing |
| Economy never tested honestly | High | free default or attempts counted as success | production capability flags and transactional metrics |
| Content expansion before quality | High | new maps while P0 is open | Core Release Gate |
| Dependency upgrade breakage | Medium | deploy/runtime changes hidden in feature PR | isolated upgrade PRs and production smoke |
| Art/audio inconsistency | Medium | placeholders and repeated synthetic cues | manifest/license audit and authored presentation phase |

## 23. Audit evidence and reference standards

The 2026-08-01 audit used repository history, all active planning/handoff documents, content and model
catalogs, simulation/runtime/UI/save code, production build output, dependency reports, and the live
animation/movement verification from the preceding fix.

Measured baseline:

- 512 GLB files in the repository; 109 manifest keys and 97 unique referenced files.
- `public/` about 63 MB; models about 47 MB; unique active manifest models about 23.9 MB.
- Fresh save JSON about 10,427,502 bytes; serialize about 13 ms and deserialize about 18 ms on the
  audit machine. Browser storage reliability, not raw CPU time, is the blocker.
- Main production JS about 1.1 MB minified / 312 KB gzip and a Vite chunk warning.
- Production dependency audit: zero known vulnerabilities. Full audit: six transitive development
  vulnerabilities through the old Wrangler 3 toolchain; upgrade requires deployment verification.
- `npm run build`, `npm run check`, `npm run assetcheck`, strict unused-symbol typecheck, and
  `git diff --check` passed at the audited baseline.

Implementation should consult primary guidance rather than model memory for unstable APIs:

- [Three.js resource cleanup](https://threejs.org/manual/en/cleanup.html)
- [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [web.dev: optimize JavaScript execution](https://web.dev/articles/optimize-javascript-execution)
- [web.dev: off-main-thread architecture](https://web.dev/articles/off-main-thread)
- [W3C Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C overview of WCAG 2.2 changes](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/)

## 24. Definition of review-ready

Tarnation is review-ready when an external player can install/open it, understand it, play the full
intended arc, make meaningful choices, recover from mistakes, trust the save, and finish without a
developer explaining a control or apologizing for a placeholder. The game holds its frame and memory
budgets, every visible system does what its text promises, interactions look and sound intentional,
and accessibility/settings are part of the product rather than a final patch.

The route to that result is not more features. It is closing the P0 failures, completing the systems
already visible, choosing one signature interlock, and applying the same restrained quality bar to
every transition the player can see.
