import { describe, expect, it } from 'vitest';
import { DENSE_FARM_ORIGIN, DENSE_FARM_SIZE, denseFarmStressFixture, FIXTURE_SEED, freshGameFixture, malformedSaveFixtures, midgameSaveFixture, priorVersionSaveFixture, type PriorSaveVersion } from './fixtures';
import { countItem } from '../src/sim/inventory';
import { cropItem, ITEM_WOOD } from '../src/sim/items';
import { loadFromSaveData, loadFromString, saveToString } from '../src/sim/gameState';
import { deserialize, SAVE_VERSION, serialize } from '../src/sim/save';

describe('save serialization and fixture round-trips', () => {
  it('serializes a fixed-seed fresh game deterministically and loads its full grid back', () => {
    const first = saveToString(freshGameFixture(FIXTURE_SEED));
    const second = saveToString(freshGameFixture(FIXTURE_SEED));

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThan(10_000_000);
    const loaded = loadFromString(first);
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({ seed: FIXTURE_SEED, clock: { day: 1, phase: 'day', elapsed: 0 }, inventoryOpen: true });
    expect(loaded!.tiles).toHaveLength(240);
    expect(loaded!.tiles[0]).toHaveLength(240);
  });

  it('round-trips a representative midgame without losing crops, inventory, buildings, or Codex data', () => {
    const raw = serialize(midgameSaveFixture());
    const parsed = deserialize(raw);
    const loaded = parsed ? loadFromSaveData(parsed) : null;

    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      seed: 0x4d1d_6a0e,
      clock: { day: 3, phase: 'night', elapsed: 11 },
      homesteadTier: 3,
      irrigationTier: 3,
      bucketFill: 7,
      duckettes: 143,
      inventoryOpen: false,
      toolbarSlot: 2,
    });
    expect(countItem(loaded!.inventory, ITEM_WOOD)).toBe(37);
    expect(countItem(loaded!.inventory, cropItem('Beet'))).toBe(4);
    expect(loaded!.tiles[20]![20]!.state).toBe('mature');
    expect(loaded!.tiles[20]![21]!.state).toBe('planted');
    expect(loaded!.placedBuildings).toHaveLength(2);
    expect(loaded!.placedBuildings[1]).toMatchObject({ id: 'gate', gateOpen: true });
    expect(loaded!.codex).toHaveLength(2);
    expect(loaded!.seedInventory).toHaveLength(3);
  });

  it('round-trips a dense typed farm stress fixture without committing generated JSON', () => {
    const raw = serialize(denseFarmStressFixture());
    const parsed = deserialize(raw);
    const loaded = parsed ? loadFromSaveData(parsed) : null;

    expect(loaded).not.toBeNull();
    expect(loaded!.stats.cropsHarvested).toBe(DENSE_FARM_SIZE * DENSE_FARM_SIZE);
    expect(loaded!.tiles[DENSE_FARM_ORIGIN]![DENSE_FARM_ORIGIN]!.seed).not.toBeNull();
    expect(loaded!.tiles[DENSE_FARM_ORIGIN + DENSE_FARM_SIZE - 1]![DENSE_FARM_ORIGIN + DENSE_FARM_SIZE - 1]!.seed).not.toBeNull();
    expect(loaded!.tiles[0]![0]!.state).toBe('grass');
  });

  it('rejects malformed save envelopes without creating a partial game state', () => {
    for (const fixture of malformedSaveFixtures()) {
      expect(deserialize(fixture.raw), fixture.label).toBeNull();
      expect(loadFromString(fixture.raw), fixture.label).toBeNull();
    }
  });

  it('rejects a future save version instead of silently loading it as current data', () => {
    const future = JSON.stringify({ ...JSON.parse(priorVersionSaveFixture(7)), version: SAVE_VERSION + 1 });

    expect(deserialize(future)).toBeNull();
  });

  it('stamps accepted legacy data to the current version and filters unknown assets without resetting the run', () => {
    const raw = JSON.parse(serialize(midgameSaveFixture())) as Record<string, unknown>;
    raw.placedBuildings = [
      { id: 'fence', x: 30.5, z: 30.5, rotation: 0 },
      { id: 'building:deleted-forever', x: 12, z: 12, rotation: 0 },
    ];
    raw.inventory = [
      { id: 'deed:fence', count: 1 },
      { id: 'deed:deleted-forever', count: 2 },
    ];

    const parsed = deserialize(JSON.stringify(raw));
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe(SAVE_VERSION);
    expect(parsed!.placedBuildings).toEqual([{ id: 'fence', x: 30.5, z: 30.5, rotation: 0, gateOpen: false }]);
    expect(parsed!.inventory).toEqual([{ id: 'deed:fence', count: 1 }, ...Array(23).fill(null)]);
  });
});

