import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { assetDefinition } from '../src/content/purchasables';
import { buildAuthoredVisual, buildCampFixture } from '../src/game/PresentationProps';
import { disposeObjectResources } from '../src/game/ResourceDisposal';

const CAMP_FOOTPRINTS = {
  caravan: { width: 3, depth: 2 },
  barrel: { width: 1, depth: 1 },
  haystack: { width: 1, depth: 1 },
} as const;

describe('authored presentation props', () => {
  it('builds a distinct visible silhouette for every authored camp fixture', () => {
    for (const visual of Object.keys(CAMP_FOOTPRINTS) as (keyof typeof CAMP_FOOTPRINTS)[]) {
      const root = buildCampFixture(visual);
      expect(root, `${visual} root`).not.toBeNull();
      if (!root) continue;
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root);
      const size = bounds.getSize(new THREE.Vector3());
      const meshNames: string[] = [];
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) meshNames.push(object.name);
      });

      expect(root.name, `${visual} name`).toBe(`authored_${visual}`);
      expect(meshNames.length, `${visual} mesh count`).toBeGreaterThan(1);
      expect(size.x, `${visual} width`).toBeLessThanOrEqual(CAMP_FOOTPRINTS[visual].width + 0.05);
      expect(size.z, `${visual} depth`).toBeLessThanOrEqual(CAMP_FOOTPRINTS[visual].depth + 0.05);
      expect(size.y, `${visual} height`).toBeGreaterThan(0.2);
      disposeObjectResources(root, { geometries: true, materials: true, textures: true });
    }
  });

  it('keeps the bucket as the same authored held prop rather than a backpack substitute', () => {
    const root = buildAuthoredVisual('bucket');
    root.updateMatrixWorld(true);
    const names: string[] = [];
    root.traverse((object) => {
      if (object instanceof THREE.Mesh) names.push(object.name);
    });

    expect(root.name).toBe('bucket_authored_prop');
    expect(names).toEqual(expect.arrayContaining(['bucket_body', 'bucket_rim', 'bucket_handle']));
    expect(assetDefinition('tool:bucket')?.modelKey).toBeNull();
    disposeObjectResources(root, { geometries: true, materials: true, textures: true });
  });

  it('leaves the crate and coin sack on honest accepted item models', () => {
    expect(assetDefinition('fixture:crate')?.modelKey).toBe('chest_closed');
    expect(assetDefinition('fixture:coin-sack')?.modelKey).toBe('pouch');
  });
});
