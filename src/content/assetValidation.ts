import type { ModelKind } from './models';

export type JsonObject = { [key: string]: unknown };

export type GlbParseResult = Readonly<{
  document: JsonObject | null;
  binaryByteLength: number;
  errors: readonly string[];
}>;

export type Bounds3 = Readonly<{
  min: readonly [number, number, number];
  max: readonly [number, number, number];
}>;

export type GltfInspection = Readonly<{
  kind: ModelKind;
  animationNames: readonly string[];
  sourceBounds: Bounds3 | null;
  externalUris: readonly string[];
  errors: readonly string[];
}>;

export type GltfInspectionOptions = Readonly<{
  expectedKind?: ModelKind;
  expectedClips?: Readonly<Record<string, RegExp>>;
}>;

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const COMPONENT_TYPES = new Set([5120, 5121, 5122, 5123, 5125, 5126]);
const ACCESSOR_COMPONENTS: Readonly<Record<string, number>> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function array(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function index(value: unknown, length: number): value is number {
  return integer(value) && value >= 0 && value < length;
}

function finiteArray(value: unknown, expectedLength: number, path: string, errors: string[]): void {
  if (!Array.isArray(value) || value.length !== expectedLength || value.some((entry) => !finiteNumber(entry))) {
    errors.push(`${path} must contain ${expectedLength} finite numbers`);
  }
}

function chunkType(view: DataView, offset: number): number {
  return view.getUint32(offset + 4, true);
}

/** Parse the container and JSON chunk of a binary glTF without Three.js or browser APIs. */
export function parseGlb(buffer: Uint8Array): GlbParseResult {
  const errors: string[] = [];
  if (buffer.byteLength < 20) {
    return { document: null, binaryByteLength: 0, errors: ['file is shorter than the 20-byte GLB header'] };
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) errors.push('invalid GLB magic');
  if (view.getUint32(4, true) !== 2) errors.push('GLB version must be 2');
  const declaredLength = view.getUint32(8, true);
  if (declaredLength !== buffer.byteLength) {
    errors.push(`declared GLB length ${declaredLength} does not match file length ${buffer.byteLength}`);
  }

  const firstChunkLength = view.getUint32(12, true);
  if (chunkType(view, 12) !== JSON_CHUNK) errors.push('first GLB chunk must be JSON');
  const firstChunkEnd = 20 + firstChunkLength;
  if (firstChunkEnd > buffer.byteLength) errors.push('JSON chunk extends past the end of the file');
  if (errors.length > 0 && firstChunkEnd > buffer.byteLength) {
    return { document: null, binaryByteLength: 0, errors };
  }

  let document: JsonObject | null = null;
  try {
    const jsonText = new TextDecoder().decode(buffer.subarray(20, firstChunkEnd)).replace(/\u0000+$/, '').trim();
    const parsed: unknown = JSON.parse(jsonText);
    if (!isObject(parsed)) errors.push('GLB JSON chunk must contain an object');
    else document = parsed;
  } catch (error) {
    errors.push(`invalid GLB JSON chunk: ${error instanceof Error ? error.message : String(error)}`);
  }

  let binaryByteLength = 0;
  let offset = firstChunkEnd;
  while (offset + 8 <= buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const end = offset + 8 + length;
    if (end > buffer.byteLength) {
      errors.push(`GLB chunk at byte ${offset} extends past the end of the file`);
      break;
    }
    if (chunkType(view, offset) === BIN_CHUNK) binaryByteLength = Math.max(binaryByteLength, length);
    offset = end;
  }
  if (offset !== buffer.byteLength) errors.push('GLB chunks do not consume the complete file');
  if (!document || errors.length > 0) return { document: null, binaryByteLength, errors };
  return { document, binaryByteLength, errors };
}

function collectTextureIndices(value: unknown, path: string, errors: string[], indices: number[]): void {
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (key.endsWith('Texture') && isObject(child)) {
      if (integer(child.index)) indices.push(child.index);
      else errors.push(`${path}.${key}.index must be an integer`);
      continue;
    }
    if (isObject(child)) collectTextureIndices(child, `${path}.${key}`, errors, indices);
  }
}

