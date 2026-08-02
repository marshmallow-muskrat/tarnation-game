import { shortestHeadingDelta } from './Locomotion';

export type AxeTarget = 'tree' | 'stump' | 'boulder' | 'none';

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
