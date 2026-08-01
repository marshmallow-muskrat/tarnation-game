# TARNATION — Masterplan ALPHA v2 (Draft 0.2 — "Make It Look Like A Game")

> ## ⚠️ HISTORICAL — not build instruction
>
> This document predates the current design. It is kept for its systems thinking, which is
> still useful, but **do not build from it**. Two things in it are dead:
>
> 1. **The Dark Woods, the Woodsman, the Attention meter, the bag-drop stake, and the "no jokes
>    past the treeline" tonal contract** — all removed. Replaced by multiple maps of varying
>    difficulty with triggered secret zones and boss/challenge/treasure zones.
> 2. **Phaser, Electron, Steam SDK, the `packages/` layout** — the stack is Three.js + React +
>    Vite on Cloudflare Pages.
>
> **Current design authority: [`../CLAUDE.md`](../CLAUDE.md), [`../ASSETS.md`](../ASSETS.md),
> [`../IDEAS.md`](../IDEAS.md).**


**This is a modification spec for an existing codebase**, not a rebuild. Draft 0 works
mechanically — tilling, growth, the day clock, weasels, the woods, the bag stake all function.
Do not rewrite them. This document fixes how it *looks* and *reads*.

**Live build being fixed:** https://tarnation.pages.dev

---

## 0. Honest diagnosis

Draft 0 has four rendering **bugs** and one **design gap**. Two of the bugs came from wrong numbers
in Masterplan Alpha v1. Fix the bugs before touching art — no amount of art fixes a broken viewport.

| # | Problem | Cause |
|---|---|---|
| 1 | Big empty light-green region on the right | World is 640×640 (`GRID 20×20 × TILE 32`) inside a 1280×720 camera. **Wrong numbers in v1.** |
| 2 | Canvas sits in the corner, doesn't fill the browser | No Phaser `Scale` mode set |
| 3 | Treeline renders on top of the HUD bar | Depth ordering — world objects above the HUD scene |
| 4 | Farm is one flat green void; you can't see tiles | **v1 never required tiles to be legible.** Nothing indicates where the grid is. |
| 5 | Everything is a flat untextured shape with no shadow | The design gap — see §2 |

**The core lesson for §2:** "programmer art" was the right call, but programmer art still needs
*structure* — grid legibility, shadows, depth sorting, and value contrast. Draft 0 has none of
those, which is why it reads as 1970s Pong rather than as an honest grey-box.

---

## 1. PHASE A — Bug fixes (do these first, they're cheap)

### A1. World must be larger than the viewport

Change in `src/content.ts`:

```ts
export const TILE = 64;        // was 32 — bigger tiles read better and give art room
export const GRID_W = 24;      // was 20
export const GRID_H = 24;      // was 20
// world is now 1536x1536, comfortably larger than the 1280x720 camera
```

Set camera bounds to the world size and clamp the player to them. There must be **no visible area
outside the world.** If the camera can see past the edge, the bounds are wrong.

### A2. Canvas fills the browser

```ts
scale: {
  mode: Phaser.Scale.FIT,
  autoCenter: Phaser.Scale.CENTER_BOTH,
  width: 1280,
  height: 720,
}
```

Design resolution stays 1280×720; FIT scales it to any window and letterboxes. Set the page
background to near-black so letterbox bars look deliberate.

### A3. Fix depth ordering

- HUD is a separate scene launched with `this.scene.launch()`. Bring it to the top explicitly:
  `this.scene.bringToTop('HudScene')`.
- Inside the world scene, give everything an explicit depth band:

```ts
export const DEPTH = {
  ground:   0,     // tiles
  scatter:  10,    // pebbles, tufts, flowers
  shadow:   20,    // all drop shadows
  actors:   30,    // ★ y-sorted: sprite.setDepth(DEPTH.actors + sprite.y * 0.001)
  overhead: 900,   // tree canopies the player can walk behind
  weather:  950,   // vignette, day/night tint
};
```

