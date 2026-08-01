# TARNATION — Asset plan (Quaternius)

**Decision: Quaternius becomes the primary art source.** All packs are CC0 — commercial use, no
attribution required, no licence tracking beyond keeping the files.

The reason this works isn't that any single pack is good. It's that **every Quaternius pack is by
the same artist with the same proportions, palette and shading**, so a fence from one pack and a
cow from another already look like one world. That coherence is the thing you'd otherwise pay an
artist for.

---

## 1. The KayKit decision — make it now

The player is currently `thorn-ranger.glb` from **KayKit**, a different artist. KayKit is chunkier
and more detailed; Quaternius is flatter and simpler. Both are good; **mixed, they read as two
games.**

**Recommendation: go all-Quaternius.** Move the player to Ultimate Animated Characters and retire
the KayKit models, except where a specific thing has no Quaternius equivalent.

**The exception worth keeping:** the Woodsman. It's rendered as a pure black unlit silhouette, so
its source mesh is invisible by definition — style mismatch cannot show. Keep whichever silhouette
reads best.

---

## 2. Pack triage

You listed fifteen. Most are right. Three aren't, and one is more important than you flagged.

### Download now — core

| Pack | Use | Priority |
|---|---|---|
| **Ultimate Animated Characters** | Player, merchant, any NPC | 🔴 First |
| **Ultimate Animated Animals** | Weasels, donkey, mole, plains animals, elephant | 🔴 First |
| **Ultimate Crops** | All 5+ crops and their growth stages | 🔴 First |
| **Ultimate Nature** | Trees, rocks, bushes, scatter — replaces procedural props | 🔴 First |
| **Ultimate Monsters** | ⭐ **The Dark Woods.** See §3. | 🔴 First |
| **Ultimate Buildings** | Homestead tiers + the 25-piece city-building sheet | 🟠 Second |
| **Ultimate RPG** | Slingshot, bow, axe, tools, props | 🟠 Second |
| **Ultimate Modular Men / Women** | Merchant, future NPCs, character variety | 🟡 Later |
| **Ultimate Food** | Cooking, market stall dressing, decoy pie | 🟡 Later |
| **Ultimate Furniture** | Only once interiors exist | 🟡 Later |

### Hold off

**Ultimate House Interior** — there are no interiors in the design yet. Downloading is free, but
don't wire it in; an interior system is a real feature, not an asset drop.

**Animated Fish** — `masterplan.md` §15 explicitly lists *"No fishing. It's always the thing that
eats a month."* You now have a river and a lake, which makes the temptation worse, not better. If
you want fish as *ambient life* in the water — visual only, not catchable — that's cheap and lovely.
The moment it becomes a minigame, it's a month.

### Two real problems

**Ultimate Guns — tonal mismatch.** The weapon ladder is slingshot → bow → blunderbuss → varmint
rifle → the Cropper. That's 1940s Americana. A modern pack is typically pistols, ARs and SMGs, and
a modern assault rifle in a cartoon farm game breaks the period the whole art direction rests on.

*Recommendation:* take only the period-plausible pieces — a break-action shotgun, a hunting rifle, a
revolver — and get the slingshot and bow from **Ultimate RPG** instead. Skip the modern silhouettes.

*Counter-argument, honestly:* golden-age cartoons did absurd anachronism constantly. If you want a
comically modern gun as a late-tier joke, that's defensible — just make it *the joke*, deliberately,
not the default aesthetic.

**Ultimate Modular Sci-Fi — wrong game.** There's no reading where sci-fi fits 1940s cartoon
Americana plus folk horror. Download it for a future project; keep it out of this one.

---

## 3. Ultimate Monsters is the most important pack on your list

`IDEAS.md` §0.1 flags that the 78-entry idea sheet contains **nothing** for the Dark Woods — the
half of the game that is actually the differentiator. The reason is partly that horror is harder to
brainstorm than comedy, and partly that there was nothing to build with.

**Ultimate Monsters fixes that.** It gives you a roster to build the woods out of, immediately:

- **Woodsman variants** — same all-black unlit treatment, different silhouettes per depth tier, so
  the Fringe, Thickets and Deepwood each have their own wrong shape
- **Deep-woods fauna** — things that aren't the Woodsman but shouldn't be there
- **The Hollow** — whatever is at the bottom

**The treatment matters more than the model.** Take any monster, override every material to unlit
pure black with `fog: false`, and it becomes a silhouette with a real walk cycle. That's free, and
it's scarier than a detailed monster because the player's imagination fills it in.

Half-lit variants for the shallower tiers: very dark grey rather than pure black, so depth reads as
"how much of it you can see."

---

## 4. Where files live

Follow the split from the studio playbook: **raw sources in cloud, game-ready exports in git.**

### Raw packs → shared cloud drive, never git

```
Google Drive / Dropbox
└── Marshmallow Muskrat/
    └── assets-raw/
        └── quaternius/
            ├── Ultimate_Animated_Animals.zip
            ├── Ultimate_Crops.zip
            └── …
```

The zips are large, never change, and you don't need version history on them. Both of you need
access; that's all.

### Game-ready models → git, in `public/models/`

Only the specific files the game actually loads. Organised by category:

```
public/models/
├── characters/   player.glb, merchant.glb
├── animals/      weasel.glb, donkey.glb, mole.glb, deer.glb, …
├── monsters/     woodsman.glb, deepwood_a.glb, …
├── crops/        turnip.glb, carrot.glb, onion.glb, …
├── nature/       tree_oak.glb, rock_a.glb, bush_a.glb, …
├── buildings/    house_1.glb … house_5.glb, silo.glb, windmill.glb, …
├── items/        slingshot.glb, bow.glb, axe.glb, bucket.glb, …
└── CREDITS.md
```

