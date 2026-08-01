type SoundKind =
  | 'ui'
  | 'tool'
  | 'shot'
  | 'hit'
  | 'defeat'
  | 'water'
  | 'trap'
  | 'build'
  | 'reward';

type SoundSpec = {
  type: OscillatorType;
  start: number;
  end: number;
  duration: number;
  volume: number;
};

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

/** Optional Web Audio feedback. It never owns game state and never blocks loading. */
export class AudioFeedback {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private variantSeed = 0x2d7a11;

  constructor() {
    try {
      this.muted = localStorage.getItem('tarnation.audioMuted') === '1';
    } catch {
      // Storage is optional; audio should still be usable in a restricted context.
    }
  }

  unlock(): void {
    if (!this.context) {
      try {
        const Context =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Context) return;
        this.context = new Context();
        this.master = this.context.createGain();
        this.master.gain.value = 0.32;
        this.master.connect(this.context.destination);
      } catch {
        this.context = null;
        this.master = null;
        return;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  play(kind: SoundKind): void {
    if (this.muted) return;
    this.unlock();
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
    oscillator.connect(gain).connect(master);
    oscillator.start(now);
    oscillator.stop(now + spec.duration + 0.02);
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('tarnation.audioMuted', this.muted ? '1' : '0');
    } catch {
      // Storage is optional.
    }
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  }

  dispose(): void {
    if (this.context) void this.context.close();
    this.context = null;
    this.master = null;
  }

  private nextVariant(): number {
    this.variantSeed = (this.variantSeed * 1664525 + 1013904223) >>> 0;
    return this.variantSeed / 0x1_0000_0000;
  }
}
