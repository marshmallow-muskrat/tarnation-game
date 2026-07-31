import * as THREE from 'three';
import { hash2 } from './noise';

/**
 * Tilled ground used to be one box per tile, so a worked field read as a grid of
 * identical squares. These are five hand-shaped dirt patches — lobed, irregular,
 * none of them square — picked per tile so no two neighbours match.
 */

export const DIRT_VARIANTS = 5;

const THICKNESS = 0.18;

/** Radial profile per variant: [base radius, harmonics as (freq, amp, phase)]. */
const PROFILES: { radius: number; lobes: [number, number, number][] }[] = [
  // 0 — wide oval with a bitten-out side
  { radius: 0.54, lobes: [[1, 0.1, 0.4], [3, 0.07, 1.1], [5, 0.03, 0.2]] },
  // 1 — teardrop
  { radius: 0.5, lobes: [[1, 0.16, 2.2], [2, 0.06, 0.5]] },
  // 2 — clover-ish, three soft lobes
  { radius: 0.49, lobes: [[3, 0.13, 0.9], [6, 0.04, 0.3]] },
  // 3 — long, raked furrow patch
  { radius: 0.52, lobes: [[2, 0.17, 0.0], [4, 0.05, 1.7]] },
  // 4 — ragged, many small bites
  { radius: 0.51, lobes: [[5, 0.09, 1.3], [7, 0.05, 0.6], [2, 0.06, 2.6]] },
];

function buildShape(variant: number): THREE.Shape {
  const p = PROFILES[variant % PROFILES.length]!;
  const segs = 40;
  const shape = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let r = p.radius;
    for (const [freq, amp, phase] of p.lobes) {
      r += Math.sin(a * freq + phase) * amp;
    }
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

/** Five flat-topped dirt slabs, centred on the origin like the box they replace. */
export function buildDirtGeometries(): THREE.BufferGeometry[] {
  const geos: THREE.BufferGeometry[] = [];
  for (let v = 0; v < DIRT_VARIANTS; v++) {
    const geo = new THREE.ExtrudeGeometry(buildShape(v), {
      depth: THICKNESS,
      bevelEnabled: false,
      curveSegments: 4,
    });
    // Extrusion runs along +Z; lay it flat so it grows along +Y, then centre it.
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -THICKNESS / 2, 0);
    geo.computeVertexNormals();
    geos.push(geo);
  }
  return geos;
}

/** Which of the five patches this tile uses — stable, so it never flickers. */
export function dirtVariant(tx: number, ty: number): number {
  return Math.floor(hash2(tx, ty, 0x6d17) * DIRT_VARIANTS) % DIRT_VARIANTS;
}

/** Quarter-turn yaw per tile, on top of the shape choice. */
export function dirtYaw(tx: number, ty: number): number {
  return Math.floor(hash2(tx, ty, 0x9a3f) * 4) * (Math.PI / 2);
}
