import {
  AUDIO_EVENT_CATALOG,
  LEGACY_SOUND_EVENTS,
  type AudioLeafBus,
  type AudioEvent,
  type LegacySoundKind,
} from './audioCatalog';
import type { GameSettings } from './Settings';

export type SoundKind = LegacySoundKind;
export type AudioPhase = 'day' | 'night';

type SoundSpec = {
  type: OscillatorType;
  start: number;
  end: number;
  duration: number;
  volume: number;
};

type AudioVolumeSettings = Pick<GameSettings, 'masterVolume' | 'musicVolume' | 'effectsVolume' | 'ambienceVolume'>;

const SOUND_SPECS: Record<SoundKind, SoundSpec> = {
  ui: { type: 'sine', start: 520, end: 680, duration: 0.07, volume: 0.08 },
  tool: { type: 'triangle', start: 150, end: 92, duration: 0.09, volume: 0.1 },
  shot: { type: 'sawtooth', start: 180, end: 70, duration: 0.1, volume: 0.11 },
  hit: { type: 'square', start: 120, end: 72, duration: 0.06, volume: 0.08 },
  defeat: { type: 'sine', start: 300, end: 120, duration: 0.18, volume: 0.12 },
  water: { type: 'sine', start: 310, end: 500, duration: 0.12, volume: 0.08 },
  trap: { type: 'square', start: 210, end: 90, duration: 0.14, volume: 0.11 },
  build: { type: 'triangle', start: 230, end: 560, duration: 0.2, volume: 0.1 },
  reward: { type: 'sine', start: 460, end: 760, duration: 0.16, volume: 0.1 },
};

/**
 * Optional authored Web Audio presentation. It never owns game state, blocks
 * loading, or consumes simulation randomness. Missing or blocked assets use
 * the old oscillator cues for the current event only.
 */
export class AudioFeedback {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<AudioLeafBus, GainNode | null> = {
    music: null,
    effects: null,
    ambience: null,
    ui: null,
  };
  private volumes: AudioVolumeSettings = {
    masterVolume: 1,
    musicVolume: 1,
    effectsVolume: 1,
    ambienceVolume: 1,
  };
  private muted = false;
  private phase: AudioPhase = 'day';
  private disposed = false;
  private variantSeed = 0x2d7a11;
  private readonly loaded = new Map<AudioEvent, AudioBuffer>();
  private readonly loading = new Map<AudioEvent, Promise<AudioBuffer | null>>();
  private readonly failed = new Set<AudioEvent>();
  private readonly loops = new Map<AudioEvent, AudioBufferSourceNode>();

  constructor() {
    try {
      this.muted = localStorage.getItem('tarnation.audioMuted') === '1';
    } catch {
      // Storage is optional; audio should still be usable in a restricted context.
    }
  }

