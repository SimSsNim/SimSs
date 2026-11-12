import { defineConfig } from '@playwright/test';

const chromiumPath = process.env.PW_CHROMIUM_PATH; // 필요할 때만(예: /opt/pw-browsers/chromium/...)

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/',
    trace: 'off',
    launchOptions: chromiumPath ? { executablePath: chromiumPath } : {},
  },
  projects: [
    { name: 'mobile-light', use: { viewport: { width: 390, height: 844 }, colorScheme: 'light', hasTouch: true } },
    { name: 'mobile-dark', use: { viewport: { width: 390, height: 844 }, colorScheme: 'dark', hasTouch: true } },
    { name: 'desktop-light', use: { viewport: { width: 1280, height: 800 }, colorScheme: 'light' } },
    { name: 'desktop-dark', use: { viewport: { width: 1280, height: 800 }, colorScheme: 'dark' } },
  ],
  webServer: {
    command: 'npm run lessons:index && npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
