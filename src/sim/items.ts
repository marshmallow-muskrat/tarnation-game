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
  /** One line of flavour, shown in the hover tooltip. */
  blurb: string;
  /** Duckettes paid per unit at the market stall. */
  price: number;
}

/**
 * Prices are pinned to wood = 1 duckette.
 *
 * A tree is 5 axe swings for 2 wood, so wood is the low, always-available floor.
 * A crop costs a till, a seed, a bucket trip and two full days on one tile, so a
 * planted tile has to beat two days of chopping by a clear margin — base crops
 * land at 6–14, and anything out of the breeding bed is worth more again.
 */

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

const BASE_CROPS: Record<string, { glyph: string; price: number; blurb: string }> = {
  Grass: { glyph: 'G', price: 6, blurb: 'Fodder. Grows anywhere, sells for little.' },
  Dandelion: { glyph: 'D', price: 8, blurb: 'Bitter greens. Somebody buys them.' },
  Beet: { glyph: 'B', price: 10, blurb: 'Honest root. The backbone of a season.' },
  Carrot: { glyph: 'C', price: 12, blurb: 'Sweeter than a beet, and priced like it.' },
  Lettuce: { glyph: 'L', price: 14, blurb: 'Thirsty, leafy, and worth the trouble.' },
};

export function itemInfo(id: ItemId): ItemInfo {
  if (id === ITEM_WOOD) {
    return { id, name: 'Wood', glyph: 'W', price: 1, blurb: 'Chopped from a tree. The base of every price.' };
  }
  if (id === ITEM_DARKWOOD) {
    return { id, name: 'Darkwood', glyph: 'DW', price: 10, blurb: 'Heartwood from somewhere darker.' };
  }

  const crop = cropName(id);
  if (crop !== null) {
    const base = BASE_CROPS[crop];
    // Anything not in the base catalogue came out of the breeding bed — worth more.
    return {
      id,
      name: crop,
      glyph: base?.glyph ?? '+',
      price: base?.price ?? 26,
      blurb: base?.blurb ?? 'A hybrid of your own making. Rare, and priced for it.',
    };
  }

  if (id.startsWith('trophy:')) {
    return {
      id,
      name: id.slice(7),
      glyph: 'T',
      price: 60,
      blurb: 'A rare trophy taken from a fallen creature.',
    };
  }

  return { id, name: id, glyph: '?', price: 1, blurb: '' };
}
