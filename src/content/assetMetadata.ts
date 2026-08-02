import {
  DEFAULT_CLIPS,
  MODEL_KEYS,
  modelDef,
  modelLoadGroup,
  type AssetFallback,
  type ModelAxis,
  type ModelClipSemantic,
  type ModelClipMatchers,
  type ModelFootprint,
  type ModelIconFraming,
  type ModelKind,
  type ModelKey,
  type ModelMarkerSource,
  type ModelSourceRecord,
} from './models';
import { EQUIPMENT_KEYS, EQUIPMENT_PROFILES } from './equipment';
import { PURCHASABLE_ASSETS } from './purchasables';

export type ModelAssetMetadata = Readonly<{
  key: ModelKey;
  path: string;
  kind: ModelKind;
  requiredClips: readonly ModelClipSemantic[];
  clipMatchers: ModelClipMatchers;
  sourceBounds: 'glb-position-accessors';
  groundPivot: ModelAxis;
  forwardAxis: ModelAxis;
  upAxis: ModelAxis;
  targetHeight: number;
  collisionFootprint: ModelFootprint;
  interactionFootprint: ModelFootprint;
  loadGroup: ReturnType<typeof modelLoadGroup>;
  fallback: AssetFallback;
  markerSource: ModelMarkerSource;
  rightHandGrip?: ModelAxis;
  leftHandSupportGrip?: ModelAxis;
  actionLeftHandSupportGrip?: ModelAxis;
  icon: ModelIconFraming;
  source: ModelSourceRecord;
}>;

const DEFAULT_AXIS: ModelAxis = [0, 1, 0];
const DEFAULT_FORWARD_AXIS: ModelAxis = [0, 0, 1];
const DEFAULT_GROUND_PIVOT: ModelAxis = [0, 0, 0];
const DEFAULT_ICON: ModelIconFraming = {
  yaw: -0.55,
  pitch: 0.54,
  roll: 0,
  distance: 2.15,
  targetY: 0.42,
  orthographicScale: 1,
};

const SOURCE_RECORDS: Readonly<Record<string, ModelSourceRecord>> = {
  characters: {
    pack: 'Ultimate Animated Character Pack',
    provider: 'Quaternius',
    url: 'https://quaternius.com',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    record: 'ASSETS.md; public/models/CREDITS.md',
  },
  animals: {
    pack: 'Ultimate Animated Animals',
    provider: 'Quaternius',
    url: 'https://quaternius.com',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    record: 'ASSETS.md; public/models/CREDITS.md',
  },
  crops: {
    pack: 'Nature Crops Pack',
    provider: 'Quaternius',
    url: 'https://quaternius.com',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    record: 'ASSETS.md; public/models/CREDITS.md',
  },
  nature: {
    pack: 'Ultimate Nature Pack',
    provider: 'Quaternius',
    url: 'https://quaternius.com',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    record: 'ASSETS.md; public/models/CREDITS.md',
  },
  trees: {
    pack: 'Textured Stylized Trees — May 2020',
    provider: 'Quaternius',
    url: 'https://quaternius.com',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    record: 'ASSETS.md; public/models/CREDITS.md',
  },
  buildings: {
    pack: 'Farm Buildings',
    provider: 'Quaternius',
    url: 'https://quaternius.com',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    record: 'ASSETS.md; public/models/CREDITS.md',
  },
  items: {
    pack: 'Survival Pack, RPG Items, and Universal Animation libraries',
    provider: 'Quaternius',
    url: 'https://quaternius.com',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    record: 'ASSETS.md; public/models/CREDITS.md',
  },
  monsters: {
    pack: 'Ultimate Monsters',
    provider: 'Quaternius',
    url: 'https://quaternius.com',
    license: 'CC0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    record: 'ASSETS.md; public/models/CREDITS.md',
  },
};

const ALL_ANIMAL_CLIPS: readonly ModelClipSemantic[] = ['idle', 'walk', 'run', 'attack', 'death'];
const PLAYER_CLIPS: readonly ModelClipSemantic[] = ['idle', 'walk', 'run'];

function sourceRecordForPath(path: string): ModelSourceRecord {
  const category = path.split('/')[0];
  const source = category ? SOURCE_RECORDS[category] : undefined;
  if (!source) throw new Error(`No asset provenance record for model path: ${path}`);
  return source;
}

function expectedKindForPath(path: string): ModelKind {
  return path.startsWith('characters/') || path.startsWith('animals/') || path.startsWith('monsters/')
    ? 'rigged'
    : 'static';
}

function requiredClipsFor(key: ModelKey): readonly ModelClipSemantic[] {
  const def = modelDef(key);
  if (def.requiredClips) return def.requiredClips;
  if (def.path.startsWith('animals/') || def.path.startsWith('monsters/')) return ALL_ANIMAL_CLIPS;
  if (def.path.startsWith('characters/')) return PLAYER_CLIPS;
  return [];
}

