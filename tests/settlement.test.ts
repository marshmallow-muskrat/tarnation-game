import { describe, expect, it } from 'vitest';
import { createGameState, checkWin, loadFromString, markWinShown, saveToString } from '../src/sim/gameState';
import { makeSeed } from '../src/sim/genetics';
import { settlementObjective } from '../src/sim/settlement';

function hybridEntry() {
  const seed = {
    ...makeSeed('beet'),
    displayName: 'Beet-Carrot Hybrid',
    hybrid: true,
    lineage: ['Beet', 'Carrot'],
  };
  return { id: 'test-hybrid', seed, discoveredDay: 2 };
}

function completedSettlementState() {
  const state = createGameState(0x5eed_0208);
  state.stats.cropsHarvested = 1;
  state.codex.push(hybridEntry());
  state.placedBuildings = [{ id: 'fence', x: 30, z: 30, rotation: 0 }];
  state.homesteadTier = 2;
  return state;
}

describe('settlement objective', () => {
  it('shows the four player-visible pillars as incomplete on a fresh game', () => {
    const objective = settlementObjective(createGameState(0x5eed_0208));

    expect(objective.title).toBe('Establish the homestead');
    expect(objective.complete).toBe(false);
    expect(objective.steps.map((step) => [step.id, step.complete])).toEqual([
      ['grow', false],
      ['experiment', false],
      ['defend', false],
      ['develop', false],
    ]);
  });

  it('marks Grow complete only after a crop harvest is recorded', () => {
    const state = createGameState(1);
    state.stats.cropsHarvested = 1;

    expect(settlementObjective(state).steps.find((step) => step.id === 'grow')?.complete).toBe(true);
    expect(settlementObjective(createGameState(1)).steps.find((step) => step.id === 'grow')?.complete).toBe(false);
  });

  it('marks Experiment complete from a discovered hybrid Codex entry', () => {
    const state = createGameState(2);
    state.codex.push(hybridEntry());

    expect(settlementObjective(state).steps.find((step) => step.id === 'experiment')?.complete).toBe(true);
    expect(settlementObjective(createGameState(2)).steps.find((step) => step.id === 'experiment')?.complete).toBe(false);
  });

  it('marks Defend complete from a fence, gate, or existing trophy outcome', () => {
    const fenceState = createGameState(3);
    fenceState.placedBuildings = [{ id: 'fence', x: 1, z: 1, rotation: 0 }];
    const gateState = createGameState(4);
    gateState.placedBuildings = [{ id: 'gate', x: 1, z: 1, rotation: 0 }];
    const trophyState = createGameState(5);
    trophyState.stats.trophies = 1;

    expect(settlementObjective(fenceState).steps.find((step) => step.id === 'defend')?.complete).toBe(true);
    expect(settlementObjective(gateState).steps.find((step) => step.id === 'defend')?.complete).toBe(true);
    expect(settlementObjective(trophyState).steps.find((step) => step.id === 'defend')?.complete).toBe(true);
  });

  it('marks Develop complete from homestead progression or a utility building', () => {
    const tierState = createGameState(6);
    tierState.homesteadTier = 2;
    const utilityState = createGameState(7);
    utilityState.placedBuildings = [{ id: 'water_tower', x: 1, z: 1, rotation: 0 }];

    expect(settlementObjective(tierState).steps.find((step) => step.id === 'develop')?.complete).toBe(true);
    expect(settlementObjective(utilityState).steps.find((step) => step.id === 'develop')?.complete).toBe(true);
    expect(settlementObjective(createGameState(8)).steps.find((step) => step.id === 'develop')?.complete).toBe(false);
  });

  it('opens the ending when all pillars are complete regardless of day, then stays dismissed', () => {
    const state = completedSettlementState();
    state.clock.day = 1;

    expect(checkWin(state)).toBe(true);
    expect(settlementObjective(state).complete).toBe(true);

    markWinShown(state);
    expect(checkWin(state)).toBe(false);
  });

  it('does not open the ending merely because the old day-five threshold was reached', () => {
    const state = createGameState(0x5eed_0208);
    state.clock.day = 5;

    expect(checkWin(state)).toBe(false);
  });

  it('derives completion after save roundtrip without adding an objective save field', () => {
    const state = completedSettlementState();
    const raw = saveToString(state);
    const loaded = loadFromString(raw);

    expect(loaded).not.toBeNull();
    expect(loaded && settlementObjective(loaded).complete).toBe(true);
    expect(loaded && checkWin(loaded)).toBe(true);
    expect(raw).not.toContain('objective');
  });
});
