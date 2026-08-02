import { BEAR_TRAP_PLACE_RANGE, TOOL_RANGE } from '../content';
import { MODEL_KEYS, type ModelKey } from './models';

export type Axis = readonly [number, number, number];
export type SocketTransform = Readonly<{
  position: Axis;
  rotation: Axis;
}>;

export type EquipmentKey =
  | 'axe'
  | 'bow_wooden'
  | 'shotgun_2'
  | 'shovel'
  | 'bucket'
  | 'bear_trap'
  | 'build_preview';

export type EquipmentActionKind = 'tool' | 'ranged' | 'interact';
export type EquipmentActionClip = 'pickUp' | 'shoot' | 'swordSlash' | 'punch';
export type EquipmentAudioCue = 'tool' | 'shot' | 'water' | 'trap' | 'build';
export type EquipmentVfxCue = 'chop' | 'soil' | 'water' | 'muzzle' | 'trap' | 'build';
export type EquipmentTargetClass =
  | 'tree_or_boulder'
  | 'farm_tile'
  | 'water_or_crop'
  | 'ranged'
  | 'trap_ground'
  | 'placement';

export type EquipmentActionTiming = Readonly<{
  windup: number;
  contact: number;
  recover: number;
}>;

export type EquipmentInteraction = Readonly<{
  kind: EquipmentActionKind;
  clip: EquipmentActionClip;
  target: EquipmentTargetClass;
  /** Null means the action is aimed, not constrained by a world target range. */
  range: number | null;
  facingHalfAngle: number;
}>;

export type EquipmentProfile = Readonly<{
  /** Null means there is no external model; the renderer may use a glyph, authored primitive, or preview. */
  modelKey: ModelKey | null;
  /** Measured source axes before the socket rotation is applied. */
  modelForwardAxis: Axis;
  modelUpAxis: Axis;
  /** Model-space point that is placed in the animated right-hand grip. */
  rightHandGrip: Axis;
  /** Optional model-space point targeted by the left-hand support solve. */
  leftHandSupportGrip?: Axis;
  actionLeftHandSupportGrip?: Axis;
  supportBlend?: number;
  scale: number;
  sockets: Readonly<{
    carry: SocketTransform;
    action: SocketTransform;
  }>;
  readability: Readonly<{
    minScale: number;
    maxScale: number;
    minScreenFraction: number;
    maxScreenFraction: number;
  }>;
  locomotion: Readonly<{
    runClip: 'walkCarry' | 'runCarry';
    idleTime: number;
  }>;
  actionClips: readonly EquipmentActionClip[];
  interaction: EquipmentInteraction;
  timings: Partial<Record<EquipmentActionKind, EquipmentActionTiming>>;
  feedback: Readonly<{
    audio: EquipmentAudioCue;
    vfx: EquipmentVfxCue;
  }>;
  icon: Readonly<{
    yaw: number;
    pitch: number;
    roll: number;
    distance: number;
    targetY: number;
    orthographicScale: number;
  }>;
  debug: Readonly<{
    axisLength: number;
    supportColor: number;
  }>;
}>;

const TOOL_TIMING: EquipmentActionTiming = {
  windup: 0.12,
  contact: 0.05,
  recover: 0.18,
};

const RANGED_TIMING: EquipmentActionTiming = {
  windup: 0.08,
  contact: 0.06,
  recover: 0,
};

const INTERACT_TIMING: EquipmentActionTiming = {
  windup: 0.08,
  contact: 0,
  recover: 0.08,
};

/**
 * Measured held-item profiles. The current Survival Pack glTFs do not contain
 * authored grip/socket marker nodes, so these values stay in one typed content
 * table until the source assets gain those markers.
 */
