import {
  BEAR_TRAP_COOLDOWN,
  BOULDER_COOLDOWN,
  BUCKET_CAPACITY,
  INVENTORY_SLOTS,
} from '../content';
import {
  cropName,
  itemInfo,
  ITEM_WOOD,
  type ItemId,
} from '../sim/items';
import { occupiedSlots } from '../sim/inventory';
import { woodCount, type GameState } from '../sim/gameState';
import { buildCodexCatalog } from '../sim/codex';
import { quotePurchase } from '../sim/economy';
import { seedMechanismDescription } from '../sim/genetics';
import { seedPacketCapacity } from '../sim/buildings';
import { settlementObjective, type SettlementObjective } from '../sim/settlement';
import { assetDefinition, deedAssetId, shopAssets, type AssetCategory, type AssetId, type PurchasableAsset } from '../content/purchasables';
import type { ModelKey } from './Assets';
import type { EconomyCapability } from './EconomyCapability';
import type { SaveFeedback } from './SaveTiming';
import { PLACEABLE_BUILDINGS, type BuildingPlacement } from './PlacementCoordinator';

export type HudSlot = {
  id: ItemId | null;
  name: string;
  glyph: string;
  model: ModelKey | null;
  count: number;
  price: number;
  blurb: string;
};

export type HudToolbarSlot = {
  index: number;
  name: string;
  glyph: string;
  model: ModelKey | null;
  selected: boolean;
  empty: boolean;
};

export type HudBuildOption = {
  index: number;
  name: string;
  model: ModelKey;
  cost: number;
  canAfford: boolean;
};

export type HudMarket = {
  open: boolean;
  items: { id: ItemId; name: string; glyph: string; model: ModelKey | null; count: number; price: number }[];
  total: number;
};

export type HudVendorAsset = {
  id: AssetId;
  name: string;
  description: string;
  footprint: string;
  useType: PurchasableAsset['useType'];
  gate: boolean;
  model: ModelKey;
  price: number;
  material: string;
  owned: number;
  canBuy: boolean;
  lockReason: string;
};

export type HudVendor = {
  open: boolean;
  tab: AssetCategory;
  tabs: AssetCategory[];
  items: HudVendorAsset[];
  economyLabel: string;
  message: string;
};

export type HudContextMenu = {
  open: boolean;
  x: number;
  y: number;
  name: string;
  placedIndex: number;
  gate: boolean;
  gateOpen: boolean;
};

export type HudCodexTrait = {
  label: string;
  value: string;
};

export type HudCodexEntry = {
  key: string;
  kind: 'discovered' | 'undiscovered';
  name: string;
  species: string | null;
  model: ModelKey | null;
  discoveredDay: number | null;
  lineage: string;
  traits: HudCodexTrait[];
  effect: string;
  compareSelected: boolean;
  ariaLabel: string;
};

export type HudCodex = {
  open: boolean;
  entries: HudCodexEntry[];
  selectedKey: string | null;
  compareKeys: string[];
  status: string;
};

/** Floating "+3 Wood" that rises off whatever the player just gathered. */
export type HudPopup = {
  id: number;
  text: string;
  /** Viewport fraction, 0..1 from the top-left. */
  x: number;
  y: number;
  /** 1 at spawn → 0 when it should be gone. */
  life: number;
};

export type HudSnapshot = {
  day: number;
  phase: 'day' | 'night';
  phaseT: number;
  hint: string;
  inventory: HudSlot[];
  seedStorage: {
    used: number;
    capacity: number;
  };
  inventoryOpen: boolean;
  duckettes: number;
  toolbar: HudToolbarSlot[];
  build: {
    active: boolean;
    selectedIndex: number;
    wood: number;
    options: HudBuildOption[];
    placement: {
      valid: boolean;
      reason: string;
    };
  };
  helpOpen: boolean;
  codex: HudCodex;
  toolSlot: {
    name: string;
    glyph: string;
    model: ModelKey | null;
    selected: boolean;
    fill: number;
    capacity: number;
  };
  ultimate: {
    name: string;
    glyph: string;
    model: ModelKey;
    ready: boolean;
    cooldown: number;
    max: number;
  };
  bearTrap: {
    name: string;
    glyph: string;
    model: ModelKey;
    ready: boolean;
    cooldown: number;
    max: number;
  };
  market: HudMarket;
  vendor: HudVendor;
  contextMenu: HudContextMenu;
  demolishMode: boolean;
  paused: boolean;
  /** Screen-space bearing to the market stall, radians, 0 = straight up. */
  marketAngle: number;
  marketDistance: number;
  popups: HudPopup[];
  toast: string;
  save: {
    state: SaveFeedback['state'];
    message: string;
  };
  objective: SettlementObjective;
  win: null | {
    daysSurvived: number;
    cropsHarvested: number;
    woodGathered: number;
    trophies: number;
  };
};

