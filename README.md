# Tarnation

[![Quality gates](https://github.com/marshmallow-muskrat/tarnation-game/actions/workflows/qa.yml/badge.svg?branch=main)](https://github.com/marshmallow-muskrat/tarnation-game/actions/workflows/qa.yml)
[![Production deployment](https://github.com/marshmallow-muskrat/tarnation-game/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/marshmallow-muskrat/tarnation-game/actions/workflows/deploy.yml)

**[Play the current web release](https://tarnation.pages.dev/)**

Tarnation is a stylized, low-poly frontier homestead game. Grow and crossbreed unusual crops, turn
their traits into practical advantages, build a more capable settlement, and defend it from readable
fox raids. The current release is a complete desktop-browser vertical slice built with Three.js,
React, TypeScript, and Vite.

## Current release

Version **0.3.0 / M10** completes the Masterplan V2 implementation pass:

- A multi-day grow, experiment, defend, and develop loop with a clear settlement objective.
- Counted seed packets, meaningful crop traits, a Seed Codex, water progression, working buildings,
  an honest paid economy, and differentiated fox roles.
- Reworked movement, animation transitions, tool grips, targeting, and interaction feedback.
- Safer compact saves with migration, recovery, import/export, and visible save status.
- A clearer HUD, keyboard-remappable controls, accessible modal behavior, settings, reduced motion,
  high-contrast UI, audio controls, and first-session guidance.
- Staged asset loading, shared render resources, bounded effects, deterministic performance budgets,
  and fallbacks for missing assets or unsupported WebGL.
- Automated unit, simulation, asset, audio, performance, visual, and production-browser checks before
  any `main` deployment, plus a player-initiated sanitized diagnostics export.

The automated release and live smoke checks pass. Human animation/accessibility signoff and external
playtesting were deliberately deferred by the owner, so the Core Release Gate remains conditional and
content expansion is still paused. See the
[completion review](docs/masterplan-v2-completion-review.md) for the concise evidence and remaining risks.

## Run locally

Node.js 24 is required.

```bash
npm ci
npm run dev
```

- Game: <http://localhost:5183/>
- Asset preview: <http://localhost:5183/picker.html>
- Production build: `npm run build`
- Deterministic tests: `npm run test:ci`
- Full production-browser journeys: `npm run e2e:ci`
- Production deploy: automatic after a verified push to `main`

Do not deploy task branches manually; the `main` workflow is the production path.

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

Controls can be rebound in Settings. Double-click a deed in the inventory to place, equip, or apply
it. Right-click an inventory stack to delete one item after confirmation.

## Architecture

```text
src/sim/       Pure deterministic simulation, saves, economy, genetics, and raids
src/game/      Three.js world, assets, input, actions, persistence, and runtime services
src/ui/        React HUD, dialogs, and shared model-backed icons
src/content/   Typed tuning, equipment, purchases, and model manifests
public/        Validated game-ready models, audio, and KTX2 support files
tests/         Unit, integration, production E2E, and reviewed visual baselines
```

The project preserves a fixed simulation step, seeded randomness, typed content contracts, primitive
asset fallbacks, and a strict separation between simulation and browser/rendering code. Larger runtime
responsibilities have been moved into focused controllers and services, although `GameRuntime.ts` and
the main HUD remain known candidates for careful future decomposition.

## Project documentation

- [`masterplan-v2.md`](masterplan-v2.md) — product and engineering authority
- [`HANDOFF.md`](HANDOFF.md) — current verified implementation and deployment record
- [`DECISIONS.md`](DECISIONS.md) — resolved product and technical decisions
- [`CHANGELOG.md`](CHANGELOG.md) — shipped milestone notes
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — contributor workflow and quality checks
- [`ASSETS.md`](ASSETS.md) and [`PROVENANCE.md`](PROVENANCE.md) — asset pipeline and licensing records
- [`docs/history/`](docs/history/) — superseded plans retained only for provenance

The repository's original code and authored assets are all-rights-reserved; third-party material keeps
its separately documented terms. See [`LICENSE`](LICENSE) for details.
