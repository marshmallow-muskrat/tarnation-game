import { shortestHeadingDelta } from './Locomotion';

export type AxeTarget = 'tree' | 'stump' | 'boulder' | 'none';
export type MeleeTargetKind = 'hostile' | 'friendly';
export type MeleeEffect = 'damage' | 'daze';
export type MeleeCandidate<T> = Readonly<{
  kind: MeleeTargetKind;
  target: T;
  x: number;
  z: number;
}>;

/** Combat has a narrower, explicit cone than a radial work-area check. */
export const MELEE_FACING_HALF_ANGLE = Math.PI * 0.42;

export function meleeEffectForTarget(kind: MeleeTargetKind): MeleeEffect {
  return kind === 'friendly' ? 'daze' : 'damage';
}

export function headingToTarget(
  fromX: number,
  fromZ: number,
  targetX: number,
  targetZ: number,
): number {
  return Math.atan2(targetX - fromX, targetZ - fromZ);
}

export function isWithinFacingArc(
  heading: number,
  targetHeading: number,
  halfAngle: number,
): boolean {
  return Math.abs(shortestHeadingDelta(heading, targetHeading)) <= Math.max(0, halfAngle);
}

export function isWithinMeleeContact(
  fromX: number,
  fromZ: number,
  targetX: number,
  targetZ: number,
  heading: number,
  range: number,
  halfAngle: number,
): boolean {
  if (Math.hypot(targetX - fromX, targetZ - fromZ) > Math.max(0, range)) return false;
  return isWithinFacingArc(heading, headingToTarget(fromX, fromZ, targetX, targetZ), halfAngle);
}

/** A fixed grid line prevents a tool or melee contact from reaching through a solid footprint. */
export function isMeleeContactObstructed(
  fromX: number,
  fromZ: number,
  targetX: number,
  targetZ: number,
  blockedTiles: ReadonlySet<string>,
): boolean {
  const distance = Math.hypot(targetX - fromX, targetZ - fromZ);
  const steps = Math.max(1, Math.ceil(distance * 4));
  const originKey = `${Math.floor(fromX)},${Math.floor(fromZ)}`;
  for (let step = 1; step < steps; step++) {
    const progress = step / steps;
    const key = `${Math.floor(fromX + (targetX - fromX) * progress)},${Math.floor(fromZ + (targetZ - fromZ) * progress)}`;
    if (key !== originKey && blockedTiles.has(key)) return true;
  }
  return false;
}

/** Select one intended target before an action starts; ties preserve candidate order. */
export function selectMeleeCandidate<T>(
  fromX: number,
  fromZ: number,
  heading: number,
  range: number,
  halfAngle: number,
  candidates: readonly MeleeCandidate<T>[],
): MeleeCandidate<T> | null {
  let selected: MeleeCandidate<T> | null = null;
  let selectedDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.hypot(candidate.x - fromX, candidate.z - fromZ);
    if (distance >= selectedDistance) continue;
    if (!isWithinMeleeContact(fromX, fromZ, candidate.x, candidate.z, heading, range, halfAngle)) continue;
    selected = candidate;
    selectedDistance = distance;
  }
  return selected;
}

export function classifyAxeTarget(target: {
  tree: boolean;
  stump: boolean;
  boulder: boolean;
}): AxeTarget {
  if (target.tree) return 'tree';
  if (target.stump) return 'stump';
  if (target.boulder) return 'boulder';
  return 'none';
}
