/**
 * The authored audio contract is kept separate from Web Audio so it can be
 * checked without a browser and so runtime code cannot silently invent paths.
 */
export type AudioBus = 'master' | 'music' | 'effects' | 'ambience' | 'ui';
export type AudioLeafBus = Exclude<AudioBus, 'master'>;
export type AudioPriority = 'ambient' | 'action' | 'threat' | 'ui';

export type LegacySoundKind =
  | 'ui'
  | 'tool'
  | 'shot'
  | 'hit'
  | 'defeat'
  | 'water'
  | 'trap'
  | 'build'
  | 'reward';

export type AudioEvent =
  | 'ui-confirm'
  | 'ui-error'
  | 'footstep-ground'
  | 'footstep-wood'
  | 'tool-wood'
  | 'tool-soil'
  | 'tool-metal'
  | 'shot'
  | 'water'
  | 'crop-harvest'
  | 'fox-threat'
  | 'fox-hit'
  | 'fox-trap'
  | 'defeat'
  | 'building'
  | 'reward'
  | 'merchant'
  | 'day-transition'
  | 'save-success'
  | 'save-error'
  | 'music-day'
  | 'music-night'
  | 'ambience-day'
  | 'ambience-night';

export type AudioEventDefinition = Readonly<{
  asset: string;
  bus: AudioLeafBus;
  loop: boolean;
  gain: number;
  fallback: LegacySoundKind | null;
  priority: AudioPriority;
  maxVoices: number;
  minInterval: number;
  duckFactor: number;
  duckDuration: number;
  spatial: boolean;
  caption: string | null;
}>;

type MixOverrides = Partial<Pick<
  AudioEventDefinition,
  'priority' | 'maxVoices' | 'minInterval' | 'duckFactor' | 'duckDuration' | 'spatial' | 'caption'
>>;

const asset = (name: string): string => `/audio/${name}.wav`;

const oneShot = (
  name: string,
  bus: AudioLeafBus,
  gain: number,
  fallback: LegacySoundKind,
  overrides: MixOverrides = {},
): AudioEventDefinition => ({
  asset: asset(name),
  bus,
  loop: false,
  gain,
  fallback,
  priority: 'action',
  maxVoices: 2,
  minInterval: 0.06,
  duckFactor: 0.72,
  duckDuration: 0.28,
  spatial: false,
  caption: null,
  ...overrides,
});

const loop = (name: string, bus: 'music' | 'ambience', gain: number): AudioEventDefinition => ({
  asset: asset(name),
  bus,
  loop: true,
  gain,
  fallback: null,
  priority: 'ambient',
  maxVoices: 1,
  minInterval: 0,
  duckFactor: 1,
  duckDuration: 0,
  spatial: false,
  caption: null,
});