describe('supported prior save migrations', () => {
  const versions: PriorSaveVersion[] = [3, 4, 5, 6, 7];

  it.each(versions)('migrates released save version %d into the current weapon, inventory, and state model', (version) => {
    const parsed = deserialize(priorVersionSaveFixture(version));
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe(SAVE_VERSION);
    expect(parsed!.day).toBe(4);
    expect(parsed!.phase).toBe('night');
    expect(parsed!.playerX).toBe(120);
    expect(parsed!.playerZ).toBe(120);

    const loaded = loadFromSaveData(parsed!);
    expect(loaded.seed).toBe(0x1e9a_c700);
    expect(countItem(loaded.inventory, ITEM_WOOD)).toBe(({ 3: 37, 4: 37, 5: 37, 6: 42, 7: 48 } as Record<number, number>)[version]);
    expect(countItem(loaded.inventory, cropItem(version === 3 ? 'Beet' : version === 4 ? 'Beet' : version === 5 ? 'Beet' : version === 6 ? 'Carrot' : 'Lettuce'))).toBeGreaterThan(0);
    expect(loaded.weapon).toBe(version <= 5 ? 'shotgun' : 'axe');
    expect(loaded.duckettes).toBe(({ 3: 0, 4: 250, 5: 275, 6: 310, 7: 410 } as Record<number, number>)[version]);
    expect(loaded.toolbarSlot).toBe(version < 5 ? 1 : 2);
    expect(loaded.homesteadTier).toBe(({ 3: 2, 4: 2, 5: 1, 6: 3, 7: 4 } as Record<number, number>)[version]);
    expect(loaded.placedBuildings).toHaveLength(version >= 6 ? 2 : 0);
  });

  it('keeps the current v4 behavior of adding the legacy trophy list to an already populated trophy stack', () => {
    const parsed = deserialize(priorVersionSaveFixture(4));

    expect(parsed).not.toBeNull();
    expect(countItem(parsed!.inventory, 'trophy:Thicket Fox')).toBe(2);
  });

  it('documents that retired top-level darkwood from v3/v4 is currently discarded during migration', () => {
    for (const version of [3, 4] as const) {
      const parsed = deserialize(priorVersionSaveFixture(version));
      expect(parsed).not.toBeNull();
      expect(countItem(parsed!.inventory, 'darkwood')).toBe(0);
    }
  });

  it('keeps v5 and newer trophy inventory distinct from the legacy trophy ledger', () => {
    for (const version of [5, 6, 7] as const) {
      const parsed = deserialize(priorVersionSaveFixture(version));
      expect(parsed).not.toBeNull();
      expect(countItem(parsed!.inventory, 'trophy:Thicket Fox')).toBe(1);
      expect(parsed!.trophies).toEqual(['Thicket Fox']);
    }
  });

  it('accepts the unversioned and historically unshipped v1/v2 fallback shapes using the same pre-v5 rules', () => {
    for (const version of [undefined, 1, 2] as const) {
      const data = JSON.parse(priorVersionSaveFixture(3)) as Record<string, unknown>;
      if (version === undefined) delete data.version;
      else data.version = version;
      const parsed = deserialize(JSON.stringify(data));

      expect(parsed).not.toBeNull();
      expect(parsed!.version).toBe(SAVE_VERSION);
      expect(parsed!.toolbarSlot).toBe(1);
      expect(countItem(parsed!.inventory, ITEM_WOOD)).toBe(37);
    }
  });
});
