# TARNATION — Masterplan ALPHA v3 (Draft 0.3 — "The Gloamreach Engine")

**This replaces the renderer, not the game.** Draft 0.2's Phaser 2D look is abandoned. Tarnation
becomes a 3D isometric game using the exact rendering recipe from Gloamreach.

**Source of truth:** the Gloamreach codebase at `~/Documents/Codex/2026-07-25/i/`.
The renderer is `src/game/WorldRenderer.ts`. Every constant below was read out of it.

---

## 0. Two discoveries that drive this document

### The characters were never AI art

`~/Documents/Codex/2026-07-25/i/public/assets/characters/kaykit/` contains
`waywarden.glb`, `thorn-ranger.glb`, `moon-arcanist.glb`, and six more.

They are **KayKit** models — free, low-poly, pre-rigged, pre-animated 3D character assets by Kay
Lousberg. They look great because a professional artist made a coherent set, and because
Gloamreach lights them well.

This means **the art problem is already solved and always was.** No AI generation, no cutout
puppet rigging, no palette clamping, no style bible, no consistency battle. Download a coherent
CC0 pack, light it with the rig in §2, done. `docs/ART_PIPELINE.md` was written on the wrong
assumption and is superseded for 3D work.

### The sim layer ports for free

`~/tarnation/src/sim/` is 616 lines of pure TypeScript — clock, farm grid, crop growth, raid
generation, seeded RNG, save serialization — with zero Phaser imports.

**Copy that directory across unchanged.** The renderer is what's being replaced.

---

## 1. Stack

| | v1/v2 (dead) | **v3** |
|---|---|---|
| Renderer | Phaser 3, 2D | **Three.js ^0.185** |
| UI | Phaser scenes | **React 19 + CSS**, DOM overlay |
| Build | Vite | Vite |
| Deploy | Cloudflare Pages | Cloudflare Pages |
| Assets | none | **CC0 low-poly `.glb`** |

Dependencies: `three`, `react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`,
`wrangler`, `@types/three`. Nothing else.

**Do not use Next.js.** Gloamreach uses it for SSR and accounts; Tarnation needs neither. Plain
Vite + React is the same look with a fraction of the machinery.

```
src/
├── main.tsx           React root
├── App.tsx            HUD overlay + canvas mount
├── ui/                HUD components
├── game/
│   ├── WorldRenderer.ts    Three.js scene (see §2)
│   ├── Assets.ts           GLTF loading + caching
│   ├── InputController.ts  keyboard/mouse
│   └── GameRuntime.ts      ties sim to renderer, owns the loop
├── sim/               ★ COPIED VERBATIM from ~/tarnation/src/sim/
└── styles.css         (see §4)
```

---

## 2. The look recipe — copy these numbers exactly

Read directly out of `WorldRenderer.ts`. These constants *are* the Gloamreach look. Do not
improvise, do not "improve" them.

### Camera — orthographic, this is what makes it isometric

```ts
const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 80)
const cameraOffset = new THREE.Vector3(10.5, 12.5, 10.5)

// every frame:
camera.position.copy(cameraTarget).add(cameraOffset).add(shakeOffset)
camera.lookAt(cameraTarget)
// zoom is eased, never snapped:
camera.zoom = THREE.MathUtils.lerp(camera.zoom, targetZoom, 1 - Math.exp(-delta * 4.2))
camera.updateProjectionMatrix()
```

Orthographic + that offset is the entire isometric feel. A PerspectiveCamera will look wrong.

### Renderer

```ts
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.shadowMap.autoUpdate = false      // perf: set needsUpdate = true only when the scene changes
renderer.shadowMap.needsUpdate = true
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.1
```

ACES filmic tone mapping is doing a lot of the "this looks like a real game" work. Keep it.

### Lighting rig — four lights, no more

```ts
const hemisphere = new THREE.HemisphereLight(0x8fb9b0, 0x0b1211, 1.2)
const key       = new THREE.DirectionalLight(0xbcd6d4, 1.95)   // casts shadows
const rim       = new THREE.DirectionalLight(0x5d86bd, 0.8)    // cool back-fill
const heroLight = new THREE.PointLight(0xffc98c, 8.4, 7.4, 2)  // FOLLOWS THE PLAYER
```

**The hero light is not optional.** A warm point light tracking the player against a cool scene is
why the character always reads clearly. It is the single highest-value light in the rig.

### Fog

```ts
scene.fog = new THREE.FogExp2(fogColor, 0.036)
// lerp fog colour on zone change, never snap:
scene.fog.color.lerp(target, speed)
```

### The floor — this is the diamond lattice

```ts
const tileGeometry = new THREE.BoxGeometry(0.94, 0.08, 0.94)   // 0.94 in a 1.0 grid = the gaps
const tileMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.94 })
const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, cols * rows)
// per tile:
color.copy(COLORS.floorA).lerp(COLORS.floorB, variation)   // variation = seeded noise 0..1
tiles.setColorAt(index, color)
tiles.receiveShadow = true
```

