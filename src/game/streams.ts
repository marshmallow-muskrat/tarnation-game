import * as THREE from 'three';
import { WORLD_SIZE } from '../content';

/**
 * Flowing water — the main river plus its creeks.
 *
 * Each stream is baked down to a polyline once and indexed into a coarse bucket
 * grid. Terrain carving asks "how close is the nearest channel" for all 58k
 * terrain vertices, and doing that against a Catmull-Rom curve (which allocates a
 * Vector3 per sample) was already the slowest part of world build with one river.
 * With four it has to be a lookup, not a search.
 */

export interface StreamSpec {
  points: THREE.Vector3[];
  /** Half-width in world units along the stream, t in 0..1. */
  widthAt: (t: number) => number;
  /** Longitudinal texture repeats — long streams need more. */
  uvScale: number;
}

export interface StreamHit {
  /** Distance from the centreline. */
  dist: number;
  /** Position along the stream, 0..1. */
  t: number;
  /** Full channel width there. */
  width: number;
  /** Index of the stream that matched. */
  stream: number;
}

const BUCKET = 8;
const GRID = Math.ceil(WORLD_SIZE / BUCKET) + 2;
/** Nothing beyond this influences terrain, so the buckets need no more reach. */
const MAX_REACH = 14;

type Segment = {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  t: number;
  width: number;
  stream: number;
};

function bucketIndex(x: number, z: number): number {
  const bx = Math.min(GRID - 1, Math.max(0, Math.floor(x / BUCKET) + 1));
  const bz = Math.min(GRID - 1, Math.max(0, Math.floor(z / BUCKET) + 1));
  return bz * GRID + bx;
}

export class StreamField {
  readonly curves: THREE.CatmullRomCurve3[] = [];
  readonly specs: StreamSpec[];
  private readonly buckets: Segment[][] = [];

  constructor(specs: StreamSpec[], samplesPer = 220) {
    this.specs = specs;
    for (let i = 0; i < GRID * GRID; i++) this.buckets.push([]);

    specs.forEach((spec, streamIndex) => {
      const curve = new THREE.CatmullRomCurve3(spec.points, false, 'catmullrom', 0.35);
      this.curves.push(curve);
      let prev = curve.getPoint(0);
      for (let i = 1; i <= samplesPer; i++) {
        const t = i / samplesPer;
        const p = curve.getPoint(t);
        const seg: Segment = {
          x0: prev.x,
          z0: prev.z,
          x1: p.x,
          z1: p.z,
          t,
          width: spec.widthAt(t),
          stream: streamIndex,
        };
        this.insert(seg);
        prev = p;
      }
    });
  }

  private insert(seg: Segment): void {
    const reach = MAX_REACH;
    const minX = Math.min(seg.x0, seg.x1) - reach;
    const maxX = Math.max(seg.x0, seg.x1) + reach;
    const minZ = Math.min(seg.z0, seg.z1) - reach;
    const maxZ = Math.max(seg.z0, seg.z1) + reach;
    for (let z = minZ; z <= maxZ + BUCKET; z += BUCKET) {
      for (let x = minX; x <= maxX + BUCKET; x += BUCKET) {
        const b = this.buckets[bucketIndex(x, z)];
        if (b && !b.includes(seg)) b.push(seg);
      }
    }
  }

  /** Nearest channel centreline, or null if nothing is within MAX_REACH. */
  nearest(x: number, z: number): StreamHit | null {
    const candidates = this.buckets[bucketIndex(x, z)];
    if (!candidates || candidates.length === 0) return null;
    let best: StreamHit | null = null;
    let bestD = MAX_REACH;
    for (const seg of candidates) {
      const dx = seg.x1 - seg.x0;
      const dz = seg.z1 - seg.z0;
      const len2 = dx * dx + dz * dz;
      let u = len2 > 0 ? ((x - seg.x0) * dx + (z - seg.z0) * dz) / len2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const px = seg.x0 + dx * u;
      const pz = seg.z0 + dz * u;
      const d = Math.hypot(x - px, z - pz);
      if (d < bestD) {
        bestD = d;
        best = { dist: d, t: seg.t, width: seg.width, stream: seg.stream };
      }
    }
    return best;
  }

  /** Signed-ish distance to open water: negative means you're in the channel. */
  distToWater(x: number, z: number): number {
    const hit = this.nearest(x, z);
    if (!hit) return MAX_REACH;
    return hit.dist - hit.width * 0.45;
  }

  point(stream: number, t: number): THREE.Vector3 {
    return this.curves[stream]!.getPoint(t);
  }

  tangent(stream: number, t: number): THREE.Vector3 {
    return this.curves[stream]!.getTangent(t).normalize();
  }
}

/**
 * The main river plus three creeks that branch off it, so water reaches the
 * north, the south-west and the south-east instead of only the middle band.
 */
export function buildStreamSpecs(
  lakeCx: number,
  lakeCz: number,
  meander: (x: number, z: number, salt: number) => number,
): StreamSpec[] {
  const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

  const riverRaw = [
    v(-4, 70),
    v(30, 78),
    v(55, 92),
    v(80, 88),
    v(105, 75),
    v(125, 82),
    v(145, 95),
    v(155, 100),
    v(lakeCx - 8, lakeCz + 2),
    v(lakeCx, lakeCz),
  ];

  // Wobble the interior control points so the channel isn't a drawn arc.
  const river: THREE.Vector3[] = riverRaw.map((p, i) => {
    if (i === 0 || i === riverRaw.length - 1) return p.clone();
    const prev = riverRaw[i - 1]!;
    const next = riverRaw[i + 1]!;
    const dx = next.x - prev.x;
    const dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    const n = meander(p.x, p.z, 0x51);
    const amp = 10 + meander(p.x + 40, p.z - 20, 0x99) * 4;
    return v(p.x + (-dz / len) * n * amp, p.z + (dx / len) * n * amp);
  });

  const creeks: THREE.Vector3[][] = [
    // North creek — leaves the river near the west and runs to the top edge.
    [v(52, 90), v(48, 70), v(54, 52), v(46, 32), v(50, 10), v(48, -4)],
    // South-west creek — down through the bottom-left quarter.
    [v(72, 89), v(66, 108), v(72, 130), v(60, 152), v(64, 176), v(52, 200)],
    // South-east creek — feeds the lower right, well away from the others.
    [v(126, 82), v(138, 104), v(132, 128), v(146, 150), v(140, 176), v(150, 202)],
    // North-east creek — reaches the top-right so no quarter is dry.
    [v(146, 96), v(160, 78), v(158, 56), v(172, 36), v(168, 12)],
  ];

  const wiggle = (pts: THREE.Vector3[], salt: number): THREE.Vector3[] =>
    pts.map((p, i) =>
      i === 0 ? p.clone() : v(p.x + meander(p.x, p.z, salt) * 5, p.z + meander(p.z, p.x, salt ^ 7) * 5),
    );

  return [
    { points: river, widthAt: (t) => 3 + 4 * (0.5 + 0.5 * Math.sin(t * Math.PI * 2.3)), uvScale: 8 },
    ...creeks.map((pts, i) => ({
      points: wiggle(pts, 0x200 + i * 37),
      // Creeks are narrow — 1.4 to 2.4 units, tapering as they run out.
      widthAt: (t: number) => 2.4 - t * 1.0,
      uvScale: 5,
    })),
  ];
}
