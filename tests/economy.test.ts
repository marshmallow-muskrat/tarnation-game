import { describe, expect, it } from 'vitest';
import { HOMESTEAD_UPGRADE_WOOD } from '../src/content';
import {
  assetDefinition,
  deedItemId,
  placeableAssets,
  shopAssets,
} from '../src/content/purchasables';
import { createGameState, sellEverything, sellItem } from '../src/sim/gameState';
import { addItem, countItem, createInventory, hasRoomFor } from '../src/sim/inventory';
import { cropItem, itemInfo, ITEM_WOOD } from '../src/sim/items';

describe('economy values and current purchasing inputs', () => {
  it('keeps the current economy payout snapshot for wood, base crops, hybrids, and trophies', () => {
    const payoutSnapshot = [
      ['Grass', itemInfo(cropItem('Grass')).price],
      ['Dandelion', itemInfo(cropItem('Dandelion')).price],
      ['Beet', itemInfo(cropItem('Beet')).price],
      ['Carrot', itemInfo(cropItem('Carrot')).price],
      ['Lettuce', itemInfo(cropItem('Lettuce')).price],
      ['Hybrid', itemInfo(cropItem('Screaming Cabbage')).price],
      ['Trophy', itemInfo('trophy:Thicket Fox').price],
      ['Wood', itemInfo(ITEM_WOOD).price],
    ];

    expect(payoutSnapshot).toEqual([
      ['Grass', 6],
      ['Dandelion', 8],
      ['Beet', 10],
      ['Carrot', 12],
      ['Lettuce', 14],
      ['Hybrid', 26],
      ['Trophy', 60],
      ['Wood', 1],
    ]);
    expect(HOMESTEAD_UPGRADE_WOOD).toEqual([0, 6, 12, 24, 48]);
  });

  it('keeps the current sale transaction atomic and pays exactly once per removed unit', () => {
    const game = createGameState(0x1010);
    game.inventory = createInventory();
    game.duckettes = 5;
    addItem(game.inventory, cropItem('Beet'), 3);

    expect(sellItem(game, cropItem('Beet'), false)).toBe(10);
    expect(countItem(game.inventory, cropItem('Beet'))).toBe(2);
    expect(game.duckettes).toBe(15);
    expect(sellItem(game, 'crop:Missing', true)).toBe(0);
    expect(game.duckettes).toBe(15);
    expect(countItem(game.inventory, 'crop:Missing')).toBe(0);
  });

  it('sells every current stack, including zero-value deeds, without leaving inventory residue', () => {
    const game = createGameState(0x2020);
    game.inventory = createInventory();
    game.duckettes = 0;
    addItem(game.inventory, ITEM_WOOD, 4);
    addItem(game.inventory, cropItem('Lettuce'), 2);
    addItem(game.inventory, deedItemId('fence'), 1);

    expect(sellEverything(game)).toBe(4 + 2 * 14);
    expect(game.duckettes).toBe(32);
    expect(game.inventory.every((slot) => slot === null)).toBe(true);
  });

  it('exposes only shop assets for vendor rows and keeps fixture/debug assets out of purchases', () => {
    const shop = shopAssets();
    const placeable = placeableAssets();

    expect(shop.length).toBeGreaterThan(0);
    expect(shop.every((asset) => !asset.fixture && asset.availability !== 'debug' && asset.availability !== 'fixture')).toBe(true);
    expect(placeable.every((asset) => asset.useType === 'place' && !asset.fixture)).toBe(true);
    expect(shop.some((asset) => asset.id === 'fixture:caravan')).toBe(false);
    expect(shop.some((asset) => asset.id === 'housing:homestead:1')).toBe(false);
    expect(placeable.some((asset) => asset.id === 'gate')).toBe(true);
  });

  it('uses both duckette and wood costs for a paid fence deed and requires a stackable inventory slot', () => {
    const fence = assetDefinition('fence');
    expect(fence).not.toBeNull();
    expect(fence).toMatchObject({ price: 1, materialCost: { wood: 1 }, useType: 'place' });

    const inventory = createInventory();
    expect(hasRoomFor(inventory, deedItemId('fence'))).toBe(true);
    addItem(inventory, deedItemId('fence'), 1);
    expect(hasRoomFor(inventory, deedItemId('fence'))).toBe(true);
    expect(itemInfo(deedItemId('fence')).price).toBe(0);
  });
});
