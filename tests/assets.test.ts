import { describe, expect, it } from 'vitest';
import {
  MODEL_KEYS,
  modelLoadGroup,
  modelKeysForLoadGroup,
  type AssetLoadGroup,
} from '../src/content/models';

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
