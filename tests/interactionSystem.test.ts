import { describe, expect, it } from 'vitest';
import {
  InteractionSystem,
  SLOT_AXE,
  SLOT_SHOTGUN,
  SLOT_SHOVEL,
  combatActionFor,
  selectedToolActionFor,
} from '../src/game/InteractionSystem';

type FakeInput = {
  left: boolean;
  right: boolean;
  space: boolean;
  consumeLmb(): boolean;
  consumeRmb(): boolean;
  justPressed(code: string): boolean;
};

function inputFor({ left = false, right = false, space = false }: Partial<Pick<FakeInput, 'left' | 'right' | 'space'>> = {}): FakeInput {
  return {
    left,
    right,
    space,
    consumeLmb() {
      const value = this.left;
      this.left = false;
      return value;
    },
    consumeRmb() {
      const value = this.right || this.space;
      this.right = false;
      return value;
    },
    justPressed(code) {
      return code === 'Space' && this.space;
    },
  };
}

function handlers(log: string[], contextOpened = false) {
  return {
    rotatePlacement: () => log.push('rotate'),
    placeSelectedBuilding: () => log.push('place'),
    destroyAtPointer: () => log.push('destroy'),
    openPlacedContext: () => {
      log.push('context');
      return contextOpened;
    },
    recordToolAttempt: () => log.push('tool-attempt'),
    recordCombatAttempt: () => log.push('combat-attempt'),
    useBucket: () => log.push('bucket'),
    fireWeapon: () => log.push('weapon'),
    useShovel: () => log.push('shovel'),
    useAxe: () => log.push('axe'),
    useCombatAxe: () => log.push('combat-axe'),
    emptyToolSlot: (index: number) => log.push(`empty-${index}`),
  };
}

describe('interaction routing', () => {
  it('maps toolbar and bucket selections to the existing player-visible tool actions', () => {
    expect(selectedToolActionFor({ toolSlotActive: true, toolbarSlot: SLOT_SHOTGUN })).toBe('bucket');
    expect(selectedToolActionFor({ toolSlotActive: false, toolbarSlot: SLOT_SHOTGUN })).toBe('weapon');
    expect(selectedToolActionFor({ toolSlotActive: false, toolbarSlot: SLOT_SHOVEL })).toBe('shovel');
    expect(selectedToolActionFor({ toolSlotActive: false, toolbarSlot: SLOT_AXE })).toBe('axe');
    expect(selectedToolActionFor({ toolSlotActive: false, toolbarSlot: 3 })).toBe('empty');
  });

  it('permits combat only for the ranged and axe toolbar slots', () => {
    expect(combatActionFor({ toolSlotActive: true, toolbarSlot: SLOT_SHOTGUN })).toBe('none');
    expect(combatActionFor({ toolSlotActive: false, toolbarSlot: SLOT_SHOTGUN })).toBe('weapon');
    expect(combatActionFor({ toolSlotActive: false, toolbarSlot: SLOT_SHOVEL })).toBe('none');
    expect(combatActionFor({ toolSlotActive: false, toolbarSlot: SLOT_AXE })).toBe('axe');
  });

  it('gives building mode priority over secondary combat and primary tool actions', () => {
    const log: string[] = [];
    const input = inputFor({ left: true, right: true });
    new InteractionSystem(input, handlers(log)).process({
      buildingMode: true,
      demolishMode: false,
      toolSlotActive: false,
      toolbarSlot: SLOT_SHOTGUN,
    });
    expect(log).toEqual(['rotate', 'place']);
  });

  it('opens a placed-asset context menu before falling back to combat', () => {
    const contextLog: string[] = [];
    new InteractionSystem(inputFor({ right: true }), handlers(contextLog, true)).process({
      buildingMode: false,
      demolishMode: false,
      toolSlotActive: false,
      toolbarSlot: SLOT_SHOTGUN,
    });
    expect(contextLog).toEqual(['context']);

    const combatLog: string[] = [];
    new InteractionSystem(inputFor({ right: true }), handlers(combatLog)).process({
      buildingMode: false,
      demolishMode: false,
      toolSlotActive: false,
      toolbarSlot: SLOT_SHOTGUN,
    });
    expect(combatLog).toEqual(['context', 'combat-attempt', 'weapon']);
  });

  it('keeps Space as the secondary combat input when no right-button press is present', () => {
    const log: string[] = [];
    new InteractionSystem(inputFor({ space: true }), handlers(log)).process({
      buildingMode: false,
      demolishMode: false,
      toolSlotActive: false,
      toolbarSlot: SLOT_AXE,
    });
    expect(log).toEqual(['context', 'combat-attempt', 'combat-axe']);
  });

  it('uses demolish mode for either pointer button without opening context or combat', () => {
    const log: string[] = [];
    new InteractionSystem(inputFor({ left: true, right: true }), handlers(log)).process({
      buildingMode: false,
      demolishMode: true,
      toolSlotActive: false,
      toolbarSlot: SLOT_AXE,
    });
    expect(log).toEqual(['destroy', 'destroy']);
  });

  it('routes a normal primary action through the selected tool and records the attempt', () => {
    const log: string[] = [];
    new InteractionSystem(inputFor({ left: true }), handlers(log)).process({
      buildingMode: false,
      demolishMode: false,
      toolSlotActive: true,
      toolbarSlot: SLOT_SHOTGUN,
    });
    expect(log).toEqual(['tool-attempt', 'bucket']);
  });
});
