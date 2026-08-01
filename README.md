# Tarnation

Tarnation is a cartoon-Americana, low-poly, fixed-isometric farming economy. Grow and sell crops,
gather from the landscape, defend the homestead from foxes, improve the farm, and choose how to
turn a small start into a productive settlement.

The game is built with Three.js, React, TypeScript, and Vite, and deployed as a static site to
Cloudflare Pages.

## Run locally

```bash
npm install
npm run dev
```

- Game: <http://localhost:5173/>
- Asset preview: <http://localhost:5173/picker.html>
- Typecheck: `npx tsc --noEmit`
- Production build: `npm run build`
- Deploy: `npm run deploy`

## Controls

| Input | Action |
|---|---|
| WASD | Move relative to the camera |
| 1 | Shotgun |
| 2 | Shovel |
| 3 | Red axe |
| 6 / T | Bucket |
| Q | Boulder |
| B | Bear trap |
| R | Cycle weapon |
| U | Homestead upgrade |
| P | Build mode |
| I | Inventory |
| `[` / `]` | Cycle seed |
| Left click | Use the selected tool |
| Right click / Space | Use the selected ranged weapon |
| E | Fill the bucket at water |

## Architecture

```text
src/sim/       Pure simulation and save/economy logic; no Three.js, React, DOM, or window
src/game/      Three.js renderer, assets, world, input, and runtime
src/ui/        React HUD and model-backed toolbar icons
src/content/   Tuning and the data-driven model manifest
public/models/ Accepted, game-ready .glb assets
public/basis/  Required KTX2 transcoder files
```

Read [`HANDOFF.md`](HANDOFF.md) before changing the game. The active product direction and quality
bar live in [`masterplan.md`](masterplan.md).

## Asset safety

Models are data entries in `src/content/models.ts`; `src/game/Assets.ts` owns loading and primitive
fallbacks. Keep scatter batched with instancing. Never allow one missing model to prevent the game
from starting. See [`ASSETS.md`](ASSETS.md) for the complete pipeline and pack decisions.
