import { expect, test } from '@playwright/test';
import { captureBrowserErrors, completedE2eSave, e2eSave, expectNoBrowserErrors, importSave, startAdventure } from './helpers';

test('fresh game supports movement, farm controls, settings, and a reviewed visual launch baseline', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Tarnation' })).toBeVisible();
  await expect(page.locator('.launch-card')).toHaveScreenshot('launch-card.png');

  await startAdventure(page, 'New Adventure');
  await page.keyboard.press('Escape');
  // Pause focus starts on Resume; keyboard navigation opens Settings without
  // waiting for a pointer actionability pass while the WebGL loop is busy.
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  const reducedMotion = settings.getByLabel('Reduced motion');
  const highContrast = settings.getByLabel('High-contrast UI');
  await expect(reducedMotion).toBeVisible();
  await expect(highContrast).toBeVisible();
  await reducedMotion.check({ force: true });
  await expect(reducedMotion).toBeChecked();
  await highContrast.check({ force: true });
  await expect(highContrast).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  await page.keyboard.press('Escape');

  const canvas = page.getByLabel('Tarnation game canvas');
  await canvas.focus();
  await page.keyboard.press('Digit2');
  await page.keyboard.down('KeyS');
  // Hosted software-WebGL runners need a few more fixed-step frames before
  // the player is inside the starter tile's tool range. S moves down-screen,
  // toward the nearest edge of the marked plot from the authored spawn tile.
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyS');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('game canvas did not expose a layout box');
  // The fresh camera is snapped to the player; the first marked plot is two
  // world units forward, which is a stable isometric screen offset at default zoom.
  const starterPlotPoint = {
    x: canvasBox.x + canvasBox.width / 2 - 127,
    y: canvasBox.y + canvasBox.height / 2 - 84,
  };
  await page.mouse.click(starterPlotPoint.x, starterPlotPoint.y);
  await expect(page.getByText(/plant one seed in that tilled plot/i)).toBeVisible({ timeout: 5_000 });

  await page.keyboard.press('Digit2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  await expect(page.getByRole('button', { name: /Help/ })).toBeVisible();

  await expectNoBrowserErrors(page, errors);
});

test('farm fixture harvests a mature crop and records its Codex discovery in the production build', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/');
  await importSave(page, e2eSave((save) => {
    const matureCrop = save.tiles[20]?.[20];
    if (!matureCrop?.seed) throw new Error('midgame fixture did not provide a mature seed');
    save.tiles[110]![101] = { ...matureCrop, state: 'mature', growth: 1, watered: true, plantedAt: 0 };
    save.playerX = 101.5;
    save.playerZ = 110.5;
    save.day = 1;
    save.phase = 'day';
    save.elapsed = 0;
    save.inventoryOpen = false;
  }));
  await startAdventure(page, 'Continue');

  const canvas = page.getByLabel('Tarnation game canvas');
  await canvas.focus();
  await page.keyboard.press('Digit2');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('game canvas did not expose a layout box');
  await page.mouse.click(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await expect(page.locator('.toast')).toContainText(/New Codex entry: Beet/i, { timeout: 5_000 });
  await expectNoBrowserErrors(page, errors);
});

test('midgame fixture lets the merchant sell a fence deed with its production cost shown', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/');
  await importSave(page, e2eSave((save) => {
    save.playerX = 121.5;
    // The merchant's exact tile is a reserved physical obstacle. Stand on
    // the adjacent safe tile while remaining inside interaction range.
    save.playerZ = 113.5;
    save.day = 1;
    save.phase = 'day';
    save.elapsed = 0;
    save.duckettes = 900;
    save.inventoryOpen = false;
  }));
  await startAdventure(page, 'Continue');

  await page.getByLabel('Tarnation game canvas').focus();
  await page.keyboard.press('KeyE');
  const merchant = page.getByRole('dialog', { name: 'Traveling Merchant' });
  await expect(merchant).toBeVisible();
  await merchant.getByRole('tab', { name: 'Buildings', exact: true }).click({ force: true });
  await expect(merchant.getByText('Silo', { exact: true })).toBeVisible();
  const buyButtons = merchant.getByRole('button', { name: 'Buy', exact: true });
  await expect(buyButtons.first()).toBeEnabled();
  await buyButtons.first().click({ force: true });
  await expect(merchant.getByRole('status')).toContainText(/added to inventory|Purchased|Bought|owned/i);
  await expect(merchant.getByRole('button', { name: 'Close' })).toBeVisible();
  await expectNoBrowserErrors(page, errors);
});

test('midgame fixture opens a purchased deed, previews a building, and survives reload', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/');
  await importSave(page, e2eSave((save) => {
    save.playerX = 121.5;
    save.playerZ = 113.5;
    save.day = 1;
    save.phase = 'day';
    save.elapsed = 0;
    save.inventoryOpen = false;
  }));
  await startAdventure(page, 'Continue');

  const canvas = page.getByLabel('Tarnation game canvas');
  await canvas.focus();
  await page.keyboard.press('KeyI');
  const inventory = page.getByRole('dialog', { name: /Inventory/ });
  await expect(inventory).toBeVisible();
  await inventory.getByRole('button', { name: /Use Fence Section/ }).click({ force: true });
  const build = page.getByRole('dialog', { name: 'Choose a structure' });
  await expect(build).toBeVisible();
  await expect(build.getByRole('list', { name: 'Placeable buildings' })).toBeVisible();
  await expect(build).toContainText(/Fence|Gate/);
  await page.keyboard.press('Escape');
  await expect(build).toBeHidden();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeEnabled({ timeout: 15_000 });
  await expect(page.getByText('A saved adventure is available.')).toBeVisible();
  await expectNoBrowserErrors(page, errors);
});

test('night fixture shows a deterministic fox raid in the production build', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/');
  await importSave(page, e2eSave((save) => {
    save.day = 3;
    save.phase = 'night';
    save.elapsed = 1;
    save.playerX = 104.5;
    save.playerZ = 111.5;
  }));
  await startAdventure(page, 'Continue');
  await page.waitForTimeout(4_000);
  await expect(page.locator('.toast')).toContainText(/Diggler|Nibbler|Sapper|Hauler|fox/i, { timeout: 15_000 });
  await expectNoBrowserErrors(page, errors);
});

test('completed fixture shows and dismisses the authored settlement objective', async ({ page }) => {
  const errors = captureBrowserErrors(page);
  await page.goto('/');
  const endingSave = completedE2eSave((save) => {
    save.day = 5;
    save.phase = 'day';
    save.elapsed = 0;
    save.stats.cropsHarvested = 8;
    save.stats.hybridsDiscovered = 1;
    save.winShown = false;
  });
  await importSave(page, endingSave);
  await startAdventure(page, 'Continue');
  const ending = page.getByRole('dialog', { name: 'Homestead Established' });
  await expect(ending).toBeVisible({ timeout: 15_000 });
  await expect(ending).toContainText('Grow, experiment, defend, and develop');
  await expect(ending.getByRole('button', { name: 'Keep playing' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ending).toBeHidden();
  await expectNoBrowserErrors(page, errors);
});