function catalogFootprintFor(key: ModelKey): ModelFootprint {
  const entries = PURCHASABLE_ASSETS.filter((asset) => asset.modelKey === key);
  if (entries.length === 0) return { width: 1, depth: 1 };
  return {
    width: Math.max(...entries.map((entry) => entry.footprint.width)),
    depth: Math.max(...entries.map((entry) => entry.footprint.height)),
  };
}

function equipmentForModel(key: ModelKey) {
  return EQUIPMENT_KEYS
    .map((equipmentKey) => EQUIPMENT_PROFILES[equipmentKey])
    .find((profile) => profile.modelKey === key);
}

/**
 * Resolve the complete metadata contract for one model without touching Three.js,
 * the DOM, or the filesystem. GLB-derived bounds and clip names are filled by the
 * asset checker; authored gameplay metadata remains in the typed content tables.
 */
export function modelAssetMetadata(key: ModelKey): ModelAssetMetadata {
  const def = modelDef(key);
  const equipment = equipmentForModel(key);
  return {
    key,
    path: def.path,
    kind: def.kind ?? expectedKindForPath(def.path),
    requiredClips: requiredClipsFor(key),
    clipMatchers: { ...DEFAULT_CLIPS, ...def.clips },
    sourceBounds: 'glb-position-accessors',
    groundPivot: def.groundPivot ?? DEFAULT_GROUND_PIVOT,
    forwardAxis: def.forwardAxis ?? DEFAULT_FORWARD_AXIS,
    upAxis: def.upAxis ?? DEFAULT_AXIS,
    targetHeight: def.height,
    collisionFootprint: def.collisionFootprint ?? catalogFootprintFor(key),
    interactionFootprint: def.interactionFootprint ?? catalogFootprintFor(key),
    loadGroup: modelLoadGroup(key),
    fallback: def.fallback ?? 'primitive',
    markerSource: def.markerSource ?? (equipment ? 'equipment-profile' : 'none'),
    rightHandGrip: equipment?.rightHandGrip,
    leftHandSupportGrip: equipment?.leftHandSupportGrip,
    actionLeftHandSupportGrip: equipment?.actionLeftHandSupportGrip,
    icon: equipment?.icon ?? def.icon ?? DEFAULT_ICON,
    source: def.source ?? sourceRecordForPath(def.path),
  };
}

/** Every active manifest entry resolves to the same complete metadata shape. */
export const MODEL_ASSET_METADATA: Readonly<Record<ModelKey, ModelAssetMetadata>> = Object.fromEntries(
  MODEL_KEYS.map((key) => [key, modelAssetMetadata(key)]),
) as Record<ModelKey, ModelAssetMetadata>;

export function validateModelMetadata(
  metadata: Readonly<Record<ModelKey, ModelAssetMetadata>> = MODEL_ASSET_METADATA,
): string[] {
  const problems: string[] = [];
  for (const key of MODEL_KEYS) {
    const entry = metadata[key];
    if (!entry) {
      problems.push(`${key}: missing resolved metadata`);
      continue;
    }
    if (!entry.path.endsWith('.glb')) problems.push(`${key}: manifest path must be a .glb file`);
    if (!Number.isFinite(entry.targetHeight) || entry.targetHeight <= 0) {
      problems.push(`${key}: target height must be positive`);
    }
    for (const [name, axis] of [
      ['groundPivot', entry.groundPivot],
      ['forwardAxis', entry.forwardAxis],
      ['upAxis', entry.upAxis],
    ] as const) {
      if (axis.length !== 3 || axis.some((value) => !Number.isFinite(value))) {
        problems.push(`${key}: ${name} must contain three finite values`);
      }
    }
    for (const [name, footprint] of [
      ['collisionFootprint', entry.collisionFootprint],
      ['interactionFootprint', entry.interactionFootprint],
    ] as const) {
      if (
        !Number.isFinite(footprint.width) || footprint.width <= 0 ||
        !Number.isFinite(footprint.depth) || footprint.depth <= 0
      ) problems.push(`${key}: ${name} must have positive dimensions`);
    }
    if (entry.fallback !== 'primitive') problems.push(`${key}: unsupported fallback ${entry.fallback}`);
    if (!entry.source.pack || entry.source.license !== 'CC0' || !entry.source.url) {
      problems.push(`${key}: incomplete source/license record`);
    }
    for (const [name, value] of Object.entries(entry.icon)) {
      if (!Number.isFinite(value)) problems.push(`${key}: icon ${name} is not finite`);
    }
    if (entry.icon.distance <= 0 || entry.icon.orthographicScale <= 0) {
      problems.push(`${key}: icon camera distance and scale must be positive`);
    }
    if (entry.markerSource === 'equipment-profile' && !entry.rightHandGrip) {
      problems.push(`${key}: equipment marker source has no right-hand grip`);
    }
  }
  return problems;
}
