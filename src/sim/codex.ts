import { CROP_DEFS, type BaseCropId } from '../content';
import type { CodexEntry, Seed } from './genetics';

export type CodexListingKind = 'discovered' | 'undiscovered';

/** Stable pure view data for the Codex list, including unrevealed silhouettes. */
export interface CodexListing {
  key: string;
  kind: CodexListingKind;
  seed: Seed | null;
  silhouetteSpecies: BaseCropId | null;
  discoveredDay: number | null;
}

/**
 * Build the authored five-species catalog plus discovered hybrid entries. A
 * duplicate saved id is shown once, matching discoverSeed's current contract.
 */
export function buildCodexCatalog(entries: readonly CodexEntry[]): CodexListing[] {
  const seenIds = new Set<string>();
  const discovered: CodexListing[] = [];
  const knownBaseSpecies = new Set<BaseCropId>();

  for (const entry of entries) {
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    if (!entry.seed.hybrid) knownBaseSpecies.add(entry.seed.species);
    discovered.push({
      key: `known:${entry.id}`,
      kind: 'discovered',
      seed: entry.seed,
      silhouetteSpecies: null,
      discoveredDay: entry.discoveredDay,
    });
  }

  const silhouettes: CodexListing[] = (Object.keys(CROP_DEFS) as BaseCropId[])
    .filter((species) => !knownBaseSpecies.has(species))
    .map((species) => ({
      key: `unknown:${species}`,
      kind: 'undiscovered' as const,
      seed: null,
      silhouetteSpecies: species,
      discoveredDay: null,
    }));

  return [...discovered, ...silhouettes];
}
