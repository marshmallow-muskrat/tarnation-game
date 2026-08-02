import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAME_SETTINGS,
  parseGameSettings,
  resetGameSettings,
  serializeGameSettings,
  updateGameSetting,
} from '../src/game/Settings';

describe('browser presentation settings', () => {
  it('round-trips valid device preferences without adding save fields', () => {
    const settings = updateGameSetting(
      updateGameSetting(DEFAULT_GAME_SETTINGS, 'effectsVolume', 0.35),
      'highContrast',
      true,
    );

    expect(parseGameSettings(serializeGameSettings(settings))).toEqual(settings);
    expect(Object.keys(settings)).not.toContain('day');
  });

  it('clamps unsafe numeric preferences to readable bounded values', () => {
    expect(parseGameSettings(JSON.stringify({
      masterVolume: -2,
      musicVolume: 4,
      uiScale: 99,
      textScale: 0,
    }))).toMatchObject({
      masterVolume: 0,
      musicVolume: 1,
      uiScale: 1.25,
      textScale: 1,
    });
  });

  it('restores defaults for malformed or incorrectly typed preferences', () => {
    expect(parseGameSettings('{not json')).toEqual(DEFAULT_GAME_SETTINGS);
    expect(parseGameSettings(JSON.stringify({
      masterVolume: 'quiet',
      reducedMotion: 'yes',
      cameraShake: null,
      highContrast: 1,
    }))).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it('updates one setting without mutating the previous preference object', () => {
    const previous = resetGameSettings();
    const next = updateGameSetting(previous, 'textScale', 1.4);
    expect(previous.textScale).toBe(1);
    expect(next.textScale).toBe(1.4);
    expect(next.reducedMotion).toBe(previous.reducedMotion);
  });
});
