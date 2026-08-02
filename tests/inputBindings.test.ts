import { describe, expect, it } from 'vitest';
import {
  actionIsDown,
  bindingCodes,
  DEFAULT_INPUT_BINDINGS,
  formatBinding,
  INPUT_ACTIONS,
  INPUT_BINDING_DEFINITIONS,
  parseInputBindings,
  rebindInput,
  resetInputBindings,
  serializeInputBindings,
} from '../src/game/InputBindings';

describe('keyboard input contract', () => {
  it('declares one remappable primary route for every supported keyboard action', () => {
    expect(INPUT_BINDING_DEFINITIONS).toHaveLength(INPUT_ACTIONS.length);
    expect(new Set(Object.values(DEFAULT_INPUT_BINDINGS)).size).toBe(INPUT_ACTIONS.length);
    expect(bindingCodes(DEFAULT_INPUT_BINDINGS, 'moveUp')).toEqual(['KeyW', 'ArrowUp']);
    expect(bindingCodes(DEFAULT_INPUT_BINDINGS, 'pause')).toEqual(['Escape']);
    expect(formatBinding(DEFAULT_INPUT_BINDINGS, 'moveUp')).toBe('W / ↑');
  });

  it('treats remappable keys and retained movement/tool alternates as the same action', () => {
    const held = new Set(['ArrowLeft', 'KeyQ']);
    expect(actionIsDown(held, DEFAULT_INPUT_BINDINGS, 'moveLeft')).toBe(true);
    expect(actionIsDown(held, DEFAULT_INPUT_BINDINGS, 'ultimate')).toBe(true);
    expect(actionIsDown(new Set(['KeyD']), DEFAULT_INPUT_BINDINGS, 'moveLeft')).toBe(false);
  });

  it('swaps an occupied primary key so remapping never makes another action unreachable', () => {
    const result = rebindInput(DEFAULT_INPUT_BINDINGS, 'inventory', 'KeyH');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.swappedWith).toBe('help');
    expect(result.bindings.inventory).toBe('KeyH');
    expect(result.bindings.help).toBe('KeyI');
  });

  it('rejects a retained alternate key instead of creating a hidden duplicate binding', () => {
    const result = rebindInput(DEFAULT_INPUT_BINDINGS, 'inventory', 'ArrowUp');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('reserved as an alternate');
  });

  it('keeps Escape as a cancellation alias and reserves the browser developer key', () => {
    const rebound = rebindInput(DEFAULT_INPUT_BINDINGS, 'pause', 'KeyL');
    expect(rebound.ok).toBe(true);
    if (!rebound.ok) return;
    expect(bindingCodes(rebound.bindings, 'pause')).toEqual(['KeyL', 'Escape']);

    const reserved = rebindInput(DEFAULT_INPUT_BINDINGS, 'inventory', 'F12');
    expect(reserved.ok).toBe(false);
    if (reserved.ok) return;
    expect(reserved.reason).toContain('reserved by the browser');
  });

  it('round-trips valid bindings and restores defaults for malformed settings', () => {
    const rebound = rebindInput(DEFAULT_INPUT_BINDINGS, 'inventory', 'KeyL');
    expect(rebound.ok).toBe(true);
    if (!rebound.ok) return;
    expect(parseInputBindings(serializeInputBindings(rebound.bindings))).toEqual(rebound.bindings);
    expect(parseInputBindings('{not json')).toEqual(resetInputBindings());
    expect(parseInputBindings(JSON.stringify({ inventory: 42, help: 'KeyL', moveUp: 'KeyL' }))).toMatchObject({
      inventory: 'KeyI',
      help: 'KeyL',
      moveUp: 'KeyH',
    });
  });

  it('keeps the default contract isolated from runtime rebinding', () => {
    const rebound = rebindInput(DEFAULT_INPUT_BINDINGS, 'build', 'KeyL');
    expect(rebound.ok).toBe(true);
    expect(DEFAULT_INPUT_BINDINGS.build).toBe('KeyP');
  });
});