### A4. Y-sorting

Every actor and prop sets `depth = DEPTH.actors + y * 0.001` each frame. The player then walks
*behind* trees and the house when above them, *in front* when below. This single change is the
difference between "flat top-down" and "a world with depth."

---

## 2. PHASE B — Visual structure (still zero asset files, enormous payoff)

**Do all of Phase B before generating a single image.** Every item is code, costs nothing, and
matters more than the art that lands on top of it. A game with good structure and placeholder art
looks fine. A game with beautiful art and no structure still looks broken.

### B1. Make the tile grid visible

The single highest-impact fix in this document. Right now a player cannot see where tiles are.

- Give each grass tile one of **4 slightly different green values**, chosen by seeded noise on
  `(x, y)`. Vary lightness by only ±4% — subtle, not a checkerboard.
- Draw a **1px edge** on every tile at 8% black. This reads as texture, not as a grid overlay.
- On **hover**, highlight the targeted tile with a bright 2px outline, and tint it red if out of
  `TOOL_RANGE`. The player must always know exactly which tile a click will affect.

### B2. Drop shadows on everything

An ellipse, black at 22% alpha, at the base of every actor and prop — player, weasels, trees,
house, crops, the Stalker. Width ≈ 0.9× sprite width, height ≈ 0.35× width.

Cheapest depth in all of 2D rendering. Do not skip it.

### B3. Tile-state contrast

Tilled and watered soil must be obviously different at a glance:

```ts
grass:        0x6FA84B
tilledLight:  0x8A6440   // sunlit ridges
tilled:       0x6B4A2F
watered:      0x3E2B1B   // much darker — wetness reads as value, not hue
```

Draw tilled tiles as **3 horizontal furrow lines** in `tilledLight` over the base, not a flat fill.
Two lines of code, and it instantly reads as ploughed earth.

Add a darker rim where tilled meets grass so plots have edges.

### B4. Scatter detail

Place ~200 seeded props on grass tiles: grass tufts (3 small lines), pebbles (2px circles),
flowers (3px dots in 2 accent colors). Never on tilled tiles. Randomize scale ±20%.

This is what kills the "flat void" feeling. It costs one loop and a seeded RNG.

### B5. Vignette and day/night grade

- **Vignette:** a radial gradient texture generated once, black at 35% at the corners, scaled to the
  camera, `setScrollFactor(0)`, depth `weather`.
- **Day/night grade:** a full-screen rect, `setScrollFactor(0)`, whose color and alpha lerp with the
  clock:

| Phase | Tint | Alpha |
|---|---|---|
| Dawn | `0xFFB07A` | 0.18 |
| Midday | `0xFFFFFF` | 0.00 |
| Dusk | `0xFF8C42` | 0.22 |
| Night | `0x2A3A6B` | 0.55 |

Lerp continuously across the phase, never snap. This alone makes the world feel alive.

### B6. Character legibility

The player is currently a 12px circle in a vast field. Make actors read:

- Player: **28px** tall, not 12
- Give every actor a **2px dark outline** (draw a slightly larger dark shape behind it)
- Give the player a clear **facing indicator** — a small triangle or an offset "hat" shape
- Weasels get a distinct silhouette from the player: wider than tall, low to the ground

### B7. Idle motion

Nothing static ever looks alive:

- Player and weasels **bob** ±1.5px on a sine wave, ~1.4Hz
- Grass tufts **sway** ±3° out of phase with each other
- Crops **pulse** scale 1.0 → 1.03 slowly
- The house sign / smoke puff drifts

---

## 3. PHASE C — Real assets, the Gloamreach way

Only start this once Phase A and B are done and the game reads clearly.

**The key unlock: you do not need animation to get great-looking assets.**

A **static sprite** with squash/stretch, bob, and rotation tweens reads as fully alive in a
top-down game. Every asset below is a single still image — which is precisely what produced the
Waywarden and Moon Arcanist. That skill transfers directly, today, with no puppet rigging.

