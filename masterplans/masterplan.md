# TARNATION — Masterplan I

> **Working title.** "Tarnation" is a proposal, not a decision. It's a cozy cartoon-Americana
> word that literally means *damnation* — which is the whole game in one word. Alternates:
> **Varmint Season**, **Doggone Hollow**, **Sowbelly**, **Ol' Yonder**.
> Before committing: search Steam, check USPTO TESS, and grab the domain + socials.

| | |
|---|---|
| **Studio** | Marshmallow Muskrat (working) — Shane + partner, 50/50 |
| **Doc version** | I (first masterplan) |
| **Date** | 2026-07-30 |
| **Status** | Design locked at the pillar level. Stage 1 systems specified. Stages 2–3 specified at design level, to be re-specified in Masterplan II and III before build. |
| **Target platform** | Windows `.exe` primary (Steam), macOS + Linux secondary |
| **Target price** | $12.99 |
| **Target scope** | 10–15 hours to credits, meaningfully replayable |
| **Multiplayer** | None. Solo-only. Non-negotiable for v1.0. |

**Decisions already locked (from kickoff):**
1. Stack: TypeScript + Phaser 3 + Electron
2. Art: AI-generated illustration at Gloamreach's Waywarden/Thorn Archer quality bar
3. Dark Woods: RuneScape-Wilderness model — voluntary, high risk / high reward
4. Solo-only

---

## 1. The Pitch

> **A cozy cartoon farming game where the woods next door are sincerely not cartoon.**

You inherit a scrap of land in a 1940s-cartoon world: rubber-hose animation, slide whistles,
a sun with a face. You till, you plant, you crossbreed carrots with corn until you get
something that shouldn't exist. At night, weasels burrow up and rob you blind, and you fight
them off with a slingshot while they pull faces at you.

And at the edge of your property there is a treeline.

Nobody makes you go in. The wood in there is the only wood that will build a real house. The
mushrooms in there are the only thing that makes the traps work. The seeds in there grow into
things you cannot grow anywhere else. So you go in. And the music stops, and the color drains
out, and something in there is doing an impression of the sound your own axe makes.

You can carry a lot out. If you die, you drop all of it.

### The 15-second trailer

Forty seconds is too long. The trailer is: **fifteen seconds of adorable**, hard cut, **five
seconds of the woods**, cut to black, title. That cut is the entire marketing plan. It is
inherently shareable, it explains the game with zero words, and it is the reason streamers
will click.

---

## 2. Creative Thesis — The Tonal Contract

This game has exactly one way to fail creatively, and it is this: **being jokey in the woods.**

The comedy and the horror are not blended. They are **adjacent and absolute**. The farm is a
cartoon and never stops being one. The woods are sincere and never wink. A player who laughs
in the woods is a bug report.

**The rule: no jokes past the treeline.** Not one. Not a funny death sound, not a jokey item
name, not a wacky monster. The weasels do not follow you in. The slide whistle does not follow
you in. The comedy is what you are protecting; the woods are what you are protecting it from.

Everything else in this document serves that contract.

### The Contrast Table

This is a build spec, not a mood board. Every row is enforceable in code and should be
verified before Stage 2 ships.

| | **The Farm** | **The Dark Woods** |
|---|---|---|
| Palette | Saturated, warm, high-key. Full 48-color palette. | Desaturated to ~8 values. Cold. Near-monochrome with one accent. |
| Music | Full orchestral-cartoon score, always playing | **None.** A single sustained low tone, rarely. Silence is the default. |
| Animation | Squash & stretch, snappy, anticipation on every action | Real easing. Slow. Things move with weight and do not bounce. |
| Foley | Mickey-moused: boinks, slide whistles, xylophone footsteps | Naturalistic, close-mic'd, wet. Your own breathing. |
| Death | Comic. You get flattened, you pop back up, you lose nothing | Silent screen. You lose your entire haul. |
| Camera | Locked, stable, centered | Drifts slightly. Lags a half-beat behind you. Occasionally does not follow. |
| UI | Bright, chunky, animated, always visible | Thin, low-contrast, flickers. Sometimes it is simply not there. |
| Framerate feel | Characters animate on 2s (12fps) — classic cartoon snap | Smooth 60fps. The smoothness is what's wrong with it. |
| Weather | Sunny, cartoon rain with visible droplet shapes | Fog. No precipitation. Air that doesn't move. |

That last animation row is the sharpest tool in the box: in a world where everything moves in
cartoon snaps, **the one thing that moves smoothly is the monster.** Players will feel it
before they can name it.

---

## 3. The Four Pillars and the Interlock Web

Four systems. The design requirement is that **no pillar is a side activity** — each one
feeds at least two others. This interlock is the single strongest predictor of a high review
score, and it is what separates this from "a farming game that also has a shooting minigame."

```
                    ┌──────────────┐
              ┌────►│     GROW     │◄────┐
              │     │ till, plant, │     │
              │     │  crossbreed  │     │
              │     └───┬──────┬───┘     │
     rare seeds         │      │      wood, tools
     from woods         │      │      from woods
              │    ammo │      │ defenses
              │         ▼      ▼         │
    ┌─────────┴────┐          ┌──────────┴───┐
    │    VENTURE   │          │    DEFEND    │
    │  dark woods  │          │ night raids  │
    │   run + risk │          │  vs weasels  │
    └─────────┬────┘          └──────┬───────┘
              │  light, traps,       │
              │  mushrooms           │ trophies fund
              │                      │ upgrades
              │    ┌──────────────┐  │
              └───►│    UPGRADE   │◄─┘
                   │ homestead,   │
                   │ guns, tools  │
                   └──────────────┘
```

**Read the loops out loud — every one must be true in the shipped game:**

- You **grow** crops → crops are **ammo** → ammo lets you **hunt** and **defend**
- You **defend** the farm → trophies and salvage → **upgrade** the homestead
- You **upgrade** the homestead → bigger bag, better light → you can go **deeper** in the woods
- You go **deeper** → rare seeds and good wood → better **crops** and better **buildings**
- You **crossbreed** → weird crops → weird ammo → **new ways to fight**
- Woods flora **crossbred** with farm crops → powerful hybrids that **attract more weasels**

That last one is the keystone: **the best crops in the game make your nights worse.** The
player's power is also their problem. Design every late-game reward with a cost that lands in
a different pillar.

### The signature mechanic

If a reviewer remembers one thing, it should be this:

> **In the Dark Woods, the thing hunting you is faster than you when your bag is full.**

