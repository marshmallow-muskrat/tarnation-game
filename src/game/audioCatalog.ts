/**
 * The authored audio contract is kept separate from Web Audio so it can be
 * checked without a browser and so runtime code cannot silently invent paths.
 */
export type AudioBus = 'master' | 'music' | 'effects' | 'ambience' | 'ui';
export type AudioLeafBus = Exclude<AudioBus, 'master'>;

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
}>;

const asset = (name: string): string => `/audio/${name}.wav`;

export const AUDIO_EVENT_CATALOG = {
  'ui-confirm': { asset: asset('ui-confirm'), bus: 'ui', loop: false, gain: 0.7, fallback: 'ui' },
  'ui-error': { asset: asset('ui-error'), bus: 'ui', loop: false, gain: 0.7, fallback: 'hit' },
  'footstep-ground': { asset: asset('footstep-ground'), bus: 'effects', loop: false, gain: 0.55, fallback: 'tool' },
  'footstep-wood': { asset: asset('footstep-wood'), bus: 'effects', loop: false, gain: 0.55, fallback: 'tool' },
  'tool-wood': { asset: asset('tool-wood'), bus: 'effects', loop: false, gain: 0.72, fallback: 'tool' },
  'tool-soil': { asset: asset('tool-soil'), bus: 'effects', loop: false, gain: 0.72, fallback: 'tool' },
  'tool-metal': { asset: asset('tool-metal'), bus: 'effects', loop: false, gain: 0.66, fallback: 'hit' },
  shot: { asset: asset('shot'), bus: 'effects', loop: false, gain: 0.7, fallback: 'shot' },
  water: { asset: asset('water'), bus: 'effects', loop: false, gain: 0.68, fallback: 'water' },
  'crop-harvest': { asset: asset('crop-harvest'), bus: 'effects', loop: false, gain: 0.72, fallback: 'reward' },
  'fox-threat': { asset: asset('fox-threat'), bus: 'effects', loop: false, gain: 0.75, fallback: 'hit' },
  'fox-hit': { asset: asset('fox-hit'), bus: 'effects', loop: false, gain: 0.7, fallback: 'hit' },
  'fox-trap': { asset: asset('fox-trap'), bus: 'effects', loop: false, gain: 0.72, fallback: 'trap' },
  defeat: { asset: asset('defeat'), bus: 'effects', loop: false, gain: 0.7, fallback: 'defeat' },
  building: { asset: asset('building'), bus: 'effects', loop: false, gain: 0.72, fallback: 'build' },
  reward: { asset: asset('reward'), bus: 'effects', loop: false, gain: 0.72, fallback: 'reward' },
  merchant: { asset: asset('merchant'), bus: 'ui', loop: false, gain: 0.7, fallback: 'ui' },
  'day-transition': { asset: asset('day-transition'), bus: 'ambience', loop: false, gain: 0.62, fallback: 'reward' },
  'save-success': { asset: asset('save-success'), bus: 'ui', loop: false, gain: 0.62, fallback: 'ui' },
  'save-error': { asset: asset('save-error'), bus: 'ui', loop: false, gain: 0.7, fallback: 'hit' },
  'music-day': { asset: asset('music-day'), bus: 'music', loop: true, gain: 0.28, fallback: null },
  'music-night': { asset: asset('music-night'), bus: 'music', loop: true, gain: 0.3, fallback: null },
  'ambience-day': { asset: asset('ambience-day'), bus: 'ambience', loop: true, gain: 0.42, fallback: null },
  'ambience-night': { asset: asset('ambience-night'), bus: 'ambience', loop: true, gain: 0.48, fallback: null },
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