export const EQUIPMENT_PROFILES: Readonly<Record<EquipmentKey, EquipmentProfile>> = {
  axe: {
    modelKey: 'axe',
    modelForwardAxis: [0, 0, 1],
    modelUpAxis: [0, 1, 0],
    rightHandGrip: [0, 0.05, 0],
    leftHandSupportGrip: [0, 0.7, 0],
    actionLeftHandSupportGrip: [0, 0.48, 0],
    supportBlend: 0.56,
    scale: 1.15,
    sockets: {
      carry: {
        position: [0.14, -0.02, 0.02],
        rotation: [Math.PI, 0, -0.5],
      },
      action: {
        position: [0.14, -0.02, 0.02],
        rotation: [0, Math.PI / 2, -0.55],
      },
    },
    readability: {
      minScale: 0.9,
      maxScale: 1.3,
      minScreenFraction: 0.035,
      maxScreenFraction: 0.2,
    },
    locomotion: { runClip: 'runCarry', idleTime: 0.36 },
    actionClips: ['swordSlash'],
    interaction: {
      kind: 'tool', clip: 'swordSlash', target: 'tree_or_boulder', range: TOOL_RANGE + 0.6,
      facingHalfAngle: Math.PI * 0.55,
    },
    timings: { tool: TOOL_TIMING },
    feedback: { audio: 'tool', vfx: 'chop' },
    icon: { yaw: 0.55, pitch: 0.32, roll: -0.12, distance: 2.4, targetY: 0.3, orthographicScale: 1.35 },
    debug: { axisLength: 0.42, supportColor: 0xff9f43 },
  },
  bow_wooden: {
    modelKey: 'bow_wooden',
    modelForwardAxis: [0, 0, 1],
    modelUpAxis: [0, 1, 0],
    rightHandGrip: [0, 0, 0],
    scale: 0.76,
    sockets: {
      carry: {
        position: [0, -0.02, 0.03],
        rotation: [0, 0, -0.25],
      },
      action: {
        position: [0, -0.02, 0.03],
        rotation: [0, 0, -0.25],
      },
    },
    readability: {
      minScale: 0.62,
      maxScale: 0.9,
      minScreenFraction: 0.03,
      maxScreenFraction: 0.16,
    },
    locomotion: { runClip: 'walkCarry', idleTime: 0.3 },
    actionClips: ['shoot'],
    interaction: {
      kind: 'ranged', clip: 'shoot', target: 'ranged', range: null, facingHalfAngle: Math.PI,
    },
    timings: { ranged: RANGED_TIMING },
    feedback: { audio: 'shot', vfx: 'muzzle' },
    icon: { yaw: 0.4, pitch: 0.22, roll: 0.08, distance: 2.1, targetY: 0.34, orthographicScale: 1.2 },
    debug: { axisLength: 0.36, supportColor: 0xffd28a },
  },
  shotgun_2: {
    modelKey: 'shotgun_2',
    modelForwardAxis: [1, 0, 0],
    modelUpAxis: [0, 1, 0],
    rightHandGrip: [0, -0.28, 0],
    leftHandSupportGrip: [1.35, 0.08, 0],
    supportBlend: 0.58,
    scale: 0.42,
    sockets: {
      carry: {
        position: [0.1, 0, 0],
        rotation: [0, 0, 0.5],
      },
      action: {
        position: [0.1, 0, 0],
        rotation: [0, 0, Math.PI / 2],
      },
    },
    readability: {
      minScale: 0.34,
      maxScale: 0.52,
      minScreenFraction: 0.04,
      maxScreenFraction: 0.22,
    },
    locomotion: { runClip: 'runCarry', idleTime: 0.32 },
    actionClips: ['shoot'],
    interaction: {
      kind: 'ranged', clip: 'shoot', target: 'ranged', range: null, facingHalfAngle: Math.PI,
    },
    timings: { ranged: RANGED_TIMING },
    feedback: { audio: 'shot', vfx: 'muzzle' },
    icon: { yaw: 0.6, pitch: 0.26, roll: 0.04, distance: 2.6, targetY: 0.3, orthographicScale: 1.25 },
    debug: { axisLength: 0.38, supportColor: 0xffc25c },
  },
  shovel: {
    modelKey: 'shovel',
    modelForwardAxis: [0, 1, 0],
    modelUpAxis: [0, 0, 1],
    rightHandGrip: [0, 1.1, 0],
    leftHandSupportGrip: [0, 0.02, 0],
    actionLeftHandSupportGrip: [0, -0.12, 0],
    supportBlend: 0.68,
    scale: 1.1,
    sockets: {
      carry: {
        position: [0.1, -0.02, 0.02],
        rotation: [Math.PI, 0, 1.05],
      },
      action: {
        position: [0.1, -0.02, 0.02],
        rotation: [Math.PI, 0, 1.05],
      },
    },
    readability: {
      minScale: 0.88,
      maxScale: 1.2,
      minScreenFraction: 0.035,
      maxScreenFraction: 0.2,
    },
    locomotion: { runClip: 'runCarry', idleTime: 0.3 },
    actionClips: ['pickUp'],
    interaction: {
      kind: 'tool', clip: 'pickUp', target: 'farm_tile', range: TOOL_RANGE, facingHalfAngle: Math.PI * 0.7,
    },
    timings: { tool: TOOL_TIMING },
    feedback: { audio: 'tool', vfx: 'soil' },
    icon: { yaw: 0.5, pitch: 0.28, roll: -0.08, distance: 2.45, targetY: 0.35, orthographicScale: 1.35 },
    debug: { axisLength: 0.42, supportColor: 0xffd4a1 },
  },
  bucket: {
    modelKey: null,
    modelForwardAxis: [0, 0, 1],
    modelUpAxis: [0, 1, 0],
    rightHandGrip: [0, 0, 0],
    scale: 1,
    sockets: {
      carry: { position: [0, 0, 0], rotation: [0, 0, 0] },
      action: { position: [0.02, -0.02, 0.02], rotation: [0.65, 0.15, -0.12] },
    },
    readability: {
      minScale: 0.8,
      maxScale: 1.2,
      minScreenFraction: 0.025,
      maxScreenFraction: 0.12,
    },
    locomotion: { runClip: 'walkCarry', idleTime: 0.3 },
    actionClips: ['pickUp'],
    interaction: {
      kind: 'tool', clip: 'pickUp', target: 'water_or_crop', range: TOOL_RANGE, facingHalfAngle: Math.PI * 0.75,
    },
    timings: { tool: TOOL_TIMING },
    feedback: { audio: 'water', vfx: 'water' },
    icon: { yaw: 0.3, pitch: 0.2, roll: 0, distance: 2, targetY: 0.25, orthographicScale: 1 },
    debug: { axisLength: 0.3, supportColor: 0x69b8dc },
  },
  bear_trap: {
    modelKey: 'bear_trap_open',
    modelForwardAxis: [0, 0, 1],
    modelUpAxis: [0, 1, 0],
    rightHandGrip: [0, 0, 0],
    scale: 1,
    sockets: {
      carry: { position: [0, 0, 0], rotation: [0, 0, 0] },
      action: { position: [0, 0, 0], rotation: [0, 0, 0] },
    },
    readability: {
      minScale: 0.8,
      maxScale: 1.2,
      minScreenFraction: 0.02,
      maxScreenFraction: 0.12,
    },
    locomotion: { runClip: 'walkCarry', idleTime: 0.3 },
    actionClips: ['pickUp'],
    interaction: {
      kind: 'interact', clip: 'pickUp', target: 'trap_ground', range: BEAR_TRAP_PLACE_RANGE, facingHalfAngle: Math.PI * 0.75,
    },
    timings: { interact: INTERACT_TIMING },
    feedback: { audio: 'trap', vfx: 'trap' },
    icon: { yaw: 0.65, pitch: 0.4, roll: 0, distance: 2, targetY: 0.1, orthographicScale: 0.8 },
    debug: { axisLength: 0.25, supportColor: 0xd2a86a },
  },
  build_preview: {
    modelKey: null,
    modelForwardAxis: [0, 0, 1],
    modelUpAxis: [0, 1, 0],
    rightHandGrip: [0, 0, 0],
    scale: 1,
    sockets: {
      carry: { position: [0, 0, 0], rotation: [0, 0, 0] },
      action: { position: [0, 0, 0], rotation: [0, 0, 0] },
    },
    readability: {
      minScale: 0.8,
      maxScale: 1.2,
      minScreenFraction: 0.03,
      maxScreenFraction: 0.25,
    },
    locomotion: { runClip: 'walkCarry', idleTime: 0.3 },
    actionClips: ['pickUp'],
    interaction: {
      kind: 'interact', clip: 'pickUp', target: 'placement', range: BEAR_TRAP_PLACE_RANGE, facingHalfAngle: Math.PI * 0.75,
    },
    timings: { interact: INTERACT_TIMING },
    feedback: { audio: 'build', vfx: 'build' },
    icon: { yaw: 0.45, pitch: 0.3, roll: 0, distance: 2.5, targetY: 0.35, orthographicScale: 1.4 },
    debug: { axisLength: 0.3, supportColor: 0xf2c266 },
  },
};

