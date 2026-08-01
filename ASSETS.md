# TARNATION — Asset plan (Quaternius)

> **Game concept (current):** an economic sandbox farming economy with progression across many
> systems, non-linear paths, and multiple maps of varying difficulty — including triggered secret
> zones and smaller boss, challenge and treasure zones — supporting exploration, town and city
> building, gathering and combat.
>
> **The Dark Woods is removed.** One horror zone becomes many zones of varying kind. That changes
> this plan three ways: Ultimate Monsters is back in scope (bosses and challenge zones, not one
> stalker), fish are wanted for rivers and lakes, and buildings matter far more now that town
> building is a pillar.

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

**Done.** `public/models/` is reorganised by category and the manifest points at it. The old KayKit
files remain only as placeholders until the Quaternius equivalents land.

---

## 2. Pack triage

You listed fifteen. Most are right. Three aren't, and one is more important than you flagged.

### Download now — core

| Pack | Use | Priority |
|---|---|---|
| **Ultimate Animated Characters** | Player, merchant, any NPC | 🔴 First |
| **Ultimate Animated Animals** | Weasels, donkey, livestock, wildlife | 🔴 First |
| **Ultimate Crops** | All 5+ crops and their growth stages | 🔴 First |
| **Ultimate Nature** | Trees, rocks, bushes, scatter — replaces procedural props | 🔴 First |
| **Ultimate Monsters** | Bosses, zone guardians, challenge zones. See §3. | 🟠 Second |
| **Ultimate Buildings** | Homestead tiers + the 25-piece city-building sheet | 🟠 Second |
| **Ultimate RPG** | Slingshot, bow, axe, tools, props | 🟠 Second |
| **Ultimate Modular Men / Women** | Merchant, future NPCs, character variety | 🟡 Later |
| **Ultimate Food** | Cooking, market stall dressing, decoy pie | 🟡 Later |
| **Ultimate Furniture** | Only once interiors exist | 🟡 Later |

### Hold off

**Ultimate House Interior** — there are no interiors in the design yet. Downloading is free, but
don't wire it in; an interior system is a real feature, not an asset drop.

**Animated Fish / Animated Cute Fish — download both, use as ambient life now.** Swimming fish in
the river and lake cost almost nothing: a few models on looping spline paths under the surface,
no interaction. They make the water read as alive.

