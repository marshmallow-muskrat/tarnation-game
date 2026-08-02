import { defineConfig } from '@playwright/test';

const isCi = Boolean(process.env.CI || process.env.PLAYWRIGHT_CI);

/** Production-build browser coverage used by QA-01 and the release gate. */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{testFileName}/{arg}{ext}',
  fullyParallel: false,
  forbidOnly: isCi,
  retries: isCi ? 2 : 0,
  workers: 1,
  reporter: isCi
    ? [['line'], ['html', { outputFolder: 'qa-artifacts/playwright-report', open: 'never' }]]
    : 'list',
  // Software WebGL on the hosted Linux runner can take several seconds to
  // answer each browser protocol turn while the fixed-step loop is rendering.
  // Keep the journey assertions bounded, but give a complete production-build
  // journey enough time to finish before Playwright interrupts it.
  timeout: 120_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview:qa',
    url: 'http://127.0.0.1:4173/',
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
