/**
 * Item registry — everything you gather is an item id.
 *
 * Ids are namespaced so a crop, a trophy and a raw material can never collide:
 *   wood · darkwood            raw materials
 *   crop:<display name>        harvested crops, including hybrids
 *   trophy:<animal name>       dazed plains animals
 */

export type ItemId = string;

export interface ItemInfo {
  id: ItemId;
  /** Human label shown in the inventory / market. */
  name: string;
  /** Single glyph drawn in the inventory slot. */
  glyph: string;
  /** Ducketts paid per unit at the market stall. */
  price: number;
}

export const ITEM_WOOD = 'wood';
export const ITEM_DARKWOOD = 'darkwood';

export function cropItem(displayName: string): ItemId {
  return `crop:${displayName}`;
}

export function trophyItem(name: string): ItemId {
  return `trophy:${name}`;
}

/** Crop display name for a crop item id, or null if it is not a crop. */
export function cropName(id: ItemId): string | null {
  return id.startsWith('crop:') ? id.slice(5) : null;
}

const BASE_CROPS: Record<string, { glyph: string; price: number }> = {
  Grass: { glyph: '🌿', price: 2 },
  Dandelion: { glyph: '🌼', price: 4 },
  Turnip: { glyph: '🥔', price: 8 },
  Carrot: { glyph: '🥕', price: 10 },
  Onion: { glyph: '🧅', price: 12 },
};

export function itemInfo(id: ItemId): ItemInfo {
  if (id === ITEM_WOOD) return { id, name: 'Wood', glyph: '🪵', price: 3 };
  if (id === ITEM_DARKWOOD) return { id, name: 'Darkwood', glyph: '🌑', price: 15 };

  const crop = cropName(id);
  if (crop !== null) {
    const base = BASE_CROPS[crop];
    // Anything not in the base catalogue came out of the breeding bed — worth more.
    return { id, name: crop, glyph: base?.glyph ?? '🌱', price: base?.price ?? 24 };
  }

  if (id.startsWith('trophy:')) {
    return { id, name: id.slice(7), glyph: '🏆', price: 30 };
  }

  return { id, name: id, glyph: '📦', price: 1 };
}
