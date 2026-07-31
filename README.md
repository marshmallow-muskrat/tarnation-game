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