export type HudPresenterContext = {
  state: GameState;
  hint: string;
  buildingMode: boolean;
  selectedBuildIndex: number;
  placement(): Pick<BuildingPlacement, 'valid' | 'reason'>;
  helpOpen: boolean;
  codexOpen: boolean;
  codexSelectedKey: string | null;
  codexCompareKeys: readonly string[];
  toolSlotModel: ModelKey | null;
  marketOpen: boolean;
  vendorOpen: boolean;
  vendorTab: AssetCategory;
  vendorTabs: readonly AssetCategory[];
  vendorMessage: string;
  economy: EconomyCapability;
  setVendorTab(tab: AssetCategory): void;
  contextMenu: HudContextMenu;
  demolishMode: boolean;
  paused: boolean;
  marketAngle: number;
  marketDistance: number;
  popups: readonly HudPopup[];
  save: SaveFeedback;
  winShownLocal: boolean;
};

const TOOLBAR_ASSET_IDS = ['tool:shotgun', 'tool:shovel', 'tool:axe'] as const;

/** Toolbar presentation metadata shared by the hotkey feedback and HUD. */
export const TOOLBAR = TOOLBAR_ASSET_IDS.map((id) => {
  const asset = assetDefinition(id);
  return {
    name: asset?.displayName ?? '',
    glyph: '',
    model: asset?.modelKey ?? null,
    empty: false,
  };
});

const CROP_ICON_MODELS: Record<string, ModelKey> = {
  Grass: 'grasscrop_4',
  Dandelion: 'dandelion_4',
  Beet: 'beet_4',
  Carrot: 'carrot_4',
  Lettuce: 'lettuce_4',
};

function codexIconModel(species: string | null): ModelKey | null {
  return species ? CROP_ICON_MODELS[species] ?? null : null;
}

function itemIconModel(id: ItemId): ModelKey | null {
  if (id === ITEM_WOOD) return 'wood_log';
  const deed = deedAssetId(id);
  if (deed) return assetDefinition(deed)?.modelKey ?? null;
  const crop = cropName(id);
  if (crop !== null) return CROP_ICON_MODELS[crop] ?? null;
  if (id.startsWith('trophy:')) return 'trophy';
  return null;
}

/** Maps live runtime state to the stable React HUD contract. */
export class HudPresenter {
  private listener: ((snapshot: HudSnapshot) => void) | null = null;
  private lastHudJson = '';

  get hasListener(): boolean {
    return this.listener !== null;
  }

  setListener(listener: ((snapshot: HudSnapshot) => void) | null): void {
    this.listener = listener;
    if (!listener) this.lastHudJson = '';
  }

