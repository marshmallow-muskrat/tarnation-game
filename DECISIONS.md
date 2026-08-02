# Decisions

## 2026-08-01 — Make Masterplan V2 the sole active roadmap

`masterplan-v2.md` is the authority for product, technical, quality, and release sequencing. Earlier
plans are preserved under `docs/history/` as provenance only. Historic Phaser/2D implementation,
weasel terminology, and un-gated full-game scope must not be reintroduced. Ideas worth retaining are
explicitly classified in the V2 disposition ledger.

## 2026-08-01 — Separate camp reservation from physical collision

The central camp reserves its full approach against tilling and player construction, but only actual
blocking fixtures and the merchant occupy actor-navigation tiles. This keeps the authored camp layout
without trapping a player who spawns on open camp ground. Placement and pathing must use the appropriate
set rather than a single overloaded occupancy mask.

## 2026-08-01 — Use Ultimate Nature models for chunk scatter

Scatter keeps its existing deterministic counts and placement, but its grass, rocks, bushes,
and flowers/plants now use Ultimate Nature Pack models through `instancedParts()`. Each model
variant gets one `InstancedMesh` per glTF part. If a model is missing or fails to load, the old
primitive geometry remains the fallback. The rejected `sn_` Stylized Nature assets are not used.

## 2026-08-01 — Profile held tools at the player socket

Equipped items now use named per-tool carry and action profiles instead of unrelated offsets in the
runtime. The shotgun keeps a readable carry pose, the shovel carries across the body, and the axe
gets a raised-to-contact pose during the existing rig slash clip. Axe and shovel materials render
after the body because their thin dark silhouettes otherwise disappear inside the cowboy from the
isometric camera; they still cast shadows. Bear traps use only their real model, not the generic
structure slab.

The runtime also refuses to let an abandoned async mount survive React development cleanup. Two
active runtimes were able to split input, HUD, and canvas state, which made a correct tool look like
the wrong slot. The mount now exits after preload when it has been disposed.

## 2026-08-01 — Keep the active manifest and vocabulary asset-led

Crop rendering now selects the real species-and-stage model instead of a generic legacy crop key,
and ambient wildlife instantiates the accepted animal models directly. Obsolete prototype manifest
entries and unused interaction paths were removed; the Q boulder and B bear trap remain separate
current abilities.

## 2026-08-01 — Preserve normalized scales through animation

Animated foxes, crops, and ambient animals now keep the manifest-derived base scale while they
burrow, breathe, react to hits, or show a growth pulse. Raid actors also use an evenly distributed
attack ring with wider spacing, so the long fox silhouette stays readable when several arrive at
once.

## 2026-08-01 — Give fox attacks a readable action state

When a fox reaches its assigned ring position, it now enters a short attack state with an optional
pack attack clip, a small inward lunge, and a restrained scale pulse before returning to the ring.
The motion makes simultaneous attackers feel intentional without adding player damage to a system
that does not yet expose player health.

Bear traps re-arm after their capture window ends, and also recover if the caught fox is defeated or
the raid is cleared at dawn. The cooldown and the model state therefore describe the same reusable
ability instead of leaving a permanently closed prop behind.

## 2026-08-01 — Save only complete transactions and keep failures visible

The compact SaveService remains synchronous and atomic. Runtime saves happen after completed player
actions and meaningful clock boundaries, with a fixed-step 15-second fallback for other progress;
visibility and unload flushes are best-effort only. The HUD exposes Saving, Saved, and Save failed
states through an accessible live region, and a failure has no timeout: it stays visible until a
later successful save resolves it.

## 2026-08-01 — Gate free purchases behind the build environment

Production economy policy is selected from Vite's typed development capability, not from the public
URL. Production builds always charge the authored duckette and material costs; only a visibly
labelled development build may use free purchases. Purchase quotes and commits remain pure and
atomic so a rejected transaction cannot consume currency, materials, or an inventory slot.

## 2026-08-01 — Make catalog availability explicit

Catalog entries must declare whether they are starter, merchant, upgrade, debug, unreleased, or
fixed fixtures. Production vendor and build selectors admit only explicit merchant/upgrade entries;
starter tools remain available through their authored controls, while nonfunctional buildings stay
loadable and usable for existing saves but are hidden from new production choices. Removing the two empty
toolbar slots remaps a legacy empty-slot selection to the last supported starter tool without
changing the save wire shape.

## 2026-08-01 — Keep economy outcome metrics local and deterministic

ECON-03 records attempted, rejected, cancelled, and completed outcomes plus first-completion game time
for planting, harvest, sale, purchase, building, fox defense, and the settlement goal. The counters are
runtime debug data only: they are not part of the save schema and no telemetry or network transport is
introduced. The seeded economy diagnostic uses a fixed 16-seed cohort and a 30-day policy, with explicit
observation thresholds for starvation, runaway accumulation, and inventory pressure. Malformed catalog
costs are reported as dead purchases and quarantined by the diagnostic rather than silently repaired in
the instrumentation task.

## 2026-08-01 — Tune the first-session economy from a seeded distribution

ECON-04 uses the fixed 16-seed cohort rather than a single hand-played run. The accepted baseline is a
five-day first-session target: the first crop sale arrives on day 3, and the irrigation capability
upgrade is affordable by day 5 across the cohort. A completed tree now yields one felled-tree wood plus
the existing one-wood stump-clear bonus; base crop payouts are 4/6/8/10/12₫ from grass through lettuce.
The homestead wood cadence remains 6/12/24/48, the rare trophy remains 60₫ with 1% base and 1% pity
steps, and the released merchant choices are the functional irrigation, fence, and gate paths. The
cosmetic fence variant and duplicate/nonfunctional homestead deed rows remain loadable legacy content
but are unreleased until their functions and progression authority are complete.

## 2026-08-01 — Stage manifest loading without hiding asset failures

