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
  timeout: 60_000,
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
    // Keep the desktop-first contract while bounding the software-WebGL workload
    // on hosted runners; the launch-card baseline is element-scoped.
    viewport: { width: 1280, height: 720 },
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
