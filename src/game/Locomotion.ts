export type LocomotionMode = 'idle' | 'walk' | 'run';
export type LocomotionClip = 'idle' | 'walk' | 'run' | 'walkCarry' | 'runCarry';

export type CarryProfileLike = Readonly<{
  runClip: 'walkCarry' | 'runCarry';
}>;

/** Hysteresis keeps animation from chattering at acceleration and stop boundaries. */
export const LOCOMOTION_THRESHOLDS = {
  start: 0.07,
  stop: 0.04,
  runEnter: 0.72,
  runExit: 0.62,
} as const;

/** Renderer-facing gait tuning for the in-place clips in the player glTF. */
export const LOCOMOTION_GAIT = {
  walkSpeedRatio: 0.72,
  minTimeScale: 0,
  maxTimeScale: 1.18,
  turnRate: 8.5,
  transitionSeconds: 0.14,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Return a heading in the canonical [-π, π) range. */
export function normalizeHeading(angle: number): number {
  const wrapped = (angle + Math.PI) % (Math.PI * 2);
  return (wrapped < 0 ? wrapped + Math.PI * 2 : wrapped) - Math.PI;
}

/** Shortest signed angular difference from one heading to another. */
export function shortestHeadingDelta(from: number, to: number): number {
  return normalizeHeading(to - from);
}

/** Advance a heading by at most maxDelta radians per call. */
export function approachHeading(current: number, target: number, maxDelta: number): number {
  const delta = shortestHeadingDelta(current, target);
  if (Math.abs(delta) <= Math.max(0, maxDelta)) return normalizeHeading(target);
  return normalizeHeading(current + Math.sign(delta) * Math.max(0, maxDelta));
}

/** Choose idle/walk/run with intent-aware start/stop and run hysteresis. */
export function locomotionModeFor(
  movingIntent: boolean,
  speed: number,
  currentMode: LocomotionMode,
  playerSpeed: number,
): LocomotionMode {
  const safeSpeed = Math.max(0, speed);
  const startSpeed = playerSpeed * LOCOMOTION_THRESHOLDS.start;
  const stopSpeed = playerSpeed * LOCOMOTION_THRESHOLDS.stop;
  const runEnterSpeed = playerSpeed * LOCOMOTION_THRESHOLDS.runEnter;
  const runExitSpeed = playerSpeed * LOCOMOTION_THRESHOLDS.runExit;

  if (safeSpeed <= stopSpeed) return 'idle';
  if (currentMode === 'idle') {
    if (!movingIntent || safeSpeed < startSpeed) return 'idle';
    return safeSpeed >= runEnterSpeed ? 'run' : 'walk';
  }
  if (currentMode === 'run') return safeSpeed < runExitSpeed ? 'walk' : 'run';
  return safeSpeed >= runEnterSpeed ? 'run' : 'walk';
}

export function locomotionClipFor(
  mode: LocomotionMode,
  carryProfile: CarryProfileLike | null,
): LocomotionClip {
  if (mode === 'idle') return carryProfile ? 'walkCarry' : 'idle';
  if (mode === 'run') {
    if (!carryProfile) return 'run';
    return carryProfile.runClip;
  }
  return carryProfile ? 'walkCarry' : 'walk';
}

/** Match in-place clip cadence to the current planar player speed. */
export function locomotionTimeScale(
  clip: LocomotionClip,
  speed: number,
  playerSpeed: number,
): number {
  if (clip === 'idle') return 1;
  const nominalSpeed = clip === 'run' || clip === 'runCarry'
    ? playerSpeed
    : playerSpeed * LOCOMOTION_GAIT.walkSpeedRatio;
  return clamp(
    Math.max(0, speed) / Math.max(0.001, nominalSpeed),
    LOCOMOTION_GAIT.minTimeScale,
    LOCOMOTION_GAIT.maxTimeScale,
  );
}
