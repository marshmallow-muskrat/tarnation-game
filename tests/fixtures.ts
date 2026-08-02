import { createEmptyGrid, emptyTile, type Tile, type TileState } from '../src/sim/farm';
import { crossbreed, makeSeed, seedId, type Seed } from '../src/sim/genetics';
import { addItem, createInventory } from '../src/sim/inventory';
import { cropItem, ITEM_WOOD } from '../src/sim/items';
import { createGameState, type GameState } from '../src/sim/gameState';
import { mulberry32 } from '../src/sim/rng';
import { createNewSave, SAVE_VERSION, type SaveData } from '../src/sim/save';

export const FIXTURE_SEED = 0x5eed_0202;
export const MIDGAME_SEED = 0x4d1d_6a0e;
export const DENSE_FARM_ORIGIN = 80;
export const DENSE_FARM_SIZE = 48;

export type PriorSaveVersion = 3 | 4 | 5 | 6 | 7;

export function freshGameFixture(seed = FIXTURE_SEED): GameState {
  return createGameState(seed);
}

function cropTile(
  seed: Seed,
  state: Extract<TileState, 'planted' | 'mature'>,
  growth: number,
  watered = true,
): Tile {
  return {
    ...emptyTile(),
    state,
    plantedAt: 240,
    watered,
    stage: state === 'mature' ? 2 : 1,
    growth,
    seed,
  };
}

function placeCrop(
  tiles: Tile[][],
  tx: number,
  ty: number,
  seed: Seed,
  state: Extract<TileState, 'planted' | 'mature'>,
  growth: number,
  watered = true,
): void {
  tiles[ty]![tx] = cropTile(seed, state, growth, watered);
}

function cloneSeed(seed: Seed): Seed {
  return {
    ...seed,
    traits: { ...seed.traits },
    lineage: seed.lineage ? [...seed.lineage] : undefined,
  };
}

/** A small but stateful save with worked soil, crops, breeding data, buildings, and Codex entries. */
export function midgameSaveFixture(): SaveData {
  const save = createNewSave(MIDGAME_SEED);
  const beet = makeSeed('beet', { yield: 72, weirdness: 18 });
  const carrot = makeSeed('carrot', { thirst: 62, weirdness: 22 });
  const hybrid = crossbreed(beet, carrot, mulberry32(0x1357_9bdf));
  save.tiles = createEmptyGrid();
  placeCrop(save.tiles, 20, 20, beet, 'mature', 1);
  placeCrop(save.tiles, 21, 20, hybrid, 'planted', 0.42);
  save.tiles[22]![20] = {
    ...emptyTile(),
    state: 'tilled',
    tilledDay: 3,
  };
  save.tiles[23]![20] = {
    ...emptyTile(),
    state: 'trench',
    structureHp: 3,
  };
  save.tiles[24]![20] = {
    ...emptyTile(),
    state: 'breeding',
    breedA: cloneSeed(beet),
    breedB: cloneSeed(carrot),
  };
  save.tiles[25]![20] = { ...emptyTile(), bearTrap: true };
  save.tiles[26]![20] = { ...emptyTile(), bearTrapClosed: true };

  save.day = 3;
  save.phase = 'night';
  save.elapsed = 11;
  save.playerX = 96.5;
  save.playerZ = 97.5;
  save.weapon = 'bow';
  save.unlockedWeapons = ['shotgun', 'bow'];
  save.homesteadTier = 3;
  save.placedBuildings = [
    { id: 'fence', x: 30.5, z: 30.5, rotation: 0 },
    { id: 'gate', x: 34.5, z: 30.5, rotation: 0, gateOpen: true },
    { id: 'silo', x: 39.5, z: 30.5, rotation: 0 },
    { id: 'water_tower', x: 44.5, z: 30.5, rotation: 0 },
  ];
  save.irrigationTier = 3;
  save.bucketFill = 7;
  save.selectedCrop = 'carrot';
  save.inventory = createInventory();
  addItem(save.inventory, ITEM_WOOD, 37);
  addItem(save.inventory, cropItem('Beet'), 4);
  addItem(save.inventory, 'deed:fence', 1);
  save.inventoryOpen = false;
  save.duckettes = 143;
  save.choppedTrees = { '12,14': 2, '13,14': 3 };
  save.clearedStumps = { '12,14': true };
  save.dropPity = { 'fox:diggler': 4 };
  save.toolbarSlot = 2;
  save.toolSlotActive = false;
  save.seedInventory = [
    { seed: cloneSeed(beet), count: 4 },
    { seed: cloneSeed(carrot), count: 2 },
    { seed: cloneSeed(hybrid), count: 3 },
  ];
  save.codex = [
    { id: seedId(beet), seed: cloneSeed(beet), discoveredDay: 1 },
    { id: seedId(hybrid), seed: cloneSeed(hybrid), discoveredDay: 3 },
  ];
  save.stats = {
    cropsHarvested: 8,
    woodGathered: 12,
    daysSurvived: 3,
    trophies: 2,
    hybridsDiscovered: 1,
    foxesFelled: 4,
  };
  save.simTime = 491;
  save.winShown = false;
  save.trophies = ['Thicket Fox', 'Marsh Stag'];
  return save;
}

