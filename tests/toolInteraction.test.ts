import { describe, expect, it } from 'vitest';
import {
  classifyAxeTarget,
  headingToTarget,
  isWithinFacingArc,
  isMeleeContactObstructed,
  isWithinMeleeContact,
  MELEE_FACING_HALF_ANGLE,
  meleeEffectForTarget,
  selectMeleeCandidate,
} from '../src/game/ToolInteraction';

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

  it('selects the nearest intended combat target before the swing begins', () => {
    const hostile = { id: 'fox', x: 0, z: 1.4 };
    const friendly = { id: 'deer', x: 0.2, z: 1.1 };
    const selected = selectMeleeCandidate(
      0,
      0,
      0,
      1.9,
      MELEE_FACING_HALF_ANGLE,
      [
        { kind: 'hostile' as const, target: hostile, x: hostile.x, z: hostile.z },
        { kind: 'friendly' as const, target: friendly, x: friendly.x, z: friendly.z },
      ],
    );

    expect(selected?.kind).toBe('friendly');
    expect(selected?.target).toBe(friendly);
  });

  it('rejects melee targets outside the range or behind the player instead of using a radial hit', () => {
    expect(isWithinMeleeContact(0, 0, 0, 1.8, 0, 1.9, MELEE_FACING_HALF_ANGLE)).toBe(true);
    expect(isWithinMeleeContact(0, 0, 0, 2, 0, 1.9, MELEE_FACING_HALF_ANGLE)).toBe(false);
    expect(isWithinMeleeContact(0, 0, 0, -1, 0, 1.9, MELEE_FACING_HALF_ANGLE)).toBe(false);
  });

  it('keeps friendly wildlife nonlethal while hostile wildlife remains a combat target', () => {
    expect(meleeEffectForTarget('friendly')).toBe('daze');
    expect(meleeEffectForTarget('hostile')).toBe('damage');
  });

  it('rejects a melee contact that crosses a physical obstacle tile', () => {
    const blocked = new Set(['1,0']);
    expect(isMeleeContactObstructed(0.5, 0.5, 2.5, 0.5, blocked)).toBe(true);
    expect(isMeleeContactObstructed(0.5, 0.5, 2.5, 0.5, new Set())).toBe(false);
  });
});
