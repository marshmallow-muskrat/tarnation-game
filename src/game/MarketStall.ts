import * as THREE from 'three';
import { standardMaterial } from './materials';

/**
 * The market stall — a plank counter under a striped awning. Built procedurally
 * rather than loaded, so it needs no art drop and always matches the palette.
 */
export function buildMarketStall(): THREE.Group {
  const g = new THREE.Group();

  const wood = standardMaterial(0x9a6b42, { flatShading: true, roughness: 0.9 });
  const woodDark = standardMaterial(0x6f4a2c, { flatShading: true, roughness: 0.92 });
  const cream = standardMaterial(0xf0e3c8, { flatShading: true, roughness: 0.85 });
  const red = standardMaterial(0xc0503f, { flatShading: true, roughness: 0.85 });

  // Counter
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.9), wood);
  counter.position.set(0, 0.45, 0);
  g.add(counter);

  const top = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 1.1), cream);
  top.position.set(0, 0.96, 0);
  g.add(top);

  // Corner posts
  for (const sx of [-1.3, 1.3]) {
    for (const sz of [-0.45, 0.45]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.1, 0.12), woodDark);
      post.position.set(sx, 1.05, sz);
      g.add(post);
    }
  }

  // Striped awning — alternating slats on a slight pitch
  const slats = 9;
  for (let i = 0; i < slats; i++) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(2.9 / slats, 0.1, 1.5),
      i % 2 === 0 ? red : cream,
    );
    slat.position.set(-1.45 + (i + 0.5) * (2.9 / slats), 2.18, 0.1);
    slat.rotation.x = -0.22;
    g.add(slat);
  }

  // Sign board
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.08), cream);
  sign.position.set(0, 2.6, -0.35);
  g.add(sign);
  const signEdge = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.1, 0.1), woodDark);
  signEdge.position.set(0, 2.36, -0.35);
  g.add(signEdge);

  // Crates on the counter
  for (const [x, s] of [
    [-0.85, 0.34],
    [0.75, 0.28],
  ] as const) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s * 2, s * 1.4, s * 1.6), woodDark);
    crate.position.set(x, 1.02 + s * 0.7, 0.05);
    crate.rotation.y = x > 0 ? 0.3 : -0.2;
    g.add(crate);
  }

  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
