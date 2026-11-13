import { defineConfig } from '@playwright/test';

/**
 * Browser smoke tests (plan.md §9). Uses the system Chrome (no browser download) against the
 * production preview. Run: npm run build && npm run e2e
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:4318/nameplate-forge/',
    channel: 'chrome',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npx vite preview --port 4318 --strictPort',
    url: 'http://localhost:4318/nameplate-forge/',
    reuseExistingServer: true,
  },
});