PERF-01 assigns all 109 manifest models to exactly one ordered load group: `boot`, `first_play`,
`nearby`, `catalog`, or `optional`. The player is boot-critical; the playable first scene, starter
controls, initial crops/trees/fox, ambient animals, fixtures, and homestead tier one are ready before
the world becomes controllable. Later groups load in bounded four-request batches. Missing models
retain primitive fallbacks, but first-play progress exposes the affected count and offers a retry;
catalog icons and build previews re-render when their real model becomes available. PERF-03 now
defines the separate ownership and teardown boundary for the world GPU resources.

## 2026-08-01 — Render model icons through one bounded shared context

`ModelIcon` display canvases now use a single offscreen WebGL renderer to produce 96px thumbnails,
then copy those pixels into ordinary 2D canvases. A 32-entry least-recently-used cache prevents
repeated toolbar, inventory, merchant, and building icons from rerendering or creating their own
contexts. App teardown clears cached thumbnails and disposes the shared renderer. The game renderer
and the asset-picker renderer remain separate owners; PERF-03 separately owns world GPU/resource
disposal.

## 2026-08-01 — Make runtime resource ownership explicit

The shared asset cache owns loaded glTF geometry, materials, and textures. World and runtime owners
dispose their procedural geometry/materials, dynamic projectile/effect resources, animation mixers,
listeners, and renderer exactly once. A model clone may dispose only clone-owned materials; shared
asset references use a release callback so a retired fallback remains alive until its last clone is
gone. App teardown invalidates abandoned async loads and releases the cache, while repeated React
development remounts and New Adventure cycles create fresh world/input/runtime owners without changing
simulation or save behavior. The asset-picker remains a separate explicitly scoped renderer owner.

## 2026-08-01 — Make world updates incremental without changing simulation rules

PERF-04 keeps all gameplay state and deterministic rules in their existing pure simulation modules.
Raid navigation now uses shared reverse route fields keyed by target and an explicit movement-topology
version; fields expand under a fixed per-step budget and are cleared when buildings or gates change.
Crop visuals reconcile only changed tiles and use instance groups for compatible model/stage/tint
combinations, with primitive fallback roots retained for missing assets. Decorative scatter receives a
versioned occupancy mask for camp reservations, physical buildings, and worked/cropped tiles and
rebuilds only affected live chunks. Renderer scratch objects are reused, shadow updates use quantized
player/light anchors, and asset cloning selects native `Object3D.clone()` for static scenes while
reserving `SkeletonUtils.clone()` for rigged scenes. No `src/sim` behavior, save format, timestep, or
seeded RNG behavior changes in this task.

## 2026-08-01 — Keep player animation and equipment ownership out of the composition root

The first PERF-05 extraction slice gives player animation transitions and held-tool scene ownership
to separate renderer-facing controllers. `PlayerActionController` owns the player mixer, one-shot
actions, locomotion crossfades, and the existing stationary carry pose. `EquipmentController` owns
slot-to-model selection, measured grip profiles, the hand socket, support-hand solve, and clone
disposal. `GameRuntime` remains the composition root and still owns fixed-step movement and gameplay
effects. No simulation rule, save field, input binding, clip name, asset fallback, or timing contract
changes; remaining PERF-05 responsibility extractions stay separate.

## 2026-08-01 — Keep pointer-action priority in a dedicated interaction boundary

The second PERF-05 extraction slice gives pointer-button priority and selected-tool/combat dispatch to
`InteractionSystem`. Building rotation/place, demolish, placed-asset context opening, combat fallback,
bucket/tool selection, and attempt recording remain ordered as they were in `GameRuntime`; the runtime
continues to own the callbacks that mutate gameplay and presentation state. The system has no DOM or
simulation dependency, so its routing contract is characterized with deterministic fake input. No save,
fixed-timestep, seeded-RNG, or gameplay-rule changes are introduced.

## 2026-08-01 — Keep fox direction and navigation ownership separate from the raid state machine

The third PERF-05 extraction slice gives `FoxDirector` ownership of the existing incremental
navigation field, target selection, role speed mapping, route following, and actor separation. The
`GameRuntime` remains the composition root for fox state transitions, traps, crop effects, animation,
audio, feedback, and save/economy callbacks. The director preserves the fixed 4,096-node navigation
budget, topology invalidation, seeded target/raid behavior, and the current exact-overlap nudge; the
last behavior is documented as a follow-up rather than silently corrected.

## 2026-08-01 — Keep placement preview policy separate from placement mutations

The fourth PERF-05 extraction slice gives `PlacementCoordinator` ownership of the existing placeable
catalog, selected building/deed state, quarter-turn rotation, preview center, and player-visible
placement validation. `GameRuntime` remains responsible for the placement commit, inventory/currency
transactions, demolition, gate state, and presentation side effects. The coordinator accepts
read-only reservation and simulation views, so the `src/sim` placement rules remain pure and the
legacy heading orientation, deed rotation, homestead clearance, and wood-cost behavior are preserved
without gameplay changes.

## 2026-08-01 — Keep runtime metrics local and outside the game state

The fifth PERF-05 extraction slice gives `RuntimeMetrics` ownership of the existing local economy
and action counters, first-completion timing, progression totals, and cloned debug snapshots.
`GameRuntime` remains responsible for recording the event at the existing gameplay boundary and for
providing current simulation time/day values. Metrics are not serialized, do not consume seeded
simulation randomness, and accept explicit clock values in tests so characterization remains
deterministic.

## 2026-08-01 — Keep HUD view-model assembly separate from React and gameplay

The final PERF-05 extraction slice gives `HudPresenter` ownership of the existing `HudSnapshot` type,
inventory/market/vendor/build mapping, HUD JSON deduplication, and transient-array copies. React still
renders the same typed snapshot, while `GameRuntime` supplies live world bearings, save feedback,
placement status, economy capability, and interaction hints as callbacks. The presenter has no DOM,
Three.js, save mutation, or simulation-rule authority; its deterministic tests use fixed game state.