Rigging (`docs/ART_PIPELINE.md`) is for later, when you want real walk cycles. Skip it for now.

### C1. The asset list — 18 images, all static

| # | Asset | Size | Notes |
|---|---|---|---|
| 1–4 | Grass tile ×4 variants | 64×64 | **Must tile seamlessly.** Generate one, hand-fix edges, derive variants by hue-shifting ±3% |
| 5 | Tilled soil tile | 64×64 | Visible furrows |
| 6 | Watered soil tile | 64×64 | Same furrows, much darker, slight sheen |
| 7–9 | Turnip stages 1–3 | 64×64 | Generate stage 3, derive 1–2 by scaling + cropping |
| 10 | Tree (farm/treeline) | 96×128 | Canopy separable from trunk for the overhead depth band |
| 11 | Tree (woods) | 96×128 | Desaturated, bare, wrong |
| 12 | House tier 1 | 128×128 | |
| 13 | House tier 2 (Shed) | 160×160 | Visibly bigger |
| 14 | Player | 48×48 | Top-down 3/4, strong silhouette, big hat |
| 15 | Weasel | 48×32 | Low, wide, cartoon menace |
| 16 | Stalker | 64×96 | **Featureless black silhouette.** Easiest asset, and the scariest. |
| 17 | Scatter pack | 32×32 ×6 | Tufts, pebbles, flowers, on one sheet |
| 18 | Lantern glow | 256×256 | Radial gradient, warm |

Export as **`.webp`** — same as Gloamreach. Put them in `public/art/` and load in a `Preload` scene.

### C2. The style bible

Create `docs/STYLE_BIBLE.md` and generate **everything** through it. No freelancing prompts —
consistency comes from a fixed template, not from luck.

Starting template:

```
1940s American cartoon style, rubber-hose animation aesthetic, hand-painted
gouache texture, bold black outlines of even weight, warm saturated palette,
soft ambient occlusion, key light from upper left, flat top-down 3/4 game
asset, centered on transparent background, no text, no border, no shadow
```

Negative: `photorealistic, 3d render, harsh contrast, text, watermark, drop shadow, perspective`

**Rules that produce consistency:**
- One fixed lighting direction — upper left — on every single asset, forever
- Generate **one reference image first**, love it, then feed it as a reference/style anchor to
  every subsequent generation
- Generate at 1024px and downscale to target. Downscaling hides the artifacts; ~94% of the pixels
  you discard are where the AI weirdness lives
- Design for **silhouette** — at 48px only shape and color blocking read, not detail

### C3. The two consistency enforcers

Add `scripts/process-art.mjs` using `sharp` (free), run as `npm run art`:

1. **Palette clamp** — quantize every asset to one fixed 48-color palette. The single highest-
   leverage consistency trick that exists. Mismatched art becomes unified art.
2. **Outline pass** — enforce one outline weight and color on every asset.

Raw generation in → game-ready asset out. Never hand-edit the outputs.

### C4. Seamless tiles

The one genuinely fiddly part. Generate a large texture (1024×1024), take a 64×64 crop from the
centre, then fix the seam by offsetting the image 50% in both axes and painting out the visible
cross in Photopea. Ten minutes per tile, and only 3 tiles need it.

---

## 4. PHASE D — Feel pass

Draft 0 shipped without most of this. It is not optional polish; it is the difference between a
prototype and something worth iterating on.

1. **Squash and stretch.** Player squashes on direction change (`scaleY 0.9 / scaleX 1.1`, 110ms,
   yoyo). Weasels stretch when lunging, flatten and spin when killed. Crops pop
   (scale 1.3 → 1.0, `Back.easeOut`) on maturing.
2. **Screen shake.** `camera.shake(90, 0.004)` on weasel kill, `(140, 0.008)` on tree fell,
   `(300, 0.02)` on Stalker contact.
