import { isDuskNear, type ClockState } from './clock';
import type { FoxType } from './raid';

export type ArcProgress = {
  day: number;
  cropsHarvested: number;
  codex: readonly { seed: { hybrid: boolean } }[];
  placedBuildings: readonly { id: string }[];
};

export const RAID_TELEGRAPH = 'Dusk warning · foxes raid tonight. Harvest ready crops or place a bear trap.';

export type FoxCropLossOutcome = 'nibbled' | 'destroyed' | 'taken_before_harvest';

const FOX_ROLE_LABELS: Record<FoxType, string> = {
  diggler: 'Diggler',
  nibbler: 'Nibbler',
  sapper: 'Sapper',
  hauler: 'Hauler',
};

/** Explain a crop loss with the next defensive choice the player can make. */
export function foxCropLossGuidance(
  kind: FoxType,
  cropName: string,
  outcome: FoxCropLossOutcome,
): string {
  const role = FOX_ROLE_LABELS[kind];
  if (outcome === 'nibbled') {
    return `${role} nibbled your ${cropName} · fence the plot or set a bear trap before nightfall.`;
  }
  if (outcome === 'destroyed') {
    return `${role} destroyed your ${cropName} · fence the plot or set a bear trap before nightfall.`;
  }
  return `${role} took your ${cropName} before harvest · harvest before dusk, fence the plot, or set a bear trap.`;
}

/** Explain stored-produce theft without implying that farm loss is a reward. */
export function foxProduceLossGuidance(itemName: string): string {
  return `Hauler stole ${itemName} from storage · sell it before dusk or set a bear trap.`;
}

/** The first deliberate post-tutorial choice is visible before the player buys blindly. */
export function dayTwoChoiceHint(): string {
  return 'Day 2 choice · storage (Silo), watering (Water Tower), crop strategy (C), or defense (fence/gate)';
}

/** Avoid repeating the same dusk warning after a fixed-step update or reload. */
export function shouldTelegraphRaid(clock: Pick<ClockState, 'day' | 'phase' | 't'>, warnedDay: number): boolean {
  return clock.day !== warnedDay && isDuskNear(clock);
}

function hasHybrid(progress: ArcProgress): boolean {
  return progress.codex.some((entry) => entry.seed.hybrid);
}

export function hasFunctionalBuilding(progress: Pick<ArcProgress, 'placedBuildings'>): boolean {
  return progress.placedBuildings.some(({ id }) =>
    id === 'fence' || id === 'gate' || id === 'silo' || id === 'water_tower',
  );
}

/**
 * Keep the post-sale arc explicit without adding a second saved quest system.
 * The guide asks for the missing pillar, so a player can reach genetics and a
 * functional building even when prices alone would otherwise be the only cue.
 */
export function multiDayArcHint(progress: ArcProgress): string | null {
  if (progress.day < 2 || progress.cropsHarvested < 1) return null;
  const hybrid = hasHybrid(progress);
  const functionalBuilding = hasFunctionalBuilding(progress);
  if (!hybrid && !functionalBuilding) {
    return 'Next loop · choose storage/watering, crop strategy with C, or defense at the Merchant';
  }
  if (!hybrid) return 'Next loop · use C to breed two seeds and reveal a hybrid in the Codex';
  if (!functionalBuilding) return 'Next loop · place a functional Silo, Water Tower, fence, or gate';
  return null;
}
