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
