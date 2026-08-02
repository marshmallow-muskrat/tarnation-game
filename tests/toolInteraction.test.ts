import { describe, expect, it } from 'vitest';
import { classifyAxeTarget, headingToTarget, isWithinFacingArc } from '../src/game/ToolInteraction';

describe('tool interaction policy', () => {
  it('classifies axe targets before choosing a contact result', () => {
    expect(classifyAxeTarget({ tree: true, stump: false, boulder: false })).toBe('tree');
    expect(classifyAxeTarget({ tree: false, stump: true, boulder: false })).toBe('stump');
    expect(classifyAxeTarget({ tree: false, stump: false, boulder: true })).toBe('boulder');
    expect(classifyAxeTarget({ tree: false, stump: false, boulder: false })).toBe('none');
  });

  it('computes a target heading in the same forward convention as player movement', () => {
    expect(headingToTarget(4, 4, 4, 5)).toBeCloseTo(0);
    expect(headingToTarget(4, 4, 5, 4)).toBeCloseTo(Math.PI / 2);
  });

  it('requires axe contact to fall inside the facing arc, including wraparound', () => {
    expect(isWithinFacingArc(0, 0.4, 0.5)).toBe(true);
    expect(isWithinFacingArc(0, 0.7, 0.5)).toBe(false);
    expect(isWithinFacingArc(3.1, -3.1, 0.2)).toBe(true);
  });
});