## 2026-08-01 — Apply player effects from fixed-step action phases

`ActionStateMachine` is the renderer-independent authority for player action transitions. Tool actions use
0.12 seconds of windup, a 0.05-second contact phase, and 0.18 seconds of recovery; ranged actions expose
0.08 seconds of aim before the fire event; interaction actions expose an explicit contact event. Tool input
can buffer one same-kind follow-up during contact/recovery, while cross-kind, menu, and disabled input is
rejected. Gameplay effects for farming, melee, projectiles, construction, bucket work, and bear traps now
run from fixed-step contact/fire callbacks. Movement remains available with authored phase scales of 0.75
for tool windup/recovery, 0.45 at tool contact, 0.85 while aiming, and 0.65 at ranged fire; menus and lost
focus stop movement. Focus loss cancels pending effects and focus restoration returns to a valid idle/move
state. Animation clips remain renderer-facing and are started from the state-machine start event.

## 2026-08-01 — Keep equipment profiles typed and renderer-owned

ACT-02 centralizes the measured held-equipment contract in `src/content/equipment.ts`. The table covers
the four current model-backed tools plus the bucket glyph, bear-trap model, and building preview. Each
record owns source forward/up axes, right- and optional left-hand grip points, carry/action socket
transforms, scale/readability bounds, locomotion and compatible action metadata, audio/VFX cues, fixed-step
timings, icon framing, and debug visualization settings. The current Survival Pack glTFs were inspected
and contain no authored grip/socket marker nodes, so the existing measured transforms remain authoritative
until those source assets provide markers.

`EquipmentController` now consumes the table for model cloning, grip pivots, carry/action transforms,
support-hand targets, and locomotion profiles. `GameRuntime` consumes the profile timing records while
retaining the same 0.12/0.05/0.18 tool, 0.08/0.06/0 ranged, and 0.08/0/0.08 interaction timings. F12
enables the renderer-only model-axis and support-point visualization; it is off by default and its
procedural resources are disposed with the held clone. `assetcheck` and deterministic Vitest coverage
reject invalid profile fields without loading Three.js assets. No save, simulation, timestep, input,
pricing, or gameplay rule changed in ACT-02.

## 2026-08-01 — Use a bounded, renderer-facing locomotion policy

ACT-03 keeps fixed-step movement and seeded simulation authority in `GameRuntime`, while the
renderer-facing locomotion policy owns idle/walk/run hysteresis, in-place clip cadence, and bounded
heading turns. Intent starts locomotion only after a small speed boundary, release preserves the
current gait until residual velocity settles, and run entry/exit use separate thresholds so the clip
does not chatter. Ranged aim/fire keeps the aim heading while movement strafes; ordinary movement
updates the target heading. The player glTF's Walk/Run/Carry clips have constant root translations,
so cadence is normalized with measured gait ratios rather than invented root motion. The existing
0.14-second crossfade is retained as restrained start/stop anticipation because the asset has no
authored start/stop clips. Reduced motion freezes nonessential renderer bob, motes, and shake while
leaving fixed-step timing and gameplay outcomes unchanged. No save, simulation, input binding, or
economy rule changes in ACT-03.

## 2026-08-01 — Give each tool a typed contact contract

ACT-04 adds an interaction record to every held or placement profile: action kind, authored player
clip, target class, range, and facing arc. Fixed-step callbacks remain the only place that changes
the world. The shovel now faces a valid farm tile and applies soil/plant/harvest/breeding contact
effects only at its contact event. The selected axe path accepts trees, stumps, and boulders only;
tree work uses a bounded facing arc, while a boulder produces a distinct clang response instead of
falling through to generic radial damage. The bucket uses a small authored low-poly prop because the
accepted packs contain no bucket mesh; its action socket tilts for fill/use, and fill/water feedback
still occurs at the fixed contact event. Shotgun and bow readiness still aim before the action, while
projectiles, release bursts, audio, and recoil occur at the fixed fire event. Trap and building
placement keep their valid preview/confirmation path and use the existing non-melee `PickUp` clip
because the player asset has no authored placement clip. Invalid shovel/bucket targets now explain
range or target requirements without playing a false action, and the selected shovel no longer calls
bucket watering on a thirsty crop despite the HUD saying to equip the bucket. No save, simulation,
economy, timestep, or seeded-RNG rule changes in ACT-04.

## 2026-08-01 — Keep work, combat, and wildlife target domains separate

ACT-05 keeps primary work actions target-specific: shovel and selected-axe actions resolve farm
tiles or tree/boulder targets before starting an authored action, so ambient animals are never part
of their effect set. The explicit secondary axe combat affordance selects the nearest intended
hostile or friendly wildlife candidate inside a fixed-step facing cone before the swing, then checks
the same range and facing volume again at contact. A missed or moved target reports the reason and
does not produce a success effect. Foxes retain their existing damage, defeat, and defense-reward
path. Friendly ambient animals have no combat health path: melee, ranged shots, and the boulder can
only produce a short hurt/daze response with feedback and no death marker, trophy, or reward. No
player-health or hunt system is introduced, and no save, simulation, economy, timestep, or seeded-RNG
rule changes are part of ACT-05.

## 2026-08-01 — Bound new farm work to an authored homestead

CORE-01 keeps the existing 240×240 world for exploration and decorative presentation, but only the
typed 48×48 homestead region accepts new soil work. Camp reservations, the homestead building
footprint, placed physical obstacles, trees, boulders, and water remain distinct runtime blockers;
the new farm-region predicate is only the missing outer boundary. The renderer adds a low,
non-colliding boundary and a fresh-run 10×8 starter-plot marker, while the guide derives its short
till/plant/water/grow/harvest/sell prompts from existing tiles and stats rather than adding a saved
quest schema. Fresh runs use a deterministic validated approach point outside the house and camp;
loading does not delete legacy worked tiles outside the region, preserving save data while rejecting
new work there. No seed-consumption, irrigation-tier, economy, building-function, raid, save-schema,
or ending rule is introduced by CORE-01.

