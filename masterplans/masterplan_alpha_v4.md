# TARNATION — Masterplan ALPHA v4 (Draft 0.4 — "A Playable World")

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


**Thesis:** *it should feel like a playable world, not a pre-alpha with missing textures.*

Every requirement below serves that sentence. Target feel: **RuneScape Dragonwilds** (open survival
world, resource gathering, terrain that matters) rendered in **Gloamreach/Diablo** style (fixed
isometric camera, dark low-poly atmosphere, expensive HUD).

**Builds on:** `masterplan_alpha_v3.md`. The §2 look recipe — camera, tone mapping, light rig,
materials — is unchanged and still authoritative. This document expands the world and the systems.

> **⚠️ This is no longer a one-shot.** v4 is roughly 4× the scope of v3. It is specified as
> **four sequential passes**. Build Pass 1, run it, look at it, then continue. Attempting all four
> in one generation will produce a broken build.

---

## 0. What Gloamreach actually does — three reusable findings

| Finding | Consequence for Tarnation |
|---|---|
| Only 9 `.glb` files exist, all characters. **Every tree, rock and crystal is procedural geometry.** | Build the whole environment in code with the same primitive vocabulary. No asset packs needed, and it will match automatically. |
| Geometry vocabulary: `Box` ×74, `Cylinder` ×47, `Torus` ×41, `Octahedron` ×33, `Cone` ×31, `Ring` ×17, `Dodecahedron` ×14, `Icosahedron` ×9 | This *is* the art style. Faceted low-poly primitives, one shared material. |
| 281 `.ogg` + 36 `.mp3` instrument samples driving a chord-progression scheduler in `AudioSystem.ts` | The whole procedural music system is reusable. Pass 4. |

**The material helper — every object in the world uses it:**

```ts
function standardMaterial(color: number, opts?: Partial<THREE.MeshStandardMaterialParameters>) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.04, ...opts })
}
```

Consistency comes from every mesh sharing that material profile. Do not hand-tune per object.

---

## 1. PASS 1 — The world

### 1.1 Scale

| | v3 | **v4** |
|---|---|---|
| World | 24×24 tiles | **240×240 world units** |
| Farm plot | the whole world | **48×48 sub-region** around the homestead |
| Rest of the world | — | open terrain: plains, river, lake, treeline, woods |

**Not every tile is a farm tile.** This is the key architectural change. The world is continuous
terrain; only the 48×48 plot around your homestead is tillable. Everything outside it is
landscape you walk through, gather from, and hunt in.

### 1.2 Terrain

- **Ground:** one `PlaneGeometry(240, 240, 240, 240)` rotated flat, **vertex-coloured**, with
  gentle height displacement from layered seeded noise (amplitude ±1.2 units). Rolling, not flat.
- **Vertex colours** blend 3–4 greens by height and noise so the ground is never a single flat
  colour. This alone removes most of the "missing texture" feeling.
- `receiveShadow = true`, `flatShading: true` on the material for the faceted low-poly read.

### 1.3 Chunked scatter — this is what makes it feel inhabited

Divide the world into **16×16-unit chunks** (15×15 = 225 chunks). Each chunk builds its own
`InstancedMesh` per prop type, seeded from its chunk coordinate so it's deterministic.

Only chunks within **4 chunks of the player** are in the scene. Add and remove on crossing a
chunk boundary.

**Density targets per 16×16 chunk** — err high; sparseness reads as unfinished:

| Prop | Geometry | Count | Notes |
|---|---|---|---|
| Grass tufts | 3 thin `BoxGeometry` blades | 40–70 | Random yaw, scale ±25% |
| Pebbles | `OctahedronGeometry(0.1–0.18, 0)` | 12–20 | |
| Boulders | `DodecahedronGeometry(0.4–0.9, 0)` | 1–3 | Cast shadows |
| Bushes | 2–3 clustered `IcosahedronGeometry(0.35, 0)` | 4–8 | |
| Flowers | thin cylinder + tiny octahedron | 8–15 | 2 accent colours |
| Trees | `ConeGeometry` canopy ×2 stacked + `CylinderGeometry` trunk | 0–6 | **Cluster them.** See below. |

**Trees must clump, never grid.** Use noise thresholding: sample a low-frequency noise field per
candidate position and only place a tree above a threshold. That produces groves and clearings,
which is what makes terrain look authored rather than randomised.

