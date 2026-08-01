# Vendor, Deed, Placement, and Enclosure Plan

This is the implementation record for the vendor/deed system specification. It is
written for the current Tarnation game: an isometric economic farming sandbox with
foxes, not weasels, and a renderer built on Three.js/React/Vite.

The plan is intentionally ordered by dependency. Each independently testable slice
gets its own commit. Major milestones are deployed after validation so every change
has a playable checkpoint.

## Architecture decisions

- Keep `src/content/models.ts` as the 3D model manifest.
- Add a separate gameplay catalog for purchasable and fixed placed assets.
- Keep catalog IDs stable forever; never recycle or renumber an ID.
- Keep catalog records and placement/enclosure rules renderer-free in `src/sim`.
- Keep fixtures in the catalog format but mark them unavailable for purchase.
- Treat foxes as the current crop-raider species everywhere in game code and docs.
- Keep the high inventory cap and the inventory-space check even while testing mode
  makes purchases free and unlimited.
- Stacking is permanent: identical items occupy one inventory slot with a quantity.

## Catalog record

The new asset catalog contains one record for every purchasable or fixed placed
asset:

```ts
{
  id,
  displayName,
  category,
  useType,
  modelKey,
  footprint: { width, height },
  facings: 1 | 2 | 4,
  blocksMovement,
  blocksEnclosure,
  fixture,
  gate,
  price,
  materialCost,
  description
}
```

`facings` records how many distinct art variants exist. Every placeable asset still
supports four grid orientations; rotation changes the transform even when the art
variant is shared.

## Milestone 0 — Preflight and map layout

- Pull the latest repository state and record a clean baseline.
- Inventory current keybound assets and placeable buildings.
- Assign permanent IDs and validate all model references.
- Add a per-species animal scale table, including foxes and horses.
- Resolve the current central-map overlap between the homestead and the planned
  merchant camp before placing any fixture.
- Reserve a fixed camp rectangle with clear approaches on at least two sides.
- Define the save schema version and migration boundary before adding new fields.

Acceptance: no duplicate IDs, no camp/homestead overlap, and intentional fox/horse
target heights.

## Milestone 1 — Direct tree interaction and stump economy

- Pick individual instanced trees from the cursor instead of requiring manual aim.
- Clicking a tree selects the chop target and uses the existing range/tool checks.
- Keep the existing log-like stump appearance.
- Clearing a stump gives exactly one wood resource once.
- Record that reward as an explicit economic exception for later tuning.
- Add readable tree selection and range feedback.

Deploy after this milestone.

## Milestone 2 — Catalog and keybind migration

- Add every current keybound asset to the catalog: shotgun, shovel, axe, bucket,
  boulder, bear trap, seeds/crops, buildings, and future shop assets.
- Route action-bar and keybind resolution through catalog IDs.
- Keep the old direct-keybind deployment behind a debug flag.
- Validate duplicate IDs, missing models, invalid footprints, and invalid categories.
- Use the requested baseline footprints: 1x1 small objects, 4x1 fence sections,
  2x2 carts/coops, 3x3 sheds/windmills, 4x4 homesteads/barns, 5x5 farmhouses,
  6x6 manors, and 8x8 castles.
- Prefer odd footprints for new assets and cap normal footprints near 10x10.

## Milestone 3 — Deeds, stacking, and purchase validation

- Add deed inventory items that store an `assetId` and quantity.
- Stack identical deeds into one slot.
- Branch deed use by `useType`: place, equip, or apply-and-consume.
- Return one generic deed when demolishing an asset; discard rotation on return.
- Keep currency, materials, and inventory-space checks as real APIs.
- Allow a testing flag to force all three checks to pass without removing their
  failure reasons or test coverage.

## Milestone 4 — Traveling Merchant, camp, and shop

- Add a solid, stationary Traveling Merchant NPC at a fixed map-data position;
  “Traveling” is his role/name, not a movement behavior.
- Show an interaction prompt when nearby.
- Open the shop through the interaction input and close it when walking away.
- Build a fixed central encampment from fixtures: wagon/caravan, crates, boxes,
  whiskey barrels, haystacks, and coin sacks.
- Reserve every fixture tile from tilling, planting, and placement.
- Make fixtures indestructible, movement-blocking, and enclosure-blocking.
- Add shop tabs for Housing, Weapons, Buildings, and Upgrades.
- Filter rows from the catalog and show name, description, footprint, and Buy.
- Keep price/material layout space visible but hide the values during scaffolding.
- Keep the menu open after successful purchases.
- Add specific failure messages without mutating state on failure.

Deploy after this milestone.

## Milestone 5 — Placement mode

