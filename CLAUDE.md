# CLAUDE.md — Tarnation

Read this file before changing code. It describes the current game, not discarded prototypes.
Then read [`masterplan-v2.md`](masterplan-v2.md) and implement only the authorized task ID; historical
plans in `docs/history/` are not instructions.

## Product

Tarnation is an economic sandbox farming game with a cartoon-Americana, stylised low-poly look and
a fixed isometric camera. The current loop is farming, gathering, selling, exploring, defending
the homestead from foxes, upgrading the farm, and placing buildings. Progression can later span
multiple maps and compact challenge, boss, treasure, and secret zones, but polish of the existing
loop comes first.

The stack is TypeScript with `strict: true`, Three.js, React, and Vite. The production target is a
static Cloudflare Pages deployment at `tarnation.pages.dev`.

## Architecture rules

```text
src/sim/       Pure game logic, economy, genetics, raids, inventory, and saves
src/game/      Three.js world, asset loading, renderer, input, and runtime
src/ui/        React DOM overlay and HUD
src/content/   Data and the model manifest
public/models/ Game-ready .glb files
```

`src/sim/` must not import Three.js, React, the DOM, or `window`. Return data from simulation and
let the renderer present it. Use the seeded PRNG and fixed simulation timestep; do not put
`Math.random()` in simulation code.

## Asset rules

1. Adding a model is a data edit in `src/content/models.ts`, never a switch in `Assets.ts`.
2. Use `scripts/convert-fbx.mjs` for FBX packs. Animated Characters, Animated Animals, Monsters,
   and the accepted stylised nature packs already provide glTF and should be used directly.
3. For textured packs, optimise with `gltf-transform optimize --texture-compress webp
   --texture-size 256 --compress meshopt`; never use `copy` for shared textures.
4. Set scale through the manifest `height`. Quadrupeds need an intentionally small target height
   because their body length otherwise overwhelms the 1.6-unit player.
5. Preserve primitive fallbacks and log missing models without breaking the build.
6. Clone rigged models with `SkeletonUtils.clone()`. Tint existing materials instead of replacing
   their baked detail.
7. Scatter props stay instanced. Individual scene objects are for actors and interactive props.

Read [`ASSETS.md`](ASSETS.md) before importing or replacing models. `src/game/FarmTrees.ts` and
`Assets.instancedParts()` are the reference patterns for batched models.

## Workflow

- Pull before starting: `git pull --ff-only`.
- Check `git status` before staging. Stage intentional paths; never use `git add -A` blindly.
- Keep commits small and explain tuning decisions.
- Run `npx tsc --noEmit` before every commit. Run `npm run build` for release work.
- Use `window.tarn` in the browser console for runtime inspection.
- Deploy only after a completed Masterplan V2 milestone is green and reviewed, then record the exact
  production commit, URL, and smoke test in `HANDOFF.md`.
- Do not expand scope with a new system when an existing system needs polish.
