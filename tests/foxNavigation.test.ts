import { describe, expect, it } from 'vitest';
import { FoxNavigation } from '../src/game/FoxNavigation';
import { tileKey } from '../src/sim/placement';

describe('fox navigation flow fields', () => {
  it('shares one target field while returning a deterministic route around obstacles', () => {
    const blocked = new Set([
      tileKey(9, 9),
      tileKey(10, 9),
      tileKey(11, 9),
      tileKey(9, 10),
    ]);
    const navigation = new FoxNavigation();

    navigation.request(12, 12, 1, blocked);
    const firstPending = navigation.route(7, 7, 12, 12, 1, blocked);
    const secondPending = navigation.route(8, 8, 12, 12, 1, blocked);

    expect(firstPending.status).toBe('pending');
    expect(secondPending.status).toBe('pending');
    expect(navigation.fieldCount).toBe(1);

    navigation.advance(100_000);
    const route = navigation.route(7, 7, 12, 12, 1, blocked);
    expect(route.status).toBe('ready');
    expect(route.path[route.path.length - 1]).toEqual({ tx: 12, ty: 12 });
    expect(route.path).not.toContainEqual({ tx: 9, ty: 9 });
    expect(route.path).not.toContainEqual({ tx: 10, ty: 9 });
  });

  it('does not cut diagonally through the corner of two blocked tiles', () => {
    const blocked = new Set([tileKey(2, 1), tileKey(1, 2)]);
    const navigation = new FoxNavigation();

    navigation.request(3, 3, 2, blocked);
    navigation.advance(100_000);
    const route = navigation.route(1, 1, 3, 3, 2, blocked);

    expect(route.status).toBe('ready');
    expect(route.path).not.toContainEqual({ tx: 2, ty: 2 });
  });

  it('reports a sealed target as unreachable instead of oscillating at an impossible corner', () => {
    const blocked = new Set([
      tileKey(1, 1), tileKey(2, 1), tileKey(3, 1),
      tileKey(1, 2), tileKey(3, 2),
      tileKey(1, 3), tileKey(2, 3), tileKey(3, 3),
    ]);
    const navigation = new FoxNavigation();

    navigation.request(2, 2, 3, blocked);
    navigation.advance(100_000);

    expect(navigation.route(5, 5, 2, 2, 3, blocked).status).toBe('unreachable');
  });

  it('caps route-field work per fixed-step budget instead of scanning the whole map', () => {
    const navigation = new FoxNavigation();
    navigation.request(120, 120, 4, new Set());

    expect(navigation.advance(7)).toBe(7);
    expect(navigation.pendingNodeCount).toBeGreaterThan(0);
    expect(navigation.route(0, 0, 120, 120, 4, new Set()).status).toBe('pending');
  });

  it('invalidates cached routes when movement topology changes', () => {
    const navigation = new FoxNavigation();
    const open = new Set<string>();
    navigation.request(20, 20, 8, open);
    navigation.advance(100_000);
    expect(navigation.route(19, 19, 20, 20, 8, open).status).toBe('ready');

    navigation.clear();
    expect(navigation.fieldCount).toBe(0);
    expect(navigation.pendingNodeCount).toBe(0);
    expect(navigation.route(19, 19, 20, 20, 9, new Set()).status).toBe('pending');
  });
});