- Double-clicking a place deed enters placement mode.
- Show a full-footprint, grid-snapped ghost with green/red validity tint.
- Reject overlap with assets, fixtures, tilled ground, the player tile, wrong
  terrain, or map bounds.
- Use the footprint as the complete collision shape.
- Rotate with right-click through four orientations.
- Swap non-square dimensions on quarter-turns.
- Change the visible 2.5D face when orientation changes.
- Carry the current orientation into the next placement.
- Place on legal left-click, consume one deed, and exit placement mode.
- Keep fences outside tilled areas so they do not block field enclosure.
- Refuse tilling on any occupied asset or fixture tile.

## Milestone 6 — Demolish and context actions

- Add a demolish keybind, proposed as `X`.
- Keep demolish mode active until Escape.
- Highlight the target under the cursor.
- Destroy placed assets immediately and return one deed.
- Exclude fixtures from demolish targeting.
- Add right-click menus for placed assets: Rotate and Destroy.
- Refuse rotations that overlap neighbors or leave the map.
- Add right-click inventory menus with a confirmed, irreversible Delete action.
- Make Escape cancel the active menu/mode before it can pause the game.

Deploy after this milestone.

## Milestone 7 — Gates, enclosure, and fox pathing

- Add gate definitions with open/closed state.
- Closed gates block movement and enclosure; open gates block neither.
- Walking into a closed gate opens it automatically.
- Close it a few seconds after the player passes if the space is clear.
- Swing direction follows orientation.
- Recalculate enclosure only after placement, rotation, destruction, gate toggles,
  or loading.
- Flood-fill from every map edge using 8-directional movement.
- Protect crops on tiles unreachable from the outside.
- Share the same direction and walkability rules with fox movement and spawning.
- Prevent foxes from spawning or surfacing inside enclosed areas.

Deploy after this milestone.

## Milestone 8 — Save schema and launch flow

Save one complete world state containing:

- Version number
- Placed asset IDs, positions, rotations, and gate states
- Inventory and deed quantities
- Currency and materials
- Player position
- Tilled tiles and crop growth state/timers
- Day counter

Also add:

- Timer and quit autosaves.
- Continue/New Adventure launch menu before world load.
- Disabled Continue when no save exists.
- Confirmation before New Adventure overwrites an existing save.
- Explicit migration or clear refusal for unsupported versions.
- Logged warnings and skipped entries for unknown asset IDs.
- One enclosure calculation after load and before player control.

Deploy after this milestone.

## Milestone 9 — F12 debugger and release QA

- Add F12 grid highlighting and labels.
- Use the requested `A-00` through `A-99`, then `B-00` sequence on each axis.
- Display both axes on the 240x240 map so labels remain unique.
- Show optional occupancy, fixture, and enclosure state in debug mode.
- Keep the debugger disabled by default.
- Run typecheck, simulation checks, asset validation, production build, and
  deployed browser smoke tests.
- Record each deployment in `HANDOFF.md`.

Deploy after this milestone.

## Commit sequence

1. `feat: add direct tree targets and animal scale tuning`
2. `feat: add stable purchasable asset catalog`
3. `refactor: resolve keybinds through asset catalog`
4. `feat: add stacked deeds and purchase checks`
5. `feat: add traveling merchant and fixed encampment`
6. `feat: add merchant shop tabs`
7. `feat: add grid placement ghosts`
8. `feat: add demolish and object context actions`
9. `feat: add gates and cached enclosure calculation`
10. `feat: add save migration and launch menu`
11. `feat: add F12 grid debugger`
12. `test: complete vendor deed system regression coverage`
13. `docs: record final vendor deed system deployment`

Each major deployment must have a clean `npx tsc --noEmit`, `npm run check`,
`npm run assetcheck`, and `npm run build` result before it is published.

## Implementation record

- [x] Milestone 0 — catalog IDs, map reservation, animal scale, and save boundary.
- [x] Milestone 1 — direct instanced-tree targets and one-time stump wood.
- [x] Milestone 2 — catalog-backed toolbar/build data and catalog validation.
- [x] Milestone 3 — stacked deeds, deed use branching, purchase checks, and generic deed returns.
- [x] Milestone 4 — stationary Traveling Merchant, fixed central encampment, and four-tab shop UI.
- [x] Milestone 5 — placement mode QA and final placement polish.
- [x] Milestone 6 — demolish/context QA and final interaction polish.
- [x] Milestone 7 — gate/enclosure/fox QA and final pathing polish.
- [x] Milestone 8 — save/launch QA and migration messaging.
- [ ] Milestone 9 — F12 debug QA, production smoke tests, and release record.
