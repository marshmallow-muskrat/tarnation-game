import { describe, expect, it } from 'vitest';
import { CROP_DEFS } from '../src/content';
import {
  createEmptyGrid,
  cropValueScore,
  hasPortableLightNearby,
  hasRepelNearby,
  hasRicochetNearby,
  nibbleCrop,
  plantTile,
  tillTile,
  waterTile,
} from '../src/sim/farm';
import {
  cropYieldForSeed,
  growthDurationForSeed,
  growTimeForSeed,
  type HybridMech,
  makeSeed,
  nibbleDamageForSeed,
  REPEL_FOX_USES_PER_RAID,
  repellerUsesRemaining,
  seedTraitDescription,
  waterGrowthMultiplierForSeed,
} from '../src/sim/genetics';

function plantTraitCrop(
  species: keyof typeof CROP_DEFS,
  traits: Parameters<typeof makeSeed>[1] = {},
  mech: HybridMech = 'none',
) {
  const tiles = createEmptyGrid();
  const seed = makeSeed(species, traits);
  seed.mech = mech;
  tillTile(tiles, 12, 12, 1);
  plantTile(tiles, 12, 12, seed);
  waterTile(tiles, 12, 12, 0);
  return { tiles, seed };
}

describe('released trait effects', () => {
  it('makes vigor change deterministic watered growth duration around the baseline', () => {
    const base = makeSeed('beet', { vigor: 50 });
    const slow = makeSeed('beet', { vigor: 0 });
    const fast = makeSeed('beet', { vigor: 100 });

    expect(growTimeForSeed(base, CROP_DEFS.beet.grow)).toBe(CROP_DEFS.beet.grow);
    expect(growthDurationForSeed(slow, CROP_DEFS.beet.grow, CROP_DEFS.beet.waterNeed)).toBe(
      CROP_DEFS.beet.grow * 1.25,
    );
    expect(growthDurationForSeed(fast, CROP_DEFS.beet.grow, CROP_DEFS.beet.waterNeed)).toBe(
      CROP_DEFS.beet.grow * 0.75,
    );
  });

  it('makes thirst change the speed of a watered crop without changing the binary watered state', () => {
    const low = makeSeed('beet', { thirst: 0 });
    const baseline = makeSeed('beet', { thirst: 50 });
    const high = makeSeed('beet', { thirst: 100 });

    expect(waterGrowthMultiplierForSeed(low, CROP_DEFS.beet.waterNeed)).toBe(0.875);
    expect(waterGrowthMultiplierForSeed(baseline, CROP_DEFS.beet.waterNeed)).toBe(1);
    expect(waterGrowthMultiplierForSeed(high, CROP_DEFS.beet.waterNeed)).toBe(1.125);
    expect(growthDurationForSeed(low, CROP_DEFS.beet.grow, CROP_DEFS.beet.waterNeed)).toBeLessThan(
      growthDurationForSeed(high, CROP_DEFS.beet.grow, CROP_DEFS.beet.waterNeed),
    );
  });

  it('makes hardiness reduce the same fox bite while preserving the ironroot absolute defense', () => {
    const soft = makeSeed('beet', { hardiness: 0 });
    const baseline = makeSeed('beet', { hardiness: 50 });
    const tough = makeSeed('beet', { hardiness: 100 });

    expect(nibbleDamageForSeed(soft, 0.35)).toBeCloseTo(0.525);
    expect(nibbleDamageForSeed(baseline, 0.35)).toBeCloseTo(0.35);
    expect(nibbleDamageForSeed(tough, 0.35)).toBeCloseTo(0.175);

    const { tiles } = plantTraitCrop('beet', { hardiness: 100 });
    tiles[12]![12]!.state = 'mature';
    expect(nibbleCrop(tiles, 12, 12)).toBe(true);
    expect(tiles[12]![12]!.growth).toBeCloseTo(0.75);
  });

  it('makes greed crops produce one extra unit and add explicit raid pressure', () => {
    const ordinary = makeSeed('beet', { yield: 0 });
    const greedy = makeSeed('beet', { yield: 0 });
    greedy.mech = 'greed_crop';

    expect(cropYieldForSeed(ordinary)).toBe(1);
    expect(cropYieldForSeed(greedy)).toBe(2);

    const ordinaryPlot = plantTraitCrop('beet', { yield: 0 });
    const greedyPlot = plantTraitCrop('beet', { yield: 0 }, 'greed_crop');
    expect(cropValueScore(greedyPlot.tiles)).toBeGreaterThan(cropValueScore(ordinaryPlot.tiles));
  });

  it('keeps local mechanisms active only on live crop tiles and caps their authored radius', () => {
    const tiles = createEmptyGrid();
    const repeller = makeSeed('beet');
    repeller.mech = 'repel_foxes';
    tillTile(tiles, 12, 12, 1);
    plantTile(tiles, 12, 12, repeller);

    expect(hasRepelNearby(tiles, 12, 15, 100)).toBe(true);
    expect(hasRepelNearby(tiles, 12, 16, 100)).toBe(false);
    tiles[12]![12]!.state = 'tilled';
    expect(hasRepelNearby(tiles, 12, 12)).toBe(false);
  });

  it('limits passive repellers to a small deterministic number of foxes per raid', () => {
    expect(REPEL_FOX_USES_PER_RAID).toBe(2);
    expect(repellerUsesRemaining(0)).toBe(2);
    expect(repellerUsesRemaining(1)).toBe(1);
    expect(repellerUsesRemaining(2)).toBe(0);
    expect(repellerUsesRemaining(20)).toBe(0);
  });

  it('arms ricochet once and illuminates from either a placed crop or a carried seed', () => {
    const tiles = createEmptyGrid();
    const ricochet = makeSeed('beet');
    ricochet.mech = 'ricochet';
    const light = makeSeed('beet');
    light.mech = 'portable_light';
    tillTile(tiles, 12, 12, 1);
    tillTile(tiles, 14, 12, 1);
    plantTile(tiles, 12, 12, ricochet);
    plantTile(tiles, 14, 12, light);

    expect(hasRicochetNearby(tiles, 12, 21, 100)).toBe(false);
    expect(hasRicochetNearby(tiles, 12, 19)).toBe(true);
    expect(hasPortableLightNearby(tiles, 14, 19, 100)).toBe(false);
    expect(hasPortableLightNearby(tiles, 14, 18, 6)).toBe(true);
  });

  it('describes every released mechanism with the effect the player can observe', () => {
    const mechanisms = [
      ['repel_foxes', 'Repels up to 2 foxes per raid within 3 tiles'],
      ['portable_light', 'Brightens night travel nearby'],
      ['ironroot', 'Resists fox bites and mature destruction'],
      ['ricochet', 'Nearby projectiles bounce once'],
      ['greed_crop', '+1 produce and attracts more foxes'],
      ['none', 'No hybrid mechanism'],
    ] as const;

    for (const [mech, phrase] of mechanisms) {
      const seed = makeSeed('beet');
      seed.mech = mech;
      expect(seedTraitDescription(seed)).toContain(phrase);
    }
  });
});
