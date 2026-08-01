# Tarnation handoff

This is the current truth for the game. The active product plan is [`masterplan.md`](masterplan.md).

## 1. Current game

Tarnation is a Three.js + React + Vite cartoon-Americana economic sandbox with a fixed isometric
camera, deployed to Cloudflare Pages. The player farms, gathers, sells goods, explores the map,
defends crops from foxes, upgrades the homestead, and places buildings. The design supports
non-linear progression and future maps/challenge spaces, but the current work is refinement of the
existing loop.

Run locally with `npm install && npm run dev`; open `http://localhost:5173/picker.html` for the
asset preview grid. Run `npx tsc --noEmit` for the typecheck and `npm run assetcheck` to verify the
manifest paths. `window.tarn` exposes the runtime for browser debugging.

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
- Foxes now use readable manifest scale (`0.48` height), crop stages are camera-readable, and animal
  defeats leave short-lived grounded remains markers; rare trophies also show a floating world marker.
- Held shotgun and shovel poses use a support-hand solve, stationary tools stay in a deliberate carry
  stance, and the build workflow has a dedicated structure-selection panel.
- Building mode now previews the selected model over the hovered tile with valid/blocked colour and a
  specific placement reason; `H` opens a pausing field guide for movement, tools, combat, and building.
- Shared short-lived low-poly feedback bursts now mark hits, defeats, chopping, farming, watering,
  trap catches, construction, and rewards without adding permanent scene clutter.
- Shovel and axe targets now show an in-world hover state, while the HUD explains range limits,
  blocked tiles, required tools, planting, watering, harvesting, and chopping results.
- `+ / −` adjusts bounded camera zoom and `M` toggles persisted reduced motion, including camera
  shake suppression; both are documented in the pausing field guide.

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

Milestones 0–2 are implemented in the current branch, and the runtime now exposes economy session
metrics through `window.tarn.debug().economy()`, including first-upgrade timing and action kinds.
The next active work is Milestone 3 in
`masterplan.md`:

- Use measured session actions, sales, crop throughput, upgrades, buildings, tree work, foxes, and
  day progression to calibrate the first-session economy.
- Continue fox/trap telegraphs and audio hooks, then calibrate the first-session economy against
  measured play.
- Calibrate the first-session economy against measured play. The workbook in
  `/Users/shanebaker/Downloads/tarnation_economy_base.xlsx` is a reference hypothesis, not a
  runtime authority; its outdated raid terminology is represented as foxes in project notes.
- Keep the active code and documentation vocabulary aligned with the accepted crop, wildlife, and
  building assets; obsolete prototype entries have been removed while save loading remains safe.

## 5. Release procedure

Before each commit: check `git status`, run `npx tsc --noEmit`, and build when the change affects
production. Deploy after every major masterplan milestone with `npm run deploy`, then smoke-test
the live site and record the URL/commit here.

Last known production target: <https://tarnation.pages.dev/> (accessibility release `d66ad1c`;
preview <https://21b1c00a.tarnation.pages.dev/>).
