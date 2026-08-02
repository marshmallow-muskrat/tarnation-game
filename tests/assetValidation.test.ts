import { describe, expect, it } from 'vitest';
import {
  inspectGltfDocument,
  parseGlb,
  type JsonObject,
} from '../src/content/assetValidation';

function validDocument(): JsonObject {
  return {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, skin: 0, translation: [0, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    skins: [{ joints: [0] }],
    buffers: [{ byteLength: 72 }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 36 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: 'VEC3',
        min: [-1, 0, -1],
        max: [1, 2, 1],
      },
      { bufferView: 1, componentType: 5126, count: 1, type: 'SCALAR', min: [0], max: [0] },
      { bufferView: 1, componentType: 5126, count: 1, type: 'VEC3', min: [0, 0, 0], max: [0, 0, 0] },
    ],
    animations: [{
      name: 'Idle',
      samplers: [{ input: 1, output: 2 }],
      channels: [{ sampler: 0, target: { node: 0, path: 'translation' } }],
    }],
  };
}

function makeGlb(document: JsonObject): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(document));
  const jsonLength = Math.ceil(json.byteLength / 4) * 4;
  const binaryLength = 4;
  const totalLength = 12 + 8 + jsonLength + 8 + binaryLength;
  const result = new Uint8Array(totalLength);
  const view = new DataView(result.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, totalLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  result.set(json, 20);
  const binaryOffset = 20 + jsonLength;
  view.setUint32(binaryOffset, binaryLength, true);
  view.setUint32(binaryOffset + 4, 0x004e4942, true);
  return result;
}

describe('GLB characterization and validation', () => {
  it('opens a compact GLB container and preserves its JSON and binary chunk lengths', () => {
    const result = parseGlb(makeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] }));
    expect(result.errors).toEqual([]);
    expect(result.document?.asset).toEqual({ version: '2.0' });
    expect(result.binaryByteLength).toBe(4);
  });

  it('identifies rigged scenes, finite source bounds, and named animation clips', () => {
    const result = inspectGltfDocument(validDocument(), 72, {
      expectedKind: 'rigged',
      expectedClips: { idle: /idle/i },
    });
    expect(result.errors).toEqual([]);
    expect(result.kind).toBe('rigged');
    expect(result.animationNames).toEqual(['Idle']);
    expect(result.sourceBounds).toEqual({ min: [-1, 0, -1], max: [1, 2, 1] });
  });

  it('reports the exact scene rule when a node transform or reference is malformed', () => {
    const document = validDocument();
    document.nodes = [{ mesh: 9, skin: 9, translation: [0, Number.NaN, 0] }];
    const result = inspectGltfDocument(document, 72);
    expect(result.errors).toEqual(expect.arrayContaining([
      'nodes[0].mesh is invalid',
      'nodes[0].skin is invalid',
      'nodes[0].translation must contain 3 finite numbers',
    ]));
  });

  it('rejects inverted source bounds instead of producing an unusable framing contract', () => {
    const document = validDocument();
    const accessors = document.accessors as unknown[];
    document.accessors = [{
      bufferView: 0,
      componentType: 5126,
      count: 3,
      type: 'VEC3',
      min: [2, 0, 0],
      max: [1, 1, 1],
    }, accessors[1], accessors[2]];
    const result = inspectGltfDocument(document, 72);
    expect(result.errors).toContain('accessors[0] min bounds exceed max bounds');
  });

  it('fails the expected-clip contract instead of silently accepting an incomplete rig', () => {
    const result = inspectGltfDocument(validDocument(), 72, {
      expectedKind: 'rigged',
      expectedClips: { attack: /attack/i },
    });
    expect(result.errors).toContain('missing expected attack animation clip');
  });

  it('reports external image references for the filesystem checker to resolve', () => {
    const document = validDocument();
    document.images = [{ uri: 'textures/tree.webp' }];
    document.textures = [{ source: 0 }];
    document.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }];
    document.meshes = [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }];
    const result = inspectGltfDocument(document, 72);
    expect(result.errors).toEqual([]);
    expect(result.externalUris).toEqual(['textures/tree.webp']);
  });

  it('rejects truncated GLB data before attempting to trust its JSON', () => {
    const glb = makeGlb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] });
    const result = parseGlb(glb.subarray(0, glb.byteLength - 1));
    expect(result.document).toBeNull();
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('declared GLB length'),
    ]));
  });
});
