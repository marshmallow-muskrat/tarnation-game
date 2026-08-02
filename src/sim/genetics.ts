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

/** A counted packet keeps the complete genotype while allowing like seeds to stack. */
export interface SeedPacket {
  seed: Seed;
  count: number;
}

export interface CodexEntry {
  id: string;
  seed: Seed;
  discoveredDay: number;
}

/**
 * Characterized ranges for released hybrid mechanisms. These are sim-owned
 * values so the runtime and pure tests cannot quietly drift apart.
 */
export const REPEL_FOX_RADIUS = 3;
export const RICOCHET_RADIUS = 8;
export const PORTABLE_LIGHT_RADIUS = 6;
export const GREED_RAID_SCORE = 4;

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
 * Full genotype identity used by inventory stacking. The Codex keeps its older
 * display-oriented seedId for compatibility; packets must distinguish every
 * inherited trait and lineage so unlike seeds never merge.
 */
export function seedGenotypeKey(s: Seed): string {
  return JSON.stringify([
    s.species,
    s.traits.yield,
    s.traits.vigor,
    s.traits.thirst,
    s.traits.hardiness,
    s.traits.weirdness,
    s.displayName,
    s.hybrid,
    s.mech,
    s.lineage ?? null,
  ]);
}

/** Vigor 50 is the baseline; the released 0–100 range changes time by ±25%. */
export function growTimeForSeed(seed: Seed, baseGrow: number): number {
  return baseGrow * (1.25 - seed.traits.vigor / 200);
}

export function waterNeedForSeed(seed: Seed, base: number): number {
  return Math.min(1, Math.max(0.1, base + (seed.traits.thirst - 50) / 200));
}

/**
 * A watered crop still expresses its thirst trait: higher need makes the wet
 * growth cycle slower, while low need rewards a lighter watering burden.
 * The neutral value at waterNeed .5 is 1, preserving the base crop contract.
 */
export function waterGrowthMultiplierForSeed(seed: Seed, baseWaterNeed: number): number {
  return 0.75 + waterNeedForSeed(seed, baseWaterNeed) * 0.5;
}

/** Exact deterministic duration for a planted, watered crop. */
export function growthDurationForSeed(seed: Seed, baseGrow: number, baseWaterNeed: number): number {
  return growTimeForSeed(seed, baseGrow) * waterGrowthMultiplierForSeed(seed, baseWaterNeed);
}

/** One fox bite is reduced by hardiness; 50 is the characterized baseline. */
export function nibbleDamageForSeed(seed: Seed, baseDamage: number): number {
  return baseDamage * (1.5 - seed.traits.hardiness / 100);
}

/** Greed crops yield one additional produce unit, making the tradeoff tangible. */
export function cropYieldForSeed(seed: Seed): number {
  return 1 + Math.floor(seed.traits.yield / 40) + (seed.mech === 'greed_crop' ? 1 : 0);
}

/** The explicit raid-pressure contribution of a greed crop. */
export function raidAttractionForSeed(seed: Seed): number {
  return seed.mech === 'greed_crop' ? GREED_RAID_SCORE : 0;
}

/** Compact player-facing description used by the planting HUD. */
export function seedTraitDescription(seed: Seed): string {
  const traits = `Vigor ${seed.traits.vigor} · Thirst ${seed.traits.thirst} · Hardiness ${seed.traits.hardiness} · Yield ${seed.traits.yield}`;
  const mechanism = {
    repel_foxes: 'Repels foxes within 3 tiles',
    portable_light: 'Brightens night travel nearby',
    ironroot: 'Resists fox bites and mature destruction',
    ricochet: 'Nearby projectiles bounce once',
    greed_crop: '+1 produce and attracts more foxes',
    none: 'No hybrid mechanism',
  }[seed.mech];
  return `${traits} · ${mechanism}`;
}
