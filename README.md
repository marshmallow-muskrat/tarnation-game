# Tarnation — Draft 0.3 (Gloamreach engine)

3D isometric farm-by-day / woods-by-risk game. **Three.js + React + Vite**, look recipe from Gloamreach.

## Run

```bash
npm install
npm run dev
npm run deploy   # Cloudflare Pages → tarnation.pages.dev
```

## Controls

| Input | Action |
|---|---|
| WASD | Move (camera-relative) |
| 1 | Fist — till, plant, harvest, chop trees |
| 2 | Rock — throw it |
| 3 / 4 / 5 | Empty slots |
| 6 or T | Bucket (water tool) — fill at water, pour on plants |
| LMB | Use the selected slot |
| RMB / Space | Throw / shoot |
| E | Fill bucket at a river or lake |
| [ ] | Cycle seed · R cycle weapon |
| Z / X / C | Trench · breeding bed · mushroom trap |
| North treeline (day) | Enter woods |
| South woods edge | Exit & bank wood |
| Q | Dump bag (woods) |
| Walk to house | Build the market stall (40 wood), then the cabin |
| Walk to the stall | Sell inventory for ducketts |

## Systems

- **Inventory** — 24 slots, unlimited stack size. Everything gathered (crops, wood,
  darkwood, trophies) is an item.
- **Ducketts** — currency, earned by selling at the market stall.
- **Trees** — a quarter of every world tile carries one. Three chops fells it for
  wood; it grows back two days later unless you've worked the ground.
- **Plants** — every crop takes exactly two days to grow, watered.

## Layout

- `src/sim/` — pure game logic (no Three/React)
- `src/game/` — WorldRenderer, Assets, Input, GameRuntime
- `src/ui/` — React HUD
- `public/models/` — drop `.glb` files; missing → primitive fallbacks

## Design docs

**New here? Read [`HANDOFF.md`](HANDOFF.md) first — it is the current truth.**

| Doc | What |
|---|---|
| **[`HANDOFF.md`](HANDOFF.md)** | **Current state, asset pipeline gotchas, next tasks** |
| [`ASSETS.md`](ASSETS.md) | The Quaternius asset plan — which packs, where files live, the manifest system, order of work |
| [`IDEAS.md`](IDEAS.md) | The 78-entry idea sheet, triaged into build-now / later / defer / against, with implementation notes and a suggested order |
| [`masterplans/`](masterplans/) | Full design history. `masterplan.md` is the whole game; `masterplan_alpha_v4.md` is the current build spec |
| [`docs/AI_3D_ASSETS.md`](docs/AI_3D_ASSETS.md) | Getting 3D models for free — download → primitives → AI-generate |
| [`CLAUDE.md`](CLAUDE.md) | Conventions our AI agents follow |

**Design authority:** highest-numbered masterplan wins.

> `public/basis/` holds the KTX2 transcoder. **Do not remove it** — the KayKit models
> declare `EXT_meshopt_compression`, `KHR_mesh_quantization` and `KHR_texture_basisu`,
> and a bare `GLTFLoader` throws on all three and silently falls back to primitives.
