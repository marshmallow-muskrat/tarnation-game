# TARNATION — Idea Sheet, triaged

**Source:** `tarnation-idea-sheet-static_1.html`, 78 entries across 11 sheets, dated Jul 31 2026.

This document keeps every original idea intact, adds implementation guidance, and sorts them by
**build order** rather than by sheet. Nothing is deleted — items I recommend against are kept with
the reasoning, because "we decided not to, and here's why" is worth more later than silence.

**Overall read: the raw quality here is high.** The production notes attached to several sheets
are sharper than what's in the masterplans — the irrigation note in particular is a better design
principle than the one I wrote, and it's been promoted into the recommendations below.

---

## 0. Four structural notes, before the list

### 0.1 Nothing here is for the Dark Woods

78 entries. All of them farm-side, and nearly all comedic. There is not one idea for the horror
half of the game.

That's the biggest risk in this document. The tonal contrast **is** the differentiator — a cozy
farming game is a crowded genre, and "cozy farming game where the woods are sincerely wrong" is
not. If all the design energy goes into farm progression, the likely outcome is a decent farming
game with a vestigial horror zone bolted on, which is a much worse product than either half done
properly.

**Recommendation:** for every farm sheet, write a woods sheet. The next idea session should be
woods-only, and it should be hard, because comedy is easier to brainstorm than dread.

### 0.2 Several sheets imply a much larger game

Water combat implies boats, water traversal, and — per the Goose Team note — **pirates**. City
building at 25 pieces implies a placement and build system. The artillery group implies
emplacements and base defence. Combined, these sheets are roughly **3–4× the current scope**.

None of them are bad. They're mis-sequenced. See §4.

### 0.3 The money layer — just landed ✅

City Building, The Golden Age, Crop Insurance, and Rain Dance are all **money sinks**, and a sink
can't be designed before the source exists.

**As of the "Batch 2" commits, the source exists.** Ducketts, a market stall, a 24-slot inventory,
and per-item prices in `src/sim/items.ts` — grass 6, dandelion 8, turnip 10, carrot 12, onion 14,
wood 1, darkwood 10. Four sheets are now unblocked.

**What's still missing is the curve.** Prices exist; *income per day* doesn't. Before pricing the
aqueduct per span (§1.6) or anything in City Building, measure roughly what a competent player
earns per day at each stage. Everything downstream is priced against that number, and guessing it
means re-pricing everything twice.

Note `CROP_SELL_VALUE = 0` still sits in `content.ts` — dead now that `items.ts` owns pricing, and
worth deleting before someone wires it up by mistake.

### 0.4 The chopping tiers collide with the tonal contract — and that's an opportunity

`CLAUDE.md` says **no jokes past the treeline.** The chopping sheet is all jokes: the chainsaw that
starts on the eleventh pull, the beaver crew that looks at you expectantly.

Don't resolve this by making the tools serious. Resolve it by **letting the zone change what the
joke means**:

> The chainsaw taking eleven pulls is a gag on the farm. In the Deepwood, with Attention at 80 and
> something moving at the edge of the lantern, a tool that won't start is one of the most
> frightening mechanics you could ship.

**Same code, opposite emotional valence, decided by zone.** That is the single best idea to come
out of reading this sheet, and it costs nothing — the mechanic is already written. Apply the same
lens to the rest: the Molasses Jug slowing *you* is funny on the farm and horrifying in the woods.

---

## 1. TIER 1 — Build next

High value, on-thesis, and cheap relative to what they return. Roughly in order.

### 1.1 The money layer *(unblocks four sheets)*

Not from the sheet, but everything below depends on it. Crop sell values, a buyer (the travelling
merchant from `masterplan.md` §4), and an income curve. Keep it small: one merchant, weekly, fixed
prices to start. Variable pricing is a later problem.

### 1.2 Tilling tiers 1–3 — hands → bent spade → push plow

The yield curve in the sheet is already correct and already done:

| Tier | Rate | Step |
|---|---|---|
| Hands, 6 clicks | 0.42 t/s | — |
| Bent spade, 4 clicks | 0.63 t/s | 1.5× |
| Push plow, 1 wide @ 60% | 1.20 t/s | 1.9× |

