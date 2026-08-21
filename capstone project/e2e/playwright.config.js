const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5000 },
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    actionTimeout: 5000
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ],
  // set base URL for the frontend dev server (adjust if needed)
  webServer: undefined
});