You cannot outrun it while carrying your haul. You can drop the haul and live, or keep it and
gamble. That decision happens in real time, at a sprint, in the dark, with an hour of work in
the bag. It is the whole game compressed into two seconds, and it is the clip that gets shared.

---

## 4. Player Fantasy and Session Shape

**The fantasy:** you are a small stubborn person with a shotgun and a garden, and the world is
much larger and much stranger than you are, and you are going to plant onions anyway.

### The day (target: 12–14 real minutes)

| Phase | Real time | What the player does |
|---|---|---|
| **Dawn** | ~1 min | Wake, check overnight raid damage, read the letter/rumor of the day |
| **Morning** | ~4 min | Farm chores: till, plant, water, harvest, tend breeding beds |
| **Midday** | ~5 min | The choice: build/craft at home, hunt the plains, **or** enter the woods |
| **Dusk** | ~2 min | Forced return. Set traps, load the gun, board the windows |
| **Night** | ~2–3 min | Weasel raid. Active defense. Or sleep through it if you built well enough |

**Design intent:** Dawn and Morning are *safe and pleasant on purpose* — they are the thing
you are afraid to lose. Midday is the only free choice, and it's a real one, because you
cannot do all three. Night is the drumbeat that stops the game from being a checklist.

**Dusk is a hard wall.** If you are still in the woods at Dusk, you are not coming home the
easy way. This is the timer that makes the greed decision bite without ever *forcing* entry.

### The week and the season

- **7 days = 1 week.** A traveling merchant arrives on day 7. Sole source of some seeds.
- **4 weeks = 1 season.** Seasonal crop rotation, seasonal weasel variants, one seasonal event.
- **4 seasons = the game.** Credits roll at end of Year 1. Free play continues after.

A fixed, finite arc is deliberate. It gives us an **ending**, which is worth a full review
point over an infinite treadmill, and it caps our content obligation at a shippable size.

---

## 5. Technical Architecture

### 5.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | Every file is text an AI writes perfectly. Types are how we catch AI mistakes for free. |
| Renderer | **Phaser 3** (latest 3.x, pinned) | Batteries included: tilemaps, arcade physics, tweens, particles, cameras, audio, gamepad. Mature, huge training-data footprint. |
| Build | **Vite** | You already use it. Instant HMR. |
| Desktop | **Electron** + `electron-builder` | You've already shipped Electron once. |
| Steam | **`steamworks.js`** | Achievements, stats, Steam Cloud. Node native module, Electron-compatible. |
| Testing | **Vitest** | Headless sim tests. Non-negotiable — see 5.3. |
| Maps | **Tiled** → JSON | Free editor, JSON output an AI can read and edit. |

**Pin exact versions in `CLAUDE.md`.** The most common AI failure on this stack is confidently
writing Phaser 2 or pre-3.60 APIs. Pinning + a `docs/phaser-notes.md` of gotchas kills most of it.

### 5.2 The architecture correction — this game runs locally

Gloamreach's desktop build opens a window onto `gloamreach.shanewillb.workers.dev`. Internet
required. **Do not do that here.** For a paid Steam game it fails on every axis: no offline
play, your server outage is a total outage, Steam reviews punish it hard, refund rate spikes,
and you pay hosting forever on a one-time purchase.

**Tarnation ships entirely inside the `.exe`:**

- All code and assets bundled in the app
- Renderer loads via a **custom protocol handler** (`app://`), not `file://` — `file://` breaks
  ES modules, `fetch`, and CORS in ways that waste days
- `nodeIntegration: false`, `contextIsolation: true`, a narrow `preload.ts` bridge
- Saves to `app.getPath('userData')`, on disk, no network
- **Zero network calls in the shipped build.** No telemetry, no CDN fonts, no analytics. A
  packet sniffer should show nothing. Say so on the store page; players notice.

### 5.3 The most important structural decision: split the sim from the render

```
tarnation/
├── apps/
│   ├── game/                  # Phaser. Scenes, sprites, input, audio, VFX.
│   │   └── src/scenes/        # Boot, Preload, Farm, Woods, Hunt, HUD, Pause
│   └── desktop/               # Electron main + preload. Thin. ~300 lines total.
├── packages/
│   ├── sim/                   # ★ Pure TypeScript. ZERO Phaser/DOM imports.
│   │   ├── genetics/          # crossbreeding, traits, mutation
│   │   ├── economy/           # prices, shop, merchant
│   │   ├── raid/              # weasel wave generation and resolution
│   │   ├── woods/             # depth tiers, attention/heat, loot rolls
│   │   ├── time/              # day/season clock
│   │   └── save/              # versioned serialize + migrations
│   ├── content/               # DATA ONLY: crops, weasels, guns, buildings, loot
│   └── shared/                # types, seeded RNG, math
├── masterplans/               # masterplan.md, masterplan_II.md, ...
├── docs/                      # decisions, phaser-notes, style-bible
└── assets-src/                # raw art (NOT in git — see playbook)
```

**The rule: `packages/sim` never imports Phaser, never touches `window`, never renders.**

This is the highest-leverage decision in the entire document for an AI-built game. Because:

- **The AI can test the game without a browser.** `vitest run` proves the genetics system works
  in 400ms with no rendering. AI-written game logic is *unverifiable* otherwise, and unverified
  AI code is where the bugs live.
- **You can simulate 10,000 days in a unit test** to balance the economy. Ask Claude "run a
  year of the sim 500 times and tell me if the player can go broke" and get a real answer.
  Nobody balances an indie game this well. You can, almost for free.
- **Bugs become reproducible.** Seed + action log = exact repro, handed straight to the AI.
- **Phaser becomes replaceable.** If Phaser is ever the wrong answer, the game survives.
- **It fits how AI actually works.** Claude reasons about pure functions vastly better than
  about stateful scene-graph code. Put the interesting logic where the AI is strongest.

### 5.4 Determinism

- **One seeded PRNG** (`mulberry32`), seeded from the save. `Math.random()` is **banned** in
  `packages/sim` — enforce it with an ESLint rule so the AI physically cannot slip it in.
- **Fixed timestep.** Sim ticks at a fixed 30Hz, decoupled from render framerate. Accumulate
  delta, step in fixed increments. Without this, crop growth and weasel AI behave differently
  on a 144Hz monitor than a 60Hz one — a real, common, miserable bug class.
- **Action log.** Every player action appends `{tick, type, payload}`. Ship it in bug reports.

### 5.5 Saves — where indie games earn their 1-star reviews

Corrupted saves are the #1 source of catastrophic reviews for farming games, because the player
loses 30 hours. Treat this as a launch-blocking system, not a chore.