## 2026-08-01 — Count seed packets by full genotype

CORE-02 uses a separate counted seed-packet store with 24 distinct-stack slots, matching the regular
inventory capacity. A packet key includes species, all five traits, display name, hybrid flag,
mechanic, and lineage; the older display-oriented `seedId` remains the Codex key for compatibility.
Planting consumes one exact packet only when the farm target can accept it. A mature harvest is one
transaction that requires room for both produce and one recovered packet, then returns the exact
genotype; this keeps full-storage failures from deleting a crop. The recovery rule is intentionally
simple and tuned for the current loop: one seed packet per mature crop harvested. Old v9 bare seed
indexes and v8 full-grid `Seed[]` entries migrate to counted packets; duplicate genotypes merge, and
legacy saves with more than 24 distinct stacks are preserved as temporary overflow rather than
silently discarded. Seed packets remain separate from sellable produce; a seed-sale economy is not
invented in CORE-02. No later genetics, irrigation, economy-tuning, or Codex-UI task is included.

## 2026-08-02 — Give every released seed trait a bounded consequence

CORE-03 keeps the existing Seed genotype as the sole producer and save representation for all trait
effects. `growTimeForSeed` maps Vigor 0–100 to 1.25–0.75× the species base duration, while
`waterGrowthMultiplierForSeed` maps the clamped species water need plus Thirst to 0.80–1.25× for a
watered crop; Vigor and Thirst are multiplied per crop and never pooled across the field.
`nibbleDamageForSeed` maps Hardiness 0–100 to 1.5–0.5× of the existing fox bite, per target crop.
Greed crops add one produce unit and four raid-attraction score points per active crop. These
effects are exercised by pure deterministic farm, genetics, and raid-score tests and surface in the
planting HUD with their numeric trait values and effect text.

Local mechanisms deliberately do not stack: the presence of any active `repel_foxes`, `ricochet`,
or `portable_light` crop enables one boolean effect within a capped radius of 3, 8, or 6 tiles.
Repellers send a fox fleeing with a feedback burst/toast; a ricochet crop gives each fired shotgun
pellet or bow arrow at most one seeded-RNG bounce; portable light is derived from the selected
packet or nearby planted crop and expands/brightens the renderer hero light. Ironroot remains an
absolute bite defense and mature-crop destruction defense, with explicit failed-raid feedback.
The derived effects add no save fields, preserve v9 compatibility, and do not change Codex identity
or packet stacking. The economy diagnostic remains a generic two-day base-crop model until a later
calibration task intentionally models trait distributions.

## 2026-08-02 — Finish the Seed Codex without changing save compatibility

CORE-04 presents a pure, deterministic catalog derived from the existing `CodexEntry[]`: saved
IDs are displayed once in discovery order, then absent base crop species appear as stable unknown
silhouettes in authored crop-definition order. A fresh `createGameState` records the five starter
species as day-1 discoveries so the player can immediately inspect the released roster; loading a
pre-Codex save with an empty Codex does not fabricate discoveries and instead keeps those species
unknown until the player recovers/discovers them. Existing hybrid IDs, parentage, traits, mechanism
text, and discovered days remain the saved source of truth, and the compact v9 wire format is
unchanged.

The Codex is a pausing modal. Selection and comparison use explicit buttons and keyboard operation,
comparison is limited to two discovered entries, and the modal exposes a polite live status sentence
for screen readers. Discovery feedback is brief: a first-time recovered or bred seed gets a
`New Codex entry` toast, while repeat discoveries retain the existing hybrid feedback. Selection and
comparison state is transient UI state and is not persisted. The catalog defensively deduplicates
duplicate IDs without mutating the save; all discovery, duplicate, migration, round-trip, and HUD
status contracts are covered by deterministic tests.

## 2026-08-02 — Make irrigation and homestead progression authored merchant paths

CORE-05 keeps the existing tile and save fields but gives them one player-facing authority. A trench
touching authored open water is a deterministic source; water traverses connected trenches only
downhill or across flat tiles, marks the connected trench visibly wet, and waters adjacent planted
crops. Flow is recomputed after trench, planting, load, and trench destruction so stale wet trench
states cannot survive a topology change. Bucket watering remains available everywhere in the bounded
homestead, and irrigation tier 3 removes bucket consumption; the upgrade does not claim to replace
the visible trench rule with automatic watering.

The Traveling Merchant sells one-time apply permits for homestead tiers 2–5 and irrigation tier 3.
Homestead permits are sequentially locked, consume on application, preserve the existing tier field,
show the existing tier models, and retain the current bow/axe unlock thresholds. The direct `U`
shortcut is removed from production. Legacy placeable homestead deed IDs stay in the catalog for old
save rendering and use, but remain unreleased so old inventory cannot be silently discarded and new
players do not see a second progression path. No save schema or migration rule changes in CORE-05.

## 2026-08-02 — Give the released building portfolio one bounded job each

CORE-06 releases the existing fence/gate path plus Silo and Water Tower as the small functional portfolio. A placed
Silo adds eight distinct seed-packet slots per instance; capacity is derived from `placedBuildings`, so no duplicate
save field or migration is needed. Existing seed overflow is preserved when a Silo is demolished rather than silently
discarded, and the HUD exposes the resulting used/capacity state. A Water Tower supplies bucket filling for the player
and acts as a deterministic trench-flow source within six world tiles; placement and demolition recompute the relevant
obstacle, enclosure, world-tile, and trench topology. Merchant descriptions and runtime effects use the same contract.
Coops, barns, windmills, and other cosmetic buildings remain unreleased until their animal or processing loops exist.
Rotation, collision, enclosure, demolition refunds, save round-trips, and capacity/source rules remain covered by pure
or deterministic characterization tests. No save schema or migration rule changes in CORE-06.