Ship these three now; they need no new systems. Tiers 4–5 need a mount system (§2.1).

**One flag on the curve:** the Mole at 6.00 t/s is **14× the opening rate**. That is a very steep
ladder, and it means late-game tilling is effectively free — which quietly removes the constraint
that makes irrigation and plot layout interesting. The sheet's instinct to balance the Mole on
cooldown and duration rather than speed is right, and should be treated as a hard rule, not a note.

### 1.3 Damage tiers — adopt all five, replacing the masterplan's list

Rock → Slingshot → Bow → Blunderbuss → **Anvil Launcher**. The Rock at tier 0 ("sometimes comes
back") is a better opening than starting on the slingshot, and the Anvil Launcher — spring-loaded,
three seconds of hang time, a bell tone on impact — is a perfect capstone. The hang time is the
mechanic: it's a commitment weapon you aim where things *will be*.

Supersedes `masterplan.md` §10.2.

### 1.4 The Brainstorming sheet — highest hit rate in the document

Cheap, funny, mechanically real, and each one is a self-contained system. Build these before
anything structural.

| Idea | Implementation | Why it's worth it |
|---|---|---|
| **The Sign** | Per-weasel `canRead: boolean`. Sign repels any weasel with `canRead === false`. On each repel, small chance to flip that weasel's flag permanently. | A joke with a **memory**. Cheap, and the moment a player notices one specific weasel ignoring the sign is the clip that gets shared. Highest value-per-line in the whole document. |
| **Decoy Pie** | Placeable that overrides weasel target selection within a radius for N seconds. | Solves a real problem (being across the map) and it's funny. Reuses existing AI targeting. |
| **Molasses Jug** | Ground area applying a speed multiplier to anything overlapping — **including the player**. | "Especially you" is what makes it good. Then reuse it in the woods, where it stops being funny. |
| **Mystery Seed** | Rolls a random species with randomised traits, occasionally a hostile one. | Feeds the crossbreeding system, which is the signature mechanic. Also the cheapest possible content generator. |
| **The Fiddle** | Channelled: crop growth ×N in a radius while held, player rooted, cancels on move. | Real tradeoff, no new systems, and it gives the player something to do while waiting. |

### 1.5 Crops — add all five

Mangelwurzel, Rutabaga, Miner's lettuce, **Romanesco**, King Henry greens. Pure data. Romanesco
especially — it's fractal, so it reads as distinctly weird at a glance, which does free work for
the crossbreeding fantasy.

### 1.6 Irrigation — adopt the sheet's framing over the masterplan's

The sheet's note is a better design principle than mine and should replace it verbatim:

> **Axis is upkeep, not throughput — each tier removes a constraint rather than adding a number:**
> daily re-watering, then distance from water, then having to build anything at all.

Two specifics worth keeping:

- **Ditch & sluice gate** is better than the masterplan's plain "trench" — it silts up over time and
  weasels breach it, so it stays a live system instead of a one-time unlock.
- **Price the aqueduct per span**, so cost scales with farm size and keeps absorbing money all game.
  That's a genuinely sophisticated economy idea: a sink that grows with the player automatically.

### 1.7 Housing — adopt the naming and the silhouette grammar

Lean-To → Clapboard Shack → Homestead → Roadhouse → **The Victorian**. The readable grammar —
**height, smoke, light, clutter** — is exactly right and should be a build rule: every tier must be
identifiable from across the map with no label.

**One disagreement.** The sheet says "cosmetic only for now." Don't. `masterplan.md` §8.4 has
housing gating storage, bag size, and night defence, and that's what makes the player want the next
tier. The sheet's own Golden Age note makes this argument better than I can: *"a player who does the
arithmetic will never buy a pure money hole."* The same logic applies here.

---

## 2. TIER 2 — Build after the core loop is proven

Good ideas that need a system built first, or that should wait until the farm/woods loop is known
to be fun.

### 2.1 Mount system → Tilling tiers 4–5, and The Whistle

**The Whistle is the right design and should be built first**, before any individual mount. One
slot that calls whichever creature you have tamed; upgrades add animals, not buttons. That's real
UI discipline — three summons collapsing into one input.

Then: Donkey & Plow (2 wide, 75%) and **The Mole** (3 wide, 100%, surfaces to get its bearings).
Balance both on summon cooldown and duration.

### 2.2 The Elephant

Irrigation tier 4. Already in `masterplan.md` §8.3 and still the best marketing image in the game.
Needs the same mount/summon system, so it lands with §2.1.

### 2.3 Chopping tiers, with the zone-flip

Hatchet 5 chops → Felling axe 4 → Crosscut saw 3 → Chainsaw 2 → Beaver bucket TBD.

Build the ladder; apply §0.4. Beaver Bucket is farm-side only — a comedy crew has no business past
the treeline.

### 2.4 City building — build the system, ship eight pieces

The sheet's own note is the correct plan and deserves quoting:

> The real cost here is not art, it is placement: grid snapping, rotation, collision and undo. That
> system costs the same whether you ship four pieces or forty, so build it once with a handful and
> add sprites after.

That's right. Build placement once, ship a starter set, and let the other 17 arrive free over time.

**Starter eight, chosen for silhouette variety and free-asset availability:** Water tower, Grain
silo, Windmill, Split-rail fencing, Lamp posts, Covered well, Rain barrel, Chicken coop.

**One change I'd push:** give roughly half of them a small *functional* effect rather than shipping
25 pure cosmetics — rain barrel as a water source, lamp posts with a small weasel-deterrent radius,
chicken coop producing a slow trickle of something. Same argument as §1.7. Decoration is a fine
reward; it's a weak *purchase*.

### 2.5 Rain Dance — but as weather, not a button

The sheet flags this itself, correctly: *"the only idea here that can undermine a ladder you have
already designed."* Paying cash to water everything makes the irrigation ladder — a Tier 1 system —
optional.

**Fix:** make it a rare *event* rather than a purchasable action. A dance you can perform once per
season, or a weather system that occasionally does it for free. Keeps the moment, removes the
substitution.

---

## 3. TIER 3 — Deferred

Not rejected. Wrong slot.

### 3.1 Water combat & the Goose Team

**The design itself is the best single entry in the document:**

> Firing panics the team and throws your heading; reloading calms them, so the fight becomes a
> negotiation between shooting and steering and you cannot do both well… Difficulty lives in the
> mount's personality rather than enemy damage numbers — easier to tune, and players resent their
> own mistakes far less than an enemy that simply hits harder.

That last sentence is a real design insight and it should be applied to the Mole and the Elephant
immediately, whether or not the geese ever get built.

**But:** this needs water traversal, boat physics, naval combat, and pirates — an entire third
pillar that appears in no masterplan. It is a post-launch update or a sequel, not a v1.0 feature.
Building it before the farm/woods loop is proven is precisely the scope creep that kills first
games.

**Verdict: defer, keep the design note, steal the philosophy now.**

### 3.2 Experimental ultimates — keep three, defer nine

Twelve bespoke ultimates is where scope death lives. Each needs unique VFX, unique balance, and
unique bugs.

**Keep:**
- **Corn Cannon** — already exists as "The Cropper" in `masterplan.md` §10.2, and it's the keystone
  that makes crops into ammo. Merge the two.
- **Fairy Ring** — ties directly to the mushroom/weasel trap system that's already designed. Cheap:
  an area that swaps weasel AI state.
- **The Starter** — sourdough goes feral, grows, engulfs the field. **This is the only entry in the
  entire document that bridges comedy and horror**, which is exactly the thing §0.1 says is missing.
  Worth building for that reason alone.

**Defer:** Portable Hole, Giant Magnet, Beanstalk, Weathervane, Dowsing Rod.

**Defer as a group:** the four artillery pieces (Silo Mortar, Beehive Launcher, Cider Press,
Chicken Battery). They're four variations on "lob a thing," which means they're really one
emplacement system — and an emplacement system implies base-defence-with-turrets, a different game
from the one being built.

### 3.3 The Golden Age — with one exception

The Castle and The Colossus are endgame monuments for an economy that doesn't exist. Defer until
there's demonstrated runaway money surplus (which is the only thing that justifies them).

**The Great Wheel is different and I'd pull it forward.** The sheet notes it's the only build with
both motion *and* light at distance. In a game whose second zone is dark and hostile, **a lit wheel
turning on the horizon, visible from inside the treeline, is an emotional anchor**: home is over
there, and it's warm. That's worth building for the horror half, not the farm half — which makes it
the one Golden Age item that earns its cost.

---

## 4. TIER 4 — Recommend against

### 4.1 Crop Insurance

The sheet describes it perfectly: *"Optional, boring, and the correct play."* That self-awareness is
funny, but it's also an accurate description of a mechanic that lets players **opt out of the
Defend pillar** — one of the four pillars the whole design rests on.

If night raids are working, insurance makes them not matter. If they aren't working, insurance is a
band-aid on the real problem. Either way it's the wrong fix.

**If you love the joke, keep the salesman as an NPC** who tries to sell it and is always turned
away. All of the comedy, none of the mechanical damage.

### 4.2 Pure-cosmetic sinks, as a category

The Golden Age note gets this exactly right and it deserves to be a project-wide rule:

> A player who does the arithmetic will never buy a pure money hole, and one who buys it anyway will
> feel cheated when nothing happens.

Applies to housing (§1.7) and city building (§2.4) too. Every purchase should return *something*,
even if it's small and even if it's only navigational.

---

## 5. Suggested order

| # | Work | Unblocks |
|---|---|---|
| ~~1~~ | ~~Money layer — sell values, merchant~~ ✅ **done** (Ducketts, market stall, inventory) | City building, Golden Age, everything priced |
| 1 | **Income curve** — measure ducketts/day at each stage | Pricing anything correctly, once |
| 2 | Brainstorming five: Sign, Decoy Pie, Molasses Jug, Mystery Seed, Fiddle | Nothing — pure value, ship immediately |
| 3 | Crops ×5, damage tiers ×5, tilling tiers 1–3 | Ladders players can feel |
| 4 | Irrigation reframe (upkeep not throughput) + ditch & sluice | Aqueduct pricing |
| 5 | Housing functional tiers | The first real money sink |
| 6 | **Woods idea session** — see §0.1 | The half of the game with no ideas yet |
| 7 | Mount system → Whistle → Donkey, Mole, Elephant | Tilling 4–5, irrigation 4 |
| 8 | Placement system + 8 city pieces | The other 17, free |
| 9 | Corn Cannon, Fairy Ring, The Starter | — |
| 10 | The Great Wheel | Horizon anchor for the woods |

Everything else waits.

---

## 5b. Parked — agreed, not now

**Avatar selector.** Let the player choose their character (male/female, and probably outfit) at
the start. The Quaternius Ultimate Animated Character Pack has 52 models sharing one rig and one
animation set, so the models are already free — the work is a selection screen plus storing the
choice in the save. Cheap, but not before the economy loop is proven. Player is Cowboy_Male for now.

**Weasels, donkeys and specific creatures.** Don't force a species the packs don't have. The crop
raider is a **fox**, because the animated pack ships one and a tinted fox pretending to be a weasel
looks worse than a fox. Donkey does exist in the pack and is available whenever the mount system
lands. Anything genuinely missing gets solved later — cohesion beats a wishlist.

## 6. Open questions for the next pass

1. **Is there money in this game, and how much per day?** Four sheets depend on the answer.
2. **What is the woods equivalent of this document?** (§0.1)
3. **Are pirates a real plan or a stray thought?** It changes the scope of the whole project.
4. **The Mole at 14× opening tilling speed** — is late-game tilling meant to be free? If yes, what
   replaces it as the constraint?
5. **"Claim stakes" vs "Benchmarks"** for the survey stakes — the sheet leaves this open. Claim
   stakes reads better and is more thematically Americana.
