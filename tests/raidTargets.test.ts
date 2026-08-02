import { describe, expect, it } from 'vitest';
import {
  FOX_ROLE_PROFILES,
  foxRoleProfile,
  raidLifecyclePhase,
  selectRaidTarget,
  type RaidTarget,
} from '../src/sim/raid';

function crop(
  x: number,
  y: number,
  distance: number,
  exposed = true,
): RaidTarget {
  return { kind: 'crop', x, y, distance, exposed };
}

function produce(
  id: string,
  value: number,
  distance: number,
  count = 1,
): RaidTarget {
  return { kind: 'stored_produce', id, count, value, x: 20, y: 20, distance };
}

function structure(
  structureKind: 'gate' | 'trap' | 'trench',
  distance: number,
  index = -1,
): RaidTarget {
  return { kind: 'structure', structure: structureKind, index, x: 20, y: 20, distance };
}

describe('raid consequence target policy', () => {
  it('gives every released fox role a distinct readable profile and counter contract', () => {
    const profiles = Object.values(FOX_ROLE_PROFILES);

    expect(new Set(profiles.map((profile) => profile.silhouette)).size).toBe(4);
    expect(new Set(profiles.map((profile) => profile.tint)).size).toBe(4);
    expect(new Set(profiles.map((profile) => profile.accessory)).size).toBe(4);
    expect(new Set(profiles.map((profile) => profile.audioCue)).size).toBe(4);
    expect(profiles.every((profile) => profile.telegraph.length > 0 && profile.counter.length > 0)).toBe(true);
    expect(foxRoleProfile('diggler').movementRule).toBe('burrow');
    expect(foxRoleProfile('nibbler').movementRule).toBe('sprint');
    expect(foxRoleProfile('sapper').targetPreference).toBe('structure');
    expect(foxRoleProfile('hauler').targetPreference).toBe('stored_produce');
  });

  it('makes a hauler threaten stored produce before a nearer field crop', () => {
    const target = selectRaidTarget('hauler', [
      crop(4, 4, 1),
      produce('crop:Beet', 8, 12),
      produce('crop:Lettuce', 12, 18),
    ]);

    expect(target).toMatchObject({ kind: 'stored_produce', id: 'crop:Lettuce', value: 12 });
  });

  it('makes a sapper prefer a gate, then a trap, then a trench before crops', () => {
    expect(
      selectRaidTarget('sapper', [
        crop(4, 4, 1),
        structure('trench', 2),
        structure('trap', 3),
        structure('gate', 20, 7),
      ]),
    ).toMatchObject({ kind: 'structure', structure: 'gate', index: 7 });

    expect(
      selectRaidTarget('sapper', [crop(4, 4, 1), structure('trench', 1), structure('trap', 9)]),
    ).toMatchObject({ kind: 'structure', structure: 'trap' });
  });

  it('filters enclosed crops and uses stable nearest-tile ordering for ordinary foxes', () => {
    const target = selectRaidTarget('diggler', [
      crop(2, 2, 0.1, false),
      crop(8, 3, 2),
      crop(3, 8, 2),
    ]);

    expect(target).toMatchObject({ kind: 'crop', x: 8, y: 3, exposed: true });
  });

  it('falls back to exposed crops when a role has no preferred world target', () => {
    expect(selectRaidTarget('hauler', [produce('crop:Beet', 8, 2, 0), crop(5, 6, 7)])).toMatchObject({
      kind: 'crop',
      x: 5,
      y: 6,
    });
    expect(selectRaidTarget('sapper', [crop(7, 8, 3)])).toMatchObject({ kind: 'crop', x: 7, y: 8 });
  });

  it('retreats without inventing a player target when no valid consequence remains', () => {
    expect(selectRaidTarget('diggler', [crop(2, 2, 1, false)])).toBeNull();
    expect(selectRaidTarget('hauler', [produce('crop:Beet', 8, 1, 0)])).toBeNull();
    expect(selectRaidTarget('sapper', [])).toBeNull();
  });
});

describe('raid lifecycle phases', () => {
  it('characterizes preparation, action, retreat, reward, and dawn cleanup', () => {
    expect(raidLifecyclePhase('burrow')).toBe('preparation');
    expect(raidLifecyclePhase('seek')).toBe('action');
    expect(raidLifecyclePhase('eat')).toBe('action');
    expect(raidLifecyclePhase('trapped')).toBe('action');
    expect(raidLifecyclePhase('flee')).toBe('retreat');
    expect(raidLifecyclePhase('defeated')).toBe('reward');
    expect(raidLifecyclePhase('dawn_cleanup')).toBe('dawn_cleanup');
  });
});