## 2026-08-02 — Make the multi-day arc explicit and recoverable

CORE-07 keeps the onboarding guide as derived UI rather than introducing a second saved quest
system. Day 2 presents the current functional choices—Silo, Water Tower, crop strategy through the
breeding tool, or fence/gate defense—and dusk uses a deterministic, once-per-day telegraph before
the existing raid. After the first market sale, the guide points at whichever of genetics or a
functional building is still missing. If dawn finds no counted seed packets, one Grass packet is
restored through the existing seed-inventory transaction; this is a bounded recovery path with no
save-schema field and no change to raid damage, prices, or purchase policy. The economy diagnostic
continues to represent generic two-day base crops, so its day-3 first-crop-sale result remains a
documented calibration follow-up while the existing Day 1 wood-sale route remains available.

## 2026-08-01 — Make the settlement endpoint a derived four-pillar objective

CORE-08 replaces the prototype day threshold with one authored `Establish the homestead` objective.
Grow is satisfied by a recorded crop harvest, Experiment by any discovered hybrid in the Codex,
Defend by a placed fence or gate or an existing trophy outcome, and Develop by homestead tier 2+
or a placed Silo/Water Tower. These sources are already saved gameplay state and keep the merchant,
Codex, defense, and building systems as the progression authorities rather than adding a quest
schema. The HUD shows each step from fresh play through completion, and the ending presents a
`Homestead Established` payoff using the existing feedback burst and reward sound before allowing
continued play. The existing `winShown` field remains the dismissal marker; no save schema or
migration changes are introduced. The old day-five-only behavior is characterized as insufficient,
not silently retained as a second ending path.

## 2026-08-01 — Keep fox raid consequences on vulnerable farm state

FOX-01 removes the player-centered attack ring because the released game has no player-health,
damage, recovery, accessibility, or fail-state contract. The raid instead selects deterministic
world targets: haulers prefer the highest-value stored crop produce, sappers prefer a closed gate,
then an active trap or trench, and ordinary crop roles prefer the nearest exposed crop. A closed
gate can be forced open, an active trap remains the normal capture counter, a trench loses one
structure point, and stored produce is removed atomically with player-visible feedback. A fox with
no valid world target retreats rather than inventing danger.

The existing lifecycle remains authoritative: the dusk telegraph and night spawn start a raid;
burrowing is the preparation window; seeking, eating, and trap capture are active consequences;
fox defeat grants the existing trophy roll; fleeing reaches the map edge; and dawn clears actors
and re-arms traps. No player-health state, save field, migration, navigation rewrite, role art pass,
or balance policy is introduced here. The earlier readable attack-ring decision is superseded by
this world-target contract; the remaining role silhouette, telegraph, navigation, and preparation
versus action tuning belong to FOX-02–04.

## 2026-08-01 — Give each released fox type a readable role contract

FOX-02 keeps the accepted fox model and adds renderer-owned role treatment rather than introducing
new unproven assets: clone-owned material tints, bounded silhouette proportions, and one small
procedural low-poly accessory per type. Digglers are low and slow with a dirt crest and crop
burrow rule; nibblers are lean and fast with a collar and direct crop rule; sappers are broad and
deliberate with a pack and gate/trap/trench preference; haulers are heavy with side satchels and
stored-produce preference. Each profile carries the player-facing telegraph, counter text, and an
existing audio cue, and the first role encounter in a raid announces that contract without adding
a save field.

The accessories are explicitly detached and disposed for live actors and short-lived defeat
markers. No new model, license, save schema, navigation policy, or raid-pressure tuning is added;
crowd readability and preparation/action balance remain FOX-03 and FOX-04 work.

## 2026-08-01 — Make fox routes and approach positions physically readable

FOX-03 keeps the existing shared reverse-BFS field and topology-version contract, but gives it one
shared movement rule: diagonal steps cannot pass between two blocked tiles. Enclosure flood fill uses
the same guard, so a visually closed corner is not exposed to one system and sealed to the other.
Topology invalidation remains explicit; ordinary tile-state and actor updates do not discard cached
fields.

Foxes reserve one deterministic, diagonal-first approach tile around each world target. Reservations
are released on target completion, trap/repeller retreat, actor disposal, and raid cleanup; a blocked
or occupied slot is skipped rather than forcing two actors onto the same point. Waypoint motion carries
remaining fixed-step distance across tile centers without overshooting, and bounded deterministic
separation resolves exact overlaps to the configured readability gap. No save field, target priority,
role tuning, or new visual effect is introduced.

## 2026-08-02 — Keep fox preparation readable without making passive defense automatic

FOX-04 keeps the existing dusk telegraph, burrow window, fixed-step action states, role priorities,
active tool cooldowns, and trophy-on-defeat reward contract. A live `repel_foxes` crop now drives off
at most two foxes per raid through a runtime-only counter; the cap resets at raid spawn and adds no
save field, so passive crops soften pressure without clearing a peak wave by themselves. Shotgun,
bow, melee, boulder, and bear-trap roles remain distinct through their existing typed targets,
cooldowns, action timings, and HUD recovery cues rather than gaining a second ability system.

Crop bites, crop destruction, pre-harvest hauling, and stored-produce theft now use deterministic
player-facing guidance that names the fox role and a concrete next defense. Farm loss remains a
retreat consequence without a reward; only fox defeat enters the existing trophy roll. Empty or
sealed farms, open routes, unreachable routes, ten-fox waves, and dawn cleanup remain pure
characterization cases. No save schema, migration, economy price, player-health, or production
debug behavior changes in FOX-04.

## 2026-08-01 — Make the active model manifest inspectable

