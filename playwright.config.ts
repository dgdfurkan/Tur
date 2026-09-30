import { defineConfig, devices } from '@playwright/test';

// Not the development port: the tests must run against the built site, never a dev server.
const port = 4329;
const basePath = process.env.BASE_PATH ?? '/Tur';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}${basePath}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // The site under test is the build made by `npm run build:e2e`, whose panel opens with the
    // test code. --ignore-lock keeps the server in the foreground; Astro 7 otherwise detaches
    // it into a background process when it detects an AI coding agent.
    command: `npx astro preview --ignore-lock --port ${port}`,
    env: { OUT_DIR: './dist-e2e' },
    url: `http://localhost:${port}${basePath}/`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
