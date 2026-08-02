import type { FirstPlotStage } from './farmBoundary';

/** The authored beats that carry a new player from launch to the first sale. */
export type FirstTenMinuteBeatId =
  | 'movement'
  | 'tool'
  | 'plant'
  | 'water'
  | 'grow'
  | 'harvest'
  | 'market'
  | 'merchant';

export type FirstTenMinuteGuide = {
  id: FirstTenMinuteBeatId;
  step: number;
  total: number;
  title: string;
  instruction: string;
  nextGoal: string;
};

export type FirstTenMinuteInput = {
  movementStarted: boolean;
  firstPlotStage: FirstPlotStage;
  merchantSeen: boolean;
  seedName?: string;
};

export const FIRST_TEN_MINUTE_LAUNCH_COPY =
  'Move with WASD or arrow keys. The first plot is marked when play begins.';
export const FIRST_TEN_MINUTE_SUPPORT_COPY =
  'Saved status stays above · Help is always available · Settings are in Pause (Esc).';

const TOTAL_BEATS = 8;

function guide(
  id: FirstTenMinuteBeatId,
  step: number,
  title: string,
  instruction: string,
  nextGoal: string,
): FirstTenMinuteGuide {
  return { id, step, total: TOTAL_BEATS, title, instruction, nextGoal };
}

/**
 * Derive the short first-session story from live progress without adding a
 * saved quest or campaign state machine. The runtime owns the two transient
 * facts (movement and merchant visit); farm progress remains authoritative.
 */
export function firstTenMinuteGuide(input: FirstTenMinuteInput): FirstTenMinuteGuide | null {
  if (input.merchantSeen) return null;

  if (!input.movementStarted) {
    return guide(
      'movement',
      1,
      'Get your bearings',
      'Move with WASD or the arrow keys to the highlighted starter plot.',
      'Next · select the shovel and work one highlighted tile.',
    );
  }

  switch (input.firstPlotStage) {
    case 'till':
      return guide(
        'tool',
        2,
        'Work one tile',
        'Select the shovel and till a highlighted tile.',
        'Next · plant one seed in that tilled plot.',
      );
    case 'plant':
      return guide(
        'plant',
        3,
        'Plant a seed',
        `Choose ${input.seedName ?? 'a seed'} and click the tilled plot. Planting spends one packet.`,
        'Next · fill the bucket at water, then water the thirsty crop.',
      );
    case 'water':
      return guide(
        'water',
        4,
        'Water the crop',
        'Select the bucket and water the thirsty crop. Watering starts its growth clock.',
        'Next · let the crop grow, then harvest it when mature.',
      );
    case 'grow':
      return guide(
        'grow',
        5,
        'Protect the crop',
        'The crop is growing. Foxes raid after dusk—harvest ready crops or place a bear trap before nightfall.',
        'Next · harvest the mature crop with the shovel.',
      );
    case 'harvest':
      return guide(
        'harvest',
        6,
        'Harvest the crop',
        'Select the shovel and harvest the mature crop. Produce and a seed return are stored together.',
        'Next · walk to the Market stall and sell the harvest.',
      );
    case 'sell':
      return guide(
        'market',
        7,
        'Meet the market',
        'The compass points to the Market stall. Sell the harvest there to earn duckettes.',
        'Next · visit the Traveling Merchant and choose your first upgrade path.',
      );
    case 'complete':
      return guide(
        'merchant',
        8,
        'Choose your next loop',
        'The first crop loop is complete. The Merchant offers storage, watering, crop strategy, and defense.',
        'Next · follow the Settlement objective on the left.',
      );
  }
}