ART-01 keeps `src/content/models.ts` as the only model path and target-height manifest, then resolves
the rest of the asset contract through typed metadata: expected rig class and semantic clips, source
axes and ground pivot, catalog-derived collision and interaction footprints, deterministic load group,
primitive fallback, held-marker source, icon framing, and CC0 pack/license provenance. Gameplay
placement and equipment tables remain the authorities for their existing rules; the resolved
footprints and held markers are validation metadata and do not change runtime behavior.

The asset check opens each unique active binary glTF and validates its container, scene/node/mesh/
skin/animation references, finite transforms, finite POSITION bounds, texture sources, buffer ranges,
expected clips, missing files, catalog IDs, and fallback records. This is a pure Node-side check with
no Three.js or browser dependency, so it does not change the production bundle or the primitive
fallback path. At the ART-01 boundary the repository contained 12 rigged and 85 static active files,
160 named clips, 12 intentional manifest aliases, and no external texture files. The market-stall
placeholder and hardcoded tool-icon views were left for the presentation pass.

## 2026-08-01 — Use authored props instead of unrelated presentation substitutes

ART-02 removes the `market_stall` manifest entry that pointed at the well while the live world already
used the authored `MarketStall` builder. The catalog now permits a typed `authoredVisual` with a null
`modelKey` only for the bucket, caravan, barrel, and haystack; this prevents an unrelated backpack,
tent, or log model from being presented as those objects. Crates and coin sacks continue to use the
accepted chest and pouch models, and every visible vendor/build row remains backed by an active GLB.

`PresentationProps.ts` owns the bucket, caravan, barrel, and haystack geometry. The runtime records
whether a rendered root is an authored prop or an asset-cache clone and disposes the correct resource
owner during camp rebuilds and teardown. The active picker now audits the 16 sold-building, fixture,
stall, and bucket views under the shared loader and shadowed lighting profile; authored bounds are
kept within their typed placement footprints. No new external asset or license is introduced, and
save schema, placement occupancy, economy rules, and deterministic simulation behavior are unchanged.

## 2026-08-01 — Make occupancy classes explicit across actors and decoration

ART-03 defines five shared classes in `src/sim/occupancy.ts`: hard obstacles, soft obstacles,
decorative content, interaction-only content, and reservations. Physical water, fixed blocking
fixtures, the homestead footprint, and closed placed structures are hard actor obstacles. Worked
ground and active traps are soft occupancy: player and wildlife actors may cross them, while clear
ground tools, placement validation, and scatter avoid them. Trees, boulders, and stumps are
interaction-only: they remain axe/shovel targets and placement blockers without becoming actor walls.
The full central camp remains a reservation, so it protects tilling, construction, and decoration
without trapping the player or changing enclosure topology. Decorative scatter has no gameplay
authority.

Fox navigation and flee exits use the hard obstacle set plus continuous water/building checks;
ambient wildlife uses the same point policy and deterministic safe-edge fallback. No released
asset has an authored exception to the water/building rule. Scatter is rebuilt from the classed
mask with a one-tile clearance around physical structures and interaction props, plus a future-ready
path source; no authored path layer exists yet. This changes the previously documented behavior in
which foxes and ambient animals could cross water or structures, but does not change saves, the
fixed timestep, seeded simulation, enclosure rules, or the reservation/physical-collision split.

## 2026-08-02 — Keep camera edges targetable and lighting readable

ART-04 keeps the fixed isometric composition and moves the camera’s safety contracts into the pure
`src/sim/camera.ts` module. Interactive zoom remains bounded from `0.78` through `1.3`; the
orthographic projection preserves a five-unit vertical half-frustum and treats invalid or minimized
viewport dimensions as one pixel instead of producing a non-finite matrix. Camera follow and snap
targets stay four world units inside the existing `[2, 238]` movement bounds, which keeps a player at
the map corner visible at maximum zoom without changing movement or collision. Shadow anchors retain
their existing quarter-tile quantization, and the current day/night light and fog values are now
purely characterized with readable minimum light floors.

The current game has no weather state, so no weather branch was added. The fresh tier-1 world view and
the active picker views for tiers 2–5 remain readable under the same lighting profile; no transparency
fade was introduced for a tall building that does not currently occlude the player. Local visual
evidence covered day framing, zoom bounds, the homestead approach, HUD/status/toolbar focus, and the
pausing field guide; generated screenshots are review artifacts rather than committed binary files.
No save schema, simulation timing, asset catalog, or later VFX/UX task is changed.

## 2026-08-01 — Use a bounded semantic VFX grammar

ART-05 maps transient action feedback to eight typed states: valid placement, invalid placement, work
contact, water, reward, damage, threat, and discovery. The palette is intentionally small and distinct
so a player can read the state without a per-call color contract. The renderer owns a fixed 24-slot pool
with one shared procedural geometry and slot-owned materials; it recycles the oldest active slot and
disposes the owned resources once at runtime teardown. Renderer-only decoration continues to use its
own deterministic LCG and never consumes the seeded simulation RNG.

Reduced motion suppresses transient particles at spawn, matching the existing camera-shake, crop,
loot-marker, and ambient-mote policy. Minor boulder and repeated tree-contact shake was removed where
it duplicated the same small contact cue; major combat, ranged, harvest, and settlement outcomes keep
their existing audio, popup, hit-pause, and feedback contracts. Invalid placement now gives the same
red semantic signal as its preview. No save schema, simulation rule, economy value, asset definition,
fixed timestep, or deployment credential changed.

## 2026-08-01 — Make keyboard/mouse input a typed, remappable contract

UX-01 keeps desktop keyboard/mouse as the only supported input scheme until another scheme passes the
complete game. Primary bindings are typed pure data shared by `InputController`, `GameRuntime`, the
HUD, and the field guide. Rebinding persists in browser settings under `tarnation.inputBindings`, not
in the save schema. An occupied primary key swaps with the edited action's previous key so no action
becomes unreachable; malformed, duplicate, or unknown persisted entries fall back deterministically
to safe defaults, while the existing arrow, T, comma/period, and numpad aliases remain reserved for
their current actions.

