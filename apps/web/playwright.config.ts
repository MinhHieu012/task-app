import { defineConfig, devices } from '@playwright/test';

// E2E against the dev server. Covers what needs no account (sign-in, guards, the public design system, layout at
// every target viewport). Signed-in flows run against the real Supabase project, so they are not automated here.
const PORT = 4310;
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  webServer: { command: `npx ng serve --port ${PORT}`, url: `http://localhost:${PORT}/sign-in`, reuseExistingServer: true, timeout: 180_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'chrome' } }],
});
