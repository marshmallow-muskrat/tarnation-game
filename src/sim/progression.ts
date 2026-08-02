import type { ProgressionEffect } from '../content/purchasables';

export type ProgressionState = Readonly<{
  homesteadTier: number;
  irrigationTier: number;
}>;

/** Explain why a progression item cannot be bought or applied yet. */
export function progressionLockReason(
  effect: ProgressionEffect,
  state: ProgressionState,
): string | null {
  if (effect.kind === 'irrigation') {
    return state.irrigationTier >= effect.targetTier
      ? 'Irrigation is already fully upgraded'
      : state.irrigationTier !== effect.targetTier - 1
        ? `Requires Irrigation Tier ${effect.targetTier - 1}`
        : null;
  }

  if (effect.targetTier <= state.homesteadTier) {
    return `Homestead is already tier ${state.homesteadTier}`;
  }
  return effect.targetTier !== state.homesteadTier + 1
    ? `Requires Homestead Tier ${effect.targetTier - 1}`
    : null;
}