export const EQUIPMENT_KEYS = Object.keys(EQUIPMENT_PROFILES) as EquipmentKey[];

function isFiniteAxis(axis: Axis): boolean {
  return axis.every((value) => Number.isFinite(value));
}

function isUnitAxis(axis: Axis): boolean {
  const length = Math.hypot(...axis);
  return Math.abs(length - 1) <= 0.01;
}

function isFiniteTransform(transform: SocketTransform): boolean {
  return isFiniteAxis(transform.position) && isFiniteAxis(transform.rotation);
}

/** Returns all data-contract failures so assetcheck and tests can identify the exact field. */
export function validateEquipmentProfiles(
  profiles: Readonly<Record<EquipmentKey, EquipmentProfile>> = EQUIPMENT_PROFILES,
): string[] {
  const problems: string[] = [];
  const modelKeySet = new Set<ModelKey>(MODEL_KEYS);
  for (const key of EQUIPMENT_KEYS) {
    const profile = profiles[key];
    if (!profile) {
      problems.push(`${key}: missing profile`);
      continue;
    }
    if (profile.modelKey !== null && !modelKeySet.has(profile.modelKey)) {
      problems.push(`${key}: unknown model key ${profile.modelKey}`);
    }
    if (!isFiniteAxis(profile.modelForwardAxis) || !isUnitAxis(profile.modelForwardAxis)) {
      problems.push(`${key}: modelForwardAxis must be a finite unit vector`);
    }
    if (!isFiniteAxis(profile.modelUpAxis) || !isUnitAxis(profile.modelUpAxis)) {
      problems.push(`${key}: modelUpAxis must be a finite unit vector`);
    }
    if (!isFiniteAxis(profile.rightHandGrip)) problems.push(`${key}: rightHandGrip is not finite`);
    if (profile.leftHandSupportGrip && !isFiniteAxis(profile.leftHandSupportGrip)) {
      problems.push(`${key}: leftHandSupportGrip is not finite`);
    }
    if (profile.actionLeftHandSupportGrip && !isFiniteAxis(profile.actionLeftHandSupportGrip)) {
      problems.push(`${key}: actionLeftHandSupportGrip is not finite`);
    }
    if (profile.supportBlend !== undefined && (profile.supportBlend < 0 || profile.supportBlend > 1)) {
      problems.push(`${key}: supportBlend must be between 0 and 1`);
    }
    if (!Number.isFinite(profile.scale) || profile.scale <= 0) problems.push(`${key}: scale must be positive`);
    if (!isFiniteTransform(profile.sockets.carry)) problems.push(`${key}: carry socket is not finite`);
    if (!isFiniteTransform(profile.sockets.action)) problems.push(`${key}: action socket is not finite`);
    if (
      !Number.isFinite(profile.readability.minScale) ||
      !Number.isFinite(profile.readability.maxScale) ||
      profile.readability.minScale <= 0 ||
      profile.readability.maxScale < profile.readability.minScale
    ) problems.push(`${key}: invalid readability scale range`);
    if (
      !Number.isFinite(profile.readability.minScreenFraction) ||
      !Number.isFinite(profile.readability.maxScreenFraction) ||
      profile.readability.minScreenFraction <= 0 ||
      profile.readability.maxScreenFraction < profile.readability.minScreenFraction
    ) problems.push(`${key}: invalid readability screen range`);
    if (
      !Number.isFinite(profile.locomotion.idleTime) ||
      profile.locomotion.idleTime < 0 ||
      profile.locomotion.idleTime > 1
    ) problems.push(`${key}: idleTime must be in the 0..1 clip range`);
    if (profile.actionClips.length === 0) problems.push(`${key}: no compatible action clip`);
    if (!profile.actionClips.includes(profile.interaction.clip)) {
      problems.push(`${key}: interaction clip is not listed in actionClips`);
    }
    if (
      (profile.interaction.range !== null &&
        (!Number.isFinite(profile.interaction.range) || profile.interaction.range <= 0)) ||
      !Number.isFinite(profile.interaction.facingHalfAngle) ||
      profile.interaction.facingHalfAngle <= 0 ||
      profile.interaction.facingHalfAngle > Math.PI
    ) problems.push(`${key}: invalid interaction targeting bounds`);
    for (const [kind, timing] of Object.entries(profile.timings)) {
      if (!timing) {
        problems.push(`${key}: ${kind} timing is missing`);
        continue;
      }
      if ([timing.windup, timing.contact, timing.recover].some((value) => !Number.isFinite(value) || value < 0)) {
        problems.push(`${key}: ${kind} timing contains a negative or non-finite duration`);
      }
    }
    if (
      !Number.isFinite(profile.icon.distance) ||
      profile.icon.distance <= 0 ||
      !Number.isFinite(profile.icon.orthographicScale) ||
      profile.icon.orthographicScale <= 0
    ) problems.push(`${key}: invalid icon camera framing`);
    if (!Number.isFinite(profile.debug.axisLength) || profile.debug.axisLength <= 0) {
      problems.push(`${key}: invalid debug axis length`);
    }
  }
  return problems;
}

export function equipmentTimingFor(
  key: EquipmentKey,
  action: EquipmentActionKind,
): EquipmentActionTiming | null {
  return EQUIPMENT_PROFILES[key].timings[action] ?? null;
}

export function equipmentActionClipFor(key: EquipmentKey): EquipmentActionClip {
  return EQUIPMENT_PROFILES[key].interaction.clip;
}
