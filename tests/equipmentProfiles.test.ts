import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_KEYS,
  EQUIPMENT_PROFILES,
  equipmentTimingFor,
  validateEquipmentProfiles,
} from '../src/content/equipment';
import {
  DEFAULT_INTERACT_ACTION_TIMING,
  DEFAULT_RANGED_ACTION_TIMING,
  DEFAULT_TOOL_ACTION_TIMING,
} from '../src/game/ActionStateMachine';

describe('equipment content profiles', () => {
  it('keeps every supported held or placement record valid without loading renderer assets', () => {
    expect(validateEquipmentProfiles()).toEqual([]);
    expect(EQUIPMENT_KEYS).toEqual([
      'axe',
      'bow_wooden',
      'shotgun_2',
      'shovel',
      'bucket',
      'bear_trap',
      'build_preview',
    ]);
  });

  it('describes model axes, hand sockets, readability, feedback, and action data for every record', () => {
    for (const key of EQUIPMENT_KEYS) {
      const profile = EQUIPMENT_PROFILES[key];
      expect(profile.modelForwardAxis, `${key} forward axis`).toHaveLength(3);
      expect(profile.modelUpAxis, `${key} up axis`).toHaveLength(3);
      expect(profile.rightHandGrip, `${key} right-hand grip`).toHaveLength(3);
      expect(profile.sockets.carry.position, `${key} carry position`).toHaveLength(3);
      expect(profile.sockets.action.rotation, `${key} action rotation`).toHaveLength(3);
      expect(profile.readability.maxScale, `${key} readable scale`).toBeGreaterThanOrEqual(profile.readability.minScale);
      expect(profile.readability.maxScreenFraction, `${key} readable screen range`).toBeGreaterThanOrEqual(profile.readability.minScreenFraction);
      expect(profile.actionClips, `${key} compatible clips`).not.toHaveLength(0);
      expect(Object.keys(profile.timings), `${key} action timing`).not.toHaveLength(0);
      expect(profile.feedback.audio, `${key} audio cue`).toBeTruthy();
      expect(profile.feedback.vfx, `${key} VFX cue`).toBeTruthy();
      expect(profile.icon.distance, `${key} icon distance`).toBeGreaterThan(0);
      expect(profile.icon.orthographicScale, `${key} icon scale`).toBeGreaterThan(0);
      expect(profile.debug.axisLength, `${key} debug axes`).toBeGreaterThan(0);
    }
  });

  it('preserves the measured axe grip, carry pose, action pose, and support solve', () => {
    const profile = EQUIPMENT_PROFILES.axe;
    expect(profile.modelKey).toBe('axe');
    expect(profile.rightHandGrip).toEqual([0, 0.05, 0]);
    expect(profile.leftHandSupportGrip).toEqual([0, 0.7, 0]);
    expect(profile.actionLeftHandSupportGrip).toEqual([0, 0.48, 0]);
    expect(profile.scale).toBe(1.15);
    expect(profile.sockets.carry.position).toEqual([0.14, -0.02, 0.02]);
    expect(profile.sockets.carry.rotation).toEqual([Math.PI, 0, -0.5]);
    expect(profile.sockets.action.rotation).toEqual([0, Math.PI / 2, -0.55]);
  });

  it('preserves the measured shotgun and bow hand poses used by the existing weapon controls', () => {
    const shotgun = EQUIPMENT_PROFILES.shotgun_2;
    expect(shotgun.rightHandGrip).toEqual([0, -0.28, 0]);
    expect(shotgun.leftHandSupportGrip).toEqual([1.35, 0.08, 0]);
    expect(shotgun.scale).toBe(0.42);
    expect(shotgun.sockets.carry.rotation).toEqual([0, 0, 0.5]);
    expect(shotgun.sockets.action.rotation).toEqual([0, 0, Math.PI / 2]);

    const bow = EQUIPMENT_PROFILES.bow_wooden;
    expect(bow.modelKey).toBe('bow_wooden');
    expect(bow.rightHandGrip).toEqual([0, 0, 0]);
    expect(bow.scale).toBe(0.76);
    expect(bow.locomotion.runClip).toBe('walkCarry');
  });

  it('preserves the measured shovel pose and action-specific support target', () => {
    const profile = EQUIPMENT_PROFILES.shovel;
    expect(profile.rightHandGrip).toEqual([0, 1.1, 0]);
    expect(profile.leftHandSupportGrip).toEqual([0, 0.02, 0]);
    expect(profile.actionLeftHandSupportGrip).toEqual([0, -0.12, 0]);
    expect(profile.scale).toBe(1.1);
    expect(profile.sockets.carry.rotation).toEqual([Math.PI, 0, 1.05]);
    expect(profile.sockets.action.rotation).toEqual([Math.PI, 0, 1.05]);
  });

  it('keeps action timing data aligned with the fixed-step action state defaults', () => {
    expect(equipmentTimingFor('axe', 'tool')).toEqual(DEFAULT_TOOL_ACTION_TIMING);
    expect(equipmentTimingFor('shovel', 'tool')).toEqual(DEFAULT_TOOL_ACTION_TIMING);
    expect(equipmentTimingFor('bow_wooden', 'ranged')).toEqual(DEFAULT_RANGED_ACTION_TIMING);
    expect(equipmentTimingFor('shotgun_2', 'ranged')).toEqual(DEFAULT_RANGED_ACTION_TIMING);
    expect(equipmentTimingFor('bear_trap', 'interact')).toEqual(DEFAULT_INTERACT_ACTION_TIMING);
    expect(equipmentTimingFor('build_preview', 'interact')).toEqual(DEFAULT_INTERACT_ACTION_TIMING);
    expect(equipmentTimingFor('bucket', 'ranged')).toBeNull();
  });

  it('keeps fallback records explicit for glyph tools, traps, and building previews', () => {
    expect(EQUIPMENT_PROFILES.bucket.modelKey).toBeNull();
    expect(EQUIPMENT_PROFILES.bucket.feedback).toEqual({ audio: 'water', vfx: 'water' });
    expect(EQUIPMENT_PROFILES.bear_trap.modelKey).toBe('bear_trap_open');
    expect(EQUIPMENT_PROFILES.bear_trap.feedback).toEqual({ audio: 'trap', vfx: 'trap' });
    expect(EQUIPMENT_PROFILES.build_preview.modelKey).toBeNull();
    expect(EQUIPMENT_PROFILES.build_preview.feedback).toEqual({ audio: 'build', vfx: 'build' });
  });

  it('reports the exact profile field when a measured value violates the content contract', () => {
    const malformed = {
      ...EQUIPMENT_PROFILES,
      axe: { ...EQUIPMENT_PROFILES.axe, scale: 0 },
    };
    expect(validateEquipmentProfiles(malformed)).toContain('axe: scale must be positive');
  });
});
