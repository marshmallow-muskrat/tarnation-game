# CLAUDE.md — Tarnation

Read this before writing any code. Both founders' agents follow this file, so it is the
single source of truth for how this codebase works.

**Design authority:** `masterplan.md` (and `_II`, `_III`, …). If this file and a
masterplan disagree, the **highest-numbered masterplan wins** — flag the conflict rather than
silently picking one.

---

## What this is

A 2D cartoon farming game with a genuinely horrifying second zone, shipping as a Windows `.exe`
on Steam. Built by two people who are not professional engineers, with AI assistance throughout.

**Consequence for you:** favor clear, boring, well-named code over clever code. The humans
reviewing your work need to understand it. A dense one-liner they can't read is a liability, not
a win.

---

## Stack — pinned

| | |
|---|---|
| Language | TypeScript, `strict: true` |
| Renderer | **Phaser 3** — check `package.json` for the exact pinned version |
| Build | Vite |
| Desktop | Electron + electron-builder |
| Steam | `steamworks.js` |
| Tests | Vitest |

**Phaser API discipline.** Phaser 2 and pre-3.60 APIs are a common failure mode. If you are not
certain an API exists in the pinned version, check `node_modules/phaser/types/` or the installed
docs before using it. Do not write from memory. Log every gotcha you hit in `docs/phaser-notes.md`.

---

## Architecture — the rule that matters most

```
apps/game/       Phaser. Scenes, sprites, input, audio, VFX, cameras.
apps/desktop/    Electron main + preload. Thin.
packages/sim/    ★ Pure TypeScript game logic. NO Phaser. NO DOM. NO window.
packages/content/  Data only: crops, weasels, guns, buildings, loot tables.
packages/shared/   Types, seeded RNG, math.
```

### `packages/sim` never imports Phaser, never touches the DOM

This is the most important rule in the repo. Game logic — genetics, economy, raid generation,
woods loot, the day clock, save serialization — lives in `packages/sim` as pure, testable
functions.

**Why:** it is the only way the humans can verify AI-written game logic. `vitest run` proves the
genetics system works in under a second with no browser. Logic buried in a Phaser scene is
untestable, and untestable AI code is where bugs live.

If you find yourself wanting to import Phaser into `packages/sim`, the design is wrong. Return
data from the sim and let the scene render it.

### Determinism

- **One seeded PRNG** (`mulberry32` in `packages/shared`), seeded from the save.
- **`Math.random()` is banned in `packages/sim`.** Enforced by ESLint. Do not disable the rule.
- **Fixed timestep:** the sim ticks at a fixed 30Hz, accumulated from render delta. Never derive
  game state from raw frame delta — it makes behavior differ between 60Hz and 144Hz monitors.

---

## Non-negotiables

1. **No network calls in the shipped game.** No CDN fonts, no analytics, no telemetry, no remote
   asset loading. Everything is bundled. The game must run fully offline forever.
2. **The renderer loads via the `app://` custom protocol**, never `file://`.
3. **Electron security:** `nodeIntegration: false`, `contextIsolation: true`. All main-process
   access goes through a narrow, explicit `preload.ts` bridge.
4. **Saves are atomic.** Write to `save.tmp`, fsync, then rename over `save.json`. Never write in
   place. Keep 3 rolling backups. Save format is versioned with an explicit migration per bump.
5. **Never break an existing save format without a migration.** Players losing a 30-hour save is
   the worst thing that can happen to this game.

---

## Testing

- Every `packages/sim` module needs tests. No exceptions.
- Balance is verified by **simulation**, not by feel: run thousands of iterations and assert on
  the distribution. Example: 100,000 random crossbreeds must not produce trait runaway, and the
  "absurd" Weirdness tier must be reachable in ~2 in-game weeks of deliberate play but
  essentially never by accident.
- Run `npm test` before proposing any change to `packages/sim`.

---

## Style

- Descriptive names over short ones. `weaselRaidIntensity`, not `wri`.
- Comment the **why**, never the what. If the what isn't obvious, rename things instead.
- No new dependency without asking. Every dep is a thing two non-engineers have to maintain
  forever and a potential supply-chain risk in a shipped binary.
- Data goes in `packages/content` as typed data, not hardcoded in logic. Crops, weapons, weasel
  stats, and loot tables must be editable without touching code.
- Prefer many small files over few large ones — easier to review, easier to revert.

---

## Performance budget

Check these at every milestone; regressions are bugs.

| Metric | Budget |
|---|---|
| Frame time | < 16.6ms (60fps) with 60 weasels + full particles |
| Sim tick | < 2ms |
| Cold start to playable | < 6s |
| Installed size | < 1.5 GB |
| Idle RAM | < 700 MB |
| Save write | < 50ms, never on the render thread |

---

## The tonal contract — this is a code constraint, not just vibes

The farm is a cartoon. The woods are sincerely frightening. **They never blend.**

**No jokes past the treeline.** Not in item names, not in death messages, not in sound effects,
not in UI copy. If you are writing anything that appears in the Dark Woods, it is not funny. The
comedy is what the player is protecting; the woods are what they are protecting it from.

The two zones differ mechanically and technically, not just artistically — see the Contrast Table
in `masterplan.md` §2. Notably: **farm characters animate on 2s (12fps, snappy,
squash-and-stretch); the Woodsman moves at smooth 60fps with real easing.** That difference is a
deliberate scare mechanic. Do not "fix" it.

---

## Workflow

- Branch from `main`: `feat/…`, `fix/…`. Branches live 2–3 days maximum.
- Small commits. They're the humans' undo button when an AI change goes wrong.
- Every PR gets reviewed by the other founder. Write PR descriptions for someone who did not
  watch you build it.
- Log significant decisions in `DECISIONS.md` with the reasoning and the rejected alternatives.
- Do not add features that are not in a masterplan. Scope creep is the top project risk — see
  masterplan §15 for the explicit "will not build" list. If you think something is missing,
  propose it for the next masterplan rather than building it.
