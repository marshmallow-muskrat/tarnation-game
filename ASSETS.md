# Tarnation asset pipeline

The game uses CC0 Quaternius models in a single flat-shaded, stylised low-poly language. The asset
manifest at `src/content/models.ts` is the source of truth for every model the runtime can load.
`src/content/assetMetadata.ts` resolves the shared metadata contract for each entry: rig class,
expected clips, source-space axes and pivot, target height, catalog-derived footprints, load group,
primitive fallback, held-marker source, icon framing, and CC0 provenance. `scripts/assetcheck.ts`
opens every unique referenced GLB and validates its scene graph, finite transforms, source bounds,
textures, binary references, and expected animation clips.

## Accepted packs and current use

- **Ultimate Animated Characters:** the Cowboy player rig and future NPCs.
- **Ultimate Animated Animals:** foxes and farm/wildlife actors.
- **Nature Crops Pack:** Grass, Dandelion, Beet, Carrot, and Lettuce growth models.
- **Ultimate Nature Pack:** instanced rocks, bushes, plants, grass, and flowers.
- **Textured Stylized Trees — May 2020:** accepted farm tree set, rendered with instancing.
- **Survival Pack:** the current brown shotgun, shovel, and red axe.
- **RPG Items and Universal Animation libraries:** supporting item and animation assets.
- **Farm Buildings:** barns, silos, windmills, water tower, well, coop, fences, and related pieces.
- **Ultimate Monsters:** optional rigged guardian art retained for later authored zones.

The accepted packs do not contain honest meshes for the market stall, merchant caravan, barrel,
haystack, or bucket. These are intentionally authored low-poly props in
`src/game/MarketStall.ts` and `src/game/PresentationProps.ts`; they are not substitutions for an
unrelated pack model and require no new asset license. The crate and coin sack retain their honest
accepted chest and pouch models.

The accepted tree set is deliberately separate from the Ultimate Nature scatter set. Tree models
have broad canopies, so the farm currently uses `FARM_TREE_FRACTION = 0.055` and manifest tree
height `2.5`. Recheck both values whenever the tree source changes.

## Import rules

1. Put only game-ready `.glb` files in `public/models/`, grouped by category.
2. Add or update the corresponding entry in `src/content/models.ts`; do not add model-specific
   loading branches to `src/game/Assets.ts`.
3. Convert FBX with:

   ```bash
   node scripts/convert-fbx.mjs <source> <output>
   ```

   Preserve glTF supplied by animated character, animal, monster, and accepted stylised nature
   packs when possible; conversion is a common cause of broken rigs.
4. For textured packs, optimise with:

   ```bash
   npx gltf-transform optimize in.glb out.glb \
     --texture-compress webp --texture-size 256 --compress meshopt
   ```

   Do not use `copy`: it embeds shared textures into every model and can multiply the repository
   size dramatically.
5. Normalise scale with manifest `height`. Grounding and material treatment belong in the shared
   loader. Keep source proportions intact.
6. Test active catalog models and authored props in `picker.html` and the actual game camera. A
   model that looks fine in isolation can be too large, too dark, or poorly oriented in the farm.

## Runtime safety and performance

`Assets.ts` initialises GLTF, KTX2, meshopt, and quantisation support before preloading. A missing
file must return a primitive fallback so the rest of the game remains playable. Rigged actors use
`SkeletonUtils.clone()`; ordinary props can use the shared clone path.

Scatter renders hundreds of copies per chunk. Use `Assets.instancedParts()` and one
`THREE.InstancedMesh` per geometry/material part. Do not replace scatter with individual meshes.
Trees use the same batching pattern in `FarmTrees.ts`.

## Credits and review checklist

Keep `public/models/CREDITS.md` current when adding a pack. Before committing an asset change:

- Does the manifest path exist?
- Does the GLB pass the scene, bounds, transform, texture, and expected-clip checks?
- Does the metadata resolver provide a source pack, CC0 license record, fallback, and load group?
- Is the target height visually correct beside the player?
- Does the model preserve its materials and animation clips?
- Does it render with the production decoders?
- Is it instanced if there are many copies?
- Does a missing file still use the primitive fallback?
