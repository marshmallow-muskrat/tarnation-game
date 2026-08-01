# Tarnation handoff

This is the current truth for the game. The active product plan is [`masterplan.md`](masterplan.md).

## 1. Current game

Tarnation is a Three.js + React + Vite cartoon-Americana economic sandbox with a fixed isometric
camera, deployed to Cloudflare Pages. The player farms, gathers, sells goods, explores the map,
defends crops from foxes, upgrades the homestead, and places buildings. The design supports
non-linear progression and future maps/challenge spaces, but the current work is refinement of the
existing loop.

Run locally with `npm install && npm run dev`; open `http://localhost:5173/picker.html` for the
asset preview grid. Run `npx tsc --noEmit` for the typecheck. `window.tarn` exposes the runtime for
browser debugging.

## 2. Current implementation

- Cowboy player rig with idle, walk, run, carry, pickup, shooting, slash, and punch clips.
- Farm terrain, river, lake, day/night, chunked scatter, crops, trees, economy, genetics, market,
  inventory, save/load, and homestead progression.
- Trees from **Textured Stylized Trees — May 2020**, instanced with manifest height `2.5`.
- Grass, plants, flowers, bushes, and rocks from the accepted Ultimate Nature set, instanced in
  `ScatterChunks.ts`.
- Crop roster: Grass, Dandelion, Beet, Carrot, Lettuce.
- Survival Pack shotgun, shovel, and red axe in the toolbar; bucket remains a readable glyph.
- Bear traps on `B` with open/closed models and fox capture; `Q` remains the separate boulder.
- Weapon progression is asset-led: ranged shotgun/bow work, with axe/melee as the close option.
- Farm building models are wired to homestead tiers and the first placeable building set.

## 3. Asset rules that save time

1. Add models in `src/content/models.ts`, not with code branches in `Assets.ts`.
2. Preserve supplied glTF for animated packs. Convert FBX with `scripts/convert-fbx.mjs` only when
   needed.
3. Optimise textured models with WebP textures, 256px texture size, and meshopt compression. Never
   use texture `copy` for shared pack textures.
4. Use manifest `height` for scale. Animals must be intentionally smaller than life size.
5. Keep primitive fallbacks so missing assets cannot stop the game.
6. Keep scatter instanced; use `FarmTrees.ts` and `Assets.instancedParts()` as the pattern.

## 4. Current quality work

The next active work is Milestones 1–3 in `masterplan.md`:

- Make the hand socket, item profiles, carry/action animation states, and tool contact moments
  reliable for shotgun, shovel, axe, bow, and melee.
- Remove the bear-trap footprint artifact, make trap states readable, and ensure only the selected
  ranged tool can create projectiles or their shadows.
- Improve toolbar icon framing, HUD message priority, fox separation, and interaction feedback.
- Calibrate the first-session economy against measured play. The workbook in
  `/Users/shanebaker/Downloads/tarnation_economy_base.xlsx` is a reference hypothesis, not a
  runtime authority; its outdated raid terminology is represented as foxes in project notes.
- Remove remaining obsolete terminology from active code and documentation while preserving safe
  save migration behavior where practical.

## 5. Release procedure

Before each commit: check `git status`, run `npx tsc --noEmit`, and build when the change affects
production. Deploy after every major masterplan milestone with `npm run deploy`, then smoke-test
the live site and record the URL/commit here.

Last known production target: <https://tarnation.pages.dev/>.