  unlock(): void {
    if (this.disposed) return;
    if (!this.context) {
      try {
        const Context =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        for (const bus of Object.keys(this.buses) as AudioLeafBus[]) {
          const gain = this.context.createGain();
          gain.connect(this.master);
          this.buses[bus] = gain;
        }
        this.applyVolumes();
      } catch {
        this.context = null;
        this.master = null;
        return;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume();
    void this.syncLoops();
  }

  /** Preserve the original short cue API for equipment and fox profiles. */
  play(kind: SoundKind): void {
    this.playEvent(LEGACY_SOUND_EVENTS[kind]);
  }

  /** Play the authored cue associated with a fox role's typed legacy cue. */
  playFoxCue(cue: 'hit' | 'tool' | 'build' | 'trap'): void {
    const event: Record<typeof cue, AudioEvent> = {
      hit: 'fox-hit',
      tool: 'fox-threat',
      build: 'building',
      trap: 'fox-trap',
    };
    this.playEvent(event[cue]);
  }

  playEvent(event: AudioEvent): void {
    if (this.muted || this.disposed) return;
    this.unlock();
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const definition = AUDIO_EVENT_CATALOG[event];
    if (definition.loop) {
      void this.syncLoops();
      return;
    }
    const buffer = this.loaded.get(event);
    if (buffer) {
      this.playBuffer(event, buffer);
    } else {
      if (definition.fallback) this.playSynthesized(definition.fallback, definition.bus);
      void this.loadBuffer(event);
    }
  }

  setPhase(phase: AudioPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    void this.syncLoops();
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem('tarnation.audioMuted', this.muted ? '1' : '0');
    } catch {
      // Storage is optional.
    }
    this.applyVolumes();
    void this.syncLoops();
  }

  setVolumes(settings: AudioVolumeSettings): void {
    this.volumes = {
      masterVolume: settings.masterVolume,
      musicVolume: settings.musicVolume,
      effectsVolume: settings.effectsVolume,
      ambienceVolume: settings.ambienceVolume,
    };
    this.applyVolumes();
  }

  dispose(): void {
    this.disposed = true;
    for (const source of this.loops.values()) {
      try {
        source.stop();
      } catch {
        // A source that already ended is safe to discard.
      }
    }
    this.loops.clear();
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
    this.buses = { music: null, effects: null, ambience: null, ui: null };
    this.loaded.clear();
    this.loading.clear();
  }

  private async loadBuffer(event: AudioEvent): Promise<AudioBuffer | null> {
    const existing = this.loaded.get(event);
    if (existing) return existing;
    const pending = this.loading.get(event);
    if (pending) return pending;
    if (this.failed.has(event)) return null;
    const context = this.context;
    if (!context) return null;
    const definition = AUDIO_EVENT_CATALOG[event];
    const request = fetch(definition.asset)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      })
      .then((bytes) => context.decodeAudioData(bytes))
      .then((buffer) => {
        if (!this.disposed && this.context === context) this.loaded.set(event, buffer);
        return buffer;
      })
      .catch((error: unknown) => {
        this.failed.add(event);
        console.warn(`[Audio] Falling back for ${event}:`, error);
        return null;
      });
    this.loading.set(event, request);
    void request.finally(() => this.loading.delete(event));
    return request;
  }

  private async syncLoops(): Promise<void> {
    const context = this.context;
    if (!context || this.muted || this.disposed) {
      this.stopLoops();
      return;
    }
    const desired = new Set<AudioEvent>([
      this.phase === 'day' ? 'music-day' : 'music-night',
      this.phase === 'day' ? 'ambience-day' : 'ambience-night',
    ]);
    for (const event of this.loops.keys()) {
      if (!desired.has(event)) this.stopLoop(event);
    }
    for (const event of desired) {
      if (this.loops.has(event)) continue;
      const buffer = await this.loadBuffer(event);
      if (!buffer || this.disposed || this.context !== context || this.muted || !desired.has(event)) continue;
      if (!this.loops.has(event)) this.startLoop(event, buffer);
    }
  }

  private startLoop(event: AudioEvent, buffer: AudioBuffer): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const definition = AUDIO_EVENT_CATALOG[event];
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.value = definition.gain;
    source.connect(gain).connect(this.buses[definition.bus] ?? master);
    source.start();
    this.loops.set(event, source);
  }

  private stopLoops(): void {
    for (const event of this.loops.keys()) this.stopLoop(event);
  }

  private stopLoop(event: AudioEvent): void {
    const source = this.loops.get(event);
    if (!source) return;
    try {
      source.stop();
    } catch {
      // A source that already ended is safe to discard.
    }
    this.loops.delete(event);
  }

  private playBuffer(event: AudioEvent, buffer: AudioBuffer): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const definition = AUDIO_EVENT_CATALOG[event];
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = definition.gain;
    source.connect(gain).connect(this.buses[definition.bus] ?? master);
    source.start();
  }

  private playSynthesized(kind: SoundKind, bus: AudioLeafBus): void {
    const context = this.context;
    const master = this.master;
    if (!context || !master) return;
    const spec = SOUND_SPECS[kind];
    const now = context.currentTime;
    const pitch = 0.94 + this.nextVariant() * 0.12;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = spec.type;
    oscillator.frequency.setValueAtTime(spec.start * pitch, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, spec.end * pitch),
      now + spec.duration,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(spec.volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + spec.duration);
    oscillator.connect(gain).connect(this.buses[bus] ?? master);
    oscillator.start(now);
    oscillator.stop(now + spec.duration + 0.02);
  }

  private applyVolumes(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32 * this.volumes.masterVolume;
    if (this.buses.music) this.buses.music.gain.value = this.volumes.musicVolume;
    if (this.buses.effects) this.buses.effects.gain.value = this.volumes.effectsVolume;
    if (this.buses.ambience) this.buses.ambience.gain.value = this.volumes.ambienceVolume;
    if (this.buses.ui) this.buses.ui.gain.value = this.volumes.masterVolume;
  }

  private nextVariant(): number {
    this.variantSeed = (this.variantSeed * 1664525 + 1013904223) >>> 0;
    return this.variantSeed / 0x1_0000_0000;
  }
}
