# TARNATION — handoff / current state

**Read this first. It is the current truth.** Everything in `masterplans/` is historical and
carries a banner saying so.

---

## 1. What the game is

> **An economic sandbox farming economy** with progression across many systems, non-linear paths,
> and multiple maps of varying difficulty — including triggered secret zones and smaller boss,
> challenge and treasure zones — supporting exploration, town and city building, gathering and
> combat.

Cartoon Americana, stylised low-poly, fixed isometric camera. Two non-engineer devs building with
AI assistance.

**The Dark Woods is removed.** Earlier docs are built around a single horror zone with a stalker,
an Attention meter, a bag-drop stake and a "no jokes past the treeline" tonal rule. All cut.

---

## 2. Stack

| | |
|---|---|
| Renderer | **Three.js**, orthographic isometric |
| UI | **React 19** DOM overlay |
| Build | Vite · **Cloudflare Pages** → tarnation.pages.dev |
| Logic | `src/sim/` — pure TS, no renderer imports |

No Phaser, no Electron, no Steam SDK, no backend. Those appear in old masterplans only.

```
src/sim/        pure logic — economy, growth, genetics, inventory, save
src/game/       WorldRenderer, terrain, streams, water, ScatterChunks, FarmTrees, Assets, GameRuntime
src/ui/         React HUD
src/content/    models.ts (asset manifest) + tuning constants
public/models/  .glb by category
public/basis/   KTX2 transcoder — DO NOT DELETE
scripts/        convert-fbx.mjs, simcheck.ts
picker.html     asset preview grid — /picker.html
```

---

## 3. Assets — the part with the most gotchas

**All art is Quaternius (CC0).** KayKit is retired. ~450 models converted and committed.

### The manifest is the only place a model is described

`src/content/models.ts`. **Adding a model is a data edit there, never a code edit in Assets.ts.**

```ts
key: { path, height?, tint?, tintStrength?, silhouette?, rotateX?, clips?, note? }
```

`Assets.ts` reads it. A missing file falls back to a primitive and logs once — that's what lets
assets land one at a time.

### Five things that will waste your time

1. **Most Quaternius "Ultimate" packs ship FBX/OBJ/Blend only — no glTF.** Convert with
   `node scripts/convert-fbx.mjs <src-dir> <out-dir>`. `fbx2gltf` is already a devDependency and
   works on arm64 under Rosetta. **Exceptions that DO ship glTF:** Ultimate Animated Characters,
   Ultimate Animated Animals, Ultimate Monsters, and both Stylized Nature packs — use those
   directly, since converting is where rigs break.

2. **Textured packs must be optimised, not copied.** Their `.gltf` reference shared external
   textures, so a plain copy embeds every texture into every model — one tree came out at 8.93 MB.
   Run from inside the pack's glTF directory:
   ```bash
   npx @gltf-transform/cli optimize In.gltf out.glb --texture-compress webp --texture-size 256 --compress meshopt
   ```
   That took 8.93 MB → 150 KB. Always use `optimize`, never `copy`, for textured packs.

3. **`height` normalisation is the field that matters.** Packs export at wildly different scales.
   **Quadrupeds must be well below life-size** — height-normalising a cow at its real shoulder
   height makes it dwarf the 1.6-unit player, because animals are far longer than they are tall.

4. **Clone rigged models with `SkeletonUtils.clone()`**, never `Object3D.clone()` — the latter
   leaves skinned meshes bound to the source skeleton and characters render collapsed.

5. **Tint materials, never replace them.** Replacing throws away baked detail and leaves a
   featureless blob. `tintMaterials()` clones and lerps colour.

### Instancing models

`instancedParts(key)` in `Assets.ts` flattens a glTF into geometry/material pairs so a model can
drive an `InstancedMesh`. **Scatter must stay instanced** — hundreds per chunk. `FarmTrees.ts`
shows the pattern: one `InstancedMesh` per part, same matrix written to all of them.

### Preview

`npm run dev` → **http://localhost:5173/picker.html**. Drop `.glb` into `public/preview/`, list the
names in `src/picker.ts`, and they render in the game's own lighting with names and idle
animations. Use this to choose models rather than opening Blender.

---

## 4. Where things stand

**Done**
- Player is Cowboy_Male (Ultimate Animated Characters), animated
- Trees render from the **Textured Stylized Trees — May 2020** pack via instancing; rocks,
  stumps and scatter use the Ultimate Nature Pack models
