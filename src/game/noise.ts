/** Seeded value noise helpers for terrain / scatter (no Math.random). */

export function hash2(x: number, z: number, seed = 0): number {
  let n = (Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ seed) >>> 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Bilinear value noise, cell size in world units. */
export function valueNoise2D(x: number, z: number, cell: number, seed: number): number {
  const sx = x / cell;
  const sz = z / cell;
  const x0 = Math.floor(sx);
  const z0 = Math.floor(sz);
  const fx = sx - x0;
  const fz = sz - z0;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/** Layered noise 0..1 */
export function fbm2D(x: number, z: number, seed: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < 4; i++) {
    sum += amp * valueNoise2D(x * freq, z * freq, 28, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/** Low-frequency field for tree clumping (0..1). */
export function treeGroveNoise(x: number, z: number, seed: number): number {
  return valueNoise2D(x, z, 42, seed ^ 0x7ee5);
}
