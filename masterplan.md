# Tarnation — Premium Farming Sandbox Masterplan

**Status:** active product plan  
**Scope:** refine and deepen the current game before adding major new systems  
**Progress:** Milestones 0–2 implemented; Milestone 3 calibration is in progress
**Last reviewed:** 2026-08-01

## Product brief

Tarnation is a cartoon-Americana, low-poly, fixed-isometric economic sandbox. The player turns a
small homestead into a productive settlement by farming, gathering, exploring, defending crops,
selling goods, and choosing which improvements to fund next. Progression is intentionally
non-linear: a player can lean into farming, timber, hunting, exploration, building, or a mixture of
them. The wider game can eventually contain several maps of different difficulty, triggered secret
zones, and compact boss, challenge, and treasure zones, but the current priority is making the
existing farm loop feel complete and premium.

The shipped technology is Three.js + React + Vite, with static deployment to Cloudflare Pages.
Game simulation lives in `src/sim/` and stays renderer-independent. Models are data-driven through
`src/content/models.ts`, loaded with the safe primitive fallback in `src/game/Assets.ts`, and
instanced wherever the scene contains many copies.

## Simulated IGN-style review of the current build

This is an internal review, not a real IGN score or quote.

### Current score: 4.5/10 — promising vertical slice

Tarnation already has a memorable foundation. The isometric farm has a clear silhouette, the
Quaternius assets give the world a coherent low-poly language, and the combination of crops,
trees, water, a market, fox raids, traps, and building upgrades points toward a genuinely pleasant
economic sandbox. The best part is the direction: the game has a recognizable identity instead of
looking like a generic farming prototype.

It currently feels like a demo because the player-facing layer does not yet make the underlying
systems feel intentional. Equipped tools can intersect the character or swing from an unreadable
angle, locomotion and carry animations do not always agree, and combat feedback can continue when
the selected tool is not a weapon. The bear trap has visual residue that reads like a placeholder
slab. HUD icons vary in clarity, notifications can compete for the same space, and the player has
to infer too much about range, timing, crop state, fox attacks, and building validity.

The economy has useful scaffolding but its pacing is not yet demonstrated end-to-end. The supplied
economy workbook is a valuable starting hypothesis—roughly 300 actions per in-game day, a short
crop cycle, distinct income paths, and a boss attempt that is meaningful without dominating the
whole economy—but those numbers still need to be measured against actual play. The world also
needs stronger sound, impact, animation, and state feedback before its systems can carry a premium
experience.

### What is already working

- A distinct visual identity and a coherent asset source.
- A playable movement, farming, gathering, selling, and exploration loop.
- Real player, tree, crop, scatter, animal, tool, trap, and building models with fallback safety.
- Multiple economic paths and the beginnings of progression, genetics, raids, and construction.
- A data-oriented architecture that can be tested without opening the browser.

### What prevents a 10/10 today

1. **Presentation reliability:** held items, action poses, shadows, traps, icons, and transitions
   must read correctly from every camera angle and at every movement speed.
2. **Interaction clarity:** every click needs a visible, audible, or textual confirmation; invalid
   actions need a reason; danger needs a fair telegraph.
3. **Loop depth:** farming, gathering, selling, fox defense, and building need satisfying decisions,
   costs, timing, and consequences rather than only working mechanically.
4. **Pacing:** the economy needs a measured first session, meaningful upgrade cadence, and viable
   non-linear income paths.
5. **Finish quality:** audio, particles, camera response, loading, save recovery, accessibility,
   and performance need a release bar rather than demo defaults.

## The 10/10 target

The premium version of Tarnation should feel calm and readable during ordinary farm work, then
sharp and decisive when something threatens the player’s plans. It should reward experimentation
without requiring a wiki. A new player should understand the first profitable action within a few
minutes, while a returning player should see several credible ways to improve the homestead.

The following are non-negotiable quality pillars:

- **Readable first:** silhouettes, held tools, crops, foxes, interactables, and danger states are
  recognizable at the normal camera distance.
- **Responsive second:** input produces immediate feedback, with animation and simulation timing
  agreeing instead of fighting each other.
- **Economically honest:** prices, yields, upgrade costs, and risk support multiple viable paths;
  no path is accidentally mandatory because of an unmeasured multiplier.
- **Coherent world:** the same scale, lighting, materials, naming, and visual language apply across
  farm, water, buildings, animals, UI, and challenge spaces.