### 1.4 The river

A real meandering river, not a straight channel.

1. Build a **`CatmullRomCurve3`** from ~10 control points crossing the map edge-to-lake.
2. **Meander it:** offset each control point perpendicular to the flow by layered noise so it
   snakes. Vary width 3–7 units along its length.
3. **Carve the terrain:** for every ground vertex within `width * 1.6` of the curve, lower it by a
   smoothstep falloff. Banks emerge for free.
4. **River mesh:** extrude a ribbon along the curve (`TubeGeometry` flattened, or a custom
   `BufferGeometry` from the curve's frames) and sit it slightly below bank level.
5. **Flow animation:** scroll the water material's `map`/`normalMap` offset along U each frame,
   proportional to a `flowSpeed` constant. Even with no texture, animating a subtle vertex
   displacement sine along the curve reads convincingly as current.
6. **Bank dressing:** scatter `OctahedronGeometry` stones and reeds (thin cones) along both banks
   at higher density than the open plains.

**Water material:**

```ts
new THREE.MeshStandardMaterial({
  color: 0x2E6E72, roughness: 0.18, metalness: 0.32,
  transparent: true, opacity: 0.86,
})
```

### 1.5 The lake

A wide basin the river feeds into. Carve a smooth depression (radius ~22 units), fill with the
same water material as a `CircleGeometry` with an irregular noise-perturbed rim. Denser reeds and
stones on the shore. This is the visual anchor of the map — put it somewhere you can see from the
homestead.

### 1.6 Water collection

Walk within 1.5 units of any river or lake surface with an empty bucket → prompt → fill. This is
tier 1 of the irrigation progression in §4.4.

### 1.7 No black edges — the horizon

The world must never end in void. Four layers, cheapest first:

1. **Sky:** a large inverted `SphereGeometry` with a vertical gradient (vertex colours, `BackSide`,
   unlit `MeshBasicMaterial`). Warm pale horizon → deeper blue-teal above. Never a flat clear colour.
2. **Distant treeline:** a ring of instanced `ConeGeometry` at radius 150–200, scaled large,
   heavily fog-tinted. Non-interactive.
3. **Distant hills:** 8–14 large low-poly `ConeGeometry` / `IcosahedronGeometry` silhouettes at
   radius 200–280, desaturated toward the fog colour.
4. **Fog does the blending:** `FogExp2` tuned so distant geometry fades into the sky rather than
   ending at a hard line. Farm daytime density ~**0.012**; the woods keep v3's **0.036**.

Raise the camera `far` plane to **400**.

**Acceptance:** rotate/pan anywhere and you never see the edge of the world or a black void.

---

## 2. PASS 2 — Making it read as a world

### 2.1 Hide the grid

The lattice in v3 was a mechanic leaking into the visuals.

- Farm tiles become **flush**: `BoxGeometry(1.0, 0.06, 1.0)` on 1.0 spacing. No gaps, no lattice.
- Tile *state* is communicated by **colour and height**, not by lines. Tilled sits 0.02 lower with
  furrow ridges; watered is markedly darker.
- **Grid affordance is contextual only.** When a tool is equipped, fade in a soft emissive outline
  on the hovered tile plus a gentle glow on the 8 neighbours. Fade out when the tool is stowed.
- Never show a persistent grid overlay.

### 2.2 Models — use Gloamreach's own

Copy from `~/Documents/Codex/2026-07-25/i/public/assets/characters/kaykit/`:

| Role | File | Treatment |
|---|---|---|
| **Player** | `thorn-ranger.glb` | As-is. Play its own idle/walk clips via `AnimationMixer`. |
| **Weasel** | `skeleton-minion.glb` | Scale to ~0.45, pitch forward ~25° so it runs low to the ground, override material to `0x8B5E3C` brown. Reads as scurrying vermin. |
| **The Woodsman** | `skeleton-warrior.glb` | Override every material to unlit pure black `0x000000`, `fog: false`. A silhouette with a real walk cycle. |
| **Plains animals** | `gloam-barbarian.glb`, `gloam-rogue.glb` | Scaled, recoloured, wandering. Placeholders. |

These are placeholders the user will swap. Load every model through a keyed cache with a
**primitive fallback** so a missing file never breaks the build.

### 2.3 The "not pre-alpha" checklist

This is the thesis, made testable. All must be true:

- [ ] Ground is never a single flat colour anywhere — vertex-coloured and noise-varied
- [ ] Every prop and actor casts and receives shadows
- [ ] Scatter density is high enough that no 16×16 chunk looks empty
- [ ] Trees form groves and clearings, never an even grid
- [ ] There is a visible sky, and a horizon with distance behind it
- [ ] Water visibly moves
- [ ] The player model is a real rigged character playing real animation clips
- [ ] Ambient motes drift constantly in the air on the farm
- [ ] Nothing is a bare untextured primitive sitting on flat ground

---

## 3. PASS 3 — Systems from `masterplan.md`

Scope call, stated plainly: **first tier of every pillar**, not the full masterplan. Adding all of
it at full depth would be another 3× and would not survive a build pass. What's here makes the game
feel like a real game rather than a loop demo.

### 3.1 Crops — 5 types

| Crop | Grow (s) | Water need | Notes |
|---|---|---|---|
| Grass | 40 | low | Tier 0. Maintains Tidiness. |
| Dandelion | 55 | low | First real crop |
| Turnip | 100 | med | |
| Carrot | 130 | med | |
| Onion | 160 | high | Highest value |

### 3.2 Crossbreeding — the signature mechanic, include it

Each seed carries five traits `0–100`: **Yield, Vigor, Thirst, Hardiness, Weirdness.**

Plant two parents adjacent in a **Breeding Bed** → hybrid seed at harvest:

```ts
child.trait = lerp(a.trait, b.trait, rng(0.35, 0.65)) + mutation()  // ±0..15, scaled by parent Weirdness
child.weirdness += 5 + (differentSpecies ? 12 : 0)
```

| Weirdness | Result |
|---|---|
| 0–24 | Normal, traits blended |
| 25–49 | Cosmetic oddity — wrong colour, wrong scale |
| 50–74 | True hybrid: new name, new mechanical property |
| 75–100 | Absurd: **Carrot Corn, Onionion, Screaming Cabbage** |

Every hybrid needs a mechanical identity, not just a funny name:

| Hybrid | Property |
|---|---|
| Screaming Cabbage | Repels weasels in a 3-unit radius |
| Glowshroom Gourd | Portable light — the only renewable woods light |
| Ironroot Turnip | Cannot be dug up by burrowers |
| Rubber Corn | As ammo: ricochets ×3 |
| Carrot Corn | High yield, low hardiness — the greed crop |

Discoveries go in a **Seed Codex** panel with lineage.

### 3.3 Weasels — 4 types

| Type | Behaviour |
|---|---|
| **Diggler** | Burrows up, eats one crop, leaves |
| **Nibbler** | Fast; one bite from many crops rather than eating one |
| **Sapper** | Ignores crops, chews fences and trench walls |
| **Hauler** | Steals a whole plant and runs for the treeline — **chase it** |

All burrow with a 1.2s vulnerable tell. Wave size scales with day, planted crop value, and total
Weirdness planted — **the player's own greed sets the difficulty.**

### 3.4 Irrigation — 3 tiers, and now it uses the river

| Tier | Method | Unlock |
|---|---|---|
| 1 | **Bucket** — carry 2, walk to river or lake | start |
| 2 | **Trench** — dig with the shovel; water flows **downhill along real terrain height** | shovel |
| 3 | **Aqueduct** — buildable gravity-fed stone segments | stone + Cabin |

Trenches using genuine terrain height is why §1.2's displacement matters — farm layout becomes a
spatial puzzle.

### 3.5 Homestead — 3 tiers

Lean-To (start) → Shack (40 wood) → Cabin (30 darkwood). Each raises storage, bag size, and night
defence, and visibly changes the building.

### 3.6 Weapons — 3 tiers

Slingshot (start) → Bow (silent — matters in the woods) → Blunderbuss (wide spread, slow reload,
occasionally backfires). Top-down mouse aiming. **No Hunt Mode camera** — deferred.

**Crops as ammo:** Rubber Corn ricochets, Screaming Cabbage scatters, Ironroot pierces. This is the
keystone that makes farming and combat one system.

### 3.7 The Dark Woods — 3 depths

| Depth | Yields | Threat |
|---|---|---|
| Fringe | Common wood, mushrooms | Ambient only. Always safe. |
| Thickets | Darkwood, glowcaps | Woodsman may appear at distance |
| Deepwood | Blackheart timber, rare seeds | Woodsman hunts |

**Attention** `0–100`, hidden, surfaced only through audio and sighting. Rises with time, trees
felled, depth, and noise (gunshots loud, bow silent). Decays when still or when you leave, but the
floor rises permanently with total trees felled — **over-logging is a one-way difficulty dial the
player controls.**

**Woodsman:** speed lerps `150 → 210` by `bag.length / bag.capacity`. Faster than you with a full
bag. `Q` dumps the bag. Death drops the bag where you fell; recoverable for one day.

### 3.8 Mushroom traps

Place a Dreamcap in a trap. A weasel that trips does one of 15+ behaviours: backflips, chases its
tail, high-fives another weasel, attacks other weasels, walks in a straight line off the map. This
is the game's most shareable system and it is pure state-machine code — no new art.

### 3.9 Hunting and trophies

Animals wander the plains. Non-lethal on the farm side: they get comically dazed, drop a trophy,
shake it off, wander away. Trophies mount on the Cabin wall.

**In the woods, things die.** The farm's cartoon rules do not apply past the treeline.

---

## 4. PASS 4 — Audio

Port Gloamreach's `AudioSystem.ts` + `AudioSampleBank.ts` and copy
`public/assets/audio/instruments/`. It schedules chord progressions across bass/bed/pulse/lead
layers from sampled instruments — a full generative score for free.

Farm: warm progression, tuba and pizzicato strings.
**Woods: the scheduler stops. Hard cut, no fade.** That silence is the single most important audio
decision in the game.

---

## 5. Still deferred

Donkeys and carts, the elephant, seasons and weather, homestead tiers 4–5, weapon tiers 4–5,
weasel types 5–6 and the Duke, Hunt Mode camera, the Dreamcap first-person trip sequence, the
Hollow, endings, economy and merchant, multiplayer, Electron, Steam.

---

## 6. Build order

**Four passes. Run and look at the game between each.**

| Pass | Contents | Gate before continuing |
|---|---|---|
| **1** | World: 240×240 terrain, chunked scatter, river, lake, sky, horizon, fog | Walk around an empty world and it already looks like a real place |
| **2** | Grid hidden, real models, shadows, motes, the §2.3 checklist | It stops looking pre-alpha |
| **3** | All §3 systems | It's a game |
| **4** | Procedural audio | It's atmospheric |

Within Pass 1, get terrain + sky + horizon working before the river. The river is the fiddliest
piece and should not block everything behind it.

---

## 7. Acceptance checklist

**World**
- [ ] 240×240 world; only the 48×48 plot is tillable
- [ ] Terrain has visible height variation and vertex-colour variation
- [ ] Chunks stream in and out; no hitch when crossing a boundary
- [ ] No chunk within view ever looks empty
- [ ] Trees form groves and clearings
- [ ] River meanders, has carved banks, and visibly flows
- [ ] Lake is visible from the homestead; river feeds it
- [ ] Bucket fills from river or lake
- [ ] Sky gradient, distant treeline, and hills are all present
- [ ] **No black void at any camera position**
- [ ] 60fps at full scatter density

**Look**
- [ ] No visible grid unless a tool is equipped and a tile is hovered
- [ ] Player is `thorn-ranger.glb` playing its own animation clips
- [ ] Weasels are scaled recoloured `skeleton-minion.glb`
- [ ] Woodsman is an all-black `skeleton-warrior.glb`
- [ ] Every §2.3 box ticked
- [ ] v3's camera, tone mapping and light rig constants unchanged

**Systems**
- [ ] 5 crops; breeding bed produces hybrids; Weirdness thresholds fire; Codex records them
- [ ] 4 weasel types with distinct behaviour
- [ ] 3 irrigation tiers; trenches follow real terrain height
- [ ] 3 homestead tiers, 3 weapon tiers, crops usable as ammo
- [ ] 3 woods depths, Attention rises and decays, Woodsman outruns a full bag, `Q` dumps
- [ ] Mushroom traps produce 15+ distinct weasel behaviours
- [ ] Animals wander, drop trophies, mount on the wall

**Always**
- [ ] `src/sim/` imports no renderer code
- [ ] Zero network requests after load
- [ ] Game runs with `public/models/` empty (primitive fallbacks)

---

*Masterplan ALPHA v4 — Marshmallow Muskrat. Extends v3's look recipe to a full world.*
