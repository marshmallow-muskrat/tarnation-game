import { describe, expect, it } from 'vitest';
import {
  ActionStateMachine,
  DEFAULT_TOOL_ACTION_TIMING,
} from '../src/game/ActionStateMachine';
import { InteractionSystem, type InteractionInput, type InteractionHandlers } from '../src/game/InteractionSystem';

type FakeInput = InteractionInput & {
  left: boolean;
  right: boolean;
  pressed: Set<string>;
};

function fakeInput(): FakeInput {
  return {
    left: false,
    right: false,
    pressed: new Set(),
    consumeLmb() {
      const value = this.left;
      this.left = false;
      return value;
    },
    consumeRmb() {
      const value = this.right;
      this.right = false;
      return value;
    },
    justPressed(action) {
      const value = this.pressed.has(action);
      this.pressed.delete(action);
      return value;
    },
  };
}

function noOpHandlers(overrides: Partial<InteractionHandlers>): InteractionHandlers {
  return {
    rotatePlacement: () => {},
    placeSelectedBuilding: () => {},
    destroyAtPointer: () => {},
    openPlacedContext: () => false,
    recordToolAttempt: () => {},
    recordCombatAttempt: () => {},
    useBucket: () => {},
    fireWeapon: () => {},
    useShovel: () => {},
    useAxe: () => {},
    useCombatAxe: () => {},
    emptyToolSlot: () => {},
    ...overrides,
  };
}

describe('runtime controller integration', () => {
  it('routes a primary shovel input into one fixed-step contact before the gameplay callback runs', () => {
    const input = fakeInput();
    const actionState = new ActionStateMachine<{ tile: string }>();
    const events: string[] = [];
    const handlers = noOpHandlers({
      recordToolAttempt: () => events.push('attempt'),
      useShovel: () => {
        const admission = actionState.request({
          kind: 'tool',
          timing: DEFAULT_TOOL_ACTION_TIMING,
          payload: { tile: 'starter-plot' },
        });
        events.push(`admission:${admission.disposition}`);
      },
    });
    const interaction = new InteractionSystem(input, handlers);

    input.left = true;
    interaction.process({ buildingMode: false, demolishMode: false, toolSlotActive: false, toolbarSlot: 1 });
    expect(events).toEqual(['attempt', 'admission:started']);
    expect(actionState.drainEvents().map((event) => event.type)).toEqual(['start']);

    actionState.advance(DEFAULT_TOOL_ACTION_TIMING.windup);
    expect(actionState.drainEvents().map((event) => event.type)).toEqual(['contact']);
    expect(events).not.toContain('gameplay-mutation');

    events.push('gameplay-mutation');
    actionState.advance(DEFAULT_TOOL_ACTION_TIMING.contact + DEFAULT_TOOL_ACTION_TIMING.recover);
    expect(events).toEqual(['attempt', 'admission:started', 'gameplay-mutation']);
    expect(actionState.currentState).toBe('idle');
  });

  it('keeps build placement priority ahead of tool and combat callbacks in the same input frame', () => {
    const input = fakeInput();
    const calls: string[] = [];
    const interaction = new InteractionSystem(
      input,
      noOpHandlers({
        rotatePlacement: () => calls.push('rotate'),
        placeSelectedBuilding: () => calls.push('place'),
        recordToolAttempt: () => calls.push('tool-attempt'),
        recordCombatAttempt: () => calls.push('combat-attempt'),
      }),
    );

    input.right = true;
    input.left = true;
    interaction.process({ buildingMode: true, demolishMode: false, toolSlotActive: false, toolbarSlot: 2 });

    expect(calls).toEqual(['rotate', 'place']);
  });
});
