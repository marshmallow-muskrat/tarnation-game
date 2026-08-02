import { describe, expect, it } from 'vitest';
import {
  DIAGNOSTICS_LIMITS,
  DiagnosticsEventBuffer,
  DiagnosticsPerformanceTracker,
  sanitizeDiagnostics,
  serializeDiagnostics,
  type DiagnosticsInput,
} from '../src/game/Diagnostics';

function diagnosticsInput(): DiagnosticsInput {
  return {
    build: { version: '0.3.0', commit: 'abc123', buildId: '0.3.0+abc123' },
    browser: {
      userAgent: 'Browser/1.0',
      platform: 'Test OS',
      language: 'en-US',
      online: true,
      devicePixelRatio: 1,
      hardwareConcurrency: 8,
    },
    gpu: {
      webglVersion: 'WebGL 2.0',
      vendor: 'Test vendor',
      renderer: 'Test renderer',
      webgl2: true,
      maxTextureSize: 4096,
      maxTextureUnits: 16,
      maxSamples: 4,
      renderCalls: 12,
      renderTriangles: 500,
      geometries: 8,
      textures: 4,
    },
    save: {
      version: 9,
      seed: 123,
      day: 2,
      phase: 'day',
      simTime: 42,
      mode: 'new',
      status: 'ok',
      revision: 3,
      slot: 'a',
      inventorySlotsUsed: 2,
      seedStacks: 5,
      codexEntries: 5,
      placedBuildings: 1,
      homesteadTier: 1,
      cropsHarvested: 4,
      duckettes: 90,
    },
    fixedSeed: 123,
    recentEvents: [{ kind: 'action', detail: 'till', day: 2, simTime: 42 }],
    assetFailures: [{ group: 'nearby', key: 'fox' }],
    performance: { frames: 10, fixedSteps: 60, averageFrameMs: 4, maxFrameMs: 9 },
  };
}

describe('production diagnostics contract', () => {
  it('keeps only the explicit bounded diagnostic fields and removes save contents', () => {
    const report = sanitizeDiagnostics({
      ...diagnosticsInput(),
      recentEvents: Array.from({ length: 40 }, (_, index) => ({
        kind: `action-${index}`,
        detail: `detail-${index}`,
        day: index + 1,
        simTime: index,
      })),
      assetFailures: Array.from({ length: 40 }, (_, index) => ({ group: 'optional', key: `asset-${index}` })),
    });

    expect(report.recentEvents).toHaveLength(DIAGNOSTICS_LIMITS.recentEvents);
    expect(report.recentEvents[0]?.kind).toBe('action-8');
    expect(report.assetFailures).toHaveLength(DIAGNOSTICS_LIMITS.assetFailures);
    expect(report.assetFailures[0]?.key).toBe('asset-8');
    expect(report).not.toHaveProperty('tiles');
    expect(report).not.toHaveProperty('inventory');
    expect(report).not.toHaveProperty('seedInventory');
    expect(report).not.toHaveProperty('codex');
    expect(report).not.toHaveProperty('placedBuildings');
  });

  it('sanitizes control characters and clamps malformed capability and save values', () => {
    const report = sanitizeDiagnostics({
      ...diagnosticsInput(),
      build: { version: ' 0.3.0\n', commit: '\u0000commit', buildId: ' build ' },
      browser: { ...diagnosticsInput().browser, userAgent: 'browser\u0000\nwith details' },
      gpu: { ...diagnosticsInput().gpu, maxTextureSize: Number.POSITIVE_INFINITY, vendor: '\u0007vendor' },
      save: { ...diagnosticsInput().save, day: Number.NaN, duckettes: Number.POSITIVE_INFINITY },
      performance: { frames: -4, fixedSteps: Number.NaN, averageFrameMs: -1, maxFrameMs: 2_000 },
    });

    expect(report.build.version).toBe('0.3.0');
    expect(report.build.commit).toBe('commit');
    expect(report.browser.userAgent).toBe('browser with details');
    expect(report.gpu.maxTextureSize).toBe(0);
    expect(report.save.day).toBe(1);
    expect(report.save.duckettes).toBe(0);
    expect(report.performance).toEqual({ frames: 0, fixedSteps: 0, averageFrameMs: 0, maxFrameMs: 1_000 });
  });

  it('keeps the most recent action/state events and bounds the in-memory history', () => {
    const history = new DiagnosticsEventBuffer(3);
    history.record({ kind: 'action', detail: 'first' });
    history.record({ kind: 'action', detail: 'second' });
    history.record({ kind: 'transition', detail: 'third' });
    history.record({ kind: 'outcome', detail: 'fourth' });

    expect(history.snapshot()).toEqual([
      { kind: 'action', detail: 'second' },
      { kind: 'transition', detail: 'third' },
      { kind: 'outcome', detail: 'fourth' },
    ]);
  });

  it('reports performance as bounded aggregates rather than an unbounded frame log', () => {
    const performance = new DiagnosticsPerformanceTracker();
    performance.recordFrame(4, 2);
    performance.recordFrame(8, 1);

    expect(performance.snapshot()).toEqual({
      frames: 2,
      fixedSteps: 3,
      averageFrameMs: 6,
      maxFrameMs: 8,
    });
  });

  it('serializes the same sanitized report deterministically for the same input', () => {
    const input = diagnosticsInput();
    const first = serializeDiagnostics(input);
    const second = serializeDiagnostics(input);

    expect(first).toBe(second);
    expect(first.endsWith('\n')).toBe(true);
    expect(JSON.parse(first).diagnosticsVersion).toBe(1);
  });
});