- **Safe to experiment:** save data migrates, missing assets fall back, and mistakes are reversible
  enough that players try new crops, tools, layouts, and strategies.
- **Quietly polished:** no overlapping HUD, invisible walls that feel arbitrary, floating props,
  z-fighting, unexplained projectiles, stuck animation states, or placeholder terminology in the
  shipped surface.

## Execution plan

### Milestone 0 — Foundation and truth (P0)

**Goal:** make the repository and runtime describe one current game.

- Retire `IDEAS.md` and remove historical planning documents that describe superseded systems.
- Make `HANDOFF.md`, `CLAUDE.md`, `ASSETS.md`, `README.md`, and the asset credits agree on the
  current Three.js/React/Vite/Cloudflare game.
- Rename active fox-facing domain language from the old raid prototype terminology to foxes,
  including content keys, simulation names, save stats, tooltips, tests, and telemetry-facing
  strings. Keep save migrations only where they protect existing players.
- Remove obsolete crop and woodland terminology from active code and docs. The crop roster follows
  available art: Grass, Dandelion, Beet, Carrot, and Lettuce.
- Add a small browser QA checklist and keep `scripts/simcheck.ts` aligned with the live roster.

**Exit criteria:** a repository-wide search finds no obsolete user-facing concept; typecheck and
simulation checks pass; a fresh save and a migrated save both load.

### Milestone 1 — Player and tool presentation (P0)

**Goal:** make every equipped item look deliberately held and animated.

- Establish a named right-hand socket and per-item grip profiles: scale, local offset, rotation,
  carry pose, action pose, and shadow policy. Do not tune four unrelated literals in the runtime.
- Validate the shotgun, shovel, red survival axe, bow, and future melee items in idle, walk, run,
  turn, water crossing, camera rotation, and one-shot action poses.
- Use the rig’s carry clips for locomotion and a consistent action state machine for pickup,
  digging, chopping, slashing, and shooting. An action must finish cleanly before locomotion takes
  over again.
- Make shovel tilling/digging and axe chopping visibly distinct, with a sensible contact moment.
  Prevent duplicate action restarts and gate damage/effects to the active tool.
- Ensure projectile creation is impossible unless the ranged slot is selected and equipped. Clear
  old projectiles and their shadow casters when changing tools.
- Remove stray collision/grounding geometry from trap models and ensure placed traps have one clear
  footprint, readable open/closed states, and correct shadows.
- Frame toolbar model icons for recognition first; use the model where it reads better than an
  emoji, while retaining the bucket glyph where it is clearer.

**Exit criteria:** no visible item penetrates the player or drags at the feet in the standard camera
view; each equipped item is recognizable in a one-second screenshot while idle and running; only
the shotgun can fire; shovel and axe actions visibly contact the intended target.

### Milestone 2 — Interaction feel and combat fairness (P0/P1)

**Goal:** make ordinary work and fox encounters satisfying and legible.

- Add a shared action-feedback vocabulary: contact flash, small particles, sound hook, subtle camera
  response, and a short cooldown indicator where appropriate.
- Make trees, crops, water, traps, buildings, and foxes expose range, target, invalid state, and
  result without relying on a debug console.
- Give foxes approach, attack, hit, caught, retreat, and defeat states with separation so multiple
  attackers do not collapse into one pile around the player. Cap simultaneous contact damage and
  make the attack window visible.
- Make the bear trap’s radius, trigger, closed model, reward, and reset/persistence state clear.
- Add input buffering only where it improves feel; never let buffered clicks repeat a stale action
  after the player changes slots.

**Exit criteria:** a player can explain why an action succeeded or failed from the game view alone;
three foxes remain visually separable; no attack or projectile survives a tool swap.

### Milestone 3 — Farming, gathering, and economy calibration (P1)

**Goal:** turn working systems into a satisfying first-session economy.

- Instrument actual actions, days, sales, crop cycles, upgrade purchases, fox losses, and time to
  first meaningful upgrade in a deterministic test run.
- Use `tarnation_economy_base.xlsx` as the baseline hypothesis, representing its outdated raid
  wording as foxes in project documentation. The useful anchors are approximately 300 actions per
  in-game day, a two-day crop cycle, distinct wood/fish/crop/trophy paths, a short first-session
  ramp, and a boss attempt that is costly but not mandatory.
