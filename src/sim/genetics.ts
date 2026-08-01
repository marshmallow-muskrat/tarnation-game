/**
 * Crossbreeding / Seed Codex — pure sim.
 * Traits 0–100: Yield, Vigor, Thirst, Hardiness, Weirdness.
 */
import type { BaseCropId } from '../content';
import type { Rng } from './rng';
import { randRange } from './rng';

export interface Traits {
  yield: number;
  vigor: number;
  thirst: number;
  hardiness: number;
  weirdness: number;
}

export type HybridMech =
  | 'repel_foxes'
  | 'portable_light'
  | 'ironroot'
  | 'ricochet'
  | 'greed_crop'
  | 'none';

export interface Seed {
  /** Base species or hybrid base pair key */
  species: BaseCropId;
  traits: Traits;
  displayName: string;
  hybrid: boolean;
  mech: HybridMech;
  /** For hybrids: parent species names */
  lineage?: string[];
}

export interface CodexEntry {
  id: string;
  seed: Seed;
  discoveredDay: number;
}

export function defaultTraits(species: BaseCropId): Traits {
  switch (species) {
    case 'grass':
      return { yield: 20, vigor: 70, thirst: 20, hardiness: 60, weirdness: 0 };
    case 'dandelion':
      return { yield: 35, vigor: 55, thirst: 25, hardiness: 45, weirdness: 5 };
    case 'beet':
      return { yield: 50, vigor: 50, thirst: 50, hardiness: 50, weirdness: 8 };
    case 'carrot':
      return { yield: 55, vigor: 45, thirst: 55, hardiness: 40, weirdness: 10 };
    case 'lettuce':
      return { yield: 60, vigor: 40, thirst: 75, hardiness: 35, weirdness: 12 };
  }
}

export function makeSeed(species: BaseCropId, traits?: Partial<Traits>): Seed {
  const base = defaultTraits(species);
  return {
    species,
    traits: { ...base, ...traits },
    displayName: species.charAt(0).toUpperCase() + species.slice(1),
    hybrid: false,
    mech: 'none',
  };
}

function clampTrait(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mutation(rng: Rng, parentWeird: number): number {
  const scale = 1 + parentWeird / 100;
  return randRange(rng, 0, 15) * scale * (rng() > 0.5 ? 1 : -1);
}

function nameHybrid(a: Seed, b: Seed, weird: number, rng: Rng): { name: string; mech: HybridMech } {
  if (weird >= 75) {
    const absurd = [
      { name: 'Screaming Cabbage', mech: 'repel_foxes' as const },
      { name: 'Glowshroom Gourd', mech: 'portable_light' as const },
      { name: 'Ironroot Beet', mech: 'ironroot' as const },
      { name: 'Rubber Corn', mech: 'ricochet' as const },
      { name: 'Carrot Corn', mech: 'greed_crop' as const },
      { name: 'Onilettuce', mech: 'repel_foxes' as const },
      { name: 'Screaming Cabbage', mech: 'repel_foxes' as const },
    ];
    return absurd[Math.floor(rng() * absurd.length)]!;
  }
  if (weird >= 50) {
    const combos: { name: string; mech: HybridMech }[] = [
      { name: `${a.displayName}-${b.displayName} Hybrid`, mech: 'greed_crop' },
      { name: `Wild ${a.displayName}`, mech: 'ironroot' },
      { name: `Bright ${b.displayName}`, mech: 'portable_light' },
      { name: `Bouncy ${a.species}`, mech: 'ricochet' },
    ];
    return combos[Math.floor(rng() * combos.length)]!;
  }
  if (weird >= 25) {
    return {
      name: `Odd ${a.displayName}`,
      mech: 'none',
    };
  }
  return {
    name: `${a.displayName} blend`,
    mech: 'none',
  };
}

/**
 * Breed two parent seeds → child.
 * child.trait = lerp(a,b, rng 0.35..0.65) + mutation scaled by parent Weirdness
 * weirdness += 5 + (differentSpecies ? 12 : 0)
 */
export function crossbreed(a: Seed, b: Seed, rng: Rng): Seed {
  const t = randRange(rng, 0.35, 0.65);
  const parentWeird = (a.traits.weirdness + b.traits.weirdness) / 2;
  const different = a.species !== b.species;

  const traits: Traits = {
    yield: clampTrait(
      a.traits.yield * (1 - t) + b.traits.yield * t + mutation(rng, parentWeird),
    ),
    vigor: clampTrait(
      a.traits.vigor * (1 - t) + b.traits.vigor * t + mutation(rng, parentWeird),
    ),
    thirst: clampTrait(
      a.traits.thirst * (1 - t) + b.traits.thirst * t + mutation(rng, parentWeird),
    ),
    hardiness: clampTrait(
      a.traits.hardiness * (1 - t) + b.traits.hardiness * t + mutation(rng, parentWeird),
    ),
    weirdness: clampTrait(
      parentWeird + 5 + (different ? 12 : 0) + Math.abs(mutation(rng, parentWeird)) * 0.3,
    ),
  };

  const { name, mech } = nameHybrid(a, b, traits.weirdness, rng);
  const species = t < 0.5 ? a.species : b.species;

  return {
    species,
    traits,
    displayName: name,
    hybrid: traits.weirdness >= 25,
    mech: traits.weirdness >= 50 ? mech : 'none',
    lineage: [a.displayName, b.displayName],
  };
}

export function seedId(s: Seed): string {
  return `${s.displayName}|${s.species}|${s.traits.weirdness}|${s.mech}`;
}

/**
 * Every plant takes the same two days, hybrids included — vigor and greed_crop no
 * longer bend the timer, so the player can plan a harvest by the calendar.
 */
export function growTimeForSeed(_seed: Seed, baseGrow: number): number {
  return baseGrow;
}

export function waterNeedForSeed(seed: Seed, base: number): number {
  return Math.min(1, Math.max(0.1, base + (seed.traits.thirst - 50) / 200));
}
