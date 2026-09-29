import { defineConfig, devices } from '@playwright/test';

const productionSmoke=process.env.JF_PRODUCTION_SMOKE==='1';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: productionSmoke?45000:30000,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: productionSmoke?(process.env.JF_PRODUCTION_URL||'https://app.justfuelnutrition.co.za'):'http://127.0.0.1:4173',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: productionSmoke?undefined:{
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
