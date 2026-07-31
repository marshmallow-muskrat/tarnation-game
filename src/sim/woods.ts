/**
 * Woods depth + Attention — pure.
 */
import {
  ATTENTION_CHOP,
  ATTENTION_GUN,
  ATTENTION_BOW,
  ATTENTION_IDLE_DECAY,
  ATTENTION_MAX,
  ATTENTION_TIME_DEEP,
  ATTENTION_TIME_FRINGE,
  ATTENTION_TIME_THICKET,
  WOODS_H,
} from '../content';

export type WoodsDepth = 'fringe' | 'thicket' | 'deepwood';

/** Depth from Z: south (exit) = fringe, north = deepwood */
export function depthAt(z: number): WoodsDepth {
  const t = z / WOODS_H;
  if (t > 0.55) return 'fringe';
  if (t > 0.28) return 'thicket';
  return 'deepwood';
}

export function woodYieldForDepth(d: WoodsDepth): { wood: number; darkwood: number } {
  switch (d) {
    case 'fringe':
      return { wood: 1, darkwood: 0 };
    case 'thicket':
      return { wood: 1, darkwood: 1 };
    case 'deepwood':
      return { wood: 0, darkwood: 2 };
  }
}

export function stepAttention(
  attention: number,
  dt: number,
  opts: {
    depth: WoodsDepth;
    moving: boolean;
    floor: number;
  },
): number {
  let a = attention;
  const timeRate =
    opts.depth === 'fringe'
      ? ATTENTION_TIME_FRINGE
      : opts.depth === 'thicket'
        ? ATTENTION_TIME_THICKET
        : ATTENTION_TIME_DEEP;
  a += timeRate * dt;
  if (!opts.moving) {
    a -= ATTENTION_IDLE_DECAY * dt;
  }
  a = Math.max(opts.floor, Math.min(ATTENTION_MAX, a));
  return a;
}

export function attentionOnChop(attention: number, floor: number): { attention: number; floor: number } {
  return {
    attention: Math.min(ATTENTION_MAX, attention + ATTENTION_CHOP),
    floor: Math.min(ATTENTION_MAX * 0.6, floor + 1.5),
  };
}

export function attentionOnShot(attention: number, silent: boolean): number {
  return Math.min(ATTENTION_MAX, attention + (silent ? ATTENTION_BOW : ATTENTION_GUN));
}

export function woodsmanShouldHunt(attention: number, depth: WoodsDepth): boolean {
  if (depth === 'fringe') return false;
  if (depth === 'thicket') return attention > 55;
  return attention > 35;
}
