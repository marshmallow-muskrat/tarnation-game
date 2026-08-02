import { describe, expect, it } from 'vitest';
import {
  FOX_SEPARATION,
  FOX_SPEED,
  GRID_H,
  GRID_W,
  HAULER_SPEED,
  NIBBLER_SPEED,
  WORLD_SIZE,
} from '../src/content';
import { FoxDirector, type Fox } from '../src/game/FoxDirector';

function fakeRoot() {
  return {
    position: {
      x: 0,
      y: 0,
      z: 0,
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      },
    },
    rotation: { y: 0 },
  } as unknown as Fox['root'];
}

function makeFox(overrides: Partial<Fox> = {}): Fox {
  return {
    root: fakeRoot(),
    baseScale: 1,
    actions: { mixer: null },
    x: 10.5,
    z: 10.5,
    state: 'seek',
    kind: 'diggler',
    silhouetteScale: { x: 1, y: 1, z: 1 },
    accessoryRoot: null,
    hp: 1,
    timer: 0,
    targetTx: 2,
    targetTy: 2,
    raidTarget: null,
    eatTimer: 0,
    dead: false,
    carryingProduce: false,
    trappedTx: -1,
    trappedTy: -1,
    path: [{ tx: 9, ty: 9 }],
    pathGoalKey: 'stale',
    pathTimer: 0,
    pathTopologyVersion: 0,
    ...overrides,
  };
}

function makeDirector(enclosed = new Set<string>(), blocked = new Set<string>()) {
  let topology = 0;
  const director = new FoxDirector({
    worldToFarmTile: (x, z) => {
      const tx = Math.floor(x);
      const ty = Math.floor(z);
      return tx >= 0 && ty >= 0 && tx < GRID_W && ty < GRID_H ? { tx, ty } : null;
    },
    farmTileWorld: (tx, ty) => ({ x: tx + 0.5, z: ty + 0.5 }),
    heightAt: () => 0,
    isEnclosed: (tx, ty) => enclosed.has(`${tx},${ty}`),
    topologyVersion: () => topology,
    obstacleTiles: () => blocked,
  });
  return {
    director,
    advanceTopology() {
      topology++;
    },
  };
}

describe('fox direction director', () => {
  it('selects the nearest exposed crop and clears the stale route when no target remains', () => {
    const enclosed = new Set(['4,4']);
    const { director } = makeDirector(enclosed);
    const fox = makeFox({ x: 5.5, z: 5.5 });

    director.pickTarget(fox, [{ x: 6, y: 6 }, { x: 20, y: 20 }, { x: 4, y: 4 }]);
    expect([fox.targetTx, fox.targetTy]).toEqual([6, 6]);
    expect(fox.path).toEqual([]);
    expect(fox.pathGoalKey).toBe('');

    enclosed.add('6,6');
    enclosed.add('20,20');
    director.pickTarget(fox, [{ x: 6, y: 6 }, { x: 20, y: 20 }]);
    expect([fox.targetTx, fox.targetTy]).toEqual([-1, -1]);
    expect(fox.pathTimer).toBe(0);
  });

  it('uses the role-specific movement speeds for slow digglers, fast nibblers, deliberate sappers, and haulers', () => {
    const { director } = makeDirector();
    expect(director.speedFor('diggler')).toBeCloseTo(FOX_SPEED * 0.78);
    expect(director.speedFor('sapper')).toBeCloseTo(FOX_SPEED * 0.86);
    expect(director.speedFor('nibbler')).toBe(NIBBLER_SPEED);
    expect(director.speedFor('hauler')).toBe(HAULER_SPEED);
  });

  it('follows the shared route around a blocked tile instead of routing through it', () => {
    const blocked = new Set(['2,1']);
    const { director } = makeDirector(new Set(), blocked);
    const fox = makeFox({ x: 1.5, z: 1.5, path: [], pathGoalKey: '', pathTimer: 0 });

    expect(director.moveTowardTile(fox, 3, 1, 0, 0.1)).toEqual({ atGoal: false, hasPath: true });
    director.advance();
    expect(director.moveTowardTile(fox, 3, 1, 0, 0.1).hasPath).toBe(true);
    expect(fox.path).not.toContainEqual({ tx: 2, ty: 1 });
  });

  it('applies the existing deterministic overlap nudge while preserving trapped/dead actors and bounds', () => {
    const { director } = makeDirector();
    const first = makeFox({ x: 10, z: 10 });
    const second = makeFox({ x: 10, z: 10 });
    const trapped = makeFox({ x: 1, z: 1, state: 'trapped' });
    const dead = makeFox({ x: WORLD_SIZE + 2, z: WORLD_SIZE + 2, dead: true });

    director.separate([first, second, trapped, dead]);

    const separation = Math.hypot(first.x - second.x, first.z - second.z);
    // Current behavior treats coincident actors as one unit apart before
    // calculating the push, so the nudge remains below the nominal gap.
    expect(separation).toBeCloseTo((FOX_SEPARATION - 1) * 1.04);
    expect(separation).toBeLessThan(FOX_SEPARATION);
    expect([trapped.x, trapped.z]).toEqual([1, 1]);
    expect([dead.x, dead.z]).toEqual([WORLD_SIZE + 2, WORLD_SIZE + 2]);
    expect(first.root.position.x).toBe(first.x);
    expect(first.root.position.z).toBe(first.z);
  });
});