The grid pattern is not a texture and not a shader. It is **instanced boxes 0.94 wide on a 1.0
spacing**, so the gaps between them read as lattice lines. One instanced mesh, one draw call, any
grid size. This is also exactly how the farm's tillable tiles should work — a tile's colour is its
state.

Also add an undercroft plane beneath everything:
`new THREE.Mesh(new THREE.PlaneGeometry(w + 8, d + 8), material(0x0c1412, { roughness: 1 }))`

---

## 3. Palettes — and the free gift hiding in them

Gloamreach's palette:

```ts
fog: 0x07110f, floorA: 0x18231f, floorB: 0x26322d, stone: 0x29322f,
stoneDark: 0x151d1b, teal: 0x8dd8c7, tealDeep: 0x2f746a, amber: 0xf0a24c,
moon: 0xd8f6ee, crimson: 0xd85d4c
```

**That palette is the Dark Woods.** Cold, desaturated, near-monochrome, teal-lit — it is already
precisely the horror half of Tarnation's contrast table. Use it unchanged.

The farm is the **warm inversion of the same rig**: identical camera, identical materials,
identical shadow setup, different colours and light temperatures.

```ts
// FARM (day)
fog:    0xBFD9A8   // FogExp2 density 0.012 — much thinner than the woods
floorA: 0x5E8C3A, floorB: 0x74A64A          // grass, two-tone
tilled: 0x6B4A2F, tilledLight: 0x8A6440
watered:0x3E2B1B
hemisphere: new THREE.HemisphereLight(0xBFE0FF, 0x4A6B33, 1.1)
key:        new THREE.DirectionalLight(0xFFF2D0, 2.2)
rim:        new THREE.DirectionalLight(0x8FB0D8, 0.5)
heroLight:  new THREE.PointLight(0xffc98c, 3.0, 6.0, 2)   // dimmer by day

// WOODS — Gloamreach's values verbatim, plus:
heroLight:  new THREE.PointLight(0xffc98c, 8.4, 7.4, 2)   // this is now the LANTERN
```

**The lantern is the hero light.** Shrink its `distance` as fuel drains — 7.4 → 2.5 — and the
existing rig delivers the entire horror lighting system for free. No RenderTexture masking, no
hand-rolled 2D lighting. This is what the wrong stack was costing.

Day/night on the farm is a lerp of light colours, intensities, and fog. Never snap.

---

## 4. The HUD — React + CSS, exactly Gloamreach's

The typography is most of why Gloamreach looks expensive. Copy these tokens verbatim from
`~/Documents/Codex/2026-07-25/i/src/styles.css`:

```css
:root {
  color: #e9eee9;
  background: #07110f;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --ink: #eef2ec;
  --muted: #9ba7a0;
  --faint: #64706a;
  --line: rgba(190, 220, 210, 0.18);
  --line-strong: rgba(190, 220, 210, 0.32);
  --teal: #98d8c9;
  --teal-deep: #3e776d;
  --amber: #dfa15d;
  --red: #ba5b4e;
  --panel: rgba(7, 13, 12, 0.84);
  --serif: Iowan Old Style, Baskerville, "Times New Roman", serif;
}
```

**The rules that produce the look:**

- Headings and titles are `var(--serif)`. Labels, numbers and data are Inter.
- Labels are UPPERCASE, ~11px, `letter-spacing: 0.14em`, colour `--faint`.
- Panels: `background: var(--panel)`, `border: 1px solid var(--line)`, `backdrop-filter: blur(8px)`,
  small radius, generous padding.
- Accent colour carries meaning: `--teal` for state, `--amber` for resources, `--red` for danger.
- The HUD floats over the canvas at the screen corners. It never boxes the viewport in.

**Draft 0.3 HUD, four panels only:**

| Position | Content |
|---|---|
| Top left | `TARNATION` (serif) / Day N / phase bar |
| Bottom left | Bag contents, wood banked, lantern fuel bar |
| Bottom centre | Contextual hint line — "LMB till · RMB shoot" |
| Right | Event feed: harvests, kills, wood banked, "You dropped everything" |

Do not build inventory, skills, quests, minimap, or codex. Not in scope.

---

## 5. Assets — free, CC0, and the whole problem solved

All packs below are low-poly, coherent, and free. **Verify each pack's licence before shipping**
— most are CC0, a few are pay-what-you-want.

