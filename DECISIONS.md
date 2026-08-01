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
loadable for existing saves but are hidden from new production choices. Removing the two empty
toolbar slots remaps a legacy empty-slot selection to the last supported starter tool without
changing the save wire shape.
