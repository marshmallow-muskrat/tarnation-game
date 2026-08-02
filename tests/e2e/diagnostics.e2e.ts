import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { captureBrowserErrors, expectNoBrowserErrors, startAdventure } from './helpers';

test('production build exports bounded diagnostics without a public debug escape hatch', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/');
  expect(await page.evaluate(() => 'tarn' in window), 'production must not expose window.tarn').toBe(false);
  await expect(page.getByText(/F12/i)).toHaveCount(0);

  await startAdventure(page, 'New Adventure');
  await page.getByRole('button', { name: /Help/ }).click();
  const help = page.getByRole('dialog', { name: 'How to work the homestead' });
  await expect(help).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    help.getByRole('button', { name: 'Export diagnostics' }).click(),
  ]);
  const path = await download.path();
  if (!path) throw new Error('diagnostics download did not produce a local file');
  const report = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;

  expect(report.diagnosticsVersion).toBe(1);
  expect(report.build).toMatchObject({ version: '0.3.0' });
  expect((report.build as { commit?: unknown }).commit).toMatch(/^[0-9a-f]{40}$/);
  expect(report.save).toMatchObject({ version: 9, mode: 'new' });
  expect(report).not.toHaveProperty('tiles');
  expect(report).not.toHaveProperty('inventory');
  expect(report).not.toHaveProperty('seedInventory');
  expect(report).not.toHaveProperty('codex');
  expect(report).not.toHaveProperty('placedBuildings');
  expect(Array.isArray(report.recentEvents)).toBe(true);
  expect((report.recentEvents as unknown[]).length).toBeLessThanOrEqual(32);
  await expectNoBrowserErrors(page, errors);
});
