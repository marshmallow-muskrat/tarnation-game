import { describe, expect, it } from 'vitest';
import { equippedToolKeyFor, SLOT_AXE, SLOT_SHOTGUN, SLOT_SHOVEL } from '../src/game/EquipmentController';
import { chooseLocomotionAction } from '../src/game/PlayerActionController';

describe('equipment selection and player action characterization', () => {
  it('hides held tools while the bucket slot is active', () => {
    expect(equippedToolKeyFor({ toolbarSlot: SLOT_SHOTGUN, toolSlotActive: true, weapon: 'shotgun' })).toBeNull();
  });

  it('maps the selected toolbar and weapon to the existing held model', () => {
    expect(equippedToolKeyFor({ toolbarSlot: SLOT_SHOTGUN, toolSlotActive: false, weapon: 'shotgun' })).toBe('shotgun_2');
    expect(equippedToolKeyFor({ toolbarSlot: SLOT_SHOTGUN, toolSlotActive: false, weapon: 'bow' })).toBe('bow_wooden');
    expect(equippedToolKeyFor({ toolbarSlot: SLOT_SHOVEL, toolSlotActive: false, weapon: 'shotgun' })).toBe('shovel');
    expect(equippedToolKeyFor({ toolbarSlot: SLOT_AXE, toolSlotActive: false, weapon: 'axe' })).toBe('axe');
  });

  it('keeps empty or unsupported toolbar selections unarmed', () => {
    expect(equippedToolKeyFor({ toolbarSlot: 3, toolSlotActive: false, weapon: 'shotgun' })).toBeNull();
  });

  it('uses empty-handed walk and idle clips when no tool is equipped', () => {
    expect(chooseLocomotionAction(true, 1, null)).toBe('walk');
    expect(chooseLocomotionAction(false, 0, null)).toBe('idle');
  });

  it('freezes the carry walk pose at rest and selects the authored carry run above the speed threshold', () => {
    const profile = { runClip: 'runCarry' as const, idleTime: 0.32 };
    expect(chooseLocomotionAction(false, 0, profile)).toBe('walkCarry');
    expect(chooseLocomotionAction(true, 0.71, profile, 1)).toBe('walkCarry');
    expect(chooseLocomotionAction(true, 0.73, profile, 1)).toBe('runCarry');
  });
});