- Versioned JSON: `{version: 7, data: {...}}` with an explicit migration per version bump
- **Atomic writes**: write `save.tmp` → `fsync` → `rename` over `save.json`. Never write in place.
- **3 rolling backups** + one "start of current season" backup
- Autosave at Dawn, at Dusk, on entering/leaving the woods, and on quit
- A **"Recover Save"** menu option, shipped in v1.0, not patched in later
- Steam Cloud via `steamworks.js` once local saves are bulletproof — not before

### 5.6 Lighting — the thing Phaser doesn't give you

This is the one real gap in the chosen stack, and the Dark Woods depends on it. Phaser's
built-in `Light2D` pipeline needs a normal map per sprite — far too much art labor. Do this
instead:

1. A full-screen `RenderTexture` filled with near-black (cold blue-black, ~92% alpha)
2. For each light source, `erase()` a soft radial-gradient texture at its position, scaled to
   its radius (lantern fuel drives the scale — light literally shrinks as fuel burns)
3. Draw the darkness RT above the world layer, below the UI
4. Add a vignette and a slow ±3% flicker on the lantern radius

Cheap, one draw call, and it looks correct. **Skip true shadow-casting** — it is a large
project for a small return. A shrinking light radius plus good audio plus a vignette does 90%
of the work of real shadows. Bank the time in Stage 3 instead.

### 5.7 Packaging for Steam — the detail everyone gets wrong

**Do not ship an NSIS installer through Steam.** Steam handles install and updates itself.

- Build with `electron-builder --dir` → produces `dist/win-unpacked/`
- Upload the **contents of that folder** to a Steam depot via **SteamPipe** (`steamcmd` +
  a `app_build.vdf` script). Automate this — it becomes a one-command release.
- Set the Steam launch executable to `Tarnation.exe`
- Ship a separate `NSIS` build **only** for itch.io / Patreon direct downloads
- **Code signing:** skip at first. Steam launches the exe itself so SmartScreen is mostly moot.
  Revisit (~$200–400/yr OV cert) only if you do meaningful direct distribution.
- **Steam overlay is unreliable with Electron.** Known limitation, no clean fix. Consequence:
  no in-game screenshot key, no overlay browser. Ship an **in-game screenshot function of your
  own** bound to F12 that writes a PNG to userData. It costs an afternoon and closes the gap.

### 5.8 Performance budget

Set these now; check them at every milestone. A 2D game that stutters reads as amateur
instantly, and reviewers *always* mention it.

| Metric | Budget |
|---|---|
| Frame time | < 16.6ms (60fps) with 60 weasels + full particle load |
| Sim tick | < 2ms |
| Cold start to playable | < 6s |
| Installed size | < 1.5 GB |
| Idle RAM | < 700 MB |
| Save write | < 50ms, never on the render thread |

---

## 6. Art Pipeline — the biggest risk, and the plan that solves it

### 6.1 The actual problem

Your Waywarden / Thorn Archer / Moon Arcanist assets are excellent, and that quality bar is
achievable. But there's a hard wall between what you did on Gloamreach and what this game
needs, and it needs naming precisely:

**Gloamreach needed beautiful still images. Tarnation needs characters that walk.**

AI image models are outstanding at one gorgeous illustration and **cannot** produce 24
consistent frames of the same character turning and walking. Not with seeds, not with
img2img, not with LoRAs at your scale. Every team that tries to brute-force sprite animation
out of an image model burns two months and quits.

### 6.2 The solution: cutout puppet animation

Generate **one** illustration per character. Cut it into pieces. Animate the pieces.

This is not a compromise — **it is exactly how 1940s rubber-hose cartoons were made**, and how
Paper Mario, South Park, Cuphead's UI, and most 2D mobile games work today. Rubber-hose *is*
puppet animation. The style you picked and the pipeline you need are the same thing.

**Per character:**

1. **Generate one hero illustration** — full body, neutral stance, arms slightly out, flat or
   transparent background, high resolution. Iterate until it's genuinely great. This is the
   only step where you need the image model to be brilliant, and it's the step it's best at.
