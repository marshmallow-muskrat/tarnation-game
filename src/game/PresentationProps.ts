import * as THREE from 'three';
import type { AuthoredVisual } from '../content/purchasables';
import { standardMaterial } from './materials';

export type CampFixtureVisual = Exclude<AuthoredVisual, 'bucket'>;

function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
): THREE.Mesh {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function buildCaravan(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'authored_caravan';
  const wood = standardMaterial(0x9a6b42, { flatShading: true, roughness: 0.9 });
  const woodDark = standardMaterial(0x62422b, { flatShading: true, roughness: 0.92 });
  const canvas = standardMaterial(0xd8c39e, { flatShading: true, roughness: 0.9 });
  const red = standardMaterial(0xb9503f, { flatShading: true, roughness: 0.88 });

  root.add(mesh(new THREE.BoxGeometry(2.45, 0.72, 1.35), wood, 'caravan_body'));
  const roof = mesh(new THREE.BoxGeometry(2.7, 0.12, 1.6), canvas, 'caravan_canopy');
  roof.position.y = 1.72;
  root.add(roof);

  for (const x of [-1.12, 1.12]) {
    for (const z of [-0.67, 0.67]) {
      const post = mesh(new THREE.BoxGeometry(0.1, 1.65, 0.1), woodDark, 'caravan_post');
      post.position.set(x, 0.88, z);
      root.add(post);
    }
  }

  for (const x of [-0.85, 0.85]) {
    for (const z of [-0.68, 0.68]) {
      const wheel = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.12, 12), red, 'caravan_wheel');
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(x, 0.25, z);
      root.add(wheel);
    }
  }

  const hitch = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), woodDark, 'caravan_hitch');
  hitch.position.set(1.35, 0.28, 0);
  root.add(hitch);
  return root;
}

function buildBarrel(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'authored_barrel';
  const wood = standardMaterial(0x8a5b34, { flatShading: true, roughness: 0.92 });
  const bands = standardMaterial(0x3f3025, { flatShading: true, roughness: 0.85, metalness: 0.08 });
  const top = standardMaterial(0xa87543, { flatShading: true, roughness: 0.9 });

  root.add(mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.78, 12), wood, 'barrel_body'));
  const lid = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.035, 12), top, 'barrel_lid');
  lid.position.y = 0.41;
  root.add(lid);
  for (const y of [0.16, 0.61]) {
    const band = mesh(new THREE.TorusGeometry(0.36, 0.025, 6, 16), bands, 'barrel_band');
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    root.add(band);
  }
  return root;
}

function buildHaystack(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'authored_haystack';
  const straw = standardMaterial(0xc5a34b, { flatShading: true, roughness: 0.96 });
  const strawLight = standardMaterial(0xe0c765, { flatShading: true, roughness: 0.96 });
  const tie = standardMaterial(0x76532e, { flatShading: true, roughness: 0.92 });

  root.add(mesh(new THREE.CylinderGeometry(0.44, 0.48, 0.22, 10), straw, 'haystack_base'));
  const mound = mesh(new THREE.ConeGeometry(0.47, 0.72, 10), strawLight, 'haystack_mound');
  mound.position.y = 0.46;
  root.add(mound);
  const band = mesh(new THREE.TorusGeometry(0.43, 0.035, 6, 12), tie, 'haystack_tie');
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.42;
  root.add(band);
  return root;
}

/** The accepted packs have no bucket mesh, so this is an intentional authored prop. */
function buildBucket(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'bucket_authored_prop';
  const body = mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.24, 8, 1, true),
    standardMaterial(0x57717a, { roughness: 0.72, metalness: 0.12 }),
    'bucket_body',
  );
  body.position.y = -0.12;
  root.add(body);

  const rim = mesh(
    new THREE.TorusGeometry(0.18, 0.018, 6, 16),
    standardMaterial(0xb9c8c0, { roughness: 0.42, metalness: 0.3 }),
    'bucket_rim',
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.01;
  root.add(rim);

  const handle = mesh(
    new THREE.TorusGeometry(0.17, 0.014, 5, 14, Math.PI),
    standardMaterial(0xc4a36a, { roughness: 0.6, metalness: 0.05 }),
    'bucket_handle',
  );
  handle.rotation.x = Math.PI / 2;
  handle.rotation.z = Math.PI;
  handle.position.y = 0.04;
  root.add(handle);
  return root;
}

/** Build one of the authored, non-pack presentation props without shared cache ownership. */
export function buildAuthoredVisual(visual: AuthoredVisual): THREE.Group {
  switch (visual) {
    case 'bucket': return buildBucket();
    case 'caravan': return buildCaravan();
    case 'barrel': return buildBarrel();
    case 'haystack': return buildHaystack();
  }
}

export function buildCampFixture(visual: CampFixtureVisual | undefined): THREE.Group | null {
  if (!visual) return null;
  return buildAuthoredVisual(visual);
}
