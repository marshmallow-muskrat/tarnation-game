import { describe, expect, it } from 'vitest';
import {
  AUDIO_EVENT_CATALOG,
  AUDIO_BUS_NAMES,
  AUDIO_EVENT_NAMES,
  LEGACY_SOUND_EVENTS,
} from '../src/game/audioCatalog';

describe('authored audio catalog', () => {
  it('keeps the master bus above four routable presentation buses', () => {
    const buses = new Set(Object.values(AUDIO_EVENT_CATALOG).map((event) => event.bus));

    expect(AUDIO_BUS_NAMES).toEqual(['master', 'music', 'effects', 'ambience', 'ui']);
    expect(buses).toEqual(new Set(['music', 'effects', 'ambience', 'ui']));
  });

  it('keeps four day/night loop layers distinct from one-shot feedback', () => {
    const loops = AUDIO_EVENT_NAMES.filter((event) => AUDIO_EVENT_CATALOG[event].loop);

    expect(loops).toEqual(['music-day', 'music-night', 'ambience-day', 'ambience-night']);
    expect(loops.every((event) => AUDIO_EVENT_CATALOG[event].fallback === null)).toBe(true);
  });

  it('keeps the legacy gameplay cue API mapped to authored event identities', () => {
    expect(LEGACY_SOUND_EVENTS).toEqual({
      ui: 'ui-confirm',
      tool: 'tool-soil',
      shot: 'shot',
      hit: 'fox-hit',
      defeat: 'defeat',
      water: 'water',
      trap: 'fox-trap',
      build: 'building',
      reward: 'reward',
    });
  });

  it('provides a fallback identity for every one-shot event', () => {
    expect(AUDIO_EVENT_NAMES.filter((event) => !AUDIO_EVENT_CATALOG[event].loop).every((event) => {
      return AUDIO_EVENT_CATALOG[event].fallback !== null;
    })).toBe(true);
  });
});
