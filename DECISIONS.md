# Decisions

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
