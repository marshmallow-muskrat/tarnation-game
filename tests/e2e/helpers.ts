import { expect, type Page } from '@playwright/test';
import { SAVE_SERVICE_KEYS, saveChecksum } from '../../src/game/SaveService';
import { deserialize, serialize, type SaveData } from '../../src/sim/save';
import { farmControlSaveFixture, midgameSaveFixture } from '../fixtures';

export function e2eSave(mutator?: (save: SaveData) => void): string {
  const save = midgameSaveFixture();
  save.codex = [];
  save.stats.hybridsDiscovered = 0;
  save.winShown = false;
  mutator?.(save);
  return serialize(save);
}

export function farmControlE2eSave(): string {
  return serialize(farmControlSaveFixture());
}

export function completedE2eSave(mutator?: (save: SaveData) => void): string {
  const save = midgameSaveFixture();
  mutator?.(save);
  return serialize(save);
}

export async function importSave(page: Page, json: string): Promise<void> {
  await page.getByLabel('Import save JSON').setInputFiles({
    name: 'tarnation-e2e-save.json',
    mimeType: 'application/json',
    buffer: Buffer.from(json),
  });
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled();
}

export async function startAdventure(page: Page, choice: 'Continue' | 'New Adventure'): Promise<void> {
  await page.getByRole('button', { name: choice, exact: true }).click();
  await expect(page.getByLabel('Tarnation game canvas')).toBeVisible();
  await expect(page.getByText(/^Day \d+$/)).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });
}

export async function readActiveSave(page: Page): Promise<{ slot: 'a' | 'b'; revision: number; data: SaveData }> {
  const stored = await page.evaluate((keys) => {
    const pointer = window.localStorage.getItem(keys.pointer);
    if (pointer !== 'a' && pointer !== 'b') return null;
    const key = pointer === 'a' ? keys.a : keys.b;
    return { slot: pointer, raw: window.localStorage.getItem(key) };
  }, SAVE_SERVICE_KEYS);
  if (!stored?.raw || (stored.slot !== 'a' && stored.slot !== 'b')) throw new Error('active save slot was not persisted');

  let envelope: { version?: unknown; revision?: unknown; checksum?: unknown; payload?: unknown };
  try {
    envelope = JSON.parse(stored.raw) as typeof envelope;
  } catch {
    throw new Error('active save slot did not contain a JSON envelope');
  }
  if (
    envelope.version !== 1 ||
    typeof envelope.revision !== 'number' ||
    !Number.isInteger(envelope.revision) ||
    typeof envelope.checksum !== 'string' ||
    typeof envelope.payload !== 'string' ||
    saveChecksum(envelope.payload) !== envelope.checksum
  ) {
    throw new Error('active save slot failed envelope validation');
  }
  const data = deserialize(envelope.payload);
  if (!data) throw new Error('active save payload failed production deserialization');
  return { slot: stored.slot, revision: envelope.revision, data };
}

/**
 * Activate a verified modal control without waiting for its synchronous React
 * rerender to become actionability-stable under a headless WebGL loop.
 * Visibility/enabled assertions remain at each call site; this fires the same
 * browser button handler as a pointer click.
 */
export function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    // Headless Chromium's SwiftShader emits this driver warning for the game's
    // intentional thumbnail readbacks. It is not an application warning and is
    // stable across the production-build browser harness; retain all other logs.
    const isHeadlessReadbackWarning = text.includes('GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV');
    if ((message.type() === 'warning' || message.type() === 'error') && !isHeadlessReadbackWarning) {
      errors.push(`console ${message.type()}: ${text}`);
    }
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

export async function expectNoBrowserErrors(page: Page, errors: readonly string[]): Promise<void> {
  void page;
  // Keep the drain delay outside the browser event loop. The production build
  // can legitimately starve page timers while software WebGL is rendering.
  await new Promise<void>((resolve) => setTimeout(resolve, 250));
  expect(errors, 'production E2E must not emit browser warnings or errors').toEqual([]);
}
