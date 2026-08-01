import type { SaveWriteResult } from './SaveService';

/** The low-frequency retry interval for changes that do not hit a boundary. */
export const AUTOSAVE_INTERVAL_SECONDS = 15;

export type SaveFeedbackState = 'saving' | 'saved' | 'failed';

export interface SaveFeedback {
  state: SaveFeedbackState;
  message: string;
}

export function savingFeedback(): SaveFeedback {
  return { state: 'saving', message: 'Saving…' };
}

export function completedSaveFeedback(result: Pick<SaveWriteResult, 'status' | 'message'>): SaveFeedback {
  if (result.status === 'ok') return { state: 'saved', message: 'Saved' };
  const detail = result.message ?? `storage status: ${result.status.replace('_', ' ')}`;
  return { state: 'failed', message: `Save failed: ${detail}` };
}

export interface SaveTimerStep {
  elapsed: number;
  due: boolean;
}

/** Advance a monotonic timer without tying save policy to a render frame. */
export function advanceSaveTimer(
  elapsed: number,
  dt: number,
  interval = AUTOSAVE_INTERVAL_SECONDS,
): SaveTimerStep {
  if (!Number.isFinite(interval) || interval <= 0) return { elapsed: 0, due: true };
  const safeElapsed = Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : 0;
  const safeDt = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const total = safeElapsed + safeDt;
  if (total < interval) return { elapsed: total, due: false };
  return { elapsed: total % interval, due: true };
}
