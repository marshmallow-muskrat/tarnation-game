import { expect, test } from '@playwright/test';
import { captureBrowserErrors, expectNoBrowserErrors, startAdventure } from './helpers';

test('player can hide and restore the settlement objective and market guide with keyboard controls', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/');
  await startAdventure(page, 'New Adventure');

  const canvas = page.getByLabel('Tarnation game canvas');
  const topLeftHud = page.locator('.hud-top-left');
  const objective = page.getByRole('region', { name: 'Settlement objective' });
  const marketGuide = page.locator('.market-compass');
  await expect(objective).toBeVisible();
  await expect(marketGuide).toBeVisible();
  const topLeftBounds = await topLeftHud.boundingBox();
  expect(topLeftBounds?.width ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(410);

  await canvas.focus();
  await page.keyboard.press('KeyJ');
  await expect(objective).toBeHidden();
  await page.keyboard.press('KeyJ');
  await expect(objective).toBeVisible();

  await page.keyboard.press('KeyG');
  await expect(marketGuide).toBeHidden();
  await page.keyboard.press('KeyG');
  await expect(marketGuide).toBeVisible();
  await expectNoBrowserErrors(page, errors);
});

test('unsupported WebGL shows a recoverable launch error instead of a blank game surface', async ({ page }) => {
  await page.addInitScript({
    content: `
      (() => {
        const originalGetContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (contextId, options) {
          if (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'experimental-webgl') return null;
          return originalGetContext.call(this, contextId, options);
        };
      })();
    `,
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'New Adventure', exact: true }).click();
  await expect(page.getByText('Unable to start', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
});