3. **Hit pause.** Freeze 60ms on a weasel kill. Two lines, enormous impact.
4. **Particles.** Dirt puff on till, droplets on water, wood chips on chop, dust ring on weasel
   burrow, leaf motes drifting constantly on the farm.
5. **Everything tweens.** No value snaps — lantern radius, day/night grade, camera, HUD numbers.
6. **Camera lead.** Offset the camera ~40px in the direction of movement, smoothed. Makes the
   world feel bigger than the screen.

---

## 5. The woods must survive all of this

The contrast is the entire game. When you add art and grading, the woods must get *further* from
the farm, not closer.

| | Farm | Woods |
|---|---|---|
| Palette | Full 48-color, warm, saturated | **8 values, cold, near-monochrome** |
| Scatter detail | Dense — tufts, flowers, pebbles | Sparse. Bare ground. |
| Vignette | 35% | **70%** |
| Grade | Warm | Cold desaturate, `0x1B2220` |
| Idle motion | Everything bobs and sways | **Nothing moves that isn't alive** |
| Audio | Arpeggio loop | **Hard silence** |
| Camera lead | 40px, snappy | 0px, and lerp 0.04 so it lags behind you |

That last row is free and deeply unsettling. Do not skip it.

---

## 6. Order of work

Phases are strictly sequential. Do not start C before B is done.

| Phase | Effort | Payoff |
|---|---|---|
| **A — bug fixes** | ~1 hour | Stops it looking *broken* |
| **B — visual structure** | ~3–4 hours | **Biggest single jump in the whole plan.** Still zero assets. |
| **C — real assets** | ~6–10 hours | Gloamreach-quality look |
| **D — feel pass** | ~2–3 hours | Makes it fun to touch |

**After Phase B, stop and look at it.** It will be dramatically better with no art at all, and it
will tell you exactly what the art actually needs to do.

---

## 7. Acceptance checklist

**Phase A**
- [ ] No visible area outside the world at any window size
- [ ] Canvas fills the browser window, letterboxed cleanly, at 1280×720 and at 2560×1440
- [ ] HUD is always on top; nothing renders over it
- [ ] Player walks behind trees above them and in front of trees below them

**Phase B**
- [ ] Individual tiles are visible on plain grass without tilling anything
- [ ] Hovered tile is highlighted; out-of-range shows red
- [ ] Every actor and prop casts a drop shadow
- [ ] Tilled and watered soil are unmistakable at a glance
- [ ] The farm has visible scatter detail; it does not read as a flat void
- [ ] Day/night grade transitions smoothly and is obvious at dawn, dusk, and night
- [ ] Player is ~28px, outlined, with a clear facing direction
- [ ] Nothing on screen is perfectly static

**Phase C**
- [ ] All 18 assets present, `.webp`, loaded through a Preload scene
- [ ] Ground tiles repeat with no visible seams
- [ ] `npm run art` runs the palette clamp and outline pass
- [ ] `docs/STYLE_BIBLE.md` exists and every asset went through it

**Phase D**
- [ ] Killing a weasel has shake, hit-pause, particles, and a squash animation
- [ ] Camera leads movement
- [ ] The woods feel *worse* than before, not prettier

**Overall**
- [ ] 60fps with 8 weasels, full particles, and all art loaded
- [ ] Still zero network requests after load
- [ ] `grep -r phaser src/sim/` returns nothing

---

## 8. What is still not in scope

Unchanged from v1. Do not build: genetics, more than one crop, more than one weasel type, guns
beyond the slingshot, Hunt Mode, animals, trophies, irrigation tiers, homestead tiers past the
Shed, seasons, economy, dialogue, settings menus, Electron.

**This document is about making Draft 0 look like a game. It adds no gameplay.**

---

*Masterplan ALPHA v2 — Marshmallow Muskrat. Modifies Draft 0. Supersedes the visual sections of
`masterplan_alpha.md`.*