export const AUDIO_EVENT_CATALOG = {
  'ui-confirm': oneShot('ui-confirm', 'ui', 0.7, 'ui', {
    priority: 'ui',
    maxVoices: 2,
    minInterval: 0.05,
    duckFactor: 0.68,
    duckDuration: 0.22,
  }),
  'ui-error': oneShot('ui-error', 'ui', 0.7, 'hit', {
    priority: 'ui',
    maxVoices: 1,
    minInterval: 0.18,
    duckFactor: 0.55,
    duckDuration: 0.32,
  }),
  'footstep-ground': oneShot('footstep-ground', 'effects', 0.55, 'tool', {
    maxVoices: 2,
    minInterval: 0.12,
    duckFactor: 1,
    duckDuration: 0,
  }),
  'footstep-wood': oneShot('footstep-wood', 'effects', 0.55, 'tool', {
    maxVoices: 2,
    minInterval: 0.12,
    duckFactor: 1,
    duckDuration: 0,
  }),
  'tool-wood': oneShot('tool-wood', 'effects', 0.72, 'tool', { minInterval: 0.08 }),
  'tool-soil': oneShot('tool-soil', 'effects', 0.72, 'tool', { minInterval: 0.08 }),
  'tool-metal': oneShot('tool-metal', 'effects', 0.66, 'hit', { minInterval: 0.12 }),
  shot: oneShot('shot', 'effects', 0.7, 'shot', {
    maxVoices: 2,
    minInterval: 0.16,
    duckFactor: 0.45,
    duckDuration: 0.42,
    caption: 'Shot fired',
  }),
  water: oneShot('water', 'effects', 0.68, 'water', { duckFactor: 0.9, duckDuration: 0.16 }),
  'crop-harvest': oneShot('crop-harvest', 'effects', 0.72, 'reward', {
    priority: 'ui',
    minInterval: 0.14,
    duckFactor: 0.58,
    duckDuration: 0.5,
    caption: 'Harvest complete',
  }),
  'fox-threat': oneShot('fox-threat', 'effects', 0.75, 'hit', {
    priority: 'threat',
    maxVoices: 1,
    minInterval: 0.45,
    duckFactor: 0.28,
    duckDuration: 2.2,
    spatial: true,
    caption: 'Fox threat nearby',
  }),
  'fox-hit': oneShot('fox-hit', 'effects', 0.7, 'hit', { maxVoices: 3, minInterval: 0.05 }),
  'fox-trap': oneShot('fox-trap', 'effects', 0.72, 'trap', { minInterval: 0.18 }),
  defeat: oneShot('defeat', 'effects', 0.7, 'defeat', {
    priority: 'ui',
    minInterval: 0.18,
    duckFactor: 0.52,
    duckDuration: 0.55,
  }),
  building: oneShot('building', 'effects', 0.72, 'build', { minInterval: 0.12 }),
  reward: oneShot('reward', 'effects', 0.72, 'reward', {
    priority: 'ui',
    minInterval: 0.16,
    duckFactor: 0.54,
    duckDuration: 0.52,
  }),
  merchant: oneShot('merchant', 'ui', 0.7, 'ui', {
    priority: 'ui',
    maxVoices: 1,
    minInterval: 0.18,
    duckFactor: 0.68,
    duckDuration: 0.28,
  }),
  'day-transition': oneShot('day-transition', 'ambience', 0.62, 'reward', {
    priority: 'ui',
    maxVoices: 1,
    minInterval: 0.5,
    duckFactor: 0.6,
    duckDuration: 0.8,
    caption: 'Day transition',
  }),
  'save-success': oneShot('save-success', 'ui', 0.62, 'ui', {
    priority: 'ui',
    maxVoices: 1,
    minInterval: 0.3,
    duckFactor: 0.68,
    duckDuration: 0.3,
    caption: 'Game saved',
  }),
  'save-error': oneShot('save-error', 'ui', 0.7, 'hit', {
    priority: 'threat',
    maxVoices: 1,
    minInterval: 0.3,
    duckFactor: 0.35,
    duckDuration: 0.7,
    caption: 'Save failed',
  }),
  'music-day': loop('music-day', 'music', 0.28),
  'music-night': loop('music-night', 'music', 0.3),
  'ambience-day': loop('ambience-day', 'ambience', 0.42),
  'ambience-night': loop('ambience-night', 'ambience', 0.48),
} as const satisfies Record<AudioEvent, AudioEventDefinition>;

export const LEGACY_SOUND_EVENTS: Record<LegacySoundKind, AudioEvent> = {
  ui: 'ui-confirm',
  tool: 'tool-soil',
  shot: 'shot',
  hit: 'fox-hit',
  defeat: 'defeat',
  water: 'water',
  trap: 'fox-trap',
  build: 'building',
  reward: 'reward',
};

export const AUDIO_EVENT_NAMES = Object.keys(AUDIO_EVENT_CATALOG) as AudioEvent[];
export const AUDIO_BUS_NAMES = ['master', 'music', 'effects', 'ambience', 'ui'] as const satisfies readonly AudioBus[];
