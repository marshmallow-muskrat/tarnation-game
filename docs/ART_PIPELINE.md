# Art Pipeline — getting Gloamreach-quality graphics for free

> **⚠️ SUPERSEDED for 3D work — see [`../masterplan_alpha_v3.md`](../masterplan_alpha_v3.md) §5.**
>
> This document was written on a wrong assumption: that Gloamreach's characters were AI-generated
> illustrations. They are not. They are **KayKit** models — free, pre-rigged, pre-animated low-poly
> `.glb` assets by Kay Lousberg, sitting in
> `~/Documents/Codex/2026-07-25/i/public/assets/characters/kaykit/`.
>
> Tarnation is now 3D and uses the same approach: free CC0 low-poly packs (KayKit, Quaternius,
> Kenney), lit with the Gloamreach rig. The cutout puppet rigging, palette clamping, style bible,
> and downscaling techniques below were answers to a 2D consistency problem that no longer applies.
>
> Kept for reference, and in case any 2D work (UI art, key art, the Steam capsule) comes up later.

---

**Position:** the free path is viable. Budget $0 and 20–40 hours across the project. Paying an
artist is an option later if a specific thing isn't working, not a prerequisite.

---

## 1. Why Gloamreach's approach doesn't transfer directly

The Waywarden, Thorn Archer, and Moon Arcanist look great because they are **static illustrations
displayed at a fixed size** — one image per character, shown in UI, never animated, never seen from
another angle, never required to match a walk cycle.

That is the single thing AI image models do best, and the result proves it.

Tarnation needs characters that move through a world: walking, facing multiple directions, chopping,
burrowing, dying. **No image model can generate 24 consistent frames of the same character.** Not
with fixed seeds, not with img2img, not with LoRAs at a two-person scale. Teams burn months proving
this and quit.

The gap is *animation consistency*, not art quality. Everything below routes around that one gap.

---

## 2. The core technique: generate once, animate as a puppet

This is how 1940s rubber-hose cartoons were actually made, and how Paper Mario, South Park, and most
2D mobile games work today. The style we picked and the pipeline we need are the same thing.

**Per character, once:**

1. **Generate one hero illustration.** Full body, neutral stance, arms slightly away from the torso,
   flat or transparent background, high resolution. Iterate until it's genuinely great — this is the
   Gloamreach skill, unchanged, and it's the only step where the model needs to be brilliant.
