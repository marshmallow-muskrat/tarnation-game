import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  disposeModelClone,
  disposeObjectResources,
  markMaterialOwner,
  markModelClone,
} from '../src/game/ResourceDisposal';

describe('runtime resource ownership', () => {
  it('disposes clone-owned materials without disposing materials shared by the asset cache', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const sharedMaterial = markMaterialOwner(new THREE.MeshBasicMaterial(), 'asset-cache');
    const cloneMaterial = markMaterialOwner(sharedMaterial.clone(), 'clone');
    const sharedMesh = new THREE.Mesh(geometry, sharedMaterial);
    const cloneMesh = new THREE.Mesh(geometry, cloneMaterial);
    const root = new THREE.Group();
    root.add(sharedMesh, cloneMesh);
    let sharedDisposed = false;
    let cloneDisposed = false;
    let releases = 0;
    sharedMaterial.addEventListener('dispose', () => { sharedDisposed = true; });
    cloneMaterial.addEventListener('dispose', () => { cloneDisposed = true; });
    markModelClone(root, true, () => { releases++; });

    disposeModelClone(root);
    disposeModelClone(root);

    expect(sharedDisposed).toBe(false);
    expect(cloneDisposed).toBe(true);
    expect(releases).toBe(1);
    geometry.dispose();
  });

  it('disposes all resources for an uncached fallback subtree', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const root = new THREE.Mesh(geometry, material);
    markModelClone(root, false);
    let geometryDisposed = false;
    let materialDisposed = false;
    geometry.addEventListener('dispose', () => { geometryDisposed = true; });
    material.addEventListener('dispose', () => { materialDisposed = true; });

    disposeModelClone(root);

    expect(geometryDisposed).toBe(true);
    expect(materialDisposed).toBe(true);
  });

  it('disposes procedural scene resources once without duplicating shared references', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const first = new THREE.Mesh(geometry, material);
    const second = new THREE.Mesh(geometry, material);
    const root = new THREE.Group();
    root.add(first, second);
    let geometryDisposed = 0;
    let materialDisposed = 0;
    geometry.addEventListener('dispose', () => { geometryDisposed++; });
    material.addEventListener('dispose', () => { materialDisposed++; });

    disposeObjectResources(root, { geometries: true, materials: true });

    expect(geometryDisposed).toBe(1);
    expect(materialDisposed).toBe(1);
  });
});
