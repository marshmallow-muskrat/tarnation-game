# Audio Pipeline — free, and good

**Position:** audio can be free, same as art. Budget $0. The gap between Gloamreach's audio and
what Tarnation needs is **code, not purchased sound**.

Read alongside [`ART_PIPELINE.md`](ART_PIPELINE.md) — same logic, same conclusion.

---

## 1. What's actually different from Gloamreach

Gloamreach needed a score loop, UI sounds, and combat sounds. Tarnation needs all of that plus
**audio that responds to game state**: silence that arrives on a zone change, reverb that tightens
with depth, a tone that rises with dread, a sound that plays back at you from the wrong direction.

None of that is a better sound file. All of it is code operating on sounds you already have.

| The horror requirement | What it actually costs |
|---|---|
| Silence in the woods | **Free by definition.** The most important audio decision in the game. |
| The mimic — your own axe, replayed from behind you | A delay buffer + a pan value. Reuses an existing sound. |
| Reverb that changes with depth | Web Audio `ConvolverNode`. Free impulse responses widely available. |
| Rising low tone tied to Attention | One sample, or synthesized. Volume is a lerp. |
| Close-mic'd foley: breathing, boots, cloth | Free libraries, or record it yourself on a phone. |
| Score ducking when something matters | Gain automation. Code. |

**The expensive thing a sound designer sells is judgment** — that the tone sits quiet and fades
over eight seconds rather than two. That's a late-stage refinement you can iterate toward yourself,
not a prerequisite for having good audio.

---

## 2. Free sources

| Source | What | License caution |
|---|---|---|
| **Record it yourself** | Footsteps, breathing, cloth, chopping, water | None — you own it. Often *better* for horror: unfamiliar sounds are unsettling. |
| [freesound.org](https://freesound.org) | Enormous library | **Mixed licenses.** Filter to CC0. CC-BY needs attribution; NC licenses are unusable. |
| [Pixabay Audio](https://pixabay.com/sound-effects/) | SFX + music | Generally commercial-safe. Verify per file. |
| [Kenney](https://kenney.nl/assets?q=audio) | Game-ready SFX packs | CC0. Safest option available. |
| AI music generation | The farm score | **Check your tier's commercial rights.** See §4. |

**Cartoon foley is one of the most abundant categories in free libraries** — boinks, slide whistles,
xylophone runs, comedy percussion. The farm's entire sound palette is essentially solved for free.

---

## 3. Technique that costs nothing

These are the difference between "has sounds" and "sounds good." All code.

1. **Randomize pitch and rate ±8%** on any repeated sound. Footsteps, chops, hits. Without this
   they machine-gun and read as cheap instantly. This is the single highest-impact line of audio
   code in the project.
2. **Layer everything.** One sample is thin. A chop is impact + wood crack + leaf rustle. Three
   cheap free sounds layered beat one expensive sound every time.
3. **Silence is a signal, not an absence.** The player hears the farm score for hours; cutting it
   dead on entering the woods lands like a slap. **No fade — a hard stop.**
4. **Duck the mix** when something matters. Drop everything else 12dB when the Stalker spawns.
5. **Low-pass filter to signal wrongness.** Rolling the high end off makes anything read as distant,
   underwater, or muffled. One `BiquadFilterNode`.
6. **Reverb by zone.** Farm is dry and open. The Hollow is a small, close, wet room — which makes no
   sense outdoors, and the player feels it before they can name it.

Phaser 3 runs on Web Audio, so you can reach the `AudioContext` and insert filters, convolvers, and
gain nodes into the graph directly.

---

## 4. The real risk: licensing, not quality

This is what can actually bite you on Steam, and it's worth more attention than sound quality.

- **CC-BY requires attribution.** Fine, but you must actually ship a credits screen listing it.
- **CC-BY-NC is unusable.** Non-commercial licenses cannot go in a paid game. This is the one that
  catches people.
- **AI-generated music commercial rights depend on your subscription tier.** Free tiers on most
  generators do *not* grant commercial use. Read the terms for the tier you're actually on, at the
  time you generate — these terms change.
- **Keep `docs/AUDIO_CREDITS.md` from the first sound you add.** Filename, source URL, license,
  attribution text. Reconstructing this at launch is miserable and error-prone; maintaining it costs
  ten seconds per file.

Steam's AI disclosure requirement covers AI-generated audio too, not just art.

---

## 5. Why the alpha ships silent (or nearly)

Same reasoning as grey-boxed art. Draft 0 has no audio files; optionally, a few Web Audio synth
blips and a 4-note arpeggio that hard-stops in the woods.

**That arpeggio-stop is worth building even in the alpha**, because it costs almost nothing and it
tests the single most important audio decision in the design. If the silence lands, you know the
contrast works before you source a single file.

---

## 6. Where money would still help

Only as a late, optional refinement — not a prerequisite:

- **A mixing pass** near launch. Someone with trained ears balancing levels across the whole game.
  This is the highest-value paid audio work and it's a small scoped job, not a full contract.
- **Original score** if AI generation can't hit the specific cartoon-orchestral register you want.

Plan for $0. Revisit at M6 if something specific isn't working.
