import { describe, expect, it } from 'vitest';
import {
  ActionStateMachine,
  DEFAULT_RANGED_ACTION_TIMING,
  DEFAULT_TOOL_ACTION_TIMING,
} from '../src/game/ActionStateMachine';

describe('player action state machine', () => {
  it('keeps tool effects behind a fixed-step contact event instead of button-down', () => {
    const machine = new ActionStateMachine<null>();
    const admission = machine.request({
      kind: 'tool',
      timing: DEFAULT_TOOL_ACTION_TIMING,
      payload: null,
    });

    expect(admission.disposition).toBe('started');
    expect(machine.currentState).toBe('tool_windup');
    expect(machine.drainEvents().map((event) => event.type)).toEqual(['start']);

    machine.advance(0.1);
    expect(machine.currentState).toBe('tool_windup');
    expect(machine.drainEvents()).toEqual([]);

    machine.advance(0.02);
    expect(machine.currentState).toBe('tool_contact');
    expect(machine.drainEvents().map((event) => event.type)).toEqual(['contact']);
  });

  it('transitions through recovery and returns to the movement state after clip completion', () => {
    const machine = new ActionStateMachine<null>();
    machine.setMovementIntent(true);
    machine.drainTransitions();
    machine.request({ kind: 'tool', timing: DEFAULT_TOOL_ACTION_TIMING, payload: null });
    machine.drainEvents();

    machine.advance(0.05);
    expect(machine.currentState).toBe('tool_windup');
    machine.advance(0.12);
    expect(machine.currentState).toBe('tool_recover');
    machine.advance(0.18);
    expect(machine.currentState).toBe('move');
    expect(machine.drainEvents().map((event) => event.type)).toEqual(['contact', 'complete']);
    expect(machine.movementScale).toBe(1);
  });

  it('buffers one same-kind follow-up during contact and starts it after recovery', () => {
    const machine = new ActionStateMachine<null>();
    const first = machine.request({
      kind: 'tool',
      timing: DEFAULT_TOOL_ACTION_TIMING,
      payload: null,
      bufferable: true,
    });
    machine.drainEvents();
    machine.advance(0.12);
    machine.drainEvents();

    const buffered = machine.request({
      kind: 'tool',
      timing: DEFAULT_TOOL_ACTION_TIMING,
      payload: null,
      bufferable: true,
    });
    expect(buffered.disposition).toBe('buffered');
    expect(buffered.actionId).not.toBe(first.actionId);
    expect(machine.hasBufferedInput).toBe(true);

    machine.advance(0.23);
    const events = machine.drainEvents();
    expect(events.map((event) => event.type)).toEqual(['complete', 'start']);
    expect(events[events.length - 1]?.actionId).toBe(buffered.actionId);
    expect(machine.currentState).toBe('tool_windup');
  });

  it('emits a ranged fire event only after aim and exposes the fire movement scale', () => {
    const machine = new ActionStateMachine<null>();
    machine.request({ kind: 'ranged', timing: DEFAULT_RANGED_ACTION_TIMING, payload: null });
    expect(machine.currentState).toBe('ranged_aim');
    expect(machine.drainEvents().map((event) => event.type)).toEqual(['start']);

    machine.advance(0.07);
    expect(machine.currentState).toBe('ranged_aim');
    expect(machine.drainEvents()).toEqual([]);
    machine.advance(0.01);
    expect(machine.currentState).toBe('ranged_fire');
    expect(machine.drainEvents().map((event) => event.type)).toEqual(['fire']);
    expect(machine.movementScale).toBe(0.65);
  });

  it('keeps interaction contact explicit and completes without leaving an action lock', () => {
    const machine = new ActionStateMachine<null>();
    machine.request({
      kind: 'interact',
      timing: { windup: 0.1, contact: 0.02, recover: 0.03 },
      payload: null,
    });
    expect(machine.currentState).toBe('interact');
    machine.drainEvents();
    machine.advance(0.1);
    expect(machine.drainEvents().map((event) => event.type)).toEqual(['contact']);
    machine.advance(0.05);
    expect(machine.currentState).toBe('idle');
    expect(machine.drainEvents().map((event) => event.type)).toEqual(['complete']);
  });

  it('rejects failed or cross-kind input without disabling the current control state', () => {
    const machine = new ActionStateMachine<null>();
    machine.request({ kind: 'tool', timing: DEFAULT_TOOL_ACTION_TIMING, payload: null });
    machine.drainEvents();

    expect(machine.request({
      kind: 'ranged',
      timing: DEFAULT_RANGED_ACTION_TIMING,
      payload: null,
    }).disposition).toBe('rejected');
    expect(machine.currentState).toBe('tool_windup');
  });

  it('cancels before contact, enters menu safely, and restores movement after closing it', () => {
    const machine = new ActionStateMachine<null>();
    machine.setMovementIntent(true);
    const request = machine.request({ kind: 'tool', timing: DEFAULT_TOOL_ACTION_TIMING, payload: null });
    machine.drainEvents();
    expect(machine.cancel('cancel')).toEqual([request.actionId]);
    expect(machine.currentState).toBe('move');

    machine.enterMenu();
    expect(machine.currentState).toBe('menu');
    expect(machine.movementScale).toBe(0);
    expect(machine.request({ kind: 'tool', timing: DEFAULT_TOOL_ACTION_TIMING, payload: null }).disposition).toBe('rejected');
    machine.exitMenu();
    expect(machine.currentState).toBe('move');
  });

  it('uses a disabled focus state that can be restored without a stuck input lock', () => {
    const machine = new ActionStateMachine<null>();
    machine.setMovementIntent(true);
    const request = machine.request({ kind: 'tool', timing: DEFAULT_TOOL_ACTION_TIMING, payload: null });
    machine.drainEvents();

    expect(machine.disable()).toEqual([request.actionId]);
    expect(machine.currentState).toBe('disabled');
    expect(machine.request({ kind: 'tool', timing: DEFAULT_TOOL_ACTION_TIMING, payload: null }).disposition).toBe('rejected');
    machine.enable();
    expect(machine.currentState).toBe('move');
    expect(machine.movementScale).toBe(1);
  });
});