Fishing as a *system* is a later decision. The old masterplan banned it outright (*"it's always
the thing that eats a month"*), and that warning still holds — but with an economy sandbox as the
concept, fishing is a legitimate income path rather than a distraction. Ship the fish as scenery;
decide on the minigame once the income curve is known.

### Two real problems

**Ultimate Guns — tonal mismatch.** The weapon ladder is slingshot → bow → blunderbuss → varmint
rifle → the Cropper. That's 1940s Americana. A modern pack is typically pistols, ARs and SMGs, and
a modern assault rifle in a cartoon farm game breaks the period the whole art direction rests on.

*Recommendation:* take only the period-plausible pieces — a break-action shotgun, a hunting rifle, a
revolver — and get the slingshot and bow from **Ultimate RPG** instead. Skip the modern silhouettes.

*Counter-argument, honestly:* golden-age cartoons did absurd anachronism constantly. If you want a
comically modern gun as a late-tier joke, that's defensible — just make it *the joke*, deliberately,
not the default aesthetic.

**Ultimate Modular Sci-Fi — wrong game.** Nothing about sci-fi fits cartoon Americana. Download it
for a future project; keep it out of this one.

---

## 3. Ultimate Monsters — bosses, guardians and challenge zones

With multiple maps of varying difficulty plus boss, challenge and treasure zones, this pack is
what populates them. One monster roster covers a lot of ground.

**Use the silhouette treatment selectively, not globally.** Override every material to unlit pure
black with `fog: false` and a model becomes a pure silhouette with a real walk cycle — free, and
more menacing than a detailed model because the player fills in the rest.

- **Full black** — zone guardians, anything meant to read as a threat you can't yet handle
- **Very dark grey** — mid-tier, so "how much of it you can see" encodes difficulty
- **Untreated** — ordinary fights, where the player should read attacks fairly

That gradient is a free difficulty signal, set per model via the manifest's `silhouette` flag.

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

### Format — every Ultimate pack needs converting

**Verified on quaternius.com: the entire "Ultimate" series (2019–2020) ships FBX / OBJ / Blend
only. There is no glTF.** Ultimate Crops and Ultimate Animated Characters both confirm this on
their pack pages. Newer MegaKits may differ — check per pack.

So conversion is mandatory, not optional. No Blender required:

```bash
npm i -D fbx2gltf
node scripts/convert-fbx.mjs ~/Downloads/UltimateCrops public/models/crops
node scripts/convert-fbx.mjs ~/Downloads/UltimateCrops public/models/crops --filter Carrot
```

`scripts/convert-fbx.mjs` walks a directory, converts every `.fbx` to `.glb`, and renames
`PascalCase` to `snake_case` game keys. Verified working: `FBX2glTF 0.9.7` runs on arm64 under
Rosetta.

**Check animations survived.** FBX→glTF conversion is where rigs break. Load one converted
character and confirm its clips play before converting a whole pack.

---

## 5. Integration — the manifest (built)

`src/content/models.ts` is the manifest. **Adding a model is a data edit there, never a code edit
in `Assets.ts`.** Each entry carries:

| Field | Purpose |
|---|---|
| `path` | under `public/models/` |
| `height` | **normalise to this world height** — the field that matters most; packs export at wildly different scales |
| `tint` / `tintStrength` | lerp source colour, preserving baked detail |
| `silhouette` | unlit pure black, `fog: false` |
| `rotateX` | pose fix, e.g. pitching a runner forward |
| `clips` | per-model animation-name regexes, since packs name them inconsistently |

`Assets.ts` reads it — no per-key switch survives. Missing files still fall back to primitives and
log once, which is what lets assets arrive one at a time.

A **LEGACY** block at the bottom of the manifest maps the keys the current code calls onto real
files. Migrate call sites to the categorised keys, then delete that block.

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

## 9. Download checklist

Each page's **Download** button opens a Google Drive folder — these can't be scripted, so it's a
manual click per pack. With 5 TB of Drive, keep the raw zips there permanently.

| Pack | URL |
|---|---|
| Ultimate Animated Characters | `quaternius.com/packs/ultimatedanimatedcharacter.html` |
| Ultimate Animated Animals | `quaternius.com/packs/ultimateanimatedanimals.html` |
| Ultimate Crops | `quaternius.com/packs/ultimatecrops.html` |
| Ultimate Nature | `quaternius.com/packs/ultimatenature.html` |
| Ultimate Buildings | `quaternius.com/packs/ultimatetexturedbuildings.html` |
| Ultimate RPG | `quaternius.com/packs/ultimaterpg.html` |
| Ultimate Monsters | `quaternius.com/packs/ultimatemonsters.html` |
| Ultimate Food | `quaternius.com/packs/ultimatefood.html` |
| Ultimate Furniture | `quaternius.com/packs/ultimatefurniture.html` |
| Ultimate Modular Men | `quaternius.com/packs/ultimatemodularcharacters.html` |
| Ultimate Modular Women | `quaternius.com/packs/ultimatemodularwomen.html` |
| Animated Fish | `quaternius.com/packs/animatedfish.html` |
| Animated Cute Fish | `quaternius.com/packs/cutefish.html` |

**Also worth grabbing — not on the original list but a better fit than some that were:**

| Pack | Why |
|---|---|
| **Farm Buildings** | `quaternius.com/packs/farmbuildings.html` — purpose-built for exactly this game |
| **Farm Animal** | `quaternius.com/packs/farmanimal.html` — animated livestock |
| **Universal Animation Library 1 & 2** | Retargetable humanoid animations. If a character lacks a clip you need, retarget rather than hunting for another model. |
| **Universal Base Characters** | Rigged and retargetable — a base to build custom characters on |
| **Survival Pack** | Gathering and crafting props |
| **Stylized Nature MegaKit** | Larger, Ghibli-flavoured nature set if Ultimate Nature reads too plain |

### Where they go

```
Google Drive (5 TB)
└── Marshmallow Muskrat/assets-raw/quaternius/
    ├── UltimateCrops.zip
    └── …
```

Extract to a local scratch folder, convert, and copy only what you use into `public/models/`.

**Note:** the Drive connector isn't available to Claude Code — I can't read or write your Drive
from here. Downloading and unzipping is a manual step; everything after it is scripted.

## 10. Credits

CC0 requires no attribution, but keep the record — it takes seconds now and is miserable to
reconstruct at launch. Extend `public/models/CREDITS.md` with pack name, source URL, download date,
and which game keys came from it.