/** The last released full-grid shape, used to prove the v8 → v9 codec migration. */
export function legacyV8SaveFixture(): string {
  const save = midgameSaveFixture();
  save.version = 8;
  // Released v8 stored one full Seed object per packet. Keep this fixture
  // intentionally uncompressed so migration proves both compatibility and
  // genotype stacking instead of only loading the new packet shape.
  const legacySeedInventory = save.seedInventory.flatMap((packet) =>
    Array.from({ length: packet.count }, () => cloneSeed(packet.seed)),
  );
  return JSON.stringify({ ...save, seedInventory: legacySeedInventory });
}

/** Dense worked area generated from typed state, rather than a checked-in JSON blob. */
export function denseFarmStressFixture(): SaveData {
  const save = createNewSave(0x0f11_fa4e);
  const seeds = [
    makeSeed('grass'),
    makeSeed('dandelion'),
    makeSeed('beet'),
    makeSeed('carrot'),
    makeSeed('lettuce'),
  ];
  save.tiles = createEmptyGrid();
  for (let ty = DENSE_FARM_ORIGIN; ty < DENSE_FARM_ORIGIN + DENSE_FARM_SIZE; ty++) {
    for (let tx = DENSE_FARM_ORIGIN; tx < DENSE_FARM_ORIGIN + DENSE_FARM_SIZE; tx++) {
      const seed = seeds[(tx + ty) % seeds.length]!;
      const mature = (tx + ty) % 3 !== 0;
      placeCrop(save.tiles, tx, ty, seed, mature ? 'mature' : 'planted', mature ? 1 : 0.65);
    }
  }
  save.day = 5;
  save.phase = 'day';
  save.inventory = createInventory();
  addItem(save.inventory, ITEM_WOOD, 240);
  save.duckettes = 900;
  save.stats.cropsHarvested = DENSE_FARM_SIZE * DENSE_FARM_SIZE;
  return save;
}

function commonLegacyFields(version: PriorSaveVersion): Record<string, unknown> {
  return {
    version,
    seed: 0x1e9a_c700,
    day: 4,
    phase: 'night',
    elapsed: 12,
    tiles: [],
    selectedCrop: 'beet',
    seedInventory: [],
    codex: [],
    simTime: 732,
    winShown: false,
    trophies: ['Thicket Fox'],
  };
}

