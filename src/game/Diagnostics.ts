import type { BuildIdentity } from './BuildInfo';

export const DIAGNOSTICS_VERSION = 1;

export const DIAGNOSTICS_LIMITS = {
  recentEvents: 32,
  assetFailures: 32,
  text: 160,
} as const;

export type DiagnosticsEventInput = {
  kind: string;
  detail?: string;
  status?: string;
  day?: number;
  simTime?: number;
};

export type DiagnosticsAssetFailureInput = {
  group: string;
  key: string;
};

export type DiagnosticsBrowserInput = {
  userAgent: string;
  platform: string;
  language: string;
  online: boolean;
  devicePixelRatio: number;
  hardwareConcurrency: number | null;
};

export type DiagnosticsGpuInput = {
  webglVersion: string;
  vendor: string;
  renderer: string;
  webgl2: boolean;
  maxTextureSize: number;
  maxTextureUnits: number;
  maxSamples: number;
  renderCalls: number;
  renderTriangles: number;
  geometries: number;
  textures: number;
};

export type DiagnosticsSaveInput = {
  version: number;
  seed: number;
  day: number;
  phase: string;
  simTime: number;
  mode: 'new' | 'loaded';
  status: string;
  revision: number | null;
  slot: 'a' | 'b' | null;
  inventorySlotsUsed: number;
  seedStacks: number;
  codexEntries: number;
  placedBuildings: number;
  homesteadTier: number;
  cropsHarvested: number;
  duckettes: number;
};

export type DiagnosticsPerformanceInput = {
  frames: number;
  fixedSteps: number;
  averageFrameMs: number;
  maxFrameMs: number;
};

export type DiagnosticsInput = {
  build: BuildIdentity;
  browser: DiagnosticsBrowserInput;
  gpu: DiagnosticsGpuInput;
  save: DiagnosticsSaveInput;
  fixedSeed: number | null;
  recentEvents: readonly DiagnosticsEventInput[];
  assetFailures: readonly DiagnosticsAssetFailureInput[];
  performance: DiagnosticsPerformanceInput;
};

export type DiagnosticsEvent = {
  kind: string;
  detail: string | null;
  status: string | null;
  day: number;
  simTime: number;
};

export type DiagnosticsAssetFailure = {
  group: string;
  key: string;
};

export type DiagnosticsReport = {
  diagnosticsVersion: number;
  build: BuildIdentity;
  browser: DiagnosticsBrowserInput;
  gpu: DiagnosticsGpuInput;
  save: DiagnosticsSaveInput;
  fixedSeed: number | null;
  recentEvents: DiagnosticsEvent[];
  assetFailures: DiagnosticsAssetFailure[];
  performance: DiagnosticsPerformanceInput;
};

function text(value: unknown, fallback = 'unknown', maxLength: number = DIAGNOSTICS_LIMITS.text): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
  return cleaned || fallback;
}

