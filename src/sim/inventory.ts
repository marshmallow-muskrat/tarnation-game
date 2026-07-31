/**
 * 24-slot inventory. Stacks are unbounded — one slot holds any number of one item,
 * so the only way to run out of room is to carry 24 *different* things.
 */
import { INVENTORY_SLOTS } from '../content';
import type { ItemId } from './items';

export interface InvSlot {
  id: ItemId;
  count: number;
}

export type Inventory = (InvSlot | null)[];

export function createInventory(): Inventory {
  return new Array<InvSlot | null>(INVENTORY_SLOTS).fill(null);
}

export function normalizeInventory(raw: unknown): Inventory {
  const inv = createInventory();
  if (!Array.isArray(raw)) return inv;
  let i = 0;
  for (const entry of raw) {
    if (i >= INVENTORY_SLOTS) break;
    if (!entry || typeof entry !== 'object') {
      inv[i++] = null;
      continue;
    }
    const { id, count } = entry as Partial<InvSlot>;
    if (typeof id !== 'string' || typeof count !== 'number' || count <= 0) {
      inv[i++] = null;
      continue;
    }
    inv[i++] = { id, count: Math.floor(count) };
  }
  return inv;
}

export function cloneInventory(inv: Inventory): Inventory {
  return inv.map((s) => (s ? { ...s } : null));
}

export function countItem(inv: Inventory, id: ItemId): number {
  let n = 0;
  for (const slot of inv) if (slot?.id === id) n += slot.count;
  return n;
}

/** Add to an existing stack, else take the first empty slot. False = inventory full. */
export function addItem(inv: Inventory, id: ItemId, n = 1): boolean {
  if (n <= 0) return true;
  for (const slot of inv) {
    if (slot?.id === id) {
      slot.count += n;
      return true;
    }
  }
  const free = inv.indexOf(null);
  if (free < 0) return false;
  inv[free] = { id, count: n };
  return true;
}

export function removeItem(inv: Inventory, id: ItemId, n = 1): boolean {
  if (countItem(inv, id) < n) return false;
  let left = n;
  for (let i = 0; i < inv.length && left > 0; i++) {
    const slot = inv[i];
    if (slot?.id !== id) continue;
    const take = Math.min(slot.count, left);
    slot.count -= take;
    left -= take;
    if (slot.count <= 0) inv[i] = null;
  }
  return true;
}

/** Remove every unit of an item, returning how many were taken. */
export function removeAll(inv: Inventory, id: ItemId): number {
  const n = countItem(inv, id);
  if (n > 0) removeItem(inv, id, n);
  return n;
}

export function hasRoomFor(inv: Inventory, id: ItemId): boolean {
  return inv.some((s) => s?.id === id) || inv.includes(null);
}

/** Distinct occupied slots, in slot order. */
export function occupiedSlots(inv: Inventory): InvSlot[] {
  return inv.filter((s): s is InvSlot => s !== null);
}

/** First item matching a predicate — used for picking crop ammo. */
export function findItem(inv: Inventory, pred: (id: ItemId) => boolean): ItemId | null {
  for (const slot of inv) {
    if (slot && slot.count > 0 && pred(slot.id)) return slot.id;
  }
  return null;
}