- Crops render from Nature Crops Pack, 4 growth stages per species
- Terrain, river, creeks, lake, sky, horizon, chunked scatter, day/night
- Economy: Ducketts, market stall, 24-slot inventory, per-item prices
- Genetics/crossbreeding, soil painting, toolbar
- Scatter uses instanced Ultimate Nature Pack grass, plants, flowers, bushes and rocks
- B-slot bear traps use the open/closed assets and catch foxes in range; Q boulder remains separate
- Survival Pack shotgun, shovel and red axe are modelled in the toolbar and attached to the right hand
- The weapon ladder currently starts with shotgun → bow → axe/melee; no forced gun asset is invented
- Homestead upgrades use the five house tiers, with the 13 farm building models available in build mode
- HUD previews use real models for actions and inventory; the bucket keeps its readable emoji icon

**Crop roster follows the art, deliberately.** Grass, Dandelion, **Beet**, Carrot, **Lettuce** —
named for the models that exist. Do not rename crops to something the pack lacks.

**Tuning already done — don't undo it**
- `FARM_TREE_FRACTION` is 0.055 and farm `tree_oak` is height 2.5. Real tree models have far more canopy
  volume than the thin cones those numbers were tuned for, and at 0.15 the map closed
  into a solid roof with the player buried. If you swap tree models again, re-check
  this number — canopy width, not model count, is what fills the screen.
- Animal `height` values are well below life-size on purpose. See §3 rule 3.

**Rejected, don't redo**
- Stylized Nature MegaKit trees — converted and present under the `sn_` prefix in `nature/`, but
  they read wrong against the flat-shaded look. The accepted farm tree set is now Textured
  Stylized Trees — May 2020; Ultimate Nature remains the scatter house style.
- Ultimate Guns — modern silhouettes break the 1940s Americana period.
- Modular Sci-Fi — wrong game.
- A weasel — no pack has one. The crop raider is a **fox**. Don't force species the packs lack.

---

## 5. Next tasks, in order

1. **Scatter → Ultimate Nature Pack models.** Done. `ScatterChunks.ts` uses `instancedParts()` for
   `nature/` models (`bush_1/2`, `rock_1/2/3`, `plant_1..5`, `grass_*`, `flowers_*`) and keeps the
   hundreds of instances batched.

2. **Bear trap on the B slot.** Done. Q remains the boulder; B places `bear_trap_open.glb`, catches
   a fox entering the radius, swaps to `bear_trap_closed.glb`, and persists.

3. **Tools in hand.** Done. The Cowboy rig uses the right-hand bone plus `PickUp`, `Walk_Carry`,
   `Run_Carry`, `Shoot_OneHanded`, `SwordSlash` and `Punch` clips. The Survival Pack shotgun,
   shovel and red axe are attached model assets.

4. **Weapon ladder — let the assets lead.** Done for the current accepted assets: Survival Pack
   shotgun → **bow** (`bow_wooden` + `arrow`) → axe/melee. Weapon fire is gated to the ranged slot;
   switching to shovel, axe or bucket clears active pellets.

5. **Buildings.** Done. `buildings/` has 13 farm buildings (barn, big_barn, small_barn, open_barn,
   silo, silo_house, windmill, tower_windmill, water_tower, well, chicken_coop, fence, fence2),
   wired to homestead tiers and the first placeable town-building set.

6. **Income curve.** Prices exist; ducketts-per-day doesn't. Measure it before pricing anything
   else — see `IDEAS.md` §0.3.

---

## 6. Working rules

- **`git pull` before you start.** Multiple agents and two humans commit here. A stale working tree
  nearly destroyed a batch of work once.
- Never `git add -A` without checking `git status` first.
- `src/sim/` imports no renderer code. Grep for it.
- Keep the primitive fallback path — never let a missing model break the build.
- `npx tsc --noEmit` before committing.
- `window.tarn` exposes the runtime in the console for debugging.

## 7. Docs

| File | Status |
|---|---|
| `HANDOFF.md` | **This file — current truth** |
| `CLAUDE.md` | Live — conventions and architecture |
| `ASSETS.md` | Live — Quaternius pipeline, pack triage, download flow |
| `IDEAS.md` | Live — triaged idea backlog with build order |
| `masterplans/` | **Historical.** Good systems thinking; the Dark Woods and Phaser/Electron are dead. |
