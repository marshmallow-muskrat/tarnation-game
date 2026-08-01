import { describe, expect, it } from 'vitest';
import { SAVE_KEY } from '../src/content';
import { SaveService, SAVE_SERVICE_KEYS, type SaveStorage } from '../src/game/SaveService';
import { loadFromSaveData } from '../src/sim/gameState';
import { futureSaveFixture, legacyV8SaveFixture, FIXTURE_SEED, freshGameFixture, midgameSaveFixture } from './fixtures';

class MemoryStorage implements SaveStorage {
  readonly values = new Map<string, string>();
  corruptWrites = new Set<string>();
  quotaError = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.quotaError) throw { name: 'QuotaExceededError' };
    if (this.corruptWrites.has(key)) {
      this.values.set(key, '{"corrupt":true}');
      return;
    }
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('SaveService atomic storage boundary', () => {
  it('writes a validated first candidate and makes Continue depend on a successful read', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);

    const written = service.save(freshGameFixture(FIXTURE_SEED));
    expect(written).toMatchObject({ status: 'ok', slot: 'a', revision: 1 });
    expect(storage.values.has(SAVE_SERVICE_KEYS.a)).toBe(true);
    expect(storage.values.get(SAVE_SERVICE_KEYS.pointer)).toBe('a');

    const read = service.read();
    expect(read).toMatchObject({ status: 'ok', hasSave: true, recovered: false, migrated: false, slot: 'a' });
    expect(read.state).toMatchObject({ seed: FIXTURE_SEED, clock: { day: 1, phase: 'day' } });
  });

  it('alternates candidate slots and retains the previous validated save as backup', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);

    expect(service.save(freshGameFixture(FIXTURE_SEED)).status).toBe('ok');
    expect(service.save(loadFromSaveData(midgameSaveFixture()))).toMatchObject({ status: 'ok', slot: 'b', revision: 2 });
    expect(storage.values.has(SAVE_SERVICE_KEYS.a)).toBe(true);
    expect(storage.values.has(SAVE_SERVICE_KEYS.b)).toBe(true);
    expect(service.read()).toMatchObject({ status: 'ok', slot: 'b', recovered: false, hasSave: true });
  });

  it('recovers the newest valid backup when the pointed-to slot is corrupt', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    service.save(freshGameFixture(FIXTURE_SEED));
    service.save(loadFromSaveData(midgameSaveFixture()));
    storage.values.set(SAVE_SERVICE_KEYS.b, '{not-json');

    const recovered = service.read();
    expect(recovered).toMatchObject({ status: 'ok', slot: 'a', recovered: true, hasSave: true });
    expect(recovered.state).toMatchObject({ seed: FIXTURE_SEED });

    const promoted = service.recover();
    expect(promoted).toMatchObject({ status: 'ok', slot: 'a', recovered: false, hasSave: true });
    expect(storage.values.get(SAVE_SERVICE_KEYS.pointer)).toBe('a');
  });

  it('does not advance the pointer when candidate validation fails', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    service.save(freshGameFixture(FIXTURE_SEED));
    storage.corruptWrites.add(SAVE_SERVICE_KEYS.b);

    const failed = service.save(loadFromSaveData(midgameSaveFixture()));
    expect(failed.status).toBe('corrupt');
    expect(storage.values.get(SAVE_SERVICE_KEYS.pointer)).toBe('a');
    expect(service.read()).toMatchObject({ status: 'ok', slot: 'a', recovered: false, hasSave: true });
  });

  it('returns quota_exceeded without moving the active pointer when storage rejects a write', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    storage.quotaError = true;

    expect(service.save(freshGameFixture(FIXTURE_SEED))).toMatchObject({ status: 'quota_exceeded' });
    expect(storage.values.get(SAVE_SERVICE_KEYS.pointer)).toBeUndefined();
  });

  it('reads a legacy v8 save and rewrites it through the current envelope on import', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    storage.values.set(SAVE_KEY, legacyV8SaveFixture());

    const legacy = service.read();
    expect(legacy).toMatchObject({ status: 'ok', hasSave: true, migrated: true });
    expect(legacy.state).toMatchObject({ clock: { day: 3, phase: 'night' } });

    const exported = service.exportJson();
    expect(exported.status).toBe('ok');
    expect(exported.json).toBe(legacyV8SaveFixture());
    const imported = service.importJson(exported.json!);
    expect(imported).toMatchObject({ status: 'ok', migrated: true });
    expect(service.read()).toMatchObject({ status: 'ok', hasSave: true, migrated: false });
    expect(storage.values.has(SAVE_SERVICE_KEYS.a)).toBe(true);
    expect(storage.values.has(SAVE_KEY)).toBe(false);
  });

  it('distinguishes checksum corruption, migration failure, and unavailable storage', () => {
    const storage = new MemoryStorage();
    const service = new SaveService(storage);
    service.save(freshGameFixture(FIXTURE_SEED));
    const envelope = JSON.parse(storage.values.get(SAVE_SERVICE_KEYS.a)!);
    envelope.payload = envelope.payload.replace('"day":1', '"day":2');
    storage.values.set(SAVE_SERVICE_KEYS.a, JSON.stringify(envelope));
    expect(service.read().status).toBe('corrupt');

    storage.values.clear();
    storage.values.set(SAVE_KEY, futureSaveFixture());
    expect(service.read().status).toBe('migration_failed');
    expect(new SaveService(null).read().status).toBe('unavailable');
  });
});
