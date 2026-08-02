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

- Game: <http://localhost:5183/>
- Asset preview: <http://localhost:5183/picker.html>
- Typecheck: `npx tsc --noEmit`
- Production build: `npm run build`
- Production deploy: automatic after a verified push to `main`
- Do not deploy task or integration branches manually; the reviewed `main` workflow is the deployment path.

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
| P | Build mode / merchant shop when nearby |
| X | Demolish mode |
| I | Inventory |
| `[` / `]` | Cycle seed |
| `+` / `-` | Camera zoom |
| M | Reduced motion |
| V | Toggle sound feedback |
| H | Field guide |
| J | Show/hide settlement objective |
| G | Show/hide market guide |
| Left click | Use the selected tool |
| Right click / Space | Use the selected ranged weapon; rotate in placement; context actions on placed assets |
| E | Fill the bucket at water or open the merchant shop when nearby |
| Esc | Cancel the active mode, close menus, or pause when idle |

Double-click a deed in the inventory to place, equip, or apply it. Right-click an inventory stack
to delete one item after confirmation. The merchant shop keeps its four category tabs open after a
purchase so several deeds can be bought during one visit.

## Architecture

```text
src/sim/       Pure simulation and save/economy logic; no Three.js, React, DOM, or window
src/game/      Three.js renderer, assets, world, input, and runtime
src/ui/        React HUD and model-backed toolbar icons
src/content/   Tuning and the data-driven model manifest
public/models/ Accepted, game-ready .glb assets
public/basis/  Required KTX2 transcoder files
```

Read [`HANDOFF.md`](HANDOFF.md) before changing the game. The active product, technical, quality,
and release plan is [`masterplan-v2.md`](masterplan-v2.md). Superseded plans are preserved in
[`docs/history/`](docs/history/) for provenance, not implementation.

The GitHub Actions production workflow runs simulation checks, asset validation, and the production
build before deploying `main` to Cloudflare Pages. A failed verification step prevents deployment.
The Help panel also provides a sanitized diagnostics export with build, browser/GPU, save metadata,
and bounded runtime information; it does not expose a runtime debug console or mutation handle.

## Asset safety

Models are data entries in `src/content/models.ts`; `src/game/Assets.ts` owns loading and primitive
fallbacks. Keep scatter batched with instancing. Never allow one missing model to prevent the game
from starting. See [`ASSETS.md`](ASSETS.md) for the complete pipeline and pack decisions.

Contributor setup, release notes, licensing boundaries, and provenance ledgers are documented in
[`CONTRIBUTING.md`](CONTRIBUTING.md), [`CHANGELOG.md`](CHANGELOG.md), [`LICENSE`](LICENSE), and
[`PROVENANCE.md`](PROVENANCE.md).
