/** Browser-persisted presentation and accessibility preferences.
 *
 * Settings are deliberately separate from the save schema: they describe this
 * player's device and presentation preferences, not the homestead state.
 */
export const SETTINGS_STORAGE_KEY = 'tarnation.settings';

export const SETTING_LIMITS = {
  masterVolume: { min: 0, max: 1 },
  musicVolume: { min: 0, max: 1 },
  effectsVolume: { min: 0, max: 1 },
  ambienceVolume: { min: 0, max: 1 },
  uiScale: { min: 0.9, max: 1.25 },
  textScale: { min: 1, max: 1.4 },
} as const;

export type GameSettings = {
  masterVolume: number;
  musicVolume: number;
  effectsVolume: number;
  ambienceVolume: number;
  muted: boolean;
  reducedMotion: boolean;
  cameraShake: boolean;
  uiScale: number;
  textScale: number;
  highContrast: boolean;
};

export type GameSettingKey = keyof GameSettings;
export type GameSettingValue = GameSettings[GameSettingKey];

export const DEFAULT_GAME_SETTINGS: Readonly<GameSettings> = {
  masterVolume: 1,
  musicVolume: 1,
  effectsVolume: 1,
  ambienceVolume: 1,
  muted: false,
  reducedMotion: false,
  cameraShake: true,
  uiScale: 1,
  textScale: 1,
  highContrast: false,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberSetting(
  candidate: unknown,
  fallback: number,
  limits: { min: number; max: number },
): number {
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? clamp(candidate, limits.min, limits.max)
    : fallback;
}

/** Parse malformed, missing, or old browser settings without throwing. */
export function parseGameSettings(raw: string | null | undefined): GameSettings {
  if (!raw) return { ...DEFAULT_GAME_SETTINGS };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_GAME_SETTINGS };
    }
    const candidate = parsed as Record<string, unknown>;
    return {
      masterVolume: numberSetting(candidate.masterVolume, DEFAULT_GAME_SETTINGS.masterVolume, SETTING_LIMITS.masterVolume),
      musicVolume: numberSetting(candidate.musicVolume, DEFAULT_GAME_SETTINGS.musicVolume, SETTING_LIMITS.musicVolume),
      effectsVolume: numberSetting(candidate.effectsVolume, DEFAULT_GAME_SETTINGS.effectsVolume, SETTING_LIMITS.effectsVolume),
      ambienceVolume: numberSetting(candidate.ambienceVolume, DEFAULT_GAME_SETTINGS.ambienceVolume, SETTING_LIMITS.ambienceVolume),
      muted: typeof candidate.muted === 'boolean'
        ? candidate.muted
        : DEFAULT_GAME_SETTINGS.muted,
      reducedMotion: typeof candidate.reducedMotion === 'boolean'
        ? candidate.reducedMotion
        : DEFAULT_GAME_SETTINGS.reducedMotion,
      cameraShake: typeof candidate.cameraShake === 'boolean'
        ? candidate.cameraShake
        : DEFAULT_GAME_SETTINGS.cameraShake,
      uiScale: numberSetting(candidate.uiScale, DEFAULT_GAME_SETTINGS.uiScale, SETTING_LIMITS.uiScale),
      textScale: numberSetting(candidate.textScale, DEFAULT_GAME_SETTINGS.textScale, SETTING_LIMITS.textScale),
      highContrast: typeof candidate.highContrast === 'boolean'
        ? candidate.highContrast
        : DEFAULT_GAME_SETTINGS.highContrast,
    };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function serializeGameSettings(settings: Readonly<GameSettings>): string {
  return JSON.stringify(settings);
}

/** Update one validated preference while keeping the remaining settings intact. */
export function updateGameSetting(
  settings: Readonly<GameSettings>,
  key: GameSettingKey,
  value: GameSettingValue,
): GameSettings {
  const next = { ...settings };
  if (key === 'muted' || key === 'reducedMotion' || key === 'cameraShake' || key === 'highContrast') {
    if (typeof value === 'boolean') next[key] = value;
    return next;
  }
  if (typeof value !== 'number') return next;
  next[key] = numberSetting(value, DEFAULT_GAME_SETTINGS[key], SETTING_LIMITS[key]);
  return next;
}

export function resetGameSettings(): GameSettings {
  return { ...DEFAULT_GAME_SETTINGS };
}
