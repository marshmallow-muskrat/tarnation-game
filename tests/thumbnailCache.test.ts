import { describe, expect, it } from 'vitest';
import { BoundedLruCache } from '../src/ui/ThumbnailCache';

describe('shared model icon thumbnail cache', () => {
  it('evicts the least-recently-used thumbnail at the configured bound', () => {
    const cache = new BoundedLruCache<number>(2);
    cache.set('axe', 1);
    cache.set('shovel', 2);
    expect(cache.get('axe')).toBe(1);
    cache.set('backpack', 3);

    expect(cache.get('shovel')).toBeUndefined();
    expect(cache.get('axe')).toBe(1);
    expect(cache.get('backpack')).toBe(3);
    expect(cache.size).toBe(2);
  });

  it('clears every cached thumbnail when the shared icon renderer is torn down', () => {
    const cache = new BoundedLruCache<number>(2);
    const first = 1;
    const second = 2;
    cache.set('axe', first);
    cache.set('shovel', second);

    expect(cache.clear()).toEqual([first, second]);
    expect(cache.size).toBe(0);
  });
});
