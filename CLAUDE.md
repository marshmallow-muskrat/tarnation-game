# CLAUDE.md — Tarnation

Read this before writing any code. Both founders' agents follow this file.

---

## What this is

> **An economic sandbox farming economy** with progression built into numerous systems,
> non-linear paths, and multiple maps of varying difficulty and variety — including triggered
> secret zones and smaller boss, challenge and treasure zones — that allows for exploration,
> town and city building, gathering and combat.

Cartoon Americana art direction. Built by two people who are not professional engineers, with AI
assistance throughout.

**Consequence for you:** favour clear, boring, well-named code over clever code. The humans
reviewing your work need to read it. A dense one-liner they can't follow is a liability.

### The Dark Woods is removed

Earlier masterplans are built around a single horror zone — the Dark Woods, the Woodsman, the
Attention meter, the bag-drop stake, and a hard tonal contract of "no jokes past the treeline."
**All of that is cut.**

It's superseded by the multi-zone structure above: many zones of varying difficulty and kind,
rather than one scary one. Anything in `masterplans/` describing the Dark Woods is **historical
record, not instruction.** Do not build from it.

The one thing worth keeping from it: the **silhouette treatment** (unlit pure black, `fog: false`)
is still the cheapest way to make a boss or guardian read as a threat. `Assets.ts` keeps it as
`applySilhouetteMaterials`, driven by the manifest's `silhouette` flag.

---

## Stack — actual, not aspirational

| | |
|---|---|
| Language | TypeScript, `strict: true` |
| Renderer | **Three.js** (isometric orthographic, Gloamreach look recipe) |
| UI | **React 19**, DOM overlay above the canvas |
| Build | Vite |
| Deploy | **Cloudflare Pages** → tarnation.pages.dev |

**No Phaser. No Electron. No Steam SDK. No backend.** Those appear in older masterplans; they are
not the current stack. Electron may return much later as a shipping wrapper — the static `dist/`
output is already the payload — but nothing should be built for it now.

---

## Architecture

```
src/sim/       ★ Pure game logic. No Three, no React, no DOM, no window.
src/game/      Three.js — WorldRenderer, terrain, streams, water, scatter, Assets, GameRuntime
src/ui/        React HUD
src/content/   Data — models.ts manifest, tuning constants
public/models/ .glb assets by category
public/basis/  KTX2 transcoder — DO NOT REMOVE
```

### `src/sim/` never imports a renderer

The most important rule here. Economy, growth, genetics, inventory, save serialisation — all pure
functions. **Why:** it's the only way the humans can verify AI-written logic. `scripts/simcheck.ts`
proves systems work with no browser. Logic buried in a renderer is untestable, and untestable AI
code is where bugs live.

If you want to import `three` into `src/sim/`, the design is wrong. Return data; let the renderer
draw it.

### Determinism

- One seeded PRNG (`mulberry32`), seeded from the save. **No `Math.random()` in `src/sim/`.**
- Fixed timestep, accumulated from delta. Never drive game state off raw frame delta, or behaviour
  differs between a 60Hz and a 144Hz monitor.

---

## Assets — read `ASSETS.md` before touching models

**All 3D assets come from Quaternius packs** (CC0). KayKit is retired.

**Adding a model is a data edit in `src/content/models.ts`, never a code edit in `Assets.ts`.**
The manifest carries path, target height, tint, silhouette flag and clip regexes.

Three things that will waste your time if you don't know them:

1. **Every Quaternius "Ultimate" pack ships FBX/OBJ/Blend only — no glTF.** Convert with
   `node scripts/convert-fbx.mjs <src> <out>` before anything can load.
2. **`height` in the manifest is mandatory in practice.** Packs export at wildly different scales.
   Normalise there, never by hand at a call site.
3. **The KTX2 + meshopt decoders in `Assets.ts` are load-bearing.** Some models declare
   `EXT_meshopt_compression`, `KHR_mesh_quantization`, `KHR_texture_basisu`; a bare `GLTFLoader`
   throws on all three and silently falls back to a primitive. `initAssetLoaders(renderer)` must
   run before `preloadAll()`, and the renderer must exist first because `KTX2Loader.detectSupport()`
   needs it.

**A missing model must never break the build.** The primitive fallback is what lets assets arrive
one at a time.

**Clone rigged models with `SkeletonUtils.clone()`**, never `Object3D.clone()` — the latter leaves
skinned meshes bound to the source skeleton and characters render collapsed.

**Tint materials, don't replace them.** Replacing throws away baked detail and leaves a featureless
blob.

---

## Performance

| Metric | Budget |
|---|---|
| Frame time | < 16.6ms (60fps) at full scatter density |
| Sim tick | < 2ms |
| Cold start to playable | < 6s |

**Scatter props stay `InstancedMesh`.** Hundreds per chunk — individual meshes will not hold 60fps.
Only actors get their own mesh.

---

## Workflow

- **`git pull` before you start.** Two agents and two humans work in this repo; stale working trees
  have already nearly destroyed a batch of work once.
- Small commits. They're the humans' undo button.
- Never `git add -A` without checking `git status` first.
- Log significant decisions in `DECISIONS.md` with the reasoning and rejected alternatives.
- Don't add features that aren't in a masterplan or `IDEAS.md`. Scope creep is the top project
  risk. If something's missing, propose it rather than building it.

## Design docs

| Doc | Status |
|---|---|
| `IDEAS.md` | Live — triaged idea backlog with build order |
| `ASSETS.md` | Live — the Quaternius pipeline |
| `masterplans/` | **Historical.** Useful for systems design; the Dark Woods, Phaser and Electron sections are dead. |
