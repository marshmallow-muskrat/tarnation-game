/**
 * Counted seed packets — pure inventory rules.
 *
 * Seed packets use the same 24 distinct-stack capacity as the regular bag.
 * Existing legacy saves may temporarily contain more distinct stacks; those
 * stacks are preserved and can be consumed, while new distinct packets wait
 * until the overflow is reduced. Like genotypes always stack.
 */
import { INVENTORY_SLOTS } from '../content';
import { seedGenotypeKey, type Seed, type SeedPacket } from './genetics';

export const SEED_PACKET_SLOTS = INVENTORY_SLOTS;
export const SEED_RECOVERY_PER_HARVEST = 1;

const MAX_PACKET_COUNT = Number.MAX_SAFE_INTEGER;

function validCount(count: number): boolean {
  return Number.isInteger(count) && count > 0 && count <= MAX_PACKET_COUNT;
}

export function cloneSeed(seed: Seed): Seed {
  return {
    ...seed,
    traits: { ...seed.traits },
    lineage: seed.lineage ? [...seed.lineage] : undefined,
  };
}

export function cloneSeedPacket(packet: SeedPacket): SeedPacket {
  return { seed: cloneSeed(packet.seed), count: packet.count };
}

export function makeSeedPacket(seed: Seed, count = 1): SeedPacket {
  if (!validCount(count)) throw new Error('Seed packet count must be a positive safe integer');
  return { seed, count };
}

function packetIndex(packets: readonly SeedPacket[], seed: Seed): number {
  const key = seedGenotypeKey(seed);
  return packets.findIndex((packet) => seedGenotypeKey(packet.seed) === key);
}

/** Merge duplicate genotypes without changing the first-seen ordering. */
export function normalizeSeedPackets(packets: readonly SeedPacket[]): SeedPacket[] {
  const normalized: SeedPacket[] = [];
  const indexes = new Map<string, number>();
  for (const packet of packets) {
    if (!validCount(packet.count)) continue;
    const key = seedGenotypeKey(packet.seed);
    const existing = indexes.get(key);
    if (existing === undefined) {
      indexes.set(key, normalized.length);
      normalized.push(cloneSeedPacket(packet));
      continue;
    }
    const target = normalized[existing]!;
    target.count = Math.min(MAX_PACKET_COUNT, target.count + packet.count);
  }
  return normalized;
}

export function canAddSeedPacket(
  packets: readonly SeedPacket[],
  seed: Seed,
  count = 1,
): boolean {
  if (!validCount(count)) return false;
  const index = packetIndex(packets, seed);
  if (index >= 0) {
    return packets[index]!.count <= MAX_PACKET_COUNT - count;
  }
  return packets.length < SEED_PACKET_SLOTS;
}

/** Add packets transactionally: no partial count or Codex mutation on failure. */
export function addSeedPacket(
  packets: SeedPacket[],
  seed: Seed,
  count = 1,
): boolean {
  if (!canAddSeedPacket(packets, seed, count)) return false;
  const index = packetIndex(packets, seed);
  if (index >= 0) {
    packets[index]!.count += count;
  } else {
    packets.push({ seed, count });
  }
  return true;
}

/** Remove exact genotype packets; a stack disappears at zero. */
export function consumeSeedPacket(
  packets: SeedPacket[],
  seed: Seed,
  count = 1,
): boolean {
  if (!validCount(count)) return false;
  const index = packetIndex(packets, seed);
  if (index < 0 || packets[index]!.count < count) return false;
  packets[index]!.count -= count;
  if (packets[index]!.count === 0) packets.splice(index, 1);
  return true;
}

/** Discard a selected packet count without touching any other genotype. */
export function discardSeedPacket(
  packets: SeedPacket[],
  index: number,
  count = 1,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= packets.length || !validCount(count)) return false;
  const packet = packets[index]!;
  if (packet.count < count) return false;
  packet.count -= count;
  if (packet.count === 0) packets.splice(index, 1);
  return true;
}

/** Sort deterministically while returning the selected genotype's new index. */
export function sortSeedPackets(packets: SeedPacket[], selectedIndex: number): number {
  const selectedKey = packets[selectedIndex] ? seedGenotypeKey(packets[selectedIndex]!.seed) : null;
  packets.sort((a, b) => {
    const leftName = a.seed.displayName;
    const rightName = b.seed.displayName;
    const byName = leftName < rightName ? -1 : leftName > rightName ? 1 : 0;
    if (byName !== 0) return byName;
    const leftKey = seedGenotypeKey(a.seed);
    const rightKey = seedGenotypeKey(b.seed);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  if (!packets.length) return 0;
  const next = selectedKey ? packets.findIndex((packet) => seedGenotypeKey(packet.seed) === selectedKey) : -1;
  return next >= 0 ? next : Math.min(Math.max(selectedIndex, 0), packets.length - 1);
}

export function seedPacketAt(
  packets: readonly SeedPacket[],
  selectedIndex: number,
): SeedPacket | null {
  return packets[selectedIndex] ?? packets[0] ?? null;
}
