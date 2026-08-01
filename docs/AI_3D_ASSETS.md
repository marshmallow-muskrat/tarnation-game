# Free 3D assets — generating and sourcing without paying

**Question:** what's the best way for two indie devs to get 3D models — weasels, the main
character, donkeys, whatever we add — using AI, without paying for assets?

**Short answer:** AI generation is the *third* thing to try, not the first. And the hardest part
isn't making a mesh, it's **rigging and animating** it. Most of this document is about routing
around that.

---

## 1. The hierarchy — try these in order

### Tier 1: Download it (fastest, best quality, free)

For a low-poly farming game, most of what you need already exists as CC0. Downloading beats
generating on quality, time, and consistency — and generated assets in a coherent art style are
exactly what these packs already are.

| Source | What | Licence |
|---|---|---|
| [Quaternius](https://quaternius.com) | **Modular Farm, Ultimate Nature, Farm Animals, Cute Characters, Animated Animals** | CC0 |
| [Kenney](https://kenney.nl/assets?q=3d) | Nature, Food, Survival, Platformer, Castle kits | CC0 |
| [KayKit](https://kaylousberg.itch.io) | Characters, dungeon, medieval builder. **Already in use.** | CC0 (verify per pack) |
| [Poly Pizza](https://poly.pizza) | Searchable free model library | Mixed — filter to CC0 |
| [Sketchfab](https://sketchfab.com) | Huge library | Mixed — filter to CC0, check per model |

**Quaternius alone covers most of the idea sheet**: farm animals, modular farm buildings, nature
scatter, and animated creatures. Check there before generating anything.

**Always save the licence file next to the asset**, the way `public/models/CREDITS.md` does. Doing
this at launch instead of as you go is miserable.

### Tier 2: Build it from primitives (free, instant, perfectly consistent)

Gloamreach has only **9 model files, all characters.** Every tree, rock, crystal and structure in
it is procedural Three.js geometry — 74 `Box`, 47 `Cylinder`, 41 `Torus`, 33 `Octahedron`, 31
`Cone`, 14 `Dodecahedron`, all through one shared material.

For fences, walls, silos, water towers, crates, signposts, lamp posts, boardwalks — **code is
faster than any asset pipeline**, matches the art style automatically, and costs nothing to
iterate. A grain silo is a cylinder and a hemisphere. A water tower is a cylinder on four legs.

Most of the 25-piece city building sheet is buildable this way in an afternoon.

### Tier 3: Generate it with AI

For the things that are genuinely bespoke and don't exist in a pack.

| Tool | Type | Notes |
|---|---|---|
| [Tripo](https://tripo3d.ai) | Text/image → 3D | Free tier with credits. Good stylized output, `.glb` export. |
| [Meshy](https://meshy.ai) | Text/image → 3D | Free tier. Has auto-rigging for humanoids. |
| [Hunyuan3D](https://github.com/Tencent/Hunyuan3D-2) | Open source | Runs locally, free forever, needs a decent GPU. |
| [TRELLIS](https://github.com/microsoft/TRELLIS) | Open source | Image → 3D, strong quality. |

**Image → 3D beats text → 3D.** Generate a 2D concept first with an image model, iterate until you
love it, *then* convert. You get far more control, and it's the workflow that already produced good
results on Gloamreach's portraits.

**Why AI meshes work unusually well for this specific game:** the renderer overrides every
material with a shared flat-shaded `standardMaterial`. AI-generated textures are usually the
weakest part of the output — and this game throws them away. What's left is silhouette and
proportion, which is what AI 3D is actually good at.

---

## 2. The real problem: rigging and animation

A generated mesh is a **static lump**. Making it walk is the hard part, and it's where teams stall.

### Humanoids — solved, free

**[Mixamo](https://mixamo.com)** (Adobe, free, no longer requires a paid account): upload a
humanoid mesh, it auto-rigs it, and you pick from a large free animation library — walk, run, idle,
attack, death. Export as `.glb` or `.fbx`.

This works for the player character and any human NPC. It is the single most valuable free tool in
this pipeline.

Meshy and Tripo also offer auto-rigging for humanoids.

### Quadrupeds and creatures — the actual hard case

**Mixamo does not do animals.** Weasels, donkeys, moles, geese, the elephant — none of them can be
auto-rigged. Three options, in order of practicality:

**Option A — download an animated one.** Quaternius has CC0 animated animal packs. This is almost
always the right answer. A donkey is a donkey.

**Option B — don't rig it at all.** ← *the one worth internalising*

At Gloamreach's camera distance, a creature occupies a small fraction of the screen. **You cannot
see limb articulation at that size.** A rigid mesh driven by procedural motion reads as fully alive:

- Bob on a sine wave while moving
- Squash on landing, stretch on lunge (scale the root — no new geometry)
- Rotate to face heading, with a slight roll into turns
- Hop arcs instead of a walk cycle for small creatures
- Tail as one separate mesh, lagging behind the body with a damped follow

The weasel is a perfect candidate: it burrows, scurries, eats, and flees. Every one of those reads
better as a squash-and-stretch hop than as a walk cycle would.

This is the same insight as the 2D one, one dimension up: **procedural motion beats rigged
animation for small creatures at isometric distance**, and it's free.

**Option C — hand-rig in Blender.** Free, learnable, but it's a real skill and a real time sink.
Only worth it for a hero creature that's on screen constantly and close.

---

## 3. Cleanup — the step everyone skips

AI-generated meshes are dense and messy. Two free fixes:

**Blender** (free): Decimate modifier to cut triangle count, then **Shade Flat** to match the
game's faceted look. Often improves the appearance as well as the performance.

**[gltf-transform](https://gltf-transform.dev)** (npm, free) — command line, scriptable:

```bash
npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp
```

Gloamreach's models are already meshopt-compressed and KTX2-textured this way, which is why
`src/game/Assets.ts` needs the decoders wired up. Match that pipeline and everything loads through
the same path.

---

## 4. Consistency — already solved in this codebase

The thing that makes mixed-source assets look like one game isn't the assets. It's the **material
override**.

`src/game/materials.ts` funnels everything through:

```ts
standardMaterial(color, { roughness: 0.86, metalness: 0.04 })
```

A downloaded Kenney barn, a Quaternius donkey, an AI-generated mole, and a code-built silo all look
like the same world once they share a material profile, a flat-shaded look, and a palette. That's
the 3D equivalent of palette clamping, and it's already in the code.

**Rule: nothing enters the game with its own materials.** Strip them, tint them, done. (Note the
one exception already in `Assets.ts` — the KayKit characters get *tinted* rather than replaced,
because their baked textures carry real detail. Judge per asset.)

---

## 5. What I'd actually do for Tarnation

| Asset | Approach |
|---|---|
| Player | KayKit `thorn-ranger.glb` — already in, already rigged and animated |
| Weasels | Quaternius animated animal, **or** current placeholder + procedural motion (§2 Option B) |
| Donkey, mole, elephant, geese | Quaternius first; procedural motion if no rig exists |
| The Woodsman | KayKit skeleton, all-black unlit. Free, and better than anything you'd generate |
| Crops | Code primitives — a turnip is a sphere and two cones |
| Trees, rocks, bushes | Code primitives, as Gloamreach does |
| Buildings, silos, fences, city pieces | Code primitives first; AI-generate only the ornate ones (The Victorian, the Castle) |
| Key art / Steam capsule | 2D image generation — the Gloamreach strength, unchanged |

**Estimated cost: $0.** The pipeline is: download → build from primitives → generate, in that
order, with everything forced through one material.
