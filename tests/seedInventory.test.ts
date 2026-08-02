import { describe, expect, it } from 'vitest';
import { INVENTORY_SLOTS } from '../src/content';
import {
  addSeedPacket,
  canAddSeedPacket,
  discardSeedPacket,
  normalizeSeedPackets,
  SEED_PACKET_SLOTS,
  sortSeedPackets,
} from '../src/sim/seedInventory';
import { makeSeed, seedGenotypeKey, type SeedPacket } from '../src/sim/genetics';
import {
  createGameState,
  addSeedToInventory,
  discardSeedFromInventory,
  harvestCropTransaction,
  onNewDay,
  plantSeedPacket,
  selectedSeedPacket,
  sortSeedInventory,
} from '../src/sim/gameState';
import { emptyTile, getTile, tillTile } from '../src/sim/farm';
import { addItem, createInventory } from '../src/sim/inventory';
import { cropItem, type ItemId } from '../src/sim/items';
import { seedPacketCapacity } from '../src/sim/buildings';

function distinctSeed(index: number) {
  const species = (['grass', 'dandelion', 'beet', 'carrot', 'lettuce'] as const)[index % 5]!;
  return makeSeed(species, { yield: 20 + index, weirdness: index % 20 });
}

describe('counted seed packet inventory', () => {
  it('stacks only identical full genotypes and keeps similar display IDs separate', () => {
    const packets: SeedPacket[] = [];
    const base = makeSeed('beet');
    const sameGenotype = makeSeed('beet');
    const differentGenotype = makeSeed('beet', { yield: base.traits.yield + 1 });

    expect(addSeedPacket(packets, base, 2)).toBe(true);
    expect(addSeedPacket(packets, sameGenotype, 3)).toBe(true);
    expect(addSeedPacket(packets, differentGenotype)).toBe(true);

    expect(packets).toHaveLength(2);
    expect(packets[0]!.count).toBe(5);
    expect(seedGenotypeKey(packets[0]!.seed)).not.toBe(seedGenotypeKey(packets[1]!.seed));
  });

  it('rejects a new genotype when all packet stacks are occupied but still accepts stacking', () => {
    const packets: SeedPacket[] = [];
    for (let index = 0; index < SEED_PACKET_SLOTS; index++) {
      expect(addSeedPacket(packets, distinctSeed(index))).toBe(true);
    }
    const before = packets.map((packet) => packet.count);
    const extra = makeSeed('lettuce', { yield: 99, weirdness: 99 });

    expect(SEED_PACKET_SLOTS).toBe(INVENTORY_SLOTS);
    expect(canAddSeedPacket(packets, extra)).toBe(false);
    expect(addSeedPacket(packets, extra)).toBe(false);
    expect(addSeedPacket(packets, packets[0]!.seed, 2)).toBe(true);
    expect(packets).toHaveLength(SEED_PACKET_SLOTS);
    expect(packets.slice(1).map((packet) => packet.count)).toEqual(before.slice(1));
    expect(packets[0]!.count).toBe(before[0]! + 2);
  });

  it('accepts a new genotype beyond the base limit when a silo provides the saved building effect', () => {
    const packets: SeedPacket[] = [];
    for (let index = 0; index < SEED_PACKET_SLOTS; index++) {
      expect(addSeedPacket(packets, distinctSeed(index))).toBe(true);
    }
    const capacity = seedPacketCapacity([{ id: 'silo' }]);
    const extra = makeSeed('lettuce', { yield: 99, weirdness: 99 });

    expect(canAddSeedPacket(packets, extra)).toBe(false);
    expect(canAddSeedPacket(packets, extra, 1, capacity)).toBe(true);
    expect(addSeedPacket(packets, extra, 1, capacity)).toBe(true);
    expect(packets).toHaveLength(SEED_PACKET_SLOTS + 1);
  });

  it('derives the live game seed capacity from placed silos without adding a save field', () => {
    const game = createGameState(0x0101_0101);
    game.seedInventory = [];
    for (let index = 0; index < SEED_PACKET_SLOTS; index++) {
      expect(addSeedToInventory(game, distinctSeed(index))).toBe(true);
    }
    const extra = makeSeed('lettuce', { yield: 99, weirdness: 99 });

    expect(addSeedToInventory(game, extra)).toBe(false);
    game.placedBuildings.push({ id: 'silo', x: 20.5, z: 20.5, rotation: 0 });
    expect(addSeedToInventory(game, extra)).toBe(true);
    expect(seedPacketCapacity(game.placedBuildings)).toBe(SEED_PACKET_SLOTS + 8);
    expect(game.seedInventory).toHaveLength(SEED_PACKET_SLOTS + 1);
  });

  it('restores one deterministic grass packet at dawn when a raid emptied seed storage', () => {
    const game = createGameState(0x0102_0304);
    game.seedInventory = [];

    expect(onNewDay(game).seedReserveAdded).toBe(true);
    expect(game.seedInventory).toMatchObject([{ seed: { species: 'grass' }, count: 1 }]);
    expect(onNewDay(game).seedReserveAdded).toBe(false);
    expect(game.seedInventory).toHaveLength(1);
  });

  it('consumes exactly one selected packet only when planting can commit', () => {
    const game = createGameState(0x0202_0202);
    const seed = makeSeed('carrot', { weirdness: 33 });
    game.seedInventory = [{ seed, count: 2 }];
    game.selectedSeedIndex = 0;
    tillTile(game.tiles, 12, 12, 1);

    expect(plantSeedPacket(game, 12, 12, seed)).toBe(true);
    expect(game.seedInventory[0]!.count).toBe(1);
    expect(getTile(game.tiles, 12, 12)?.seed).toBe(seed);

    expect(plantSeedPacket(game, 13, 13, seed)).toBe(false);
    expect(game.seedInventory[0]!.count).toBe(1);
    expect(getTile(game.tiles, 13, 13)?.state).toBe('grass');
  });

  it('does not consume a packet when the target is occupied or the genotype is unavailable', () => {
    const game = createGameState(0x0303_0303);
    const seed = makeSeed('beet');
    game.seedInventory = [{ seed, count: 1 }];
    game.selectedSeedIndex = 0;

    expect(plantSeedPacket(game, 12, 12, seed)).toBe(false);
    expect(game.seedInventory[0]!.count).toBe(1);

    tillTile(game.tiles, 12, 12, 1);
    const other = makeSeed('lettuce');
    expect(plantSeedPacket(game, 12, 12, other)).toBe(false);
    expect(game.seedInventory[0]!.count).toBe(1);
    expect(getTile(game.tiles, 12, 12)?.state).toBe('tilled');
  });

  it('deletes only the requested packet quantity and clamps the selected stack after removal', () => {
    const packets: SeedPacket[] = [
      { seed: makeSeed('beet'), count: 2 },
      { seed: makeSeed('carrot'), count: 1 },
    ];
    expect(discardSeedPacket(packets, 0)).toBe(true);
    expect(packets[0]!.count).toBe(1);
    expect(discardSeedPacket(packets, 0)).toBe(true);
    expect(packets).toHaveLength(1);
    expect(discardSeedPacket(packets, 0, 2)).toBe(false);

    const game = createGameState(0x0404_0404);
    game.seedInventory = [
      { seed: makeSeed('lettuce'), count: 1 },
      { seed: makeSeed('beet'), count: 2 },
    ];
    game.selectedSeedIndex = 1;
    expect(discardSeedFromInventory(game, 1, 2)).toBe(true);
    expect(game.selectedSeedIndex).toBe(0);
    game.seedInventory.push({ seed: makeSeed('beet'), count: 2 });
    game.selectedSeedIndex = 1;
    sortSeedInventory(game);
    expect(selectedSeedPacket(game)?.seed.species).toBe('beet');
    expect(game.seedInventory.map((packet) => packet.seed.species)).toEqual(['beet', 'lettuce']);
  });

  it('merges duplicate packets during migration without changing the first-seen order', () => {
    const beet = makeSeed('beet');
    const carrot = makeSeed('carrot');
    const normalized = normalizeSeedPackets([
      { seed: beet, count: 2 },
      { seed: carrot, count: 4 },
      { seed: makeSeed('beet'), count: 3 },
    ]);

    expect(normalized).toMatchObject([
      { seed: beet, count: 5 },
      { seed: carrot, count: 4 },
    ]);
    const selectedIndex = sortSeedPackets(normalized, 0);
    expect(selectedIndex).toBe(0);
  });

  it('returns produce and one exact genotype packet in one mature-crop transaction', () => {
    const game = createGameState(0x0505_0505);
    const seed = makeSeed('lettuce', { yield: 91, weirdness: 62 });
    game.seedInventory = [];
    game.tiles[14]![14] = { ...emptyTile(), state: 'mature', seed, stage: 2, growth: 1 };

    const result = harvestCropTransaction(game, 14, 14);

    expect(result).toMatchObject({ ok: true, count: 3, seed });
    expect(game.inventory.find((slot) => slot?.id === cropItem(seed.displayName))?.count).toBe(3);
    expect(game.seedInventory).toMatchObject([{ seed, count: 1 }]);
    expect(getTile(game.tiles, 14, 14)?.state).toBe('tilled');
  });

  it('leaves a mature crop untouched when produce or recovered-seed storage is full', () => {
    const fullBagGame = createGameState(0x0606_0606);
    const seed = makeSeed('beet');
    fullBagGame.seedInventory = [];
    fullBagGame.tiles[15]![15] = { ...emptyTile(), state: 'mature', seed, stage: 2, growth: 1 };
    fullBagGame.inventory = createInventory();
    for (let index = 0; index < fullBagGame.inventory.length; index++) {
      fullBagGame.inventory[index] = { id: `crop:occupied-${index}` as ItemId, count: 1 };
    }

    expect(harvestCropTransaction(fullBagGame, 15, 15).ok).toBe(false);
    expect(getTile(fullBagGame.tiles, 15, 15)?.state).toBe('mature');
    expect(fullBagGame.seedInventory).toHaveLength(0);

    const fullSeedGame = createGameState(0x0707_0707);
    fullSeedGame.inventory = createInventory();
    fullSeedGame.tiles[16]![16] = { ...emptyTile(), state: 'mature', seed, stage: 2, growth: 1 };
    fullSeedGame.seedInventory = Array.from({ length: SEED_PACKET_SLOTS }, (_, index) => ({
      seed: distinctSeed(index),
      count: 1,
    }));
    addItem(fullSeedGame.inventory, cropItem(seed.displayName), 1);

    expect(harvestCropTransaction(fullSeedGame, 16, 16).ok).toBe(false);
    expect(getTile(fullSeedGame.tiles, 16, 16)?.state).toBe('mature');
    expect(fullSeedGame.inventory.find((slot) => slot?.id === cropItem(seed.displayName))?.count).toBe(1);
  });
});
