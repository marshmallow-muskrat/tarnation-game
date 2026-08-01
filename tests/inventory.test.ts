import { describe, expect, it } from 'vitest';
import { INVENTORY_SLOTS } from '../src/content';
import {
  addItem,
  cloneInventory,
  countItem,
  createInventory,
  findItem,
  hasRoomFor,
  normalizeInventory,
  occupiedSlots,
  removeAll,
  removeItem,
} from '../src/sim/inventory';

describe('inventory capacity, stacking, and transactions', () => {
  it('creates the configured number of empty slots and stacks unlimited copies in one slot', () => {
    const inventory = createInventory();

    expect(inventory).toHaveLength(INVENTORY_SLOTS);
    expect(addItem(inventory, 'crop:Beet', 5000)).toBe(true);
    expect(addItem(inventory, 'crop:Beet', 5000)).toBe(true);
    expect(countItem(inventory, 'crop:Beet')).toBe(10000);
    expect(occupiedSlots(inventory)).toEqual([{ id: 'crop:Beet', count: 10000 }]);
  });

  it('accepts at most one stack per distinct item and rejects a twenty-fifth distinct item atomically', () => {
    const inventory = createInventory();
    for (let i = 0; i < INVENTORY_SLOTS; i++) expect(addItem(inventory, `filler:${i}`, 1)).toBe(true);

    const before = cloneInventory(inventory);
    expect(addItem(inventory, 'overflow', 1)).toBe(false);
    expect(inventory).toEqual(before);
    expect(hasRoomFor(inventory, 'filler:0')).toBe(true);
    expect(hasRoomFor(inventory, 'overflow')).toBe(false);

    expect(removeItem(inventory, 'filler:0', 1)).toBe(true);
    expect(hasRoomFor(inventory, 'overflow')).toBe(true);
    expect(addItem(inventory, 'overflow', 1)).toBe(true);
  });

  it('refuses an insufficient removal without changing the existing stack', () => {
    const inventory = createInventory();
    addItem(inventory, 'wood', 3);

    expect(removeItem(inventory, 'wood', 4)).toBe(false);
    expect(countItem(inventory, 'wood')).toBe(3);
    expect(removeItem(inventory, 'wood', 2)).toBe(true);
    expect(countItem(inventory, 'wood')).toBe(1);
    expect(removeAll(inventory, 'wood')).toBe(1);
    expect(countItem(inventory, 'wood')).toBe(0);
  });

  it('removes across duplicate legacy stacks while preserving unrelated slots', () => {
    const inventory = normalizeInventory([
      { id: 'wood', count: 2 },
      { id: 'crop:Beet', count: 4 },
      { id: 'wood', count: 3 },
    ]);

    expect(removeItem(inventory, 'wood', 4)).toBe(true);
    expect(inventory[0]).toBeNull();
    expect(inventory[2]).toEqual({ id: 'wood', count: 1 });
    expect(inventory[1]).toEqual({ id: 'crop:Beet', count: 4 });
    expect(findItem(inventory, (id) => id.startsWith('crop:'))).toBe('crop:Beet');
  });

  it('normalizes malformed entries, floors positive counts, and truncates beyond capacity', () => {
    const raw = [
      null,
      { id: 'wood', count: 2.9 },
      { id: 'bad', count: 0 },
      { id: 4, count: 2 },
      ...Array.from({ length: INVENTORY_SLOTS + 3 }, (_, i) => ({ id: `item:${i}`, count: 1 })),
    ];
    const inventory = normalizeInventory(raw);

    expect(inventory[0]).toBeNull();
    expect(inventory[1]).toEqual({ id: 'wood', count: 2 });
    expect(inventory[2]).toBeNull();
    expect(inventory[3]).toBeNull();
    expect(inventory).toHaveLength(INVENTORY_SLOTS);
  });

  it('treats non-positive additions as successful no-ops', () => {
    const inventory = createInventory();

    expect(addItem(inventory, 'wood', 0)).toBe(true);
    expect(addItem(inventory, 'wood', -2)).toBe(true);
    expect(countItem(inventory, 'wood')).toBe(0);
    expect(inventory.every((slot) => slot === null)).toBe(true);
  });
});
