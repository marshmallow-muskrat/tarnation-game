import { describe, expect, it } from 'vitest';
import { legacyV8SaveFixture } from './fixtures';
import { buildCodexCatalog } from '../src/sim/codex';
import { createGameState, discoverSeed, loadFromSaveData, loadFromString, saveToString } from '../src/sim/gameState';
import { crossbreed, makeSeed, seedId } from '../src/sim/genetics';
import { mulberry32 } from '../src/sim/rng';
import { deserialize, SAVE_VERSION } from '../src/sim/save';

describe('Seed Codex catalog and discovery', () => {
  it('starts a new adventure with every starter species discovered and no hidden starter silhouette', () => {
    const game = createGameState(0xced0_0401);
    const catalog = buildCodexCatalog(game.codex);

    expect(game.codex.map((entry) => entry.seed.species)).toEqual([
      'grass',
      'dandelion',
      'beet',
      'carrot',
      'lettuce',
    ]);
    expect(catalog).toHaveLength(5);
    expect(catalog.every((entry) => entry.kind === 'discovered')).toBe(true);
  });

  it('keeps duplicate discovery idempotent and lists unknown species as stable silhouettes', () => {
    const game = createGameState(0xced0_0402);
    game.codex = [];
    const beet = makeSeed('beet');
    const hybrid = crossbreed(makeSeed('beet', { weirdness: 90 }), makeSeed('carrot', { weirdness: 90 }), mulberry32(7));

    expect(discoverSeed(game, beet)).toBe(true);
    expect(discoverSeed(game, beet)).toBe(false);
    expect(discoverSeed(game, hybrid)).toBe(true);
    expect(game.stats.hybridsDiscovered).toBe(1);

    const catalog = buildCodexCatalog([
      ...game.codex,
      { id: seedId(beet), seed: beet, discoveredDay: 99 },
    ]);
    expect(catalog.filter((entry) => entry.kind === 'discovered')).toHaveLength(2);
    expect(catalog.find((entry) => entry.key === 'unknown:lettuce')).toMatchObject({
      kind: 'undiscovered',
      seed: null,
      silhouetteSpecies: 'lettuce',
      discoveredDay: null,
    });
    expect(catalog.map((entry) => entry.key)).toContain('unknown:grass');
    expect(catalog.map((entry) => entry.key)).toContain('unknown:carrot');
  });

  it('round-trips discovered day, lineage, and traits without changing the save contract', () => {
    const game = createGameState(0xced0_0403);
    const hybrid = crossbreed(makeSeed('beet', { weirdness: 90 }), makeSeed('carrot', { weirdness: 90 }), mulberry32(11));
    game.codex = [];
    game.clock.day = 4;
    expect(discoverSeed(game, hybrid)).toBe(true);

    const loaded = loadFromString(saveToString(game));
    expect(loaded).not.toBeNull();
    expect(loaded!.codex).toContainEqual({
      id: seedId(hybrid),
      seed: hybrid,
      discoveredDay: 4,
    });
  });

  it('keeps discovered Codex entries while migrating the supported v8 save shape', () => {
    const parsed = deserialize(legacyV8SaveFixture());

    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe(SAVE_VERSION);
    const loaded = loadFromSaveData(parsed!);
    const catalog = buildCodexCatalog(loaded.codex);

    expect(catalog.filter((entry) => entry.kind === 'discovered')).toHaveLength(2);
    expect(catalog.find((entry) => entry.kind === 'discovered' && entry.seed?.hybrid)?.discoveredDay).toBe(3);
    expect(catalog.some((entry) => entry.kind === 'undiscovered')).toBe(true);
  });
});
