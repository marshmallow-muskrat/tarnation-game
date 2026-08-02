import { describe, expect, it } from 'vitest';
import {
  blocksFor,
  buildScatterOccupancy,
  OCCUPANCY_POLICY,
  type OccupancyClass,
  type OccupancyConsumer,
} from '../src/sim/occupancy';
import { tileKey } from '../src/sim/placement';

describe('occupancy policy', () => {
  it('keeps physical obstacles solid for the player and all wildlife consumers', () => {
    expect(blocksFor('hard-obstacle', 'player')).toBe(true);
    expect(blocksFor('hard-obstacle', 'wildlife')).toBe(true);
    expect(blocksFor('hard-obstacle', 'enclosure')).toBe(true);
  });

  it('lets actors cross worked ground while keeping soft ground out of clear-ground tools and scatter', () => {
    expect(blocksFor('soft-obstacle', 'player')).toBe(false);
    expect(blocksFor('soft-obstacle', 'wildlife')).toBe(false);
    expect(blocksFor('soft-obstacle', 'tools')).toBe(true);
    expect(blocksFor('soft-obstacle', 'placement')).toBe(true);
    expect(blocksFor('soft-obstacle', 'scatter')).toBe(true);
  });

  it('treats trees and rocks as interaction-only instead of walls or enclosure boundaries', () => {
    expect(blocksFor('interaction-only', 'player')).toBe(false);
    expect(blocksFor('interaction-only', 'wildlife')).toBe(false);
    expect(blocksFor('interaction-only', 'tools')).toBe(true);
    expect(blocksFor('interaction-only', 'placement')).toBe(true);
    expect(blocksFor('interaction-only', 'enclosure')).toBe(false);
  });

  it('protects reserved camp land from editing and decoration without making empty camp ground impassable', () => {
    expect(blocksFor('reservation', 'player')).toBe(false);
    expect(blocksFor('reservation', 'wildlife')).toBe(false);
    expect(blocksFor('reservation', 'tools')).toBe(true);
    expect(blocksFor('reservation', 'placement')).toBe(true);
    expect(blocksFor('reservation', 'scatter')).toBe(true);
    expect(blocksFor('reservation', 'enclosure')).toBe(false);
  });

  it('keeps decorative content non-authoritative for every consumer', () => {
    const consumers: OccupancyConsumer[] = ['player', 'wildlife', 'tools', 'placement', 'scatter', 'enclosure'];
    for (const consumer of consumers) expect(blocksFor('decorative', consumer)).toBe(false);
  });

  it('exposes the complete five-class policy so a new consumer cannot silently invent a sixth rule', () => {
    const classes: OccupancyClass[] = [
      'hard-obstacle',
      'soft-obstacle',
      'decorative',
      'interaction-only',
      'reservation',
    ];
    expect(Object.keys(OCCUPANCY_POLICY).sort()).toEqual(classes.sort());
  });

  it('masks scatter on occupancy tiles and keeps a readable clearance around structures and paths', () => {
    const mask = buildScatterOccupancy(
      {
        'hard-obstacle': new Set([tileKey(10, 10)]),
        'soft-obstacle': new Set([tileKey(20, 20)]),
        'interaction-only': new Set([tileKey(30, 30)]),
        reservation: new Set([tileKey(40, 40)]),
        paths: new Set([tileKey(50, 50)]),
      },
      { 'hard-obstacle': 1, 'interaction-only': 1, paths: 1 },
    );

    expect(mask).toContain(tileKey(10, 10));
    expect(mask).toContain(tileKey(9, 9));
    expect(mask).toContain(tileKey(20, 20));
    expect(mask).not.toContain(tileKey(19, 19));
    expect(mask).toContain(tileKey(30, 30));
    expect(mask).toContain(tileKey(29, 29));
    expect(mask).toContain(tileKey(40, 40));
    expect(mask).toContain(tileKey(49, 49));
    expect(mask).not.toContain(tileKey(0, 0));
  });
});