- Reconcile the workbook’s income paths with the systems that actually exist in the game. Do not
  introduce a fish or boss mechanic merely to satisfy a spreadsheet row; label unimplemented rows
  as future calibration targets.
- Keep the current art-led crop roster and ensure each crop has distinct growth readability, risk,
  margin, and reason to exist. Balance by observed time-to-cash, not only nominal sell price.
- Make soil, watering, crop maturity, harvesting, genetics, and selling communicate state and
  reward. Remove dead-end actions and invisible prerequisites.
- Tune homestead costs and income so the first upgrade arrives during the intended first session,
  while later upgrades require a real choice between reinvestment and cash.

**Exit criteria:** a fresh player reaches the first meaningful upgrade without a guide; at least
two income paths are competitive; the measured first-session curve is documented and repeatable.

### Milestone 4 — Homestead and building polish (P1)

**Goal:** make building progression feel physical and consequential.

- Give each homestead tier a clear before/after silhouette, construction action, cost preview, and
  completion response.
- Make placeable buildings snap predictably, show valid/invalid footprints, avoid water and overlap,
  and persist across reloads.
- Use the existing barn, silo, windmill, well, coop, fence, and tower assets to create useful
  choices before adding a larger city-building catalog.
- Add lightweight ambient life and state changes to upgraded spaces rather than expanding the map
  prematurely.

**Exit criteria:** a player can place, cancel, move where allowed, and understand the benefit of a
  building without consulting documentation.

### Milestone 5 — UI, onboarding, accessibility, and audio (P1)

**Goal:** make the game welcoming and pleasant for a long session.

- Replace stacked instructional text with one prioritized message channel plus short-lived action
  feedback. Keep the action bar readable at common window sizes.
- Add a compact first-day onboarding path, pause/help screen, remappable actions, camera zoom
  bounds, reduced camera motion, high-contrast target outlines, and a readable text scale.
- Add a small coherent sound set for footsteps, tool contact, crops, water, sales, fox warnings,
  traps, building, and UI. Randomize repeated sounds and keep a credits ledger for third-party
  audio.
- Use audio and visual emphasis to separate work, reward, warning, and failure without making the
  screen noisy.

**Exit criteria:** a first-time player can complete the first crop and sale with only the in-game
  help; no HUD elements overlap at the supported viewport sizes; key information is available
  without relying on color alone.

### Milestone 6 — Performance, saves, and release hardening (P0 at release)

**Goal:** make the polished loop reliable.

- Keep scatter batched and profile frame time with full chunk density, many crops, several foxes,
  placed buildings, and active water.
- Add asset-load diagnostics that identify a missing model without breaking the scene; verify all
  accepted manifest entries in a build smoke test.
- Test save/load, day rollover, tool swaps, trap persistence, building persistence, crop growth,
  and schema migration from every supported prior save version.
- Add a repeatable browser smoke route for fresh game, farming, combat, trap, building, save/load,
  and deploy verification.
- Set the release bar at 60fps on the target desktop, no console errors during a normal session,
  no stale projectiles or shadows, and a playable scene within six seconds on a warm production
  load.

**Exit criteria:** production build passes typecheck, simulation checks, browser smoke checks, and
the performance budget; Cloudflare deployment is verified after every major milestone.

## Priority order

| Priority | Work | Reason |
|---|---|---|
| P0 | Equipped item socket/profiles, action state machine, projectile gating, trap footprint | These are visible correctness bugs that undermine every system. |
| P0 | Fox separation and attack feedback | Multiple attackers must remain fair and readable. |
| P0 | Save/load and missing-asset safety | A premium economy cannot lose progress or fail on one asset. |
| P1 | Farming/economy calibration, building feedback, HUD/onboarding | Converts the vertical slice into a repeatable game. |
| P1 | Audio, particles, camera response, accessibility | The final layer of feel and comprehension. |
| P2 | Additional maps, secret zones, bosses, challenge/treasure zones, larger town catalog | Expand only after the current loop earns expansion. |

## Definition of done for every milestone

Each milestone produces a small commit, a passing `npx tsc --noEmit`, and a browser smoke check.
The live site is deployed after each major milestone, with the production URL recorded in the
handoff. Screenshots are captured for visual work. Any new tuning number is documented with the
reason, observed result, and a rollback path.

The game is ready for a serious public review when a new player can understand, enjoy, and recover
from the first session without external explanation; a returning player has multiple profitable
choices; and the game never asks the player to forgive a bug in order to see the underlying idea.
