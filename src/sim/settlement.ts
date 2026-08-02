/**
 * The authored release objective, derived from ordinary game progress rather
 * than stored as a second progression state machine.
 */
import type { CodexEntry } from './genetics';
import type { GameStats, PlacedBuilding } from './save';

export type SettlementStepId = 'grow' | 'experiment' | 'defend' | 'develop';

export type SettlementStep = {
  id: SettlementStepId;
  label: string;
  complete: boolean;
};

export type SettlementObjective = {
  title: string;
  complete: boolean;
  steps: readonly SettlementStep[];
};

export type SettlementInput = {
  stats: Pick<GameStats, 'cropsHarvested' | 'trophies'>;
  codex: readonly Pick<CodexEntry, 'seed'>[];
  homesteadTier: number;
  placedBuildings: readonly Pick<PlacedBuilding, 'id'>[];
};

const SETTLEMENT_TITLE = 'Establish the homestead';

function hasBuilding(input: SettlementInput, ids: readonly string[]): boolean {
  return input.placedBuildings.some((building) => ids.includes(building.id));
}

/** Derive the player-visible four-pillar settlement progress from saved state. */
export function settlementObjective(input: SettlementInput): SettlementObjective {
  const steps: SettlementStep[] = [
    {
      id: 'grow',
      label: 'Grow · harvest a crop',
      complete: input.stats.cropsHarvested > 0,
    },
    {
      id: 'experiment',
      label: 'Experiment · discover a hybrid',
      complete: input.codex.some((entry) => entry.seed.hybrid),
    },
    {
      id: 'defend',
      label: 'Defend · place a fence, gate, or earn a trophy',
      complete: input.stats.trophies > 0 || hasBuilding(input, ['fence', 'gate']),
    },
    {
      id: 'develop',
      label: 'Develop · advance the homestead or build a utility',
      complete: input.homesteadTier >= 2 || hasBuilding(input, ['silo', 'water_tower']),
    },
  ];

  return {
    title: SETTLEMENT_TITLE,
    complete: steps.every((step) => step.complete),
    steps,
  };
}

export function isSettlementObjectiveComplete(input: SettlementInput): boolean {
  return settlementObjective(input).complete;
}