`Enter` provides the primary work/place/demolish route and `O` provides placed-asset context; focused
inventory controls provide explicit use and delete actions so double-click and right-click are never
the only route. Pointer input remains available, and the fixed timestep, seeded simulation, save
schema, `src/sim/` purity, and production asset path are unchanged. Modal semantics and focus
trapping/restoration are implemented in UX-03; settings coverage is implemented in UX-04 and
onboarding remains the scoped UX-05 follow-up.

## 2026-08-01 — Rebuild information hierarchy without changing simulation or save rules

UX-02 makes new games and `createNewSave()` start with inventory closed, while preserving explicit
saved panel state and the current v3/v4 migration default that a missing `inventoryOpen` field stays
open. The HUD keeps time, the settlement objective, save status, Duckettes, wood, seed capacity,
selected toolbar, and a concise contextual prompt; inventory renders occupied stacks only. Focused-panel
priority prevents simultaneous catalog, inventory, Help, Codex, build, context, and market overlays,
and authored result/benefit, cost, footprint, capacity/ownership, and lock reason are shown before
purchase or placement. Visible implementation/debug scaffolding (`?legacy`, F12 grid toggle,
`window.tarn`, Draft title, all-controls hint, and `place/apply/equip` labels) is removed. No
simulation rule, fixed timestep, seeded RNG, save schema, or migration data is changed; modal
semantics and focus restoration are implemented in UX-03.

## 2026-08-01 — Make every active overlay a real modal boundary

UX-03 gives launch, pause, Help, Codex, inventory, merchant, build, context, and settlement overlays
explicit dialog/menu semantics, labels, focus entry, wraparound Tab trapping, Escape behavior, and
focus restoration. Toasts and purchase messages use nonvisual status regions. Modal transitions clear
held keyboard state and release active pointer capture so a key or click used to open/close a panel
cannot leak into the world. The build catalog is a deliberate exception to a blocking scrim: the
catalog pauses the fixed-step world, but pointer placement still reaches the canvas and commits only
at its normal fixed-step action boundary. Settlement presentation also pauses until the player
dismisses it. No save schema, migration, economy, seeded RNG, `src/sim/` rule, or asset path changed;
settings/scaling/contrast are implemented in UX-04 and onboarding remains UX-05.

## 2026-08-02 — Keep accessibility preferences outside the homestead save

UX-04 stores presentation and device preferences under `tarnation.settings`, never in the v9 save
schema: bounded master/music/effects/ambience volumes, mute, reduced motion, camera shake, UI/text
scale, and high-contrast UI. The existing `tarnation.audioMuted` and `tarnation.reducedMotion` keys
are read as compatibility fallbacks. Settings are applied live through typed audio gain buses and
the renderer's camera-shake/reduced-motion controls; all four active settings sections have labeled
controls, visible focus, color-independent state, and 44px minimum control rows. The existing
conflict-safe input rebinding is available from Settings as well as Help. The day/night schedule
stays fixed because a partial day-length preference would desynchronize crop growth, raid timing,
cooldowns, and economy pacing under the fixed timestep. No save field, migration, seeded RNG,
`src/sim/` rule, or asset path changed. AUD-01 now supplies original authored music, ambience, and UI
sources with synthesized audio retained only as a missing/blocked-asset fallback; AUD-02 remains the
separate information-mix pass. Onboarding remains UX-05.

## 2026-08-02 — Author compact audio assets and keep synthesis as a fallback

AUD-01 keeps the Web Audio context optional and lazy: the first user gesture creates the master gain
root, four typed leaf buses (music, effects, ambience, and UI), and loads the authored event assets
without delaying boot. Original deterministic WAV files in `public/audio/` cover the current gameplay
and presentation event families plus day/night music and ambience loops; `CREDITS.md` records that
they are generated from the repository's retained source script with no third-party license. Day and
night loop selection follows the existing fixed simulation phase but does not alter timing or RNG.
Missing, blocked, or decode-failed files use the prior oscillator cue for that event and report one
recoverable warning, so audio failure cannot block play. No save field, simulation rule, asset model,
or fixed-step contract changed; AUD-02 remains responsible for the information-priority mix pass.

## 2026-08-02 — Mix audio by gameplay information priority

AUD-02 keeps audio presentation subordinate to readable gameplay. Typed event metadata bounds
simultaneous voices and minimum repeat intervals, threat/action/UI events temporarily duck music and
ambience without muting effects, and only fox threat events use a stereo pan derived from relative
world position. Meaningful cues expose captions through the existing HUD toast/status channel.
Audio metadata, timers, and panning live in renderer presentation only; seeded RNG, fixed-step timing,
saves, and `src/sim/` remain unchanged. FEEL-01 is the separate cohesive timeline pass.

## 2026-08-02 — Synchronize impact feedback at fixed action boundaries

FEEL-01 treats the existing action-state machine as the animation timeline authority: one-shot
animation begins at `start`, and the typed presentation bundle is emitted at the fixed contact or
fire event. A renderer-only timeline now coalesces repeated semantic VFX/audio/camera/hit-pause
bundles, retains contextual HUD toasts, and removes redundant impact layers from melee misses and fox
defeats. Camera shake uses a decaying envelope and a dedicated renderer jitter stream, never the
seeded simulation RNG. Reduced motion still suppresses transient particles and shake, and no save,
economy, input, or fixed-step simulation rule changed.

## 2026-08-01 — Keep the first ten minutes derived and non-modal