/** Builds the compact shape emitted by each prior released save version. */
export function priorVersionSaveFixture(version: PriorSaveVersion): string {
  const data = commonLegacyFields(version);
  switch (version) {
    case 3:
      Object.assign(data, {
        wood: 37,
        darkwood: 4,
        bagSize: 12,
        shedBuilt: true,
        homesteadTier: 2,
        weapon: 'blunderbuss',
        unlockedWeapons: ['slingshot', 'bow', 'blunderbuss'],
        irrigationTier: 1,
        bucketFill: 2,
        inventory: { Beet: 9, Carrot: 4 },
        attentionFloor: 0.2,
        stats: {
          cropsHarvested: 5,
          woodGathered: 14,
          darkwoodGathered: 2,
          stalkerCaught: 1,
          daysSurvived: 4,
          trophies: 1,
          hybridsDiscovered: 0,
        },
      });
      break;
    case 4:
      Object.assign(data, {
        wood: 37,
        darkwood: 4,
        bagSize: 12,
        shedBuilt: true,
        homesteadTier: 2,
        weapon: 'rock',
        unlockedWeapons: ['rock', 'bow'],
        irrigationTier: 1,
        bucketFill: 2,
        inventory: [
          { id: 'wood', count: 37 },
          { id: 'crop:Beet', count: 9 },
          { id: 'trophy:Thicket Fox', count: 1 },
        ],
        ducketts: 250,
        choppedTrees: { '10,10': 2 },
        toolbarSlot: 0,
        toolSlotActive: false,
        attentionFloor: 0.2,
        stats: {
          cropsHarvested: 5,
          woodGathered: 14,
          darkwoodGathered: 2,
          stalkerCaught: 1,
          daysSurvived: 4,
          trophies: 1,
          hybridsDiscovered: 0,
        },
      });
      break;
    case 5:
      Object.assign(data, {
        weapon: 'rock',
        unlockedWeapons: ['rock', 'bow'],
        irrigationTier: 2,
        bucketFill: 5,
        inventory: [
          { id: 'wood', count: 37 },
          { id: 'crop:Beet', count: 9 },
          { id: 'trophy:Thicket Fox', count: 1 },
        ],
        inventoryOpen: false,
        duckettes: 275,
        choppedTrees: { '10,10': 2 },
        clearedStumps: { '10,10': true },
        dropPity: { 'fox:diggler': 3 },
        toolbarSlot: 2,
        toolSlotActive: false,
        stats: {
          cropsHarvested: 6,
          woodGathered: 16,
          daysSurvived: 4,
          trophies: 1,
          hybridsDiscovered: 1,
          weaselsFelled: 2,
        },
      });
      break;
    case 6:
      Object.assign(data, {
        weapon: 'axe',
        unlockedWeapons: ['shotgun', 'bow', 'axe'],
        homesteadTier: 3,
        placedBuildings: [
          { id: 'silo', x: 44.5, z: 44.5, rotation: 0 },
          { id: 'fence', x: 48.5, z: 44.5, rotation: 1 },
        ],
        irrigationTier: 3,
        bucketFill: 8,
        inventory: [
          { id: 'wood', count: 42 },
          { id: 'crop:Carrot', count: 3 },
          { id: 'trophy:Thicket Fox', count: 1 },
        ],
        inventoryOpen: false,
        duckettes: 310,
        choppedTrees: { '10,10': 2 },
        clearedStumps: { '10,10': true },
        dropPity: { 'fox:nibbler': 2 },
        toolbarSlot: 2,
        toolSlotActive: false,
        stats: {
          cropsHarvested: 8,
          woodGathered: 21,
          daysSurvived: 4,
          trophies: 1,
          hybridsDiscovered: 1,
          weaselsFelled: 3,
        },
      });
      break;
    case 7:
      Object.assign(data, {
        weapon: 'axe',
        unlockedWeapons: ['shotgun', 'bow', 'axe'],
        homesteadTier: 4,
        placedBuildings: [
          { id: 'silo', x: 44.5, z: 44.5, rotation: 0 },
          { id: 'gate', x: 48.5, z: 44.5, rotation: 0, gateOpen: true },
        ],
        irrigationTier: 3,
        bucketFill: 9,
        inventory: [
          { id: 'wood', count: 48 },
          { id: 'crop:Lettuce', count: 5 },
          { id: 'trophy:Thicket Fox', count: 1 },
        ],
        inventoryOpen: false,
        duckettes: 410,
        choppedTrees: { '10,10': 2 },
        clearedStumps: { '10,10': true },
        dropPity: { 'fox:hauler': 1 },
        toolbarSlot: 2,
        toolSlotActive: false,
        stats: {
          cropsHarvested: 12,
          woodGathered: 28,
          daysSurvived: 4,
          trophies: 1,
          hybridsDiscovered: 2,
          foxesFelled: 4,
        },
      });
      break;
  }
  return JSON.stringify(data);
}

export function malformedSaveFixtures(): readonly { label: string; raw: string }[] {
  return [
    { label: 'invalid JSON', raw: '{not-json' },
    { label: 'null root', raw: 'null' },
    { label: 'missing seed', raw: JSON.stringify({ version: 8, day: 1, phase: 'day', tiles: [] }) },
    { label: 'missing day', raw: JSON.stringify({ version: 8, seed: FIXTURE_SEED, phase: 'day', tiles: [] }) },
    {
      label: 'invalid phase',
      raw: JSON.stringify({ version: 8, seed: FIXTURE_SEED, day: 1, phase: 'dusk', tiles: [] }),
    },
    {
      label: 'tiles are not an array',
      raw: JSON.stringify({ version: 8, seed: FIXTURE_SEED, day: 1, phase: 'day', tiles: {} }),
    },
  ];
}

export function futureSaveFixture(): string {
  return JSON.stringify({
    ...JSON.parse(priorVersionSaveFixture(7)),
    version: SAVE_VERSION + 1,
  });
}
