import { describe, expect, it } from 'vitest';
import {
  MODEL_KEYS,
  modelLoadGroup,
  modelKeysForLoadGroup,
  type AssetLoadGroup,
} from '../src/content/models';
import {
  MODEL_ASSET_METADATA,
  modelAssetMetadata,
  validateModelMetadata,
} from '../src/content/assetMetadata';

const GROUPS: readonly AssetLoadGroup[] = ['boot', 'first_play', 'nearby', 'catalog', 'optional'];

describe('asset loading groups', () => {
  it('assigns every manifest model to exactly one deterministic loading group', () => {
    const grouped = GROUPS.flatMap((group) => modelKeysForLoadGroup(group));
    expect(grouped).toHaveLength(MODEL_KEYS.length);
    expect(new Set(grouped).size).toBe(MODEL_KEYS.length);
    expect([...grouped].sort()).toEqual([...MODEL_KEYS].sort());
    for (const key of MODEL_KEYS) expect(modelLoadGroup(key)).toBeTypeOf('string');
  });

  it('keeps the player in boot and the playable initial scene in first-play assets', () => {
    expect(modelKeysForLoadGroup('boot')).toEqual(['player']);
    expect(modelKeysForLoadGroup('first_play')).toEqual(
      expect.arrayContaining([
        'shotgun_2',
        'shovel',
        'axe',
        'fox',
        'beet_4',
        'tree_oak',
        'rock_a',
        'market_stall',
        'house_1',
      ]),
    );
  });

  it('keeps catalog choices out of boot and first-play startup work', () => {
    expect(modelKeysForLoadGroup('catalog')).toEqual(
      expect.arrayContaining(['well', 'fence', 'fence2', 'house_5', 'bow_wooden']),
    );
    expect(modelKeysForLoadGroup('boot')).not.toContain('well');
    expect(modelKeysForLoadGroup('first_play')).not.toContain('house_5');
  });

  it('leaves future-only art in optional loading without changing the fallback contract', () => {
    expect(modelKeysForLoadGroup('optional')).toEqual(
      expect.arrayContaining(['corn_4', 'guardian_a']),
    );
    expect(modelLoadGroup('guardian_a')).toBe('optional');
  });
});

describe('asset manifest metadata', () => {
  it('resolves a complete fallback, provenance, scale, axis, footprint, and icon contract for every model', () => {
    expect(validateModelMetadata()).toEqual([]);
    expect(Object.keys(MODEL_ASSET_METADATA)).toHaveLength(MODEL_KEYS.length);
    for (const key of MODEL_KEYS) {
      const metadata = modelAssetMetadata(key);
      expect(metadata.targetHeight, `${key} target height`).toBeGreaterThan(0);
      expect(metadata.fallback, `${key} fallback`).toBe('primitive');
      expect(metadata.source.license, `${key} license`).toBe('CC0');
      expect(metadata.source.record, `${key} provenance record`).toContain('CREDITS.md');
      expect(metadata.collisionFootprint.width, `${key} collision width`).toBeGreaterThan(0);
      expect(metadata.interactionFootprint.depth, `${key} interaction depth`).toBeGreaterThan(0);
      expect(metadata.icon.distance, `${key} icon distance`).toBeGreaterThan(0);
    }
  });

  it('derives rig classification and the player-visible animation contract from the active GLB packs', () => {
    expect(modelAssetMetadata('player').kind).toBe('rigged');
    expect(modelAssetMetadata('player').requiredClips).toEqual(['idle', 'walk', 'run']);
    expect(modelAssetMetadata('fox').requiredClips).toEqual(['idle', 'walk', 'run', 'attack', 'death']);
    expect(modelAssetMetadata('tree_oak').kind).toBe('static');
    expect(modelAssetMetadata('tree_oak').requiredClips).toEqual([]);
  });

  it('derives placement footprints from the gameplay catalog without changing its ownership', () => {
    expect(modelAssetMetadata('fence').collisionFootprint).toEqual({ width: 4, depth: 1 });
    expect(modelAssetMetadata('house_5').collisionFootprint).toEqual({ width: 8, depth: 8 });
    expect(modelAssetMetadata('shotgun_2').collisionFootprint).toEqual({ width: 1, depth: 1 });
  });

  it('uses typed equipment records as the source for held-tool markers and icon framing', () => {
    const shotgun = modelAssetMetadata('shotgun_2');
    expect(shotgun.markerSource).toBe('equipment-profile');
    expect(shotgun.rightHandGrip).toEqual([0, -0.28, 0]);
    expect(shotgun.leftHandSupportGrip).toEqual([1.35, 0.08, 0]);
    expect(shotgun.icon.orthographicScale).toBe(1.25);
    expect(modelAssetMetadata('well').markerSource).toBe('none');
  });
});