UX-05 adds an authored eight-beat guide in `src/sim/onboarding.ts` for launch/movement, the existing
starter-plot action transitions, crop protection, market sale, and the first merchant choice. The
guide consumes the existing starter-plot state plus two runtime-only facts (whether the player has
moved and whether the merchant has been opened); it is not a second quest system and adds no save
field, migration, RNG, economy, or fixed-step rule. A compact non-modal HUD card keeps the current
Save status, settlement objective, Help button, market compass, and pause/Settings route available,
while launch copy names only the immediate movement control and starter-plot destination. The grow
beat explicitly explains that foxes raid after dusk and names harvesting or a bear trap as the next
counter. Existing first-plot prompt copy now receives the active remappable binding labels, keeping
the lower contextual prompt consistent with the onboarding card without changing any input route.
The implementation is covered by deterministic transition tests and a documented five-participant
study protocol. The product owner explicitly waived the study for this release; the protocol remains
available for future validation and no participant findings are fabricated. UX-05 can therefore
close on implementation and deterministic/browser evidence, with M8 release verification still
pending.

## 2026-08-02 — Make the production build the QA-01 browser contract

QA-01 uses Vitest for deterministic simulation/codecs and small runtime-controller seams, and Playwright
against `vite preview` for the player-visible journeys that depend on React, canvas input, assets, and
modal semantics. The browser suite uses compact typed save builders, a reviewed platform-neutral launch
baseline, one worker, and fixed viewport/timeout settings; it does not inspect browser storage or depend
on network state. Three scripted performance scenarios enforce named budgets for dense farming, raid route
fields, and a seeded economy cohort while writing only ignored QA artifacts. The deployment workflow runs
the performance and production-build browser gates before the final build and deployment. Chromium's
headless SwiftShader `GL_CLOSE_PATH_NV` thumbnail-readback message is a browser-driver warning rather
than an application warning, so the harness filters only that exact message and continues to fail on all
other console warnings/errors and page errors. No production code, save schema, fixed timestep, seeded
simulation behavior, or bundle asset changed.

## 2026-08-02 — Keep QA-02 CI release-critical and non-deploying

QA-02 adds a separate pull-request/main quality workflow with locked installs, strict typechecking,
existing simulation/unit/asset/audio/feel/performance gates, a production-only dependency audit, a
production build, and Playwright E2E. It never receives deployment credentials or deploys a branch. The
workflow uploads the generated performance report, Playwright HTML report, screenshots, traces, and videos
only after failure, with a bounded 14-day retention period. The `e2e:ci` script sets a task-specific CI
flag so local and hosted runs use the same retry, forbid-only, line, and HTML-report behavior. There is
no formatter or linter script to invoke yet; the six full-audit dev-tool advisories are reviewed as the
REL-01 dependency-upgrade follow-up while the production dependency tree must remain at zero findings.
The deployment workflow repeats strict typecheck and production audit. GitHub branch protection and the
single final human review are intentionally reserved for the Core Release Gate boundary so autonomous task
and integration work can continue without weakening the required checks.

The first hosted run also exposed two harness portability contracts: the launch-card baseline must be
platform-specific because system font metrics change its measured height, and modal buttons that synchronously
rerender a WebGL-backed React HUD can leave Playwright's pointer actionability wait pending. The E2E suite
now keeps `darwin` and `linux` baselines, splits long journeys at modal boundaries, and uses the UI's real
keyboard focus paths for pause/settings, merchant dismissal, and ending dismissal before asserting the
resulting state. This changes no production UI or gameplay behavior.

## 2026-08-02 — Make hosted QA-02 farm coverage observe the save contract

The fresh-game journey now proves movement by reading the active `SaveService` two-slot envelope before and
after one bounded KeyD input, then using the existing `beforeunload` persistence boundary. Farm control is
covered by a compact typed fixture that places the player on a known empty starter-plot tile; the mature-crop
journey's camera-centered click remains the input technique, and the assertion reads the production save until
the fixed-step contact commits `grass → tilled`. A hosted run exposed that the transient interaction hint can
appear just after a five-second wait on the slow Linux software-WebGL renderer even though the persisted farm
transition is already correct. The final test polls the persisted state rather than adding a larger timing
guess or a production debug hook. Run [30762042879](https://github.com/marshmallow-muskrat/tarnation-game/actions/runs/30762042879)
passed the full quality workflow for `b4d4c9b`. No production behavior, save schema, fixed timestep, seeded
simulation, or asset bundle changed.

## 2026-08-02 — Make production diagnostics explicit, bounded, and player-initiated

QA-03 adds a Help-panel export rather than a public runtime inspection handle. Vite injects the package
version, exact Git commit, and stable build ID; the export collects only browser/GPU capability summaries,
save version and non-sensitive counts, the fixed seed, bounded recent action/outcome/day-transition events,
bounded asset fallback failures, and aggregate frame/fixed-step performance. A pure sanitizer removes control
characters, clamps numeric values, caps text and arrays, deduplicates asset failures, and serializes the
explicit schema deterministically. Full save contents, personal data, unbounded logs, `window.tarn`, and
mutation/debug escape hatches remain absent. No save field, simulation rule, fixed timestep, seeded RNG,
economy rule, or asset path changed.

## 2026-08-02 — Pin the release toolchain to Wrangler 4 and Node 24

REL-01 upgrades the local and deployment toolchain from Wrangler 3 to stable Wrangler `4.118.0`.
The deployment workflow is pinned to the `wrangler-action` `v4.0.0` commit and passes the same exact
CLI version, while `.nvmrc`, package engines, and CI keep contributors on Node 24. The existing Pages
configuration remains a static `dist` deployment; Wrangler 4 local Pages preview returned the built
index successfully, and the reviewed Pages deploy command remains `pages deploy dist --project-name=tarnation
--branch=main`. `npm ci`, full `npm audit`, and `npm audit --omit=dev` all passed with zero vulnerabilities.
Contribution, release-note, all-rights-reserved licensing, and asset/audio provenance ledgers were added.
No Vite, React, Three.js, save, simulation, economy, or gameplay contract changed.
