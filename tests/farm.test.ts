import { describe, expect, it } from 'vitest';
import { CROP_DEFS, FULL_DAY, TILL_DECAY_DAYS } from '../src/content';
import {
  clearBreedingParents,
  createEmptyGrid,
  decayUnplantedTilth,
  destroyCrop,
  digTrench,
  flowTrenchWater,
  harvestTile,
  hasRepelNearby,
  makeBreedingBed,
  nibbleCrop,
  placeBearTrap,
  plantTile,
  stepCrops,
  tillTile,
  trenchSourceTiles,
  triggerBearTrap,
  waterTile,
} from '../src/sim/farm';
import { growthDurationForSeed, makeSeed } from '../src/sim/genetics';

describe('farming and crop transitions', () => {
  it('turns grass into fresh tilled soil and rejects non-grass retilling', () => {
    const tiles = createEmptyGrid();

    expect(tillTile(tiles, 4, 4, 3)).toBe(true);
    expect(tiles[4]![4]!.state).toBe('tilled');
    expect(tiles[4]![4]!.tilledDay).toBe(3);
    expect(tillTile(tiles, 4, 4, 3)).toBe(false);
    expect(tillTile(tiles, -1, 4, 3)).toBe(false);
  });

  it('plants only tilled soil and allows a breeding bed to accept exactly two parents', () => {
    const tiles = createEmptyGrid();
    const beet = makeSeed('beet');
    const carrot = makeSeed('carrot');

    expect(plantTile(tiles, 4, 4, beet)).toBe(false);
    expect(tillTile(tiles, 4, 4, 1)).toBe(true);
    expect(makeBreedingBed(tiles, 4, 4)).toBe(true);
    expect(plantTile(tiles, 4, 4, beet)).toBe(true);
    expect(plantTile(tiles, 4, 4, carrot)).toBe(true);
    expect(plantTile(tiles, 4, 4, makeSeed('lettuce'))).toBe(false);
    expect(tiles[4]![4]!.breedA?.displayName).toBe('Beet');
    expect(tiles[4]![4]!.breedB?.displayName).toBe('Carrot');
  });

  it('waters a planted tile once and records the watering simulation time', () => {
    const tiles = createEmptyGrid();
    tillTile(tiles, 3, 3, 1);
    plantTile(tiles, 3, 3, makeSeed('beet'));

    expect(waterTile(tiles, 3, 3, 17.5)).toBe(true);
    expect(tiles[3]![3]!.watered).toBe(true);
    expect(tiles[3]![3]!.plantedAt).toBe(17.5);
    expect(waterTile(tiles, 3, 3, 18)).toBe(false);
  });

  it('does not grow a dry crop, then advances stages and matures it after two full days', () => {
    const tiles = createEmptyGrid();
    tillTile(tiles, 2, 2, 1);
    const lettuce = makeSeed('lettuce');
    plantTile(tiles, 2, 2, lettuce);
    const tile = tiles[2]![2]!;

    stepCrops(tiles, FULL_DAY);
    expect(tile.state).toBe('planted');
    expect(tile.growth).toBe(0);
    expect(tile.stage).toBe(0);

    waterTile(tiles, 2, 2, 0);
    const first = stepCrops(tiles, 200);
    expect(first).toEqual([]);
    expect(tile.state).toBe('planted');
    expect(tile.stage).toBe(1);
    const grow = growthDurationForSeed(lettuce, CROP_DEFS.lettuce.grow, CROP_DEFS.lettuce.waterNeed);
    expect(tile.growth).toBeCloseTo(200 / grow);

    const second = stepCrops(tiles, grow - 200);
    expect(second).toEqual([{ x: 2, y: 2 }]);
    expect(tile.state).toBe('mature');
    expect(tile.stage).toBe(2);
    expect(tile.growth).toBe(1);
  });

  it('applies each crop seed vigor and water need to its deterministic growth duration', () => {
    for (const species of Object.keys(CROP_DEFS) as (keyof typeof CROP_DEFS)[]) {
      const tiles = createEmptyGrid();
      tillTile(tiles, 1, 1, 1);
      const seed = makeSeed(species, { vigor: 0 });
      plantTile(tiles, 1, 1, seed);
      waterTile(tiles, 1, 1, 0);

      const duration = growthDurationForSeed(seed, CROP_DEFS[species].grow, CROP_DEFS[species].waterNeed);
      stepCrops(tiles, duration);
      expect(tiles[1]![1]!.state, `${species} should mature on its trait-aware grow time`).toBe('mature');
    }
  });

  it('returns yield based on the seed trait and resets the harvested tile to tilled soil', () => {
    const tiles = createEmptyGrid();
    tillTile(tiles, 5, 5, 1);
    const seed = makeSeed('beet', { yield: 99 });
    plantTile(tiles, 5, 5, seed);
    waterTile(tiles, 5, 5, 0);
    stepCrops(tiles, CROP_DEFS.beet.grow);

    const result = harvestTile(tiles, 5, 5);
    expect(result).toMatchObject({ ok: true, seed, count: 3, hybridChild: null });
    expect(tiles[5]![5]!.state).toBe('tilled');
    expect(tiles[5]![5]!.seed).toBeNull();
  });

  it('clears a full breeding bed without silently generating a hybrid child', () => {
    const tiles = createEmptyGrid();
    tillTile(tiles, 6, 6, 1);
    makeBreedingBed(tiles, 6, 6);
    const a = makeSeed('beet');
    const b = makeSeed('carrot');
    plantTile(tiles, 6, 6, a);
    plantTile(tiles, 6, 6, b);

    const harvested = harvestTile(tiles, 6, 6);
    expect(harvested).toEqual({ ok: true, seed: null, count: 0, hybridChild: null });
    expect(tiles[6]![6]!.state).toBe('tilled');

    tillTile(tiles, 7, 7, 1);
    makeBreedingBed(tiles, 7, 7);
    plantTile(tiles, 7, 7, a);
    plantTile(tiles, 7, 7, b);
    expect(clearBreedingParents(tiles, 7, 7)).toEqual({ a, b });
    expect(clearBreedingParents(tiles, 7, 7)).toBeNull();
  });

  it('reclaims unplanted soil after the configured interval plus one dawn and preserves planted soil', () => {
    const tiles = createEmptyGrid();
    tillTile(tiles, 8, 8, 3);
    expect(decayUnplantedTilth(tiles, 3)).toEqual([]);
    expect(decayUnplantedTilth(tiles, 3 + TILL_DECAY_DAYS)).toEqual([]);
    expect(decayUnplantedTilth(tiles, 3 + TILL_DECAY_DAYS + 1)).toEqual([{ x: 8, y: 8 }]);
    expect(tiles[8]![8]!.state).toBe('grass');

    tillTile(tiles, 9, 9, 3);
    plantTile(tiles, 9, 9, makeSeed('beet'));
    expect(decayUnplantedTilth(tiles, 99)).toEqual([]);
    expect(tiles[9]![9]!.state).toBe('planted');
  });

  it('flows trench water downhill to planted tiles but not uphill', () => {
    const tiles = createEmptyGrid();
    digTrench(tiles, 1, 1);
    digTrench(tiles, 2, 1);
    tillTile(tiles, 3, 1, 1);
    plantTile(tiles, 3, 1, makeSeed('beet'));
    tillTile(tiles, 1, 2, 1);
    plantTile(tiles, 1, 2, makeSeed('carrot'));

    const watered = flowTrenchWater(tiles, (x, z) => -x + z * 10, [{ x: 1, y: 1 }]);
    expect(watered).toBe(1);
    expect(tiles[1]![1]!.watered).toBe(true);
    expect(tiles[1]![2]!.watered).toBe(true);
    expect(tiles[1]![3]!.watered).toBe(true);
    expect(tiles[2]![1]!.watered).toBe(false);
  });

  it('recomputes connected trench wetness from explicit water sources instead of leaving stale wet tiles', () => {
    const tiles = createEmptyGrid();
    digTrench(tiles, 1, 1);
    digTrench(tiles, 2, 1);
    const sources = trenchSourceTiles(tiles, (x, z) => (x === 1.5 && z === 1.5 ? 0 : 10));

    expect(sources).toEqual([{ x: 1, y: 1 }]);
    expect(flowTrenchWater(tiles, (x, z) => -x + z * 10, sources)).toBe(0);
    expect(tiles[1]![1]!.watered).toBe(true);
    expect(tiles[1]![2]!.watered).toBe(true);

    expect(flowTrenchWater(tiles, () => 0, [])).toBe(0);
    expect(tiles[1]![1]!.watered).toBe(false);
    expect(tiles[1]![2]!.watered).toBe(false);
  });

  it('lets ironroot resist mature destruction and nibbles ordinary mature crops back to young growth', () => {
    const ordinary = createEmptyGrid();
    tillTile(ordinary, 2, 2, 1);
    plantTile(ordinary, 2, 2, makeSeed('beet'));
    waterTile(ordinary, 2, 2, 0);
    stepCrops(ordinary, CROP_DEFS.beet.grow);
    expect(nibbleCrop(ordinary, 2, 2)).toBe(true);
    expect(ordinary[2]![2]!).toMatchObject({ state: 'planted', growth: 0.5, stage: 1, watered: true });

    const ironroot = createEmptyGrid();
    tillTile(ironroot, 3, 3, 1);
    plantTile(ironroot, 3, 3, makeSeed('beet', { weirdness: 80 }));
    ironroot[3]![3]!.state = 'mature';
    ironroot[3]![3]!.seed = makeSeed('beet', { weirdness: 80 });
    ironroot[3]![3]!.seed!.mech = 'ironroot';
    expect(destroyCrop(ironroot, 3, 3)).toBe(false);
    expect(nibbleCrop(ironroot, 3, 3)).toBe(false);
  });

  it('places and triggers a bear trap once, and detects a live fox-repelling crop in range', () => {
    const tiles = createEmptyGrid();
    expect(placeBearTrap(tiles, 4, 4)).toBe(true);
    expect(placeBearTrap(tiles, 4, 4)).toBe(false);
    expect(triggerBearTrap(tiles, 4, 4)).toBe(true);
    expect(triggerBearTrap(tiles, 4, 4)).toBe(false);

    tillTile(tiles, 6, 6, 1);
    const repeller = makeSeed('beet', { weirdness: 80 });
    repeller.mech = 'repel_foxes';
    plantTile(tiles, 6, 6, repeller);
    expect(hasRepelNearby(tiles, 6, 7, 1.1)).toBe(true);
    expect(hasRepelNearby(tiles, 8, 8, 1.1)).toBe(false);
  });
});