2. **Cut into ~12 parts** in [Photopea](https://photopea.com) (free, browser-based): head,
   torso, upper arm ×2, forearm ×2, hand ×2, thigh ×2, shin ×2, foot ×2. Paint behind the seams.
3. **Export each part** as a trimmed PNG with a recorded pivot point.
4. **Rig in code.** A bone = `{parent, pivot, rotation, scale, spriteKey, z}`. A skeleton is a
   tree of those. ~200 lines of TypeScript, and Claude writes it correctly on the first try.
5. **Animate by tweening rotations.** A walk cycle is 4 keyframes of ~8 rotation values.
   Squash & stretch is `scale` on the root — **zero new art**. A blink is swapping one PNG.

**What this buys you:** unlimited animations from one image, perfect frame-to-frame consistency
(it's literally the same pixels), and a new character costs *one good generation* instead of
forty consistent ones. Adding a new weasel type becomes a one-hour job.

**Tooling escape hatch:** if hand-rolling the rig stalls, use **DragonBones** (free, JSON
export, JS runtime) or **Spine** (paid, official Phaser plugin, industry standard). Start
hand-rolled — you get total control and Claude can debug code it wrote far better than a
third-party runtime.

### 6.3 What to generate directly (where AI image models shine)

| Asset class | Approach | Notes |
|---|---|---|
| Environment props | Direct generation, static | Trees, rocks, fences, barrels. No animation needed. This is the sweet spot. |
| Terrain tiles | Direct, then hand-fix seams | Generate large, slice, fix edges manually |
| Buildings | Direct, one image per tier | Homestead tiers are 5 gorgeous stills |
| Item / crop icons | Direct, batch | Small size hides inconsistency |
| Crop growth stages | Generate mature plant → derive stages 1–3 by scale + crop + desaturate | Saves ~70% of crop art work |
| UI frames | Direct | |
| Characters & weasels | **Puppet rig only** | Never try to generate animation frames |
| Portraits / dialogue | Direct — your existing strength | Reuse the Gloamreach approach wholesale |

### 6.4 The consistency enforcers

Three mechanical rules that make a pile of separately-generated assets look like one game.
Skip these and it looks like a scrapbook.

1. **Palette clamping.** Define one fixed 48-color palette. Every asset gets quantized to it in
   post (a small `sharp` script in the asset pipeline, run automatically). This is the single
   highest-leverage consistency trick that exists — mismatched art becomes unified art.
2. **One outline rule.** Golden-age cartoons have consistent bold outlines. Enforce a fixed
   outline weight and color on every asset in post. Two assets with the same outline read as
   the same world even when the rendering differs.
3. **A written style bible.** `docs/STYLE_BIBLE.md` holds the exact prompt prefix, the negative
   prompt, the palette hex list, the reference image, and the lighting direction (pick one:
   key light from upper left, always). Every asset goes through it. **No freelancing prompts.**

Automate 1 and 2 as `npm run assets:process`. Raw generation in → game-ready asset out. The AI
can write this pipeline in an afternoon and it pays for itself in a week.

### 6.5 Two things you must handle before launch

**Elmer Fudd is Warner Bros. intellectual property.** The 1940s rubber-hose Americana *style*
is not protectable and you're free to use it. A specific character is very much protectable.
So:

- The character is **not** named Fudd, is **not** designed to resemble him, and does **not** use
  the speech impediment as a signature (no "wascally," no r→w gimmick as a catchphrase)
- Do not prompt image models with "Elmer Fudd" — they will happily produce a near-copy, and
  a near-copy in your shipped build is a DMCA takedown of your Steam page
- **Design an original character** in the golden-age style: exaggerated silhouette, small body,
  huge head, distinctive hat. Style is free. Characters are not.

**Steam requires AI content disclosure.** Valve mandates that you declare AI-generated content
on the store page. This is not optional and it's checked during review. Two honest facts:

- Disclosed AI-art games do ship and do sell. This is not a blocker.
- There is a vocal segment of players, curators, and streamers who will downrate or refuse to
  cover a game with AI art. For a game whose **hook is its art style**, that's a real
  commercial risk, not a hypothetical one.

**Recommendation: plan for the free path.** See **[`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md)**
for the full workflow. The short version: the animation-consistency problem is solved by the
puppet rig (§6.2), not by money. Static assets — which are most of the screen — are direct
generation and already a proven strength. Realistic cost is **$0 and 20–40 hours** across the
whole project.

Spend money only as a targeted fix if something specific fails: the rig can't hit the animation
quality after an honest attempt, or the Steam capsule and key art specifically, where an
illustrator's composition instincts are worth real money even when everything else is AI.

The AI-disclosure backlash is a separate, commercial risk that no technique or budget fully
removes. Go in with open eyes; plenty of games ship disclosed and sell fine.

---

## 7. Audio — 70% of whether the woods are scary

Underfunding audio is the most common way a horror game fails. Budget real money here before
you budget it for art.

**The farm:** a warm 6–8 track loop set. Cartoon orchestration — pizzicato strings, tuba,
xylophone, slide whistle, muted trumpet. Foley is "mickey-moused": every action has a musical
sound. Footsteps are xylophone notes. This is a *lot* of small sounds and it's what makes the
farm feel alive.

**The woods:** the design is **subtractive**. The horror is what you take away.

- No music. Ever. The absence of the farm's score is the threat signal, and because the player
  has heard that score for hours, silence lands like a slap.
- Close-mic'd naturalistic foley: your own breathing, boots in wet leaves, cloth
- One **low sustained tone** that fades in as Attention rises — the player's dread meter,
  audible before it's visible
- **The mimic:** record the player's own axe-chop sound and play it back, spatialized, from a
  direction they are not facing, 20–90 seconds later. This costs almost nothing to implement
  and is the most effective single scare in the design.
- Reverb changes with depth. Fringe is dry and open. The Hollow is a small, close, wet room —
  which makes no sense outdoors, and the player will feel that before they understand it.

**Build this yourselves — see [`docs/AUDIO_PIPELINE.md`](docs/AUDIO_PIPELINE.md).** The gap
between Gloamreach's audio and this is *code, not purchased sound*: silence is free, the mimic is
a delay buffer and a pan value, depth-reverb is a `ConvolverNode`, and cartoon foley is one of the
best-covered categories in free CC0 libraries. Plan for $0.

The one thing to guard is **attention, not budget** — audio treated as an afterthought is how
horror games fail. The real risk here is licensing, not quality: CC-BY-NC sounds cannot ship in a
paid game, and AI-music commercial rights depend on your subscription tier. Keep
`docs/AUDIO_CREDITS.md` from the very first sound file.

---

## 8. STAGE 1 — The Farm

*Buildable now. This is Milestone 1 through 3.*

### 8.1 Land and tilling

- Farm is a **grid** (start 24×24 tiles, expandable to 48×48 across the year)
- Tile states: `wild → cleared → tilled → planted → watered → grown → harvested`
- **Grass maintenance:** cleared tiles slowly revert to wild. Mowing/maintaining grass gives a
  small passive **Tidiness** bonus that raises crop quality farm-wide. This makes the "maintain
  your area" fantasy mechanically real instead of decorative, and it gives players a calming
  low-stakes activity for when they don't want to make decisions.
- Tools: Hoe, Watering Can, Axe, Shovel, Scythe. Each has 4 upgrade tiers (wood → iron →
  darkwood → fantastical). Upgrades come from woods materials — a Stage 2 dependency.

### 8.2 The genetics system — the game's most original mechanic

Not a lookup table of funny names. A real, small genetics engine, which means players discover
combinations **we never explicitly designed**. That's where the streamer clips and the wiki
come from.

Every seed carries five traits, `0–100`:

| Trait | Effect |
|---|---|
| **Yield** | Units harvested per plant |
| **Vigor** | Growth speed |
| **Thirst** | Water required per day (lower is better) |
| **Hardiness** | Resistance to weasels, frost, trampling |
| **Weirdness** | ★ Unlocks fantastical outcomes. The whole system's engine. |

**Crossbreeding:** plant two parents in adjacent tiles of a **Breeding Bed** (a buildable
structure). At harvest they produce a hybrid seed.

```
child.trait = lerp(parentA.trait, parentB.trait, rng(0.35..0.65))
            + mutation()                        // ±0..15, weighted by parent Weirdness
child.weirdness += 5 + (parentsAreDifferentSpecies ? 12 : 0)
```

**Weirdness thresholds gate the fantastical:**

| Weirdness | Result |
|---|---|
| 0–24 | Normal crop, traits blended |
| 25–49 | Cosmetic oddity — wrong color, wrong size, a tiny face |
| 50–74 | **True hybrid** — new species, new name, new mechanical property |
| 75–89 | **Absurd** — Carrot Corn, Onionion, Pumpelon, Screaming Cabbage |
| 90–100 | **Wrong** — it works, it's powerful, and it is quietly a Stage 2 problem |

**Every hybrid must have a mechanical identity, not just a funny name.** This is the rule that
separates a system from a gag reel:

| Hybrid | Property |
|---|---|
| Screaming Cabbage | Repels weasels in a 3-tile radius. Audibly. Constantly. |
| Glowshroom Gourd | Portable light source. Burns 8 minutes. The only renewable woods light. |
| Ironroot Turnip | Cannot be dug up by burrowers. Plant a perimeter of them. |
| Rubber Corn | As ammo: ricochets off 3 surfaces. As a crop: bounces when harvested. |
| Carrot Corn | High yield, low hardiness. The greed crop. |
| Sunflower Onion | Makes you cry, which in the woods means you cannot see. Do not eat before entering. |
| Bramblewheat *(woods hybrid)* | Best-in-game yield. **+30% weasel raid intensity while planted.** |

**The Seed Codex:** every discovery gets a permanent illustrated entry with its traits and
lineage tree. Collection dopamine, a completion goal, and a natural "what happens if I cross X
with Y" engine for streamers.

**Balance requirement:** write a Vitest suite that runs 100,000 random crosses and asserts the
distribution — no trait runaway, absurd tier reachable in ~2 in-game weeks of deliberate play
and essentially never by accident. **This is exactly the test the sim/render split exists to
make possible.**

### 8.3 Water and irrigation

The progression Shane sketched, kept nearly intact — it's a genuinely good escalating gag
where each tier is both funnier and more useful:

| Tier | Method | Unlock | Feel |
|---|---|---|---|
| 1 | **Buckets.** Carry two, walk to the river, walk back. | Start | Tedious *on purpose* — establishes the baseline |
| 2 | **Trenches.** Dig with the shovel; water flows downhill along real slope. | Shovel | The first real "I'm an engineer" moment |
| 3 | **Roman aqueduct.** Buildable pipe segments, arches, gravity-fed. | Stone + Tier-2 homestead | Absurd civic grandeur on a vegetable patch |
| 4 | **The Elephant.** Walks a route between river and field, waters with trunk. | Late Year 1 | The endgame flex |

**The elephant is a character, not a machine.** It has a name. It gets startled by weasels and
stampedes through your crops. It is afraid of the treeline and will not go near it. It is the
single best marketing asset in Stage 1 — an elephant watering a carrot patch with its trunk
while a weasel steals a cabbage in the foreground *is* the Steam capsule image.

Trenches should use **real terrain height** so water genuinely flows downhill. It makes farm
layout a spatial puzzle and it's the kind of small systemic honesty that reviewers notice.

### 8.4 The Homestead

Five tiers. Each is one gorgeous AI-generated illustration plus an interior.

| Tier | Name | Cost | Unlocks |
|---|---|---|---|
| 1 | Lean-To | start | 12 storage, a bed |
| 2 | Shack | wood ×40 | 24 storage, cooking, tool rack |
| 3 | Cabin | darkwood ×30 | 48 storage, Breeding Bed indoors, **trophy wall** |
| 4 | Farmhouse | darkwood ×80 + stone | 96 storage, gunsmith bench, cellar |
| 5 | Manor | endgame materials | 200 storage, the good ending's stage |

The **trophy wall** matters more than it looks: it turns hunting into a visible record of the
player's own playthrough. "The world reflects your choices" is a review-score lever, and here
it costs us almost nothing — mounts are static illustrations.

Each tier also raises your **night defense floor**, so building is defense, not just storage.

### 8.5 The Weasels

The comic antagonist and the reason night exists. They need genuine personality — they taunt,
they mug at the camera, they get flattened and peel themselves off the ground.

| Type | Behavior | Counter |
|---|---|---|
| **Diggler** | Basic. Burrows up, eats one crop, leaves. | Anything |
| **Nibbler** | Fast. Takes a bite from many crops rather than eating one. | Area denial, traps |
| **Sapper** | Ignores crops. Chews fences and trench walls. | Ironroot perimeter, patrols |
| **Hauler** | Steals an entire plant and runs for the treeline. **Chase it.** | Speed, ranged weapons |
| **Cheeky** | Steals a *tool*. If it escapes, you buy it back from the merchant. | Rage |
| **The Duke** *(boss)* | Tiny crown, monocle, cape. Commands a wave. Seasonal. | Everything you have |

**The mushroom traps.** From Stage 2, place woods mushrooms in traps. A weasel that trips:
backflips, runs in circles, chases its own tail, high-fives another weasel, attacks *other
weasels*, wanders into a second trap, walks in a perfectly straight line off the map. This is
**emergent comedy**, which means it's clippable, which means it's free marketing. Give it a
generous variety table — 15+ behaviors — because this is the single most shareable system in
the game and it's cheap: it's all code and reused rigs.

**Raid intensity** scales with: day number, crop value planted, Weirdness of planted crops, and
whether you have Bramblewheat in the ground. The player's own greed sets the difficulty — the
same principle as the woods, applied to the farm.

### 8.6 Donkeys and carts

Wild donkeys roam the plains. Tame with feed over several days (they're skittish and it's a
slow, sweet little relationship). A tamed donkey pulls a cart: mobile storage, faster travel.

Cart physics should be **slightly too bouncy** — comedy comes free from good physics and a
tuned suspension value. A cart that spills cabbages down a hill is a better joke than any
written one.

**Do not put a donkey in the woods.** Or rather: let the player try, once.

---

## 9. STAGE 2 — The Dark Woods

*Masterplan II will specify this to build depth. This is the design lock.*

### 9.1 The Wilderness model

Locked from kickoff: **voluntary, high risk, high reward.** Nothing ever forces you in. The
game is completable without it — badly, slowly, with a Tier-3 house and a bad ending. Everything
good is in there.

**Depth tiers.** Deeper = better rewards, worse everything else.

| Depth | Name | Yields | Threat |
|---|---|---|---|
| 1 | **The Fringe** | Common wood, common mushrooms | Ambient dread only. No entity. Teaches the space is safe-ish. |
| 2 | **The Thickets** | Darkwood, glowcaps | The Woodsman may appear at distance. Never approaches. |
| 3 | **The Deepwood** | Blackheart timber, rare seeds | The Woodsman hunts. Attention rises fast. |
| 4 | **The Hollow** | Endgame materials, the story | It knows you're there before you arrive. |

### 9.2 The stake — what you actually lose

**On death you drop your Harvest Bag.** Everything you gathered this run. You keep your tools,
your equipped weapon, and your lantern — losing those would be punishing enough to make players
stop entering, which kills the system.

- Your bag stays where you died. **You can go back for it.** The thing that killed you is still
  there, and it is now between you and an hour of your work.
- The bag despawns at the end of the next in-game day. One shot at recovery.
- **Lucky Rabbit's Foot:** consumable, protects one death's haul. Expensive. Bought from the
  merchant. Gives players a spendable safety valve and gives the economy a real money sink.
  Crucially it converts "should I go deeper?" from a mood into a **budgeted decision**.

**The Harvest Bag has limited slots** (upgradeable). Every extra item is more reward *and* more
loss. **The player sets their own tension level, item by item.** This is the entire risk/reward
design in one UI element, and it's why the Wilderness model was the right call.

### 9.3 Attention — the heat system

A hidden `0–100` meter, surfaced only through audio and environment, never as a number.

**Rises with:** time in the woods, trees felled, depth, noise (gunshots are very loud; the bow
is silent — this is why the bow tier exists), lantern brightness.

**Falls with:** standing still, extinguishing your light, leaving.

| Attention | What happens |
|---|---|
| 0–24 | Nothing. Birds, if there were birds. |
| 25–49 | The low tone fades in. Your axe sound gets mimicked. |
| 50–74 | Distant sightings. It's motionless. It's gone when you look again. |
| 75–89 | It follows. It stays at the edge of your light. It does not attack. |
| 90–100 | **It hunts.** Faster than you when your bag is full. |

**The woods remember.** Attention decays between visits but never fully resets, and the decay
floor rises permanently with total trees felled across the whole save. **Over-logging is a
one-way difficulty dial that the player controls.** A player who clear-cuts for efficiency
makes their own late game a horror game. A careful player keeps it manageable forever. Nobody
tells them this. They figure it out, and then they tell each other, and that's a community.

### 9.4 The Woodsman

One entity, used sparingly. **Presence, not jump-scares.** The design rule: a player should
never see it clearly until the endgame, and should never be certain whether they just saw it.

- Never scripted. Always Attention-driven. Two runs are never the same.
- It **mimics** — your axe, your footsteps, eventually your own voice-less "hmm" idle sound
- It appears at maximum draw distance, motionless. It does not move while observed.
- It moves with **real physics and smooth easing** in a world where everything else snaps to
  12fps. That's the tell.
- At Attention 90+: it pursues at a speed slightly above your full-bag walk and slightly below
  your empty-bag run. **The math is the mechanic.** Drop the bag, live. Keep it, gamble.
- It never enters the Fringe. The Fringe is always safe. Safety must be real for danger to be.

### 9.5 Logging, mushrooms, and corrupted seeds

- **Wood tiers:** Common (Fringe) → Darkwood (Thickets) → Blackheart (Deepwood) → ??? (Hollow).
  Gates homestead tiers 3–5 and tool tiers 3–4. This is the hard dependency that makes the
  woods non-optional in practice while remaining optional in principle.
- **Mushrooms:** Glowcap (light), Dreamcap (weasel traps — the comedy engine), and rarer
  varieties for Stage 3 ammo.
- **If you eat a Dreamcap, the horror rules invert.** The woods become saturated, cartoon,
  musical, friendly. Everything is bright and lovely. **And it is so much worse** — because
  you can no longer tell what's real, the Woodsman renders as something charming, and when it
  wears off you are somewhere you did not walk to. This is the best idea in Stage 2. Build it.
- **Corrupted seeds:** cross woods flora with farm crops for the strongest hybrids in the game,
  which raise raid intensity. The two stages feed each other in both directions.

### 9.6 The rare wrongness table

A weighted table of low-probability events. A 1-in-40 event that's genuinely unsettling gets
clipped and shared forever; a 1-in-3 event becomes wallpaper within an hour. **Rarity is the
budget.** Target: a player should see maybe 5 of these in a full playthrough and hear about the
rest from other players.

Seed the table with ~20 entries. Examples of the register we're aiming for: a tree you already
cut is standing again; your own footprints lead somewhere you didn't walk; the treeline exit is
briefly not where it was; every mushroom in view is facing you; the lantern lights nothing for
one second; a second set of footsteps continues for two steps after you stop.

Never explain any of them. Never acknowledge them in UI. No achievement fires.

---

## 10. STAGE 3 — Guns and Hunting

*Masterplan III will specify to build depth.*

### 10.1 Two shooting modes, contextual

**Top-down aim (farm defense).** Mouse-aimed, fast, reactive, for night raids. Bullets are
physical objects — Rubber Corn ricochets, spread weapons spread. Readable, chunky, satisfying.

**Hunt Mode (the Duck Hunt layer).** On the open plains, raising your gun shifts the camera to
a light-gun view: the world becomes a parallax stage, animals cross it, you have a crosshair
and a magazine. Reload is a physical animation with real downtime. This is a *deliberate mode
change* — the same tonal-shift instinct as the woods, applied to comedy.

Hunt Mode is the second-best GIF in the game and it's cheap: static parallax backgrounds
(AI-generated, our strength), puppet-rigged animals crossing on paths.

### 10.2 The five tiers

| Tier | Weapon | Character |
|---|---|---|
| 1 | **Slingshot** | Arcing, slow, weak, silent. Ammo: pebbles, small crops. |
| 2 | **Bow** | Fast, accurate, **silent** — the woods weapon. Retrievable arrows. |
| 3 | **Blunderbuss** | Wide spread, brutal, slow reload, deafening. **Occasionally backfires and blackens your face** — comedy tier, and genuinely powerful. |
| 4 | **Varmint Rifle** | Lever-action. Precise, fast, loud. The workhorse. |
| 5 | **The Cropper** | Fires *your crops*. Ammo behavior = crop properties. Endgame. |

**Acquisition should be funny, never a shop purchase.** The blunderbuss is dug up in a field,
still loaded. The rifle is traded from the merchant for something absurd. The Cropper is built
by the player from a Tier-5 homestead bench and a schematic found in the Hollow.

### 10.3 Crops as ammo — the keystone

**This is the single mechanic that makes the game one game instead of three.**

You grow your ammunition. Different hybrids are different ammo types:

| Ammo crop | Effect |
|---|---|
| Rubber Corn | Ricochets ×3 |
| Screaming Cabbage | Area fear — weasels scatter |
| Ironroot Turnip | Armor-piercing, no spread |
| Dreamcap round | Enemies hit begin tripping |
| Bramblewheat | Highest damage. Costs your best crop. |

So: **breeding is ballistics.** A player optimizing their gun is farming. A player farming is
arming. Every hour in the dirt cashes out at night and in the woods. When a reviewer writes
"every system in this game talks to every other system," this is the sentence they're
describing.

### 10.4 Animals, trophies, and the tone problem

Roaming plains animals with cartoonishly exaggerated features — a rhino that is 80% tusk, a pig
that is mostly snout, a bird with a comically long neck.

**The tone problem, addressed directly:** shooting cute animals can alienate a chunk of the
cozy audience you need. The cartoon convention solves it cleanly: **on the farm and plains,
nothing dies.** Animals get comically dazed, see stars, drop a trophy, shake it off, and wander
away slightly annoyed. It is funnier than killing them, it costs nothing, and it keeps the
cozy-farming audience buying.

**In the woods, things die.** Same principle as everything else in this document: the farm's
rules are cartoon rules, and the woods do not follow them. The first time a player realizes the
"nothing really dies" rule doesn't apply past the treeline should be a genuinely bad moment.

Trophies mount on the trophy wall. Some are pure decoration, some grant small passive bonuses,
all of them are a record of a specific playthrough.

---

## 11. Meta-progression and the Ending

Credits at the end of Year 1 (~10–15 hours). **A real ending is worth a full review point**
over an infinite treadmill, and it caps our content obligation at something two people can
actually finish.

- **The arc:** why is the land cheap? What happened to the previous owner? The Hollow answers it.
- **Three endings** gated by Homestead tier and Deepwood progress: leave, stay, or the third one.
- **Free play continues** after credits, with the save intact.
- **New Year+** for replay: keep the Seed Codex, reset the farm, harder raids, one new woods depth.

---

## 12. Difficulty, Accessibility, and Cozy Mode

Reviewers now explicitly score accessibility, and one of these settings materially widens the
market. Build them as first-class features, not a patch.

- **Cozy Mode:** disables the Harvest Bag loss stake. Woods still dark, still tense, still
  atmospheric — you just don't lose your haul. **This one toggle lets the entire cozy-farming
  audience buy the game.** That is a large number of people who otherwise bounce off the word
  "horror" in a review. Highest-ROI setting in the document.
- **Varmint Mode:** harder raids, faster Attention, smaller bag. For the streamers.
- Colorblind palettes (the woods lean heavily on desaturation — this needs real testing)
- Text size and UI scale sliders; no text below 14px at 1080p
- Full input remapping, mouse and gamepad
- **Photosensitivity toggle** — the Dreamcap sequence needs one, and needs it flagged
- Subtitles for all audio cues, **including the horror ones.** A deaf player must be able to
  perceive the mimicked axe. Solve this in the design, not with a caption crawl.
- Adjustable day length for players who find 12 minutes stressful

---

## 13. Reverse-Engineering the Review Score

Asked for a 10/10 IGN game, so here's the honest version, which is more useful.

**Straight talk:** 10/10s are almost never awarded, and they're not a plannable target — they
come from timing, cultural moment, and a specific reviewer's taste. Chasing one is not a design
strategy. But the *rubric* is real and it is absolutely plannable, and the things that produce
a 9 are the same things that produce **Overwhelmingly Positive on Steam**, which is the thing
that actually pays the mortgage. Design for the 9. Market for the streamers.

**What reviewers actually reward, and where this design already delivers:**

| Criterion | Our answer | Status |
|---|---|---|
| **A hook stated in one sentence** | "A cozy cartoon farming game where the woods next door are sincerely not cartoon." | ✅ Strong |
| **Systems that interlock, not coexist** | The interlock web (§3). Crops-as-ammo is the keystone. | ✅ Strong — our best asset |
| **The first 10 minutes** | Must be storyboarded beat-by-beat. Reviewers form the score early. | ⚠️ **Not yet designed — do this in Masterplan II** |
| **Tonal confidence** | The Tonal Contract (§2). Never wink in the woods. | ✅ Locked |
| **A memorable mechanic they'll describe to a friend** | Drop the bag or die. | ✅ Strong |
| **A real ending** | Year 1, three endings (§11). | ✅ Planned |
| **Polish / no jank** | Perf budget (§5.8), save integrity (§5.5). | ⚠️ Earned in M5, not designed in |
| **Accessibility** | §12, incl. Cozy Mode. | ✅ Planned |
| **Art that photographs well** | The one genuine risk. See §6.5. | ⚠️ **Highest risk item** |
| **Audio** | §7 + `docs/AUDIO_PIPELINE.md`. Free; the risk is licensing, not cost. | ✅ Planned |

**Two gaps to close before this can score high, stated plainly:**

1. **The first 10 minutes are not designed yet.** Every high-scoring game has a deliberately
   authored opening. Storyboard it shot by shot in Masterplan II — including the exact moment
   the player first notices the treeline, which should happen in minute 2 and be completely
   unremarked upon.
2. **The art has to actually be great**, not "good for two guys with AI tools." It's the first
   thing every reviewer, streamer, and store-page visitor evaluates, and it's the section of
   this plan with the most execution risk. Budget real money for it (§6.5).

**Realistic target:** 85–90 aggregate, Overwhelmingly Positive on Steam, one breakout streamer
moment. That outcome makes real money at $12.99. A 10/10 is a lottery ticket you buy by
executing the above.

---

## 14. Production Roadmap

Two part-time non-engineers with AI assistance. These estimates assume **~15 hours/week each**.
They are honest, not optimistic. Adjust once you know your real velocity from M0.

| # | Milestone | Deliverable | Est. |
|---|---|---|---|
| **M0** | **Toolchain** | Repo, monorepo scaffold, Electron shell running locally with bundled assets, `npm run dev` and `npm run dist:win` both working, CI green. **Prove the .exe pipeline before writing a game.** | 2–3 wks |
| **M1** | **The Loop** | Grey boxes. Till → plant → water → grow → harvest. Day clock. Save/load. Sim tests passing. **No art.** | 3–4 wks |
| **M2** | **Vertical Slice** | One in-game week. 5 crops, genetics v1, 1 weasel type, night raid, Homestead T1–2, real art for exactly this content. **Playable by someone else.** | 8–10 wks |
| **M3** | **Stage 1 Complete** | Full farm: all crops, genetics, irrigation T1–4, homestead T1–5, all 6 weasels, donkeys, Seed Codex. | 10–14 wks |
| **M4** | **The Dark Woods** | 4 depths, bag stake, Attention, the Woodsman, logging, mushrooms, Dreamcap sequence. **Audio pass — hire out.** | 12–16 wks |
| **M5** | **Guns & Hunt** | 5 tiers, Hunt Mode, crop ammo, animals, trophy wall. | 8–10 wks |
| **M6** | **Demo** | First 40 min, polished to launch quality. Steam page live. → **Next Fest.** | 6–8 wks |
| **M7** | **Content & Polish** | Endings, balance from sim tests, accessibility, perf, 200-bug burn-down. | 10–14 wks |
| **M8** | **Launch** | Cert, SteamPipe, marketing beat, launch. | 4 wks |

**Realistic total: 16–24 months part-time.** Anyone who tells you 6 is selling something.

**Gate rules — do not cross these:**
- **No art before M2.** Grey boxes until the loop is proven fun. Art on an unfun loop is money set on fire, and it's the #1 way hobby projects die.
- **Steam page live at M6 at the latest.** Wishlists compound; every month it's not up is lost money. Earlier is better — the day you have one good GIF is early enough.
- **If M2 isn't fun, stop and fix M2.** Do not proceed to M3 hoping content fixes it. It won't.

---

## 15. Scope Guardrails — what we are NOT building

Write these down now, because the temptation arrives at month 8 when you're bored of bug-fixing.
Every one of these has killed a real indie game.

- ❌ **Multiplayer or co-op.** Decided. It taxes every system and doubles every bug.
- ❌ **Procedurally generated farm.** Hand-authored. Proc-gen looks cheap and tests badly.
- ❌ **Romance / NPC relationship system.** Stardew has 12 people and 40 hours of dialogue. We have a merchant.
- ❌ **Crafting tree beyond ~30 recipes.**
- ❌ **Fishing.** It's always the thing that eats a month. No fishing.
- ❌ **Mod support at launch.** Post-1.0 if it sells.
- ❌ **Console ports before PC 1.0 ships.** Electron makes this hard anyway; deal with it later or not at all.
- ❌ **A second woods biome.** One woods, deep, terrifying. Not two, shallow.

**The rule: anything not in this document is Masterplan II's problem, not this build's.**

---

## 16. Marketing and Launch

The part most indie devs skip, and the reason most indie games make under $1,000.

**Wishlists are the currency.** Rules of thumb from the community — heuristics, not laws:
under ~2,000 wishlists at launch is usually a commercial disappointment; ~7,000–10,000 is a
real launch; 20,000+ is a good one. Wishlists accumulate over *months*, which is why the store
page date matters more than the launch date.

**The plan:**

1. **Steam page live as early as legally useful** — you need Steam Direct paid ($100/title,
   recoupable after $1,000 revenue) and the page approved. Valve requires the page live **at
   least 2 weeks** before release; treat that as a floor, not a target. Aim for M6 at the latest.
2. **The whiplash trailer** (§1). It is the entire pitch, it needs no words, and it is built
   to be reposted.
3. **Short-form video from M3 onward.** Weasels tripping on Dreamcaps is native TikTok/Shorts
   content that costs you nothing extra — it's a system you're building anyway. 3 posts/week.
4. **Devlogs on YouTube.** Slower burn, but this is what makes the Patreon viable later, and
   "two guys who'd never coded before are making a game with AI" is a genuinely good story
   people will follow.
5. **Steam Next Fest — once, with a great demo,** roughly 2–3 months before launch. You get one
   shot; a mediocre demo spends it for nothing.
6. **Streamer outreach at demo and at launch.** The tonal whiplash is the pitch, and it plays
   to both horror and cozy channels — an unusually wide net for one email.
7. **itch.io** for early builds and Patreon rewards. Free, no gatekeeping, good pressure valve.
8. **Price $12.99.** No launch discount beyond 10–15%. Never launch on sale — it caps your
   long-tail pricing forever.

---

## 17. Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| **Art quality/consistency doesn't reach the bar** | 🟠 High | Puppet rig (§6.2), palette clamp + outline rule (§6.4), prove the pipeline on one character before scaling — [`docs/ART_PIPELINE.md`](docs/ART_PIPELINE.md) |
| **AI-art disclosure backlash** | 🟠 High | Human-artist pass before launch; disclose honestly; lead marketing with *systems*, not just art |
| **The woods aren't actually scary** | 🟠 High | Contrast table is a build spec (§2); dynamic audio built in code (`docs/AUDIO_PIPELINE.md`); playtest with strangers at M4, not friends |
| **Scope creep kills the project** | 🟠 High | §15 guardrails; masterplan-per-stage discipline; M2 gate |
| **The 50/50 partnership breaks down** | 🟠 High | Written operating agreement with vesting **before** meaningful work — see the Studio Playbook |
| **Save corruption at launch** | 🟠 High | §5.5. Atomic writes + backups + Recover Save shipped in 1.0 |
| **Electron perf / Steam overlay complaints** | 🟡 Medium | Perf budget (§5.8); own screenshot key; disclose the overlay limitation in the FAQ |
| **Burnout at month 10** | 🟡 Medium | Ship the demo at M6 — external validation is the fuel that gets you through M7 |
| **Nobody sees it** | 🔴 Critical | §16, starting at M3, not at M8 |

---

## 18. Open Questions — Round 2

For Masterplan II. Answer these and the next document writes itself.

**Tone & story**
1. Is there any dialogue/text at all, or is the game silent-film style with visual gags only?
2. Does the player character speak? Have a face we see? A name?
3. What actually happened to the previous owner of the farm — and does the player learn it?
4. Is the Woodsman explained by the end, or does it stay unexplained? *(Strong recommendation: unexplained.)*

**Farm**
5. Fixed farm layout, or does the player choose where the house goes?
6. Can crops die permanently, or only get damaged?
7. Do seasons force replanting (Stardew-style) or are crops perennial?
8. Is there money, or is it pure barter with the merchant?

**Woods**
9. Is the woods layout fixed and memorizable, or does it shift between visits? *(Shifting is scarier; fixed is fairer. Possible answer: fixed geometry, shifting contents.)*
10. Can you die on the farm at all, or is death exclusively a woods thing?
11. Should the Woodsman ever be *visible* in a full-detail render, or never?

**Guns**
12. Is Hunt Mode a separate camera or an overlay on the existing view?
13. Do guns have durability?
14. Is there any non-lethal/pacifist path through the whole game?

**Meta**
15. What's the actual game title? *(Blocking — needed for the Steam page and every asset.)*
16. Do we want an in-game photo mode? *(Cheap, and it generates marketing for free.)*
17. Target ship date — are we aiming at a specific Next Fest?
18. What's the total budget we're each willing to put in (art + audio + Steam fee)?

---

*Masterplan I — Marshmallow Muskrat. Next: `masterplan_II.md` (Stage 1 build spec + first-10-minutes storyboard).*