function updateBounds(
  current: Bounds3 | null,
  min: readonly number[],
  max: readonly number[],
): { min: [number, number, number]; max: [number, number, number] } {
  if (!current) {
    return { min: [min[0]!, min[1]!, min[2]!], max: [max[0]!, max[1]!, max[2]!] };
  }
  return {
    min: [
      Math.min(current.min[0], min[0]!),
      Math.min(current.min[1], min[1]!),
      Math.min(current.min[2], min[2]!),
    ],
    max: [
      Math.max(current.max[0], max[0]!),
      Math.max(current.max[1], max[1]!),
      Math.max(current.max[2], max[2]!),
    ],
  };
}

/** Validate references, transforms, bounds, textures, and animations in one glTF JSON document. */
export function inspectGltfDocument(
  document: JsonObject,
  binaryByteLength: number,
  options: GltfInspectionOptions = {},
): GltfInspection {
  const errors: string[] = [];
  const scenes = array(document.scenes);
  const nodes = array(document.nodes);
  const meshes = array(document.meshes);
  const accessors = array(document.accessors);
  const bufferViews = array(document.bufferViews);
  const buffers = array(document.buffers);
  const materials = array(document.materials);
  const textures = array(document.textures);
  const images = array(document.images);
  const animations = array(document.animations);
  const skins = array(document.skins);
  const cameras = array(document.cameras);
  const externalUris: string[] = [];

  const asset = isObject(document.asset) ? document.asset : null;
  if (asset?.version !== '2.0') errors.push('asset.version must be 2.0');
  if (scenes.length === 0) errors.push('document must contain at least one scene');
  if (document.scene !== undefined && !index(document.scene, scenes.length)) {
    errors.push('document.scene must reference an existing scene');
  }

  const bufferLengths: Array<number | null> = [];
  buffers.forEach((entry, bufferIndex) => {
    if (!isObject(entry)) {
      errors.push(`buffers[${bufferIndex}] must be an object`);
      bufferLengths.push(null);
      return;
    }
    if (!integer(entry.byteLength) || entry.byteLength < 0) {
      errors.push(`buffers[${bufferIndex}].byteLength must be a non-negative integer`);
      bufferLengths.push(null);
    } else {
      bufferLengths.push(entry.byteLength);
      if (typeof entry.uri === 'string') {
        if (!entry.uri.startsWith('data:')) externalUris.push(entry.uri);
      } else if (bufferIndex === 0 && binaryByteLength < entry.byteLength) {
        errors.push(`binary GLB chunk is shorter than buffers[${bufferIndex}].byteLength`);
      }
    }
  });

  bufferViews.forEach((entry, bufferViewIndex) => {
    if (!isObject(entry)) {
      errors.push(`bufferViews[${bufferViewIndex}] must be an object`);
      return;
    }
    if (!index(entry.buffer, buffers.length)) errors.push(`bufferViews[${bufferViewIndex}].buffer is invalid`);
    const byteOffset = integer(entry.byteOffset) ? entry.byteOffset : 0;
    const byteLength = integer(entry.byteLength) ? entry.byteLength : null;
    if (entry.byteOffset !== undefined && (!integer(entry.byteOffset) || entry.byteOffset < 0)) {
      errors.push(`bufferViews[${bufferViewIndex}].byteOffset must be non-negative`);
    }
    if (!integer(entry.byteLength) || entry.byteLength < 0) {
      errors.push(`bufferViews[${bufferViewIndex}].byteLength must be non-negative`);
    }
    if (entry.byteStride !== undefined && (!integer(entry.byteStride) || entry.byteStride < 4 || entry.byteStride > 252)) {
      errors.push(`bufferViews[${bufferViewIndex}].byteStride is outside the glTF range`);
    }
    if (index(entry.buffer, bufferLengths.length) && byteLength !== null) {
      const available = bufferLengths[entry.buffer];
      if (available !== null && byteOffset + byteLength > available) {
        errors.push(`bufferViews[${bufferViewIndex}] extends past its buffer`);
      }
    }
  });

  const accessorBounds = new Map<number, Bounds3>();
  accessors.forEach((entry, accessorIndex) => {
    if (!isObject(entry)) {
      errors.push(`accessors[${accessorIndex}] must be an object`);
      return;
    }
    if (entry.bufferView !== undefined && !index(entry.bufferView, bufferViews.length)) {
      errors.push(`accessors[${accessorIndex}].bufferView is invalid`);
    }
    if (!COMPONENT_TYPES.has(entry.componentType as number)) {
      errors.push(`accessors[${accessorIndex}].componentType is unsupported`);
    }
    const components = ACCESSOR_COMPONENTS[typeof entry.type === 'string' ? entry.type : ''];
    if (!components) errors.push(`accessors[${accessorIndex}].type is unsupported`);
    if (!integer(entry.count) || entry.count < 1) errors.push(`accessors[${accessorIndex}].count must be positive`);
    for (const [boundName, bound] of [['min', entry.min], ['max', entry.max]] as const) {
      if (bound === undefined) continue;
      if (!Array.isArray(bound) || bound.length !== components || bound.some((value) => !finiteNumber(value))) {
        errors.push(`accessors[${accessorIndex}].${boundName} is not finite or has the wrong length`);
      }
    }
    const minBound = Array.isArray(entry.min) ? entry.min : null;
    const maxBound = Array.isArray(entry.max) ? entry.max : null;
    if (
      minBound && maxBound &&
      minBound.length === components && maxBound.length === components &&
      minBound.every(finiteNumber) && maxBound.every(finiteNumber) &&
      minBound.some((min, component) => min > maxBound[component]!)
    ) {
      errors.push(`accessors[${accessorIndex}] min bounds exceed max bounds`);
    }
  });

  images.forEach((entry, imageIndex) => {
    if (!isObject(entry)) {
      errors.push(`images[${imageIndex}] must be an object`);
      return;
    }
    if (entry.bufferView !== undefined && !index(entry.bufferView, bufferViews.length)) {
      errors.push(`images[${imageIndex}].bufferView is invalid`);
    }
    if (typeof entry.uri === 'string' && !entry.uri.startsWith('data:')) externalUris.push(entry.uri);
    if (entry.bufferView === undefined && typeof entry.uri !== 'string') {
      errors.push(`images[${imageIndex}] needs a bufferView or uri`);
    }
  });

  textures.forEach((entry, textureIndex) => {
    if (!isObject(entry)) {
      errors.push(`textures[${textureIndex}] must be an object`);
      return;
    }
    const extensionSources = isObject(entry.extensions)
      ? Object.values(entry.extensions)
        .map((extension) => (isObject(extension) ? extension.source : undefined))
        .find((source) => source !== undefined)
      : undefined;
    const source = entry.source ?? extensionSources;
    if (!index(source, images.length)) errors.push(`textures[${textureIndex}].source is invalid`);
    if (entry.sampler !== undefined && !index(entry.sampler, array(document.samplers).length)) {
      errors.push(`textures[${textureIndex}].sampler is invalid`);
    }
  });

  materials.forEach((entry, materialIndex) => {
    const indices: number[] = [];
    collectTextureIndices(entry, `materials[${materialIndex}]`, errors, indices);
    for (const textureIndex of indices) {
      if (!index(textureIndex, textures.length)) errors.push(`materials[${materialIndex}] references an invalid texture`);
    }
  });

  meshes.forEach((entry, meshIndex) => {
    if (!isObject(entry)) {
      errors.push(`meshes[${meshIndex}] must be an object`);
      return;
    }
    const primitives = array(entry.primitives);
    if (primitives.length === 0) errors.push(`meshes[${meshIndex}] has no primitives`);
    primitives.forEach((primitive, primitiveIndex) => {
      if (!isObject(primitive)) {
        errors.push(`meshes[${meshIndex}].primitives[${primitiveIndex}] must be an object`);
        return;
      }
      const attributes = isObject(primitive.attributes) ? primitive.attributes : {};
      for (const [attribute, accessorIndex] of Object.entries(attributes)) {
        if (!index(accessorIndex, accessors.length)) {
          errors.push(`meshes[${meshIndex}].primitives[${primitiveIndex}].attributes.${attribute} is invalid`);
        }
      }
      if (primitive.indices !== undefined && !index(primitive.indices, accessors.length)) {
        errors.push(`meshes[${meshIndex}].primitives[${primitiveIndex}].indices is invalid`);
      }
      if (primitive.material !== undefined && !index(primitive.material, materials.length)) {
        errors.push(`meshes[${meshIndex}].primitives[${primitiveIndex}].material is invalid`);
      }
      const positionIndex = attributes.POSITION;
      if (!index(positionIndex, accessors.length)) {
        errors.push(`meshes[${meshIndex}].primitives[${primitiveIndex}] has no valid POSITION accessor`);
        return;
      }
      const position = accessors[positionIndex];
      if (!isObject(position) || position.type !== 'VEC3') {
        errors.push(`meshes[${meshIndex}].primitives[${primitiveIndex}] POSITION must be VEC3`);
        return;
      }
      if (!Array.isArray(position.min) || !Array.isArray(position.max)) {
        errors.push(`meshes[${meshIndex}].primitives[${primitiveIndex}] POSITION needs min and max bounds`);
        return;
      }
      const min = position.min;
      const max = position.max;
      if (
        min.length !== 3 || max.length !== 3 ||
        min.some((value) => !finiteNumber(value)) || max.some((value) => !finiteNumber(value))
      ) {
        errors.push(`meshes[${meshIndex}].primitives[${primitiveIndex}] POSITION bounds must be finite VEC3 values`);
        return;
      }
      const current = accessorBounds.get(positionIndex) ?? null;
      accessorBounds.set(positionIndex, updateBounds(current, min, max));
    });
  });

  const visiting = new Set<number>();
  const visited = new Set<number>();
  const visitNode = (nodeIndex: number): void => {
    if (visiting.has(nodeIndex)) {
      errors.push(`node hierarchy contains a cycle at nodes[${nodeIndex}]`);
      return;
    }
    if (visited.has(nodeIndex)) return;
    const node = nodes[nodeIndex];
    if (!isObject(node)) return;
    visiting.add(nodeIndex);
    if (node.mesh !== undefined && !index(node.mesh, meshes.length)) errors.push(`nodes[${nodeIndex}].mesh is invalid`);
    if (node.skin !== undefined && !index(node.skin, skins.length)) errors.push(`nodes[${nodeIndex}].skin is invalid`);
    if (node.camera !== undefined && !index(node.camera, cameras.length)) errors.push(`nodes[${nodeIndex}].camera is invalid`);
    if (node.matrix !== undefined) finiteArray(node.matrix, 16, `nodes[${nodeIndex}].matrix`, errors);
    if (node.matrix === undefined) {
      if (node.translation !== undefined) finiteArray(node.translation, 3, `nodes[${nodeIndex}].translation`, errors);
      if (node.rotation !== undefined) finiteArray(node.rotation, 4, `nodes[${nodeIndex}].rotation`, errors);
      if (node.scale !== undefined) finiteArray(node.scale, 3, `nodes[${nodeIndex}].scale`, errors);
    }
    if (node.children !== undefined) {
      if (!Array.isArray(node.children)) {
        errors.push(`nodes[${nodeIndex}].children must be an array`);
      } else {
        node.children.forEach((child, childIndex) => {
          if (!index(child, nodes.length)) errors.push(`nodes[${nodeIndex}].children[${childIndex}] is invalid`);
          else visitNode(child);
        });
      }
    }
    visiting.delete(nodeIndex);
    visited.add(nodeIndex);
  };

  scenes.forEach((scene, sceneIndex) => {
    if (!isObject(scene)) {
      errors.push(`scenes[${sceneIndex}] must be an object`);
      return;
    }
    const sceneNodes = scene.nodes;
    if (sceneNodes !== undefined && Array.isArray(sceneNodes)) {
      sceneNodes.forEach((nodeIndex, nodeListIndex) => {
        if (!index(nodeIndex, nodes.length)) errors.push(`scenes[${sceneIndex}].nodes[${nodeListIndex}] is invalid`);
        else visitNode(nodeIndex);
      });
    }
  });
  nodes.forEach((_, nodeIndex) => visitNode(nodeIndex));

  skins.forEach((entry, skinIndex) => {
    if (!isObject(entry)) {
      errors.push(`skins[${skinIndex}] must be an object`);
      return;
    }
    if (!Array.isArray(entry.joints) || entry.joints.length === 0) errors.push(`skins[${skinIndex}].joints is empty`);
    else entry.joints.forEach((nodeIndex, jointIndex) => {
      if (!index(nodeIndex, nodes.length)) errors.push(`skins[${skinIndex}].joints[${jointIndex}] is invalid`);
    });
    if (entry.inverseBindMatrices !== undefined && !index(entry.inverseBindMatrices, accessors.length)) {
      errors.push(`skins[${skinIndex}].inverseBindMatrices is invalid`);
    }
    if (entry.skeleton !== undefined && !index(entry.skeleton, nodes.length)) errors.push(`skins[${skinIndex}].skeleton is invalid`);
  });

  animations.forEach((entry, animationIndex) => {
    if (!isObject(entry)) {
      errors.push(`animations[${animationIndex}] must be an object`);
      return;
    }
    if (entry.name !== undefined && typeof entry.name !== 'string') errors.push(`animations[${animationIndex}].name must be a string`);
    const samplers = array(entry.samplers);
    samplers.forEach((sampler, samplerIndex) => {
      if (!isObject(sampler)) {
        errors.push(`animations[${animationIndex}].samplers[${samplerIndex}] must be an object`);
        return;
      }
      if (!index(sampler.input, accessors.length)) errors.push(`animations[${animationIndex}].samplers[${samplerIndex}].input is invalid`);
      if (!index(sampler.output, accessors.length)) errors.push(`animations[${animationIndex}].samplers[${samplerIndex}].output is invalid`);
    });
    const channels = array(entry.channels);
    channels.forEach((channel, channelIndex) => {
      if (!isObject(channel)) {
        errors.push(`animations[${animationIndex}].channels[${channelIndex}] must be an object`);
        return;
      }
      if (!index(channel.sampler, samplers.length)) errors.push(`animations[${animationIndex}].channels[${channelIndex}].sampler is invalid`);
      const target = isObject(channel.target) ? channel.target : null;
      if (!target || !index(target.node, nodes.length)) errors.push(`animations[${animationIndex}].channels[${channelIndex}].target.node is invalid`);
      if (!target || !['translation', 'rotation', 'scale', 'weights'].includes(String(target.path))) {
        errors.push(`animations[${animationIndex}].channels[${channelIndex}].target.path is invalid`);
      }
    });
  });

  let sourceBounds: Bounds3 | null = null;
  for (const bounds of accessorBounds.values()) sourceBounds = updateBounds(sourceBounds, bounds.min, bounds.max);
  if (!sourceBounds) errors.push('document has no finite mesh POSITION bounds');

  const animationNames = animations.map((entry, animationIndex) => {
    if (!isObject(entry) || typeof entry.name !== 'string' || entry.name.length === 0) {
      errors.push(`animations[${animationIndex}] needs a non-empty name`);
      return `#${animationIndex}`;
    }
    return entry.name;
  });
  const kind: ModelKind = skins.length > 0 || nodes.some((node) => isObject(node) && node.skin !== undefined)
    ? 'rigged'
    : 'static';
  if (options.expectedKind && kind !== options.expectedKind) {
    errors.push(`expected ${options.expectedKind} asset but found ${kind}`);
  }
  for (const [semantic, matcher] of Object.entries(options.expectedClips ?? {})) {
    const found = animationNames.some((name) => {
      matcher.lastIndex = 0;
      return matcher.test(name);
    });
    if (!found) errors.push(`missing expected ${semantic} animation clip`);
  }

  return {
    kind,
    animationNames,
    sourceBounds,
    externalUris,
    errors,
  };
}
