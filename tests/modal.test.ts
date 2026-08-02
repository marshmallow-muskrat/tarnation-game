import { describe, expect, it } from 'vitest';
import { nextFocusIndex } from '../src/ui/modal';

describe('modal keyboard focus policy', () => {
  it('starts forward Tab at the first focusable control', () => {
    expect(nextFocusIndex(-1, 3, 1)).toBe(0);
  });

  it('starts reverse Tab at the last focusable control', () => {
    expect(nextFocusIndex(-1, 3, -1)).toBe(2);
  });

  it('wraps forward focus after the last control', () => {
    expect(nextFocusIndex(2, 3, 1)).toBe(0);
  });

  it('wraps reverse focus before the first control', () => {
    expect(nextFocusIndex(0, 3, -1)).toBe(2);
  });

  it('does not invent a focus target for an empty modal', () => {
    expect(nextFocusIndex(-1, 0, 1)).toBe(-1);
  });
});
