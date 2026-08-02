import type { PurchasableAsset } from '../content/purchasables';
import { deedItemId } from '../content/purchasables';
import { addItem, cloneInventory, countItem, hasRoomFor, removeItem, type Inventory } from './inventory';
import { ITEM_WOOD, type ItemId } from './items';
import { progressionLockReason } from './progression';

export type PurchasePolicy = {
  readonly allowFreePurchases: boolean;
};

export type PurchaseState = {
  duckettes: number;
  inventory: Inventory;
  homesteadTier?: number;
  irrigationTier?: number;
};

export type PurchaseQuote = {
  itemId: ItemId;
  owned: number;
  price: number;
  materialCost: Readonly<Record<string, number>>;
  reasons: string[];
  canBuy: boolean;
};

export type PurchaseResult =
  | {
      ok: true;
      itemId: ItemId;
      duckettesSpent: number;
      materialSpent: Readonly<Record<string, number>>;
    }
  | {
      ok: false;
      quote: PurchaseQuote;
    };

function materialItemId(material: string): ItemId {
  return material === 'wood' ? ITEM_WOOD : material;
}

function materialName(material: string): string {
  return material === 'wood' ? 'Wood' : material;
}

export function quotePurchase(
  state: PurchaseState,
  asset: PurchasableAsset,
  policy: PurchasePolicy,
): PurchaseQuote {
  const itemId = deedItemId(asset.id) as ItemId;
  const reasons: string[] = [];

  if (asset.progression) {
    const progressionReason = progressionLockReason(asset.progression, {
      homesteadTier: state.homesteadTier ?? 1,
      irrigationTier: state.irrigationTier ?? 2,
    });
    if (progressionReason) reasons.push(progressionReason);
    if (countItem(state.inventory, itemId) > 0) reasons.push('Already own this progression permit');
  }

  if (!policy.allowFreePurchases) {
    if (state.duckettes < asset.price) {
      reasons.push(`Need ${asset.price} duckettes (have ${state.duckettes})`);
    }
    for (const [material, cost] of Object.entries(asset.materialCost)) {
      const owned = countItem(state.inventory, materialItemId(material));
      if (owned < cost) {
        reasons.push(`Need ${cost} ${materialName(material)} (have ${owned})`);
      }
    }
  }
  if (!hasRoomFor(state.inventory, itemId)) {
    reasons.push('Inventory has no free slot');
  }

  return {
    itemId,
    owned: countItem(state.inventory, itemId),
    price: asset.price,
    materialCost: asset.materialCost,
    reasons,
    canBuy: reasons.length === 0,
  };
}

/**
 * Applies a purchase only after every precondition passes. The candidate
 * inventory makes the mutation atomic even if a future material type adds a
 * second inventory operation.
 */
export function purchaseAsset(
  state: PurchaseState,
  asset: PurchasableAsset,
  policy: PurchasePolicy,
): PurchaseResult {
  const quote = quotePurchase(state, asset, policy);
  if (!quote.canBuy) return { ok: false, quote };

  const candidate = cloneInventory(state.inventory);
  if (!addItem(candidate, quote.itemId, 1)) {
    return {
      ok: false,
      quote: {
        ...quote,
        reasons: ['Inventory has no free slot'],
        canBuy: false,
      },
    };
  }

  const materialSpent: Record<string, number> = {};
  let duckettesSpent = 0;
  if (!policy.allowFreePurchases) {
    duckettesSpent = asset.price;
    for (const [material, cost] of Object.entries(asset.materialCost)) {
      if (!removeItem(candidate, materialItemId(material), cost)) {
        return {
          ok: false,
          quote: {
            ...quote,
            reasons: [`Need ${cost} ${materialName(material)} (have ${countItem(state.inventory, materialItemId(material))})`],
            canBuy: false,
          },
        };
      }
      materialSpent[material] = cost;
    }
  }

  state.inventory = candidate;
  state.duckettes -= duckettesSpent;
  return {
    ok: true,
    itemId: quote.itemId,
    duckettesSpent,
    materialSpent,
  };
}
