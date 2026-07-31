/**
 * Bad-luck protection for drops.
 *
 * A flat 1% roll can leave a player 400 kills deep with nothing to show. Every
 * failed roll on a given key raises that key's chance by a fixed step; a success
 * resets it. Written against a plain `Record<string, number>` of pity counters so
 * any future loot table — creatures, chests, fishing — can share it.
 */
import { TROPHY_DROP_CHANCE, TROPHY_PITY_STEP } from '../content';
import type { Rng } from './rng';

export type PityState = Record<string, number>;

export interface DropOdds {
  /** Chance before pity is applied. */
  base: number;
  /** Added per failed attempt. */
  step: number;
  /** Ceiling, so a drop stays a moment rather than a certainty. */
  max?: number;
}

export const TROPHY_ODDS: DropOdds = {
  base: TROPHY_DROP_CHANCE,
  step: TROPHY_PITY_STEP,
  max: 1,
};

/** Current chance for a key, including accumulated pity. */
export function dropChance(pity: PityState, key: string, odds: DropOdds): number {
  const misses = pity[key] ?? 0;
  return Math.min(odds.max ?? 1, odds.base + misses * odds.step);
}

/**
 * Roll a drop and update the pity counter in place.
 * Success resets the counter; failure increments it.
 */
export function rollDrop(pity: PityState, key: string, odds: DropOdds, rng: Rng): boolean {
  const chance = dropChance(pity, key, odds);
  if (rng() < chance) {
    delete pity[key];
    return true;
  }
  pity[key] = (pity[key] ?? 0) + 1;
  return false;
}
