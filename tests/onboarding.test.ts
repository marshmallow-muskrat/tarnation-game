import { describe, expect, it } from 'vitest';
import {
  FIRST_TEN_MINUTE_LAUNCH_COPY,
  FIRST_TEN_MINUTE_SUPPORT_COPY,
  firstTenMinuteGuide,
  type FirstTenMinuteInput,
} from '../src/sim/onboarding';

function input(overrides: Partial<FirstTenMinuteInput> = {}): FirstTenMinuteInput {
  return {
    movementStarted: true,
    firstPlotStage: 'till',
    merchantSeen: false,
    seedName: 'Beet',
    ...overrides,
  };
}

describe('first ten minute onboarding', () => {
  it('keeps launch copy to immediate controls and a clear first destination', () => {
    expect(FIRST_TEN_MINUTE_LAUNCH_COPY).toContain('WASD');
    expect(FIRST_TEN_MINUTE_LAUNCH_COPY).toContain('first plot');
  });

  it('starts with immediate movement and does not require an obstructing menu', () => {
    expect(firstTenMinuteGuide(input({ movementStarted: false }))).toMatchObject({
      id: 'movement',
      step: 1,
      total: 8,
      instruction: expect.stringContaining('WASD'),
    });
  });

  it('directs a moving player to the first successful shovel action', () => {
    expect(firstTenMinuteGuide(input())).toMatchObject({
      id: 'tool',
      title: 'Work one tile',
      nextGoal: expect.stringContaining('plant one seed'),
    });
  });

  it('makes the planting contract visible after soil is worked', () => {
    expect(firstTenMinuteGuide(input({ firstPlotStage: 'plant' }))).toMatchObject({
      id: 'plant',
      instruction: expect.stringContaining('Planting spends one packet'),
      nextGoal: expect.stringContaining('water the thirsty crop'),
    });
  });

  it('explains the watering transition instead of treating a planted crop as finished', () => {
    expect(firstTenMinuteGuide(input({ firstPlotStage: 'water' }))).toMatchObject({
      id: 'water',
      instruction: expect.stringContaining('growth clock'),
    });
  });

  it('gives an early, concrete fox-risk counter while the crop grows', () => {
    const guide = firstTenMinuteGuide(input({ firstPlotStage: 'grow' }));
    expect(guide).toMatchObject({
      id: 'grow',
      instruction: expect.stringContaining('Foxes raid after dusk'),
    });
    expect(guide?.instruction).toContain('bear trap');
  });

  it('explains harvest storage before sending the player to sell', () => {
    expect(firstTenMinuteGuide(input({ firstPlotStage: 'harvest' }))).toMatchObject({
      id: 'harvest',
      instruction: expect.stringContaining('stored together'),
      nextGoal: expect.stringContaining('Market stall'),
    });
  });

  it('introduces the market and then makes the merchant the next visible goal', () => {
    expect(firstTenMinuteGuide(input({ firstPlotStage: 'sell' }))).toMatchObject({
      id: 'market',
      instruction: expect.stringContaining('earn duckettes'),
      nextGoal: expect.stringContaining('Traveling Merchant'),
    });
    expect(firstTenMinuteGuide(input({ firstPlotStage: 'complete' }))).toMatchObject({
      id: 'merchant',
      step: 8,
      nextGoal: expect.stringContaining('Settlement objective'),
    });
  });

  it('ends the transient guide after the player visits the merchant', () => {
    expect(firstTenMinuteGuide(input({ firstPlotStage: 'complete', merchantSeen: true }))).toBeNull();
  });

  it('keeps all beat copy concise and free of a full keyboard reference list', () => {
    const stages: FirstTenMinuteInput['firstPlotStage'][] = ['till', 'plant', 'water', 'grow', 'harvest', 'sell', 'complete'];
    const guides = [
      firstTenMinuteGuide(input({ movementStarted: false })),
      ...stages.map((firstPlotStage) => firstTenMinuteGuide(input({ firstPlotStage }))),
    ].filter((value): value is NonNullable<typeof value> => value !== null);

    expect(new Set(guides.map((value) => value.id)).size).toBe(8);
    expect(guides.every((value) => value.instruction.length < 180 && value.nextGoal.length < 100)).toBe(true);
    expect(guides.some((value) => value.instruction.includes('Help'))).toBe(false);
    expect(FIRST_TEN_MINUTE_SUPPORT_COPY).toContain('Settings are in Pause');
  });
});
