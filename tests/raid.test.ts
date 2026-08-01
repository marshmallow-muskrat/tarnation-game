import { describe, expect, it } from 'vitest';
import { FARM_H, FARM_W, GRID_H, GRID_W, TILE } from '../src/content';
import { dropChance, rollDrop } from '../src/sim/luck';
import { foxCountForDay, generateWave, nearestEdgePoint } from '../src/sim/raid';
import { mulberry32, pick, randInt, randRange } from '../src/sim/rng';

describe('raid generation and deterministic RNG behavior', () => {
  it('produces the same seeded PRNG stream and keeps helper ranges deterministic', () => {
    const first = mulberry32(0x1234_5678);
    const second = mulberry32(0x1234_5678);
    const firstValues = [first(), first(), first()];
    const secondValues = [second(), second(), second()];

    expect(firstValues).toEqual(secondValues);
    expect(firstValues.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(randRange(() => 0.25, 10, 20)).toBe(12.5);
    expect(randInt(() => 0.9999, 0, 4)).toBe(3);
    expect(pick(() => 0.5, ['a', 'b', 'c', 'd'] as const)).toBe('c');
  });

  it('scales fox count by day and greed factors, then caps the raid at the current maximum', () => {
    expect(foxCountForDay(1)).toBe(3);
    expect(foxCountForDay(4)).toBe(6);
    expect(foxCountForDay(4, 16, 80)).toBe(9);
    expect(foxCountForDay(99, 999, 999)).toBe(10);
  });

  it('generates a repeatable fixed-seed wave with edge-safe spawn coordinates and typed fox roles', () => {
    const first = generateWave(4, 0x1357_9bdf, 16, 40);
    const second = generateWave(4, 0x1357_9bdf, 16, 40);
    const differentSeed = generateWave(4, 0x2468_ace0, 16, 40);

    expect(first).toEqual(second);
    expect(first).toHaveLength(8);
    expect(first).not.toEqual(differentSeed);
    for (const spawn of first) {
      expect(['n', 's', 'e', 'w']).toContain(spawn.edge);
      expect(['diggler', 'nibbler', 'sapper', 'hauler']).toContain(spawn.kind);
      expect(spawn.x).toBeGreaterThanOrEqual(TILE / 2);
      expect(spawn.x).toBeLessThanOrEqual(FARM_W - TILE / 2);
      expect(spawn.y).toBeGreaterThanOrEqual(TILE / 2);
      expect(spawn.y).toBeLessThanOrEqual(FARM_H - TILE / 2);
      if (spawn.edge === 'n') expect(spawn.y).toBe(TILE / 2);
      if (spawn.edge === 's') expect(spawn.y).toBe(FARM_H - TILE / 2);
      if (spawn.edge === 'w') expect(spawn.x).toBe(TILE / 2);
      if (spawn.edge === 'e') expect(spawn.x).toBe(FARM_W - TILE / 2);
    }
    expect(GRID_W).toBe(240);
    expect(GRID_H).toBe(240);
  });

  it('chooses the nearest map edge with the current north-first tie rule', () => {
    expect(nearestEdgePoint(30, 20)).toEqual({ x: 30, y: 0 });
    expect(nearestEdgePoint(30, FARM_H - 20)).toEqual({ x: 30, y: FARM_H });
    expect(nearestEdgePoint(20, 30)).toEqual({ x: 0, y: 30 });
    expect(nearestEdgePoint(FARM_W - 20, 30)).toEqual({ x: FARM_W, y: 30 });
    expect(nearestEdgePoint(20, 20)).toEqual({ x: 20, y: 0 });
  });

  it('raises pity after dry rolls, then resets the counter when the deterministic roll succeeds', () => {
    const pity: Record<string, number> = {};
    const odds = { base: 0.1, step: 0.2, max: 0.7 };
    const dryRoll = () => 0.5;

    expect(dropChance(pity, 'fox', odds)).toBe(0.1);
    expect(rollDrop(pity, 'fox', odds, dryRoll)).toBe(false);
    expect(dropChance(pity, 'fox', odds)).toBeCloseTo(0.3);
    expect(rollDrop(pity, 'fox', odds, dryRoll)).toBe(false);
    expect(dropChance(pity, 'fox', odds)).toBeCloseTo(0.5);
    expect(rollDrop(pity, 'fox', odds, dryRoll)).toBe(false);
    expect(dropChance(pity, 'fox', odds)).toBeCloseTo(0.7);
    expect(rollDrop(pity, 'fox', odds, dryRoll)).toBe(true);
    expect(pity).toEqual({});
  });
});
