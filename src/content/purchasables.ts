import type { ModelKey } from './models';
import { HOMESTEAD_UPGRADE_WOOD } from '../content';

export type AssetId = string;
export type AssetUseType = 'place' | 'equip' | 'apply';
export type AssetCategory =
  | 'Housing'
  | 'Weapons'
  | 'Buildings'
  | 'Upgrades'
  | 'Utilities'
  | 'Fixtures';
export type AssetAvailability = 'starter' | 'merchant' | 'upgrade' | 'debug' | 'unreleased' | 'fixture';

export type MaterialCost = Readonly<Record<string, number>>;

export type PurchasableAsset = {
  id: AssetId;
  displayName: string;
  category: AssetCategory;
  useType: AssetUseType;
  modelKey: ModelKey;
  footprint: { width: number; height: number };
  facings: 1 | 2 | 4;
  blocksMovement: boolean;
  blocksEnclosure: boolean;
  fixture: boolean;
  gate: boolean;
  price: number;
  materialCost: MaterialCost;
  description: string;
  availability: AssetAvailability;
  keybind?: string;
};

const place = (
  entry: Omit<PurchasableAsset, 'useType' | 'fixture' | 'gate'> &
    Partial<Pick<PurchasableAsset, 'fixture' | 'gate'>>,
): PurchasableAsset => ({
  ...entry,
  useType: 'place',
  fixture: entry.fixture ?? false,
  gate: entry.gate ?? false,
});

const equip = (
  entry: Omit<PurchasableAsset, 'useType' | 'fixture' | 'gate'>,
): PurchasableAsset => ({
  ...entry,
  useType: 'equip',
  fixture: false,
  gate: false,
});

const apply = (
  entry: Omit<PurchasableAsset, 'useType' | 'fixture' | 'gate'>,
): PurchasableAsset => ({
  ...entry,
  useType: 'apply',
  fixture: false,
  gate: false,
});

/**
 * Gameplay asset catalog. This intentionally remains separate from the model
 * manifest: a model describes how to load art, while this file describes what
 * that art means in the economy, inventory, placement and collision systems.
 */
