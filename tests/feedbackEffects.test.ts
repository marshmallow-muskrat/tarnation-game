import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  FeedbackEffectPool,
  MAX_FEEDBACK_EFFECTS,
} from '../src/game/FeedbackEffects';

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}

function particlePositions(root: THREE.Object3D): number[][] {
  return root.children.map((child) => [child.position.x, child.position.y, child.position.z]);
}

describe('pooled transient feedback effects', () => {
  it('does not attach or randomize a burst when reduced motion is enabled', () => {
    const pool = new FeedbackEffectPool();
    const parent = new THREE.Group();
    let randomCalls = 0;
    pool.spawn(parent, () => 2, 4, 5, 'reward', () => {
      randomCalls++;
      return 0.5;
    }, true);

    expect(parent.children).toHaveLength(0);
    expect(pool.activeCount).toBe(0);
    expect(randomCalls).toBe(0);
    pool.dispose();
  });

  it('reuses a fixed slot and its resources after a burst expires', () => {
    const pool = new FeedbackEffectPool();
    const parent = new THREE.Group();
    pool.spawn(parent, () => 2, 4, 5, 'work-contact', seededRandom(7), false);
    const firstRoot = parent.children[0]!;
    const firstGeometry = (firstRoot.children[0] as THREE.Mesh).geometry;
    const firstMaterial = (firstRoot.children[0] as THREE.Mesh).material;

    pool.update(1);
    expect(parent.children).toHaveLength(0);
    expect(pool.activeCount).toBe(0);

    pool.spawn(parent, () => 2, 4, 5, 'water', seededRandom(7), false);
    const secondRoot = parent.children[0]!;
    const secondMesh = secondRoot.children[0] as THREE.Mesh;
    expect(secondRoot).toBe(firstRoot);
    expect(secondMesh.geometry).toBe(firstGeometry);
    expect(secondMesh.material).toBe(firstMaterial);
    expect(pool.poolSize).toBe(MAX_FEEDBACK_EFFECTS);
    pool.dispose();
  });

  it('keeps seeded particle placement deterministic without consuming simulation randomness', () => {
    const firstPool = new FeedbackEffectPool();
    const secondPool = new FeedbackEffectPool();
    const firstParent = new THREE.Group();
    const secondParent = new THREE.Group();
    firstPool.spawn(firstParent, () => 0, 1, 2, 'discovery', seededRandom(1234), false);
    secondPool.spawn(secondParent, () => 0, 1, 2, 'discovery', seededRandom(1234), false);

    expect(particlePositions(firstParent.children[0]!)).toEqual(
      particlePositions(secondParent.children[0]!),
    );
    firstPool.dispose();
    secondPool.dispose();
  });

  it('recycles the oldest active slot instead of allocating beyond the fixed pool', () => {
    const pool = new FeedbackEffectPool();
    const parent = new THREE.Group();
    for (let i = 0; i < MAX_FEEDBACK_EFFECTS; i++) {
      pool.spawn(parent, () => 0, i, i, 'reward', seededRandom(i), false);
    }
    const oldestRoot = parent.children[0]!;
    pool.spawn(parent, () => 0, 99, 99, 'threat', seededRandom(99), false);

    expect(parent.children).toHaveLength(MAX_FEEDBACK_EFFECTS);
    expect(pool.activeCount).toBe(MAX_FEEDBACK_EFFECTS);
    expect(parent.children).toContain(oldestRoot);
    expect(oldestRoot.position.x).toBe(99);
    expect(oldestRoot.position.z).toBe(99);
    pool.dispose();
  });

  it('disposes each owned material and the shared geometry exactly once', () => {
    const pool = new FeedbackEffectPool();
    const parent = new THREE.Group();
    pool.spawn(parent, () => 0, 1, 1, 'reward', seededRandom(1), false);
    const root = parent.children[0]!;
    const geometry = (root.children[0] as THREE.Mesh).geometry;
    const material = (root.children[0] as THREE.Mesh).material as THREE.Material;
    let geometryDisposals = 0;
    let materialDisposals = 0;
    geometry.addEventListener('dispose', () => geometryDisposals++);
    material.addEventListener('dispose', () => materialDisposals++);

    pool.dispose();
    pool.dispose();

    expect(geometryDisposals).toBe(1);
    expect(materialDisposals).toBe(1);
  });
});