function finite(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function integer(value: unknown, fallback = 0, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  return Math.floor(finite(value, fallback, min, max));
}

function optionalSeed(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.floor(value) >>> 0;
}

function phase(value: unknown): string {
  return value === 'day' || value === 'night' ? value : 'unknown';
}

function mode(value: unknown): 'new' | 'loaded' {
  return value === 'loaded' ? 'loaded' : 'new';
}

function status(value: unknown): string {
  return text(value, 'unknown', 48);
}

function sanitizeEvent(value: DiagnosticsEventInput): DiagnosticsEvent {
  return {
    kind: text(value?.kind, 'unknown', 48),
    detail: typeof value?.detail === 'string' ? text(value.detail, '', 96) : null,
    status: typeof value?.status === 'string' ? text(value.status, '', 48) : null,
    day: integer(value?.day, 1, 1, 1_000_000),
    simTime: finite(value?.simTime, 0, 0, 31_536_000),
  };
}

/**
 * A bounded, append-only session history. It intentionally stores events in
 * memory only; none of this diagnostic context becomes save data.
 */
export class DiagnosticsEventBuffer {
  private readonly events: DiagnosticsEventInput[] = [];
  private readonly maxEntries: number;

  constructor(maxEntries: number = DIAGNOSTICS_LIMITS.recentEvents) {
    this.maxEntries = Math.max(1, Math.floor(maxEntries));
  }

  record(event: DiagnosticsEventInput): void {
    if (this.events.length >= this.maxEntries) this.events.shift();
    this.events.push({ ...event });
  }

  snapshot(): DiagnosticsEventInput[] {
    return this.events.map((event) => ({ ...event }));
  }
}

/** Frame aggregates are bounded counters, not a per-frame log. */
export class DiagnosticsPerformanceTracker {
  private frames = 0;
  private fixedSteps = 0;
  private totalFrameMs = 0;
  private maxFrameMs = 0;

  recordFrame(frameMs: number, fixedSteps: number): void {
    const safeFrameMs = finite(frameMs, 0, 0, 1_000);
    this.frames = Math.min(Number.MAX_SAFE_INTEGER, this.frames + 1);
    this.fixedSteps = Math.min(Number.MAX_SAFE_INTEGER, this.fixedSteps + integer(fixedSteps, 0, 0, 1_000));
    this.totalFrameMs = Math.min(Number.MAX_SAFE_INTEGER, this.totalFrameMs + safeFrameMs);
    this.maxFrameMs = Math.max(this.maxFrameMs, safeFrameMs);
  }

  snapshot(): DiagnosticsPerformanceInput {
    return {
      frames: this.frames,
      fixedSteps: this.fixedSteps,
      averageFrameMs: this.frames > 0 ? this.totalFrameMs / this.frames : 0,
      maxFrameMs: this.maxFrameMs,
    };
  }
}

function sanitizeBuild(build: BuildIdentity): BuildIdentity {
  return {
    version: text(build?.version),
    commit: text(build?.commit),
    buildId: text(build?.buildId),
  };
}

/**
 * Select and sanitize the player-facing diagnostics contract. This function
 * accepts only explicit diagnostic fields, so a full GameState cannot leak
 * into the export by accident.
 */
export function sanitizeDiagnostics(input: DiagnosticsInput): DiagnosticsReport {
  const events = Array.isArray(input?.recentEvents) ? input.recentEvents : [];
  const failures = Array.isArray(input?.assetFailures) ? input.assetFailures : [];
  const uniqueFailures = new Map<string, DiagnosticsAssetFailure>();
  for (const failure of failures.slice(-DIAGNOSTICS_LIMITS.assetFailures)) {
    const sanitized = {
      group: text(failure?.group, 'unknown', 48),
      key: text(failure?.key, 'unknown', 80),
    };
    uniqueFailures.set(`${sanitized.group}:${sanitized.key}`, sanitized);
  }

  const browser = input?.browser;
  const gpu = input?.gpu;
  const save = input?.save;
  const performance = input?.performance;

  return {
    diagnosticsVersion: DIAGNOSTICS_VERSION,
    build: sanitizeBuild(input?.build),
    browser: {
      userAgent: text(browser?.userAgent),
      platform: text(browser?.platform),
      language: text(browser?.language, 'unknown', 32),
      online: browser?.online === true,
      devicePixelRatio: finite(browser?.devicePixelRatio, 1, 0.1, 4),
      hardwareConcurrency: browser?.hardwareConcurrency === null
        ? null
        : integer(browser?.hardwareConcurrency, 0, 0, 256),
    },
    gpu: {
      webglVersion: text(gpu?.webglVersion),
      vendor: text(gpu?.vendor),
      renderer: text(gpu?.renderer),
      webgl2: gpu?.webgl2 === true,
      maxTextureSize: integer(gpu?.maxTextureSize, 0, 0, 16_384),
      maxTextureUnits: integer(gpu?.maxTextureUnits, 0, 0, 256),
      maxSamples: integer(gpu?.maxSamples, 0, 0, 64),
      renderCalls: integer(gpu?.renderCalls, 0, 0, Number.MAX_SAFE_INTEGER),
      renderTriangles: integer(gpu?.renderTriangles, 0, 0, Number.MAX_SAFE_INTEGER),
      geometries: integer(gpu?.geometries, 0, 0, Number.MAX_SAFE_INTEGER),
      textures: integer(gpu?.textures, 0, 0, Number.MAX_SAFE_INTEGER),
    },
    save: {
      version: integer(save?.version, 0, 0, 1_000),
      seed: optionalSeed(save?.seed) ?? 0,
      day: integer(save?.day, 1, 1, 1_000_000),
      phase: phase(save?.phase),
      simTime: finite(save?.simTime, 0, 0, 31_536_000),
      mode: mode(save?.mode),
      status: status(save?.status),
      revision: save?.revision === null ? null : integer(save?.revision, 0, 0, Number.MAX_SAFE_INTEGER),
      slot: save?.slot === 'a' || save?.slot === 'b' ? save.slot : null,
      inventorySlotsUsed: integer(save?.inventorySlotsUsed, 0, 0, 24),
      seedStacks: integer(save?.seedStacks, 0, 0, 1_000),
      codexEntries: integer(save?.codexEntries, 0, 0, 1_000),
      placedBuildings: integer(save?.placedBuildings, 0, 0, 1_000),
      homesteadTier: integer(save?.homesteadTier, 1, 1, 5),
      cropsHarvested: integer(save?.cropsHarvested, 0, 0, 1_000_000),
      duckettes: integer(save?.duckettes, 0, 0, 1_000_000_000),
    },
    fixedSeed: optionalSeed(input?.fixedSeed),
    recentEvents: events.slice(-DIAGNOSTICS_LIMITS.recentEvents).map(sanitizeEvent),
    assetFailures: [...uniqueFailures.values()].slice(-DIAGNOSTICS_LIMITS.assetFailures),
    performance: {
      frames: integer(performance?.frames, 0, 0, Number.MAX_SAFE_INTEGER),
      fixedSteps: integer(performance?.fixedSteps, 0, 0, Number.MAX_SAFE_INTEGER),
      averageFrameMs: finite(performance?.averageFrameMs, 0, 0, 1_000),
      maxFrameMs: finite(performance?.maxFrameMs, 0, 0, 1_000),
    },
  };
}

export function serializeDiagnostics(input: DiagnosticsInput): string {
  return `${JSON.stringify(sanitizeDiagnostics(input), null, 2)}\n`;
}