export const PURCHASABLE_ASSETS = [
  equip({
    id: 'tool:shotgun',
    displayName: 'Brown Shotgun',
    category: 'Weapons',
    modelKey: 'shotgun_2',
    footprint: { width: 1, height: 1 },
    facings: 2,
    blocksMovement: false,
    blocksEnclosure: false,
    price: 0,
    materialCost: {},
    description: 'A dependable Survival Pack shotgun.',
    availability: 'starter',
    keybind: '1',
  }),
  equip({
    id: 'tool:shovel',
    displayName: 'Shovel',
    category: 'Utilities',
    modelKey: 'shovel',
    footprint: { width: 1, height: 1 },
    facings: 2,
    blocksMovement: false,
    blocksEnclosure: false,
    price: 0,
    materialCost: {},
    description: 'Till, plant and harvest the homestead.',
    availability: 'starter',
    keybind: '2',
  }),
  equip({
    id: 'tool:axe',
    displayName: 'Red Axe',
    category: 'Utilities',
    modelKey: 'axe',
    footprint: { width: 1, height: 1 },
    facings: 2,
    blocksMovement: false,
    blocksEnclosure: false,
    price: 0,
    materialCost: {},
    description: 'Chop standing trees and clear their log-like stumps.',
    availability: 'starter',
    keybind: '3',
  }),
  equip({
    id: 'tool:bucket',
    displayName: 'Bucket',
    category: 'Utilities',
    modelKey: 'backpack',
    footprint: { width: 1, height: 1 },
    facings: 1,
    blocksMovement: false,
    blocksEnclosure: false,
    price: 0,
    materialCost: {},
    description: 'Carry water from the river to thirsty crops.',
    availability: 'starter',
    keybind: '6',
  }),
  apply({
    id: 'ability:boulder',
    displayName: 'Boulder',
    category: 'Weapons',
    modelKey: 'rock_2',
    footprint: { width: 1, height: 1 },
    facings: 1,
    blocksMovement: false,
    blocksEnclosure: false,
    price: 0,
    materialCost: {},
    description: 'Roll a heavy boulder through a line of attackers.',
    availability: 'starter',
    keybind: 'Q',
  }),
  place({
    id: 'utility:bear-trap',
    displayName: 'Bear Trap',
    category: 'Weapons',
    modelKey: 'bear_trap_open',
    footprint: { width: 1, height: 1 },
    facings: 4,
    blocksMovement: false,
    blocksEnclosure: false,
    price: 0,
    materialCost: {},
    description: 'Catch a fox that enters the trap radius.',
    availability: 'starter',
    keybind: 'B',
  }),
  apply({
    id: 'upgrade:irrigation',
    displayName: 'Irrigation Upgrade',
    category: 'Upgrades',
    modelKey: 'well',
    footprint: { width: 1, height: 1 },
    facings: 1,
    blocksMovement: false,
    blocksEnclosure: false,
    price: 12,
    materialCost: { wood: 12 },
    description: 'Unlocks reliable tier-three irrigation for every crop tile.',
    availability: 'upgrade',
  }),
  place({
    id: 'well',
    displayName: 'Well',
    category: 'Buildings',
    modelKey: 'well',
    footprint: { width: 1, height: 1 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 3,
    materialCost: { wood: 3 },
    description: 'A compact water fixture for a growing homestead.',
    availability: 'unreleased',
  }),
  place({
    id: 'fence',
    displayName: 'Fence Section',
    category: 'Buildings',
    modelKey: 'fence',
    footprint: { width: 4, height: 1 },
    facings: 2,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 1,
    materialCost: { wood: 1 },
    description: 'A four-tile field boundary section.',
    availability: 'merchant',
  }),
  place({
    id: 'fence2',
    displayName: 'Fence Section 2',
    category: 'Buildings',
    modelKey: 'fence2',
    footprint: { width: 4, height: 1 },
    facings: 2,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 1,
    materialCost: { wood: 1 },
    description: 'An alternate four-tile field boundary section.',
    availability: 'unreleased',
  }),
  place({
    id: 'gate',
    displayName: 'Field Gate',
    category: 'Buildings',
    modelKey: 'fence2',
    footprint: { width: 1, height: 1 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    gate: true,
    price: 2,
    materialCost: { wood: 2 },
    description: 'A fence-line gate that opens as you walk through.',
    availability: 'merchant',
  }),
  place({
    id: 'chicken_coop',
    displayName: 'Chicken Coop',
    category: 'Housing',
    modelKey: 'chicken_coop',
    footprint: { width: 2, height: 2 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 5,
    materialCost: { wood: 5 },
    description: 'A compact home for future farm animals.',
    availability: 'unreleased',
  }),
  place({
    id: 'small_barn',
    displayName: 'Small Barn',
    category: 'Housing',
    modelKey: 'small_barn',
    footprint: { width: 3, height: 3 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 5,
    materialCost: { wood: 5 },
    description: 'A first serious shelter for the farm.',
    availability: 'unreleased',
  }),
  place({
    id: 'open_barn',
    displayName: 'Open Barn',
    category: 'Housing',
    modelKey: 'open_barn',
    footprint: { width: 4, height: 4 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 7,
    materialCost: { wood: 7 },
    description: 'An open-sided barn for tools and animals.',
    availability: 'unreleased',
  }),
  place({
    id: 'barn',
    displayName: 'Barn',
    category: 'Buildings',
    modelKey: 'barn',
    footprint: { width: 4, height: 4 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 10,
    materialCost: { wood: 10 },
    description: 'A substantial farm building.',
    availability: 'unreleased',
  }),
  place({
    id: 'silo',
    displayName: 'Silo',
    category: 'Buildings',
    modelKey: 'silo',
    footprint: { width: 3, height: 3 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 7,
    materialCost: { wood: 7 },
    description: 'Store a larger harvest close to home.',
    availability: 'unreleased',
  }),
  place({
    id: 'silo_house',
    displayName: 'Silo House',
    category: 'Housing',
    modelKey: 'silo_house',
    footprint: { width: 4, height: 4 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 14,
    materialCost: { wood: 14 },
    description: 'A combined home and storage building.',
    availability: 'unreleased',
  }),
  place({
    id: 'windmill',
    displayName: 'Windmill',
    category: 'Buildings',
    modelKey: 'windmill',
    footprint: { width: 3, height: 3 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 8,
    materialCost: { wood: 8 },
    description: 'A landmark that turns open land into a settlement.',
    availability: 'unreleased',
  }),
  place({
    id: 'tower_windmill',
    displayName: 'Tower Windmill',
    category: 'Buildings',
    modelKey: 'tower_windmill',
    footprint: { width: 3, height: 3 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 12,
    materialCost: { wood: 12 },
    description: 'A taller windmill for a mature town.',
    availability: 'unreleased',
  }),
  place({
    id: 'water_tower',
    displayName: 'Water Tower',
    category: 'Buildings',
    modelKey: 'water_tower',
    footprint: { width: 3, height: 3 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 10,
    materialCost: { wood: 10 },
    description: 'A visible sign that the settlement is growing.',
    availability: 'unreleased',
  }),
  place({
    id: 'big_barn',
    displayName: 'Big Barn',
    category: 'Buildings',
    modelKey: 'big_barn',
    footprint: { width: 5, height: 5 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 18,
    materialCost: { wood: 18 },
    description: 'A high-capacity barn for a prosperous farm.',
    availability: 'unreleased',
  }),
  ...([1, 2, 3, 4, 5] as const).map((tier) =>
    place({
      id: `housing:homestead:${tier}`,
      displayName: `Homestead Tier ${tier}`,
      category: 'Housing',
      modelKey: `house_${tier}` as ModelKey,
      footprint: { width: tier + 3, height: tier + 3 },
      facings: 4,
      blocksMovement: true,
      blocksEnclosure: true,
      price: tier === 1 ? 0 : HOMESTEAD_UPGRADE_WOOD[tier - 1]!,
      materialCost: tier === 1 ? {} : { wood: HOMESTEAD_UPGRADE_WOOD[tier - 1]! },
      description: `Homestead upgrade tier ${tier}.`,
      // The direct homestead path is still the current legacy behavior. These
      // deed rows remain loadable for old saves, but are not production choices
      // until CORE-05 gives the merchant/deed path one authored progression job.
      availability: tier === 1 ? 'debug' : 'unreleased',
    }),
  ),
  // Fixed central encampment definitions. These are catalogued for shared model
  // and collision metadata but are never shown as shop rows.
  place({
    id: 'fixture:caravan',
    displayName: 'Merchant Caravan',
    category: 'Fixtures',
    modelKey: 'tent',
    footprint: { width: 3, height: 2 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 0,
    materialCost: {},
    description: 'A fixed fixture in the traveling merchant encampment.',
    fixture: true,
    availability: 'fixture',
  }),
  place({
    id: 'fixture:crate',
    displayName: 'Merchant Crate',
    category: 'Fixtures',
    modelKey: 'chest_closed',
    footprint: { width: 1, height: 1 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 0,
    materialCost: {},
    description: 'A fixed camp crate.',
    fixture: true,
    availability: 'fixture',
  }),
  place({
    id: 'fixture:barrel',
    displayName: 'Whiskey Barrel',
    category: 'Fixtures',
    modelKey: 'wood_log',
    footprint: { width: 1, height: 1 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 0,
    materialCost: {},
    description: 'A fixed barrel in the merchant camp.',
    fixture: true,
    availability: 'fixture',
  }),
  place({
    id: 'fixture:haystack',
    displayName: 'Haystack',
    category: 'Fixtures',
    modelKey: 'wood_log',
    footprint: { width: 1, height: 1 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 0,
    materialCost: {},
    description: 'A fixed haystack in the merchant camp.',
    fixture: true,
    availability: 'fixture',
  }),
  place({
    id: 'fixture:coin-sack',
    displayName: 'Coin Sack',
    category: 'Fixtures',
    modelKey: 'pouch',
    footprint: { width: 1, height: 1 },
    facings: 4,
    blocksMovement: true,
    blocksEnclosure: true,
    price: 0,
    materialCost: {},
    description: 'A fixed sack of coins in the merchant camp.',
    fixture: true,
    availability: 'fixture',
  }),
] as const satisfies readonly PurchasableAsset[];

const ASSET_BY_ID = new Map(PURCHASABLE_ASSETS.map((asset) => [asset.id, asset]));

export function assetDefinition(id: AssetId): PurchasableAsset | null {
  return ASSET_BY_ID.get(id) ?? null;
}

export function isVendorAsset(asset: PurchasableAsset): boolean {
  return asset.availability === 'merchant' || asset.availability === 'upgrade';
}

export function shopAssets(category?: AssetCategory): PurchasableAsset[] {
  return PURCHASABLE_ASSETS.filter(
    (asset) =>
      isVendorAsset(asset) &&
      (!category || asset.category === category),
  );
}

export function placeableAssets(includeDebug = false): PurchasableAsset[] {
  return PURCHASABLE_ASSETS.filter(
    (asset) =>
      asset.useType === 'place' &&
      (isVendorAsset(asset) || (includeDebug && asset.availability === 'debug')),
  );
}

export function fixtureAssets(): PurchasableAsset[] {
  return PURCHASABLE_ASSETS.filter((asset) => asset.availability === 'fixture');
}

export function deedItemId(assetId: AssetId): string {
  return `deed:${assetId}`;
}

export function deedAssetId(itemId: string): AssetId | null {
  return itemId.startsWith('deed:') ? itemId.slice(5) : null;
}

export function validatePurchasableCatalog(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const asset of PURCHASABLE_ASSETS) {
    if (ids.has(asset.id)) problems.push(`duplicate asset id: ${asset.id}`);
    ids.add(asset.id);
    if (asset.footprint.width < 1 || asset.footprint.height < 1) {
      problems.push(`invalid footprint: ${asset.id}`);
    }
    if (![1, 2, 4].includes(asset.facings)) problems.push(`invalid facings: ${asset.id}`);
    if (asset.fixture !== (asset.availability === 'fixture')) {
      problems.push(`fixture flag and availability disagree: ${asset.id}`);
    }
    if (asset.availability === 'starter' && !asset.keybind) {
      problems.push(`starter asset needs a keybind: ${asset.id}`);
    }
    if (asset.keybind && asset.availability !== 'starter') {
      problems.push(`only starter assets may have keybinds: ${asset.id}`);
    }
  }
  return problems;
}
