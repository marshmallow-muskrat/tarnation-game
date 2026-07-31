import * as THREE from 'three';

/** Shared material helper — every world object uses this profile (v4 §0). */
export function standardMaterial(
  color: number,
  opts: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0.04,
    ...opts,
  });
}

export function waterMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x2e6e72,
    roughness: 0.18,
    metalness: 0.32,
    transparent: true,
    opacity: 0.86,
  });
}
