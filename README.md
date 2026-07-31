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
| LMB | Till / plant / water / harvest / chop |
| RMB / Space | Slingshot |
| North treeline (day) | Enter woods |
| South woods edge | Exit & bank wood |
| Q | Dump bag (woods) |
| Walk to house | Build shed (10 wood) |

## Layout

- `src/sim/` — pure game logic (no Three/React)
- `src/game/` — WorldRenderer, Assets, Input, GameRuntime
- `src/ui/` — React HUD
- `public/models/` — drop `.glb` files; missing → primitive fallbacks
