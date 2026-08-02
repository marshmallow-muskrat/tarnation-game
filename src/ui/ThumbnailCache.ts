/** Small least-recently-used cache for rendered UI thumbnails. */
export class BoundedLruCache<T> {
  private readonly entries = new Map<string, T>();

  constructor(private readonly limit: number) {
    if (!Number.isInteger(limit) || limit < 1) throw new Error('Thumbnail cache limit must be a positive integer.');
  }

  get(key: string): T | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: T): T | undefined {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size <= this.limit) return undefined;
    const oldest = this.entries.keys().next().value;
    if (oldest === undefined) return undefined;
    const evicted = this.entries.get(oldest);
    this.entries.delete(oldest);
    return evicted;
  }

  clear(): T[] {
    const values = [...this.entries.values()];
    this.entries.clear();
    return values;
  }

  get size(): number {
    return this.entries.size;
  }
}
