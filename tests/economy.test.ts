import { describe, expect, it } from 'vitest';
import { HOMESTEAD_UPGRADE_WOOD, TOOLBAR_SLOTS } from '../src/content';
import { getEconomyCapability } from '../src/game/EconomyCapability';
import {
  assetDefinition,
  deedItemId,
  placeableAssets,
  PURCHASABLE_ASSETS,
  shopAssets,
} from '../src/content/purchasables';
import { createGameState, sellEverything, sellItem } from '../src/sim/gameState';
import { purchaseAsset, quotePurchase } from '../src/sim/economy';
import { addItem, countItem, createInventory, hasRoomFor } from '../src/sim/inventory';
import { cropItem, itemInfo, ITEM_WOOD } from '../src/sim/items';

describe('economy values and current purchasing inputs', () => {
  it('uses a visible development capability and keeps production purchases paid', () => {
    expect(getEconomyCapability({ DEV: true })).toEqual({
      allowFreePurchases: true,
      label: 'Development sandbox · purchases are free',
    });
    expect(getEconomyCapability({ DEV: false })).toEqual({
      allowFreePurchases: false,
      label: 'Production economy · costs are charged',
    });
  });

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

  it('exposes only explicitly merchant or upgrade assets for vendor rows', () => {
    const shop = shopAssets();
    const placeable = placeableAssets();

    expect(shop.length).toBeGreaterThan(0);
    expect(shop.every((asset) => asset.availability === 'merchant' || asset.availability === 'upgrade')).toBe(true);
    expect(placeable.every((asset) => asset.useType === 'place' && (asset.availability === 'merchant' || asset.availability === 'upgrade'))).toBe(true);
    expect(shop.some((asset) => asset.id === 'fixture:caravan')).toBe(false);
    expect(shop.some((asset) => asset.availability === 'starter')).toBe(false);
    expect(shop.some((asset) => asset.availability === 'unreleased')).toBe(false);
    expect(shop.some((asset) => asset.id === 'housing:homestead:1')).toBe(false);
    expect(placeable.some((asset) => asset.availability === 'unreleased')).toBe(false);
    expect(TOOLBAR_SLOTS).toBe(3);
    expect(placeable.some((asset) => asset.id === 'gate')).toBe(true);
  });

  it('classifies every catalog entry explicitly and keeps unfinished buildings out of production surfaces', () => {
    expect(PURCHASABLE_ASSETS.every((asset) => asset.availability)).toBe(true);
    expect(PURCHASABLE_ASSETS.filter((asset) => asset.availability === 'starter').map((asset) => asset.id)).toEqual([
      'tool:shotgun',
      'tool:shovel',
      'tool:axe',
      'tool:bucket',
      'ability:boulder',
      'utility:bear-trap',
    ]);
    expect(PURCHASABLE_ASSETS.filter((asset) => asset.availability === 'unreleased').map((asset) => asset.id)).toEqual([
      'well',
      'chicken_coop',
      'small_barn',
      'open_barn',
      'barn',
      'silo',
      'silo_house',
      'windmill',
      'tower_windmill',
      'water_tower',
      'big_barn',
    ]);
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

  it('deducts a paid purchase exactly once and adds one deed after all costs pass', () => {
    const game = createGameState(0x3030);
    game.inventory = createInventory();
    game.duckettes = 7;
    addItem(game.inventory, ITEM_WOOD, 4);
    const fence = assetDefinition('fence');
    if (!fence) throw new Error('fence fixture is missing');

    expect(quotePurchase(game, fence, { allowFreePurchases: false })).toMatchObject({
      owned: 0,
      price: 1,
      canBuy: true,
      reasons: [],
    });
    const result = purchaseAsset(game, fence, { allowFreePurchases: false });

    expect(result).toEqual({
      ok: true,
      itemId: deedItemId('fence'),
      duckettesSpent: 1,
      materialSpent: { wood: 1 },
    });
    expect(game.duckettes).toBe(6);
    expect(countItem(game.inventory, ITEM_WOOD)).toBe(3);
    expect(countItem(game.inventory, deedItemId('fence'))).toBe(1);
  });

  it('reports missing currency and materials without mutating a failed paid purchase', () => {
    const game = createGameState(0x4040);
    game.inventory = createInventory();
    game.duckettes = 0;
    addItem(game.inventory, ITEM_WOOD, 0);
    const beforeInventory = game.inventory.map((slot) => (slot ? { ...slot } : null));
    const fence = assetDefinition('fence');
    if (!fence) throw new Error('fence fixture is missing');

    const result = purchaseAsset(game, fence, { allowFreePurchases: false });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.quote.reasons).toEqual([
      'Need 1 duckettes (have 0)',
      'Need 1 Wood (have 0)',
    ]);
    expect(game.duckettes).toBe(0);
    expect(game.inventory).toEqual(beforeInventory);
  });

  it('leaves currency and materials unchanged when a paid purchase has no inventory slot', () => {
    const game = createGameState(0x5050);
    game.inventory = Array.from({ length: 24 }, (_, index) => ({
      id: `fixture:item-${index}`,
      count: 1,
    }));
    game.inventory[0] = { id: ITEM_WOOD, count: 1 };
    game.duckettes = 3;
    const beforeInventory = game.inventory.map((slot) => (slot ? { ...slot } : null));
    const fence = assetDefinition('fence');
    if (!fence) throw new Error('fence fixture is missing');

    const result = purchaseAsset(game, fence, { allowFreePurchases: false });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.quote.reasons).toEqual(['Inventory has no free slot']);
    expect(game.duckettes).toBe(3);
    expect(countItem(game.inventory, ITEM_WOOD)).toBe(1);
    expect(game.inventory).toEqual(beforeInventory);
  });

  it('allows only the explicitly supplied development policy to waive costs', () => {
    const game = createGameState(0x6060);
    game.inventory = createInventory();
    const fence = assetDefinition('fence');
    if (!fence) throw new Error('fence fixture is missing');

    const result = purchaseAsset(game, fence, { allowFreePurchases: true });

    expect(result).toEqual({
      ok: true,
      itemId: deedItemId('fence'),
      duckettesSpent: 0,
      materialSpent: {},
    });
    expect(game.duckettes).toBe(0);
    expect(countItem(game.inventory, deedItemId('fence'))).toBe(1);
  });
});
