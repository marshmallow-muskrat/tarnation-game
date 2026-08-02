import { expect, type Page } from '@playwright/test';
import { serialize } from '../../src/sim/save';
import { midgameSaveFixture } from '../fixtures';
import type { SaveData } from '../../src/sim/save';

export function e2eSave(mutator?: (save: SaveData) => void): string {
  const save = midgameSaveFixture();
  save.codex = [];
  save.stats.hybridsDiscovered = 0;
  save.winShown = false;
  mutator?.(save);
  return serialize(save);
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
  await page.waitForTimeout(250);
  expect(errors, 'production E2E must not emit browser warnings or errors').toEqual([]);
}
