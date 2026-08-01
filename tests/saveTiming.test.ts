import { describe, expect, it } from 'vitest';
import {
  AUTOSAVE_INTERVAL_SECONDS,
  advanceSaveTimer,
  completedSaveFeedback,
  savingFeedback,
} from '../src/game/SaveTiming';

describe('save timing policy', () => {
  it('does not request an interval save before the low-frequency boundary', () => {
    expect(advanceSaveTimer(0, AUTOSAVE_INTERVAL_SECONDS - 0.05)).toEqual({
      elapsed: AUTOSAVE_INTERVAL_SECONDS - 0.05,
      due: false,
    });
  });

  it('requests an interval save exactly at the configured boundary', () => {
    expect(advanceSaveTimer(0, AUTOSAVE_INTERVAL_SECONDS)).toEqual({ elapsed: 0, due: true });
  });

  it('preserves elapsed time after a large deterministic step instead of saving every frame', () => {
    const step = advanceSaveTimer(14.8, 0.4);
    expect(step.due).toBe(true);
    expect(step.elapsed).toBeCloseTo(0.2, 10);
  });

  it('treats paused or invalid time as no elapsed autosave time', () => {
    expect(advanceSaveTimer(4, 0)).toEqual({ elapsed: 4, due: false });
    expect(advanceSaveTimer(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({ elapsed: 0, due: false });
  });
});

describe('save feedback policy', () => {
  it('exposes a saving state while a synchronous save transaction is being attempted', () => {
    expect(savingFeedback()).toEqual({ state: 'saving', message: 'Saving…' });
  });

  it('shows a stable saved state after a successful transaction', () => {
    expect(completedSaveFeedback({ status: 'ok' })).toEqual({ state: 'saved', message: 'Saved' });
  });

  it.each(['quota_exceeded', 'corrupt', 'migration_failed', 'unavailable'] as const)(
    'keeps %s visible as a failed state until another successful save resolves it',
    (status) => {
      const feedback = completedSaveFeedback({ status, message: 'test failure' });
      expect(feedback).toEqual({ state: 'failed', message: 'Save failed: test failure' });
      expect(feedback.state).toBe('failed');
    },
  );
});