| Source | Use |
|---|---|
| [KayKit](https://kaylousberg.itch.io) — Kay Lousberg | Characters. **You already own these.** |
| [Quaternius](https://quaternius.com) | Ultimate Nature Pack, **Modular Farm Pack**, Farm Animals, Cute Characters |
| [Kenney](https://kenney.nl/assets?q=3d) | Nature Kit, Survival Kit, Food Kit. All CC0. |

### Draft 0.3 asset list

| Need | Source |
|---|---|
| Player | Copy `thorn-ranger.glb` from Gloamreach. **Zero work, today.** |
| Weasel | Quaternius Farm Animals or Cute Characters — recolour a small quadruped |
| Crop, 3 stages | Quaternius Modular Farm |
| Tree (farm) | Quaternius Ultimate Nature — full, leafy |
| Tree (woods) | Same pack, bare/dead variant, desaturated via material colour |
| House + Shed | Kenney or KayKit medieval building |
| Rocks, tufts, fences | Quaternius Ultimate Nature scatter |
| The Stalker | **A KayKit skeleton with an all-black unlit material.** Free, and scarier. |

Load with `GLTFLoader`, cache by key in `Assets.ts`, clone per instance. Same approach as
`CharacterAssets.ts`.

**Missing model must never break the build.** If a `.glb` fails to load, substitute a coloured
primitive of roughly the right size and log it. Assets drop in incrementally.

---

## 6. Movement and feel

The user specifically wants Gloamreach's movement. Read `src/game/InputController.ts` and
`src/game/locomotion.ts` and match them.

- WASD, camera-relative (W is up-screen, not world +Z — critical with an isometric camera)
- Acceleration and damping, not instant velocity. Never snap to full speed.
- The character model **rotates to face heading**, smoothly slerped
- Play the model's own walk/idle animation clips via `THREE.AnimationMixer`. KayKit rigs ship with
  them — you get real animation free, which is the thing 2D could never give you.
- Camera follows with easing and a slight lead in the direction of travel
- `camera.shake` on impacts, applied as `shakeOffset` on the camera position

---

## 7. Scope — unchanged from v1

Same game, new renderer. Still build only: till → plant → water → harvest, day/night clock,
Diggler weasels at night, slingshot, the woods with lantern + bag + Stalker, one Shed upgrade,
Day 5 win, localStorage save.

Still do **not** build: genetics, more crops, more weasel types, guns beyond the slingshot, Hunt
Mode, animals, trophies, irrigation tiers, homestead tiers past the Shed, seasons, economy,
dialogue, settings menus, multiplayer, Electron.

---

## 8. Build order

| # | Step | Done when |
|---|---|---|
| 1 | Vite + React + Three scaffold. Grey box floor, §2 camera/lights/renderer verbatim. Deploy. | A live URL shows a lit tile grid that already *looks like Gloamreach* |
| 2 | Copy `src/sim/` from `~/tarnation` unchanged. Wire the clock. | Day counter advances |
| 3 | Player: load `thorn-ranger.glb`, WASD, camera follow, walk animation | It feels like Gloamreach to move |
| 4 | Farm tiles: instanced mesh, tile states by colour, hover highlight, till/plant/water/harvest | Full crop loop, crops as `.glb` |
| 5 | HUD in React with §4 tokens | It looks expensive |
| 6 | Weasels + slingshot | Night is a threat |
| 7 | Woods: zone swap, Gloamreach palette, lantern = hero light shrinking, bag, Stalker | The risk loop works |
| 8 | Shed, Day-5 win screen, save/load | Game has an ending |
| 9 | Feel pass: shake, hit-pause, particles, eased everything | Worth iterating on |

**Step 1 is the whole gamble.** If a bare lit grid with those exact constants doesn't already look
like Gloamreach, stop and fix step 1 before writing any gameplay.

---

## 9. Acceptance checklist

- [ ] Orthographic camera at offset `(10.5, 12.5, 10.5)`, eased zoom
- [ ] ACES filmic tone mapping, exposure 1.1, sRGB output
- [ ] All four lights present, including the hero light tracking the player
- [ ] Floor is one `InstancedMesh` of `0.94³`-ish boxes on 1.0 spacing, per-tile colour
- [ ] Shadows on, `PCFShadowMap`, `autoUpdate = false` with explicit `needsUpdate`
- [ ] Exponential fog, colour lerps between zones
- [ ] Player is a real rigged `.glb` playing its own walk/idle clips
- [ ] Movement is camera-relative with acceleration and damping, model slerps to heading
- [ ] HUD uses `--serif` headings, uppercase letter-spaced labels, translucent blurred panels
- [ ] Woods use Gloamreach's palette verbatim and feel like a different game
- [ ] Lantern is the hero light, its `distance` shrinking with fuel
- [ ] Game still runs with every `.glb` missing (primitive fallbacks)
- [ ] `src/sim/` unchanged from the Phaser build, still zero renderer imports
- [ ] 60fps with 8 weasels
- [ ] Zero network requests after load

---

## 10. What this supersedes

- `masterplan_alpha.md` §2 (Phaser stack) — dead. Gameplay spec and tuning constants still stand.
- `masterplan_alpha_v2.md` — entirely dead. It solved 2D problems that no longer exist.
- `docs/ART_PIPELINE.md` — superseded for 3D. Cutout rigging and palette clamping were answers to
  a question that turned out not to apply. Kept for reference only.
- `masterplan.md` §5.6 (hand-rolled 2D lighting) — dead. Three.js lights do it properly.

The full `masterplan.md` design — pillars, tonal contract, the Wilderness model, the bag stake —
is unchanged. Only the renderer moved.

---

*Masterplan ALPHA v3 — Marshmallow Muskrat. Renderer rebuild on the Gloamreach engine.*
