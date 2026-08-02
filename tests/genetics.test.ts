import { describe, expect, it } from 'vitest';
import { FULL_DAY } from '../src/content';
import {
  addSeedToInventory,
  createGameState,
  cycleSeed,
  discoverSeed,
  selectedSeed,
} from '../src/sim/gameState';
import {
  crossbreed,
  defaultTraits,
  growTimeForSeed,
  makeSeed,
  seedId,
  waterNeedForSeed,
} from '../src/sim/genetics';

describe('genetics, inheritance, mutation, and Codex behavior', () => {
  it('creates the documented base trait profiles for every released species', () => {
    expect(defaultTraits('grass')).toEqual({ yield: 20, vigor: 70, thirst: 20, hardiness: 60, weirdness: 0 });
    expect(defaultTraits('dandelion')).toEqual({ yield: 35, vigor: 55, thirst: 25, hardiness: 45, weirdness: 5 });
    expect(defaultTraits('beet')).toEqual({ yield: 50, vigor: 50, thirst: 50, hardiness: 50, weirdness: 8 });
    expect(defaultTraits('carrot')).toEqual({ yield: 55, vigor: 45, thirst: 55, hardiness: 40, weirdness: 10 });
    expect(defaultTraits('lettuce')).toEqual({ yield: 60, vigor: 40, thirst: 75, hardiness: 35, weirdness: 12 });
  });

  it('applies trait overrides while keeping a stable Codex identifier', () => {
    const seed = makeSeed('beet', { yield: 81, weirdness: 44 });

    expect(seed).toMatchObject({ species: 'beet', displayName: 'Beet', hybrid: false, mech: 'none' });
    expect(seed.traits).toMatchObject({ yield: 81, vigor: 50, thirst: 50, hardiness: 50, weirdness: 44 });
    expect(seedId(seed)).toBe('Beet|beet|44|none');
  });

  it('inherits and mutates traits deterministically from a fixed RNG stream', () => {
    const beet = makeSeed('beet', { weirdness: 90 });
    const carrot = makeSeed('carrot', { weirdness: 90 });
    const first = crossbreed(beet, carrot, () => 0.5);
    const second = crossbreed(beet, carrot, () => 0.5);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      species: 'carrot',
      displayName: 'Rubber Corn',
      hybrid: true,
      mech: 'ricochet',
      lineage: ['Beet', 'Carrot'],
      traits: { yield: 38, vigor: 33, thirst: 38, hardiness: 31, weirdness: 100 },
    });
  });

  it('clamps mutated offspring traits and exposes a mechanism only at the hybrid threshold', () => {
    const high = makeSeed('beet', { yield: 100, vigor: 100, thirst: 100, hardiness: 100, weirdness: 100 });
    const low = makeSeed('beet', { yield: 0, vigor: 0, thirst: 0, hardiness: 0, weirdness: 100 });
    const child = crossbreed(high, low, () => 0.5);

    for (const value of Object.values(child.traits)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(child.hybrid).toBe(true);
    expect(child.mech).not.toBe('none');

    const ordinary = crossbreed(makeSeed('beet'), makeSeed('beet'), () => 0.5);
    expect(ordinary.hybrid).toBe(false);
    expect(ordinary.mech).toBe('none');
  });

  it('makes vigor and thirst affect growth deterministically while water need stays bounded', () => {
    const thirsty = makeSeed('lettuce', { thirst: 100 });
    const dry = makeSeed('grass', { thirst: 0 });

    expect(growTimeForSeed(thirsty, FULL_DAY * 2)).toBe(FULL_DAY * 2 * 1.05);
    expect(waterNeedForSeed(thirsty, 0.75)).toBe(1);
    expect(waterNeedForSeed(dry, 0.05)).toBe(0.1);
  });

  it('records each unique seed once in the Codex and counts only newly discovered hybrids', () => {
    const game = createGameState(0xabc123);
    game.codex = [];
    game.stats.hybridsDiscovered = 0;
    const base = makeSeed('beet');
    const hybrid = crossbreed(
      makeSeed('beet', { weirdness: 90 }),
      makeSeed('carrot', { weirdness: 90 }),
      () => 0.5,
    );

    expect(discoverSeed(game, base)).toBe(true);
    expect(discoverSeed(game, base)).toBe(false);
    expect(discoverSeed(game, hybrid)).toBe(true);
    expect(discoverSeed(game, hybrid)).toBe(false);
    expect(game.codex).toHaveLength(2);
    expect(game.stats.hybridsDiscovered).toBe(1);
    expect(game.codex[1]!.discoveredDay).toBe(1);
  });

  it('adds counted seed packets while keeping selection cycling deterministic and wrapping at both ends', () => {
    const game = createGameState(0xdef456);
    game.seedInventory = [];
    game.selectedSeedIndex = 0;
    const beet = makeSeed('beet');
    const carrot = makeSeed('carrot');

    addSeedToInventory(game, beet);
    addSeedToInventory(game, carrot);
    expect(game.seedInventory).toMatchObject([
      { seed: beet, count: 1 },
      { seed: carrot, count: 1 },
    ]);
    expect(selectedSeed(game)).toBe(beet);
    cycleSeed(game, 1);
    expect(selectedSeed(game)).toBe(carrot);
    expect(game.selectedCrop).toBe('carrot');
    cycleSeed(game, 1);
    expect(selectedSeed(game)).toBe(beet);
    cycleSeed(game, -1);
    expect(selectedSeed(game)).toBe(carrot);
    expect(game.codex).toHaveLength(2);
  });
});