2. **Cut into ~12 parts** in [Photopea](https://photopea.com) (free, runs in a browser): head,
   torso, upper arm ×2, forearm ×2, hand ×2, thigh ×2, shin ×2, foot ×2. Paint behind the seams so
   joints don't show gaps. ~30–60 minutes per character.
3. **Export each part** as a trimmed PNG with a recorded pivot point.
4. **Rig in code.** A bone is `{parent, pivot, rotation, scale, spriteKey, z}`; a skeleton is a tree
   of them. ~200 lines of TypeScript, written once, reused by every character forever.
5. **Animate by tweening rotations.** A walk cycle is 4 keyframes of ~8 rotation values. Squash and
   stretch is `scale` on the root — **zero new art**. A blink swaps one PNG.

**Result:** unlimited animations from one image, perfect frame-to-frame consistency (it's the same
pixels), and a new character costs one good generation instead of forty consistent ones.

**Escape hatch:** if the hand-rolled rig stalls, [DragonBones](https://dragonbones.com) is free with
a JS runtime, and Spine is the paid industry standard with an official Phaser plugin. Start
hand-rolled — Claude debugs code it wrote far better than a third-party runtime.

---

## 3. Three things that cost nothing

**Downscaling hides almost everything.** A character shown at 64px generated at 1024px discards ~94%
of its pixels, and nearly every AI artifact — mushy hands, inconsistent detail, weird edges — lives
in the pixels you throw away. The catch: at 64px only **silhouette and color blocking** read, so
generate characters with deliberately strong, distinctive silhouettes. That's the craft.

**Most of the screen is free.** Static assets need no animation and no consistency across frames:

| Asset class | Approach | Effort |
|---|---|---|
| Trees, rocks, fences, props | Direct generation, background removed | Easy |
| Buildings (5 homestead tiers) | One image per tier | Easy |
| Terrain tiles | Generate large, slice, hand-fix seams | Medium |
| Crops (3 growth stages) | Generate mature, derive earlier stages by scale + crop + desaturate | Easy |
| UI frames, item icons | Direct, batch | Easy |
| Woods parallax backgrounds | Direct — AI's sweet spot | Easy |
| Portraits / dialogue art | Direct — the Gloamreach approach, unchanged | Easy |

**Only ~4 things ever need rigging:** player, weasel (rig reused for all 6 variants), donkey, and
the elephant.

**The Stalker/Woodsman costs nothing and is better for it.** A featureless black silhouette is both
free and genuinely scarier than a detailed monster. Never render it in detail.

---

## 4. The three consistency enforcers

Separately-generated assets look like a scrapbook unless you enforce these mechanically. Automate
all three as `npm run assets:process` using [`sharp`](https://sharp.pixelplumbing.com) (free npm
package): raw generation in, game-ready asset out.

1. **Palette clamping.** Define one fixed 48-color palette. Quantize every asset to it in post. This
   is the highest-leverage consistency trick that exists — mismatched art becomes unified art.
2. **One outline rule.** Golden-age cartoons have consistent bold outlines. Enforce a fixed outline
   weight and color on every asset. Two assets sharing an outline read as the same world even when
   the underlying rendering differs.
3. **A written style bible.** `docs/STYLE_BIBLE.md` holds the exact prompt prefix, negative prompt,
   palette hex list, reference image, and a single fixed lighting direction (key light upper-left,
   always). Every asset goes through it. **No freelancing prompts.**

Use a **reference image** on every generation if your tool supports it — establish the look once,
then anchor everything to it.

---

## 5. Free tools

| Tool | Use |
|---|---|
| [Photopea](https://photopea.com) | Cutting characters into parts. Browser Photoshop, free. |
| [Krita](https://krita.org) | Painting seam fixes, touch-ups. Free desktop. |
| [`sharp`](https://sharp.pixelplumbing.com) | Batch palette clamp, outline, resize. npm. |
| [LibreSprite](https://libresprite.github.io) / [Piskel](https://piskelapp.com) | Pixel-level fixes. Free Aseprite alternatives. |
| [Tiled](https://mapeditor.org) | Map editing, JSON output. Free. |

---

## 6. Why none of this happens in the alpha

Draft 0 uses code-drawn primitives — no image or audio files at all. Four reasons, in order of
importance:

1. **You don't know the art spec yet.** You don't know how large a character is on screen, how many
   animation states you need, what camera distance you settled on, or what reads at that size.
   Generating art before those are known means throwing it away. **The alpha's job is to produce the
   art brief.**
2. **The alpha is a one-shot.** Missing or malformed assets are the top cause of one-shot build
   failures. Zero asset files guarantees it runs.
3. **Art on an unfun loop is time set on fire.** If the walk back to the treeline isn't tense,
   the design changes — and every asset made for the old design is wasted.
4. **Grey-box forces real game feel.** A game that feels good as rectangles will feel incredible
   with art. A game that only works because the art is nice is a bad game with a good coat of paint.

---

## 7. The sequence after Draft 0

1. **Play Draft 0.** Write down the actual numbers: character height in pixels, animation states
   used, how many props are on screen, the camera distance.
2. **Write the style bible** and generate a single reference image you love.
3. **Prove the pipeline on ONE character** — probably the weasel, since it's small, appears
   constantly, and mistakes are cheap. Generate → cut → rig → animate → in-game.
4. **Only then scale up.** If step 3 takes a weekend and looks good, you have your answer and the
   remaining work is mechanical.

Do not generate twenty characters before step 3 works.

---

## 8. When money would actually help

Not as a default — as a targeted fix if something specific fails:

- The puppet rig can't hit the animation quality you want after an honest attempt
- You want a hand-drawn look with real frame-by-frame animation, which AI genuinely cannot do
- Key art and the Steam capsule specifically — the one image that sells the game, where a human
  illustrator's composition instincts are worth real money even if everything else is AI

**Separately, and unrelated to quality:** Steam requires AI content disclosure, and a segment of
players and curators downrate AI art regardless of how good it looks. That's a commercial
consideration, not a technical one, and no technique fixes it. It's your call to make with open
eyes — plenty of games ship disclosed and sell fine.