**Size check:** individual low-poly `.glb` files run roughly 50–500 KB. Fifty models is around
15 MB — comfortably fine in plain git, no LFS needed. Revisit if you pass ~200 MB.

**Do not commit whole packs.** Extract what you use. A pack has hundreds of models; you'll ship
dozens.

### Format

Quaternius ships FBX, OBJ, GLTF/GLB and `.blend`. **Take the GLB.** If a pack only offers FBX,
import to Blender and export GLB with *Include → Animation* ticked.

**No conversion needed to load them.** `Assets.ts` already handles both plain GLB and the
meshopt/KTX2-compressed KayKit models — the decoders only engage when a file declares them.

---

## 5. Integration — replace the hardcoded list with a manifest

`Assets.ts` currently has a `ModelKey` union and a `MODEL_PATHS` record. That's fine for 13 models
and unmanageable at 80. Move to data:

```ts
// src/content/models.ts
export type ModelDef = {
  path: string;
  /** Normalise to this world height in units. Packs ship wildly different scales. */
  height?: number;
  /** Multiply the source colour toward this. Omit to leave the pack's own look. */
  tint?: number;
  /** Unlit pure black silhouette — woods entities. */
  silhouette?: boolean;
  /** Regexes to find clips; packs name them differently. */
  clips?: { idle?: RegExp; walk?: RegExp; attack?: RegExp; death?: RegExp };
};

export const MODELS: Record<string, ModelDef> = {
  player:   { path: 'characters/player.glb', height: 1.6 },
  merchant: { path: 'characters/merchant.glb', height: 1.6 },

  weasel:   { path: 'animals/weasel.glb',  height: 0.45, tint: 0x8b5e3c },
  donkey:   { path: 'animals/donkey.glb',  height: 1.3 },

  woodsman: { path: 'monsters/woodsman.glb', height: 1.9, silhouette: true },

  turnip_3: { path: 'crops/turnip.glb', height: 0.5 },
  tree_oak: { path: 'nature/tree_oak.glb', height: 4.0 },
};
```

**Three things this buys you:**

1. **Adding a model is a data edit**, not a code edit — no union to extend, no switch to update.
2. **`height` normalisation is essential.** Different packs export at wildly different scales; one
   may be 100× another. Normalising to a target height in the manifest means you never hand-tune
   scale in three different places.
3. **Clip regexes handle naming differences.** KayKit uses `Idle` / `Running_A`; other packs use
   `Armature|Idle` or `idle_loop`. Per-model regexes beat one global guess.

Keep the primitive fallback exactly as it is. A missing model must never break the build — that's
what lets you add assets one at a time.

---

## 6. Consistency rules

Quaternius is internally consistent, so you need less enforcement than with mixed sources. Three
rules still apply:

1. **Normalise scale through the manifest**, never by editing the model.
2. **Tint sparingly.** Quaternius already has a coherent palette. Tint when you need a variant (a
   brown weasel from a grey one), not by default. Remember `Assets.ts` *tints* rather than replaces,
   so baked detail survives.
3. **Silhouette treatment is absolute.** Anything in the woods gets unlit black, `fog: false`, no
   exceptions. That single rule is most of the tonal contrast.

**One thing to check per pack:** if a pack looks noticeably shinier or flatter than the rest, force
its materials through `standardMaterial(color, { roughness: 0.86, metalness: 0.04 })`. That's the
existing consistency enforcer and it will absorb most mismatches.

---

## 7. Optimisation — later, not now

Quaternius models are already low-poly. Don't optimise until something is actually slow.

When you do:

```bash
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp
```

That matches the pipeline the KayKit models already use, and the decoders are wired.

**Watch instancing.** Trees and rocks currently render as `InstancedMesh` built from primitives.
Swapping in real models means either keeping them instanced (fast, but no per-instance animation) or
individual meshes (flexible, far slower). **Scatter props must stay instanced** — you have hundreds
per chunk. Only actors get individual meshes.

---

## 8. Order of work

| # | Work | Why here |
|---|---|---|
| 1 | Manifest system (§5) + folder structure | Everything else depends on it. Do this before importing a single model. |
| 2 | Player from Ultimate Animated Characters | Biggest visible change, and it validates the whole pipeline on one model |
| 3 | Weasel + 3–4 animals from Ultimate Animated Animals | Proves the animal pipeline and the tint path |
| 4 | Crops from Ultimate Crops | 5 crops × 3 stages, the most-seen assets in the game |
| 5 | Trees, rocks, bushes from Ultimate Nature | Largest visual surface area; keep them instanced |
| 6 | **Woodsman + woods roster from Ultimate Monsters** | Closes the `IDEAS.md` §0.1 gap — the half of the game with no content |
| 7 | Homestead tiers from Ultimate Buildings | The housing ladder becomes real |
| 8 | Tools and weapons from Ultimate RPG | Slingshot, bow, axe, bucket |
| 9 | City-building pieces from Ultimate Buildings | After the placement system exists |

**Do step 1 first and completely.** Importing eighty models against a hardcoded `ModelKey` union is
how this turns into a week of tedium instead of an afternoon.

---

## 9. Credits

CC0 requires no attribution, but keep the record — it takes seconds now and is miserable to
reconstruct at launch. Extend `public/models/CREDITS.md` with pack name, source URL, download date,
and which game keys came from it.