  push(force: boolean, context: HudPresenterContext): void {
    if (!this.listener) return;

    const { state } = context;
    const inventory: HudSlot[] = state.inventory.map((slot) => {
      if (!slot) return { id: null, name: '', glyph: '', model: null, count: 0, price: 0, blurb: '' };
      const info = itemInfo(slot.id);
      return {
        id: slot.id,
        name: info.name,
        glyph: info.glyph,
        model: itemIconModel(slot.id),
        count: slot.count,
        price: info.price,
        blurb: info.blurb,
      };
    });
    while (inventory.length < INVENTORY_SLOTS) {
      inventory.push({ id: null, name: '', glyph: '', model: null, count: 0, price: 0, blurb: '' });
    }

    const buildPlacement = context.buildingMode
      ? context.placement()
      : { valid: false, reason: 'Open build mode to preview a structure' };
    const toolbar: HudToolbarSlot[] = TOOLBAR.map((t, i) => ({
      index: i,
      name: t.name,
      glyph: t.glyph,
      model: t.model,
      empty: t.empty,
      selected: !state.toolSlotActive && state.toolbarSlot === i,
    }));
    const marketItems = occupiedSlots(state.inventory).map((slot) => {
      const info = itemInfo(slot.id);
      return {
        id: slot.id,
        name: info.name,
        glyph: info.glyph,
        model: itemIconModel(slot.id),
        count: slot.count,
        price: info.price,
      };
    });

    const codexListings = buildCodexCatalog(state.codex);
    const codexCompareKeys = context.codexCompareKeys.filter((key) =>
      codexListings.some((entry) => entry.key === key && entry.kind === 'discovered'),
    ).slice(0, 2);
    const codexSelectedKey = codexListings.some((entry) => entry.key === context.codexSelectedKey)
      ? context.codexSelectedKey
      : codexListings[0]?.key ?? null;
    const codexEntries: HudCodexEntry[] = codexListings.map((entry) => {
      const seed = entry.seed;
      const name = seed?.displayName ?? 'Undiscovered seed';
      return {
        key: entry.key,
        kind: entry.kind,
        name,
        species: seed?.species ?? entry.silhouetteSpecies,
        model: codexIconModel(seed?.species ?? entry.silhouetteSpecies),
        discoveredDay: entry.discoveredDay,
        lineage: seed?.lineage?.join(' × ') ?? (seed ? 'Base species' : 'Unknown parentage'),
        traits: seed
          ? [
              { label: 'Yield', value: `${seed.traits.yield}/100` },
              { label: 'Vigor', value: `${seed.traits.vigor}/100` },
              { label: 'Thirst', value: `${seed.traits.thirst}/100` },
              { label: 'Hardiness', value: `${seed.traits.hardiness}/100` },
              { label: 'Weirdness', value: `${seed.traits.weirdness}/100` },
            ]
          : [],
        effect: seed
          ? seedMechanismDescription(seed.mech)
          : 'Discover this seed to reveal its traits and effect.',
        compareSelected: codexCompareKeys.includes(entry.key),
        ariaLabel:
          entry.kind === 'discovered'
            ? `${name}, discovered on day ${entry.discoveredDay ?? 1}`
            : 'Undiscovered seed silhouette',
      };
    });
    const selectedCodexEntry = codexEntries.find((entry) => entry.key === codexSelectedKey);
    const codexStatus = selectedCodexEntry
      ? selectedCodexEntry.kind === 'discovered'
        ? `${selectedCodexEntry.name} selected. ${selectedCodexEntry.effect}`
        : 'Undiscovered seed silhouette selected. Discover it to reveal traits and effect.'
      : 'No seed entries discovered yet.';

    const vendorTabs = [...context.vendorTabs];
    const vendorTab = vendorTabs.includes(context.vendorTab)
      ? context.vendorTab
      : vendorTabs[0] ?? 'Housing';
    if (vendorTab !== context.vendorTab) context.setVendorTab(vendorTab);
    const objective = settlementObjective(state);

    const snap: HudSnapshot = {
      day: state.clock.day,
      phase: state.clock.phase,
      phaseT: state.clock.t,
      hint: context.hint,
      inventory,
      seedStorage: {
        used: state.seedInventory.length,
        capacity: seedPacketCapacity(state.placedBuildings),
      },
      inventoryOpen: state.inventoryOpen,
      duckettes: state.duckettes,
      toolbar,
      build: {
        active: context.buildingMode,
        selectedIndex: context.selectedBuildIndex,
        wood: woodCount(state),
        options: PLACEABLE_BUILDINGS.map((entry, index) => ({
          index,
          name: entry.name,
          model: entry.model,
          cost: entry.cost,
          canAfford: woodCount(state) >= entry.cost,
        })),
        placement: {
          valid: buildPlacement.valid,
          reason: buildPlacement.reason,
        },
      },
      helpOpen: context.helpOpen,
      codex: {
        open: context.codexOpen,
        entries: codexEntries,
        selectedKey: codexSelectedKey,
        compareKeys: [...codexCompareKeys],
        status: codexStatus,
      },
      toolSlot: {
        name: 'Bucket',
        glyph: '🪣',
        model: context.toolSlotModel,
        selected: state.toolSlotActive,
        fill: state.bucketFill,
        capacity: BUCKET_CAPACITY,
      },
      ultimate: {
        name: 'Boulder',
        glyph: '',
        model: 'rock_2',
        ready: state.boulderCooldown <= 0,
        cooldown: Math.ceil(state.boulderCooldown),
        max: BOULDER_COOLDOWN,
      },
      bearTrap: {
        name: 'Bear Trap',
        glyph: '',
        model: 'bear_trap_open',
        ready: state.bearTrapCooldown <= 0,
        cooldown: Math.ceil(state.bearTrapCooldown),
        max: BEAR_TRAP_COOLDOWN,
      },
      market: {
        open: context.marketOpen,
        items: marketItems,
        total: marketItems.reduce((total, item) => total + item.price * item.count, 0),
      },
      vendor: {
        open: context.vendorOpen,
        tab: vendorTab,
        tabs: vendorTabs,
        economyLabel: context.economy.label,
        items: shopAssets(vendorTab).map((asset) => {
          const quote = quotePurchase(state, asset, context.economy);
          return {
            id: asset.id,
            name: asset.displayName,
            description: asset.description,
            footprint: `${asset.footprint.width}×${asset.footprint.height}`,
            useType: asset.useType,
            gate: asset.gate,
            model: asset.modelKey,
            price: asset.price,
            material: Object.entries(asset.materialCost)
              .map(([name, cost]) => `${cost} ${name}`)
              .join(', ') || '—',
            owned: quote.owned,
            canBuy: quote.canBuy,
            lockReason: quote.reasons.join(' · ') || 'Ready to buy',
          };
        }),
        message: context.vendorMessage,
      },
      contextMenu: { ...context.contextMenu },
      demolishMode: context.demolishMode,
      paused: context.paused,
      marketAngle: context.marketAngle,
      marketDistance: context.marketDistance,
      popups: context.popups.map((popup) => ({ ...popup })),
      toast: state.toast,
      save: { ...context.save },
      objective,
      win:
        objective.complete && !state.winShown && !context.winShownLocal
          ? {
              daysSurvived: Math.max(state.stats.daysSurvived, state.clock.day),
              cropsHarvested: state.stats.cropsHarvested,
              woodGathered: state.stats.woodGathered,
              trophies: state.stats.trophies,
            }
          : null,
    };

    const json = JSON.stringify(snap);
    if (!force && json === this.lastHudJson) return;
    this.lastHudJson = json;
    this.listener(snap);
  }
}
