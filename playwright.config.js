import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Laedt .env.test wenn vorhanden (Test-Credentials)
config({ path: '.env.test' });

export default defineConfig({
  // Verzeichnis mit den E2E Tests
  testDir: './tests/e2e',

  // Timeout pro Test (60 Sekunden – Supabase kann langsam sein)
  timeout: 60000,

  // Wie viele Test-Wiederholungen bei Fehlern (0 = kein Retry)
  retries: 0,

  // Parallele Ausfuehrung
  workers: 1,

  // Screenshots und Videos bei Fehlern automatisch speichern
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',

    // Headless Browser (kein Fenster oeffnen)
    headless: true,
  },

  // Browser: Nur Chromium fuer schnelle Ausfuehrung
  // Fuer Cross-Browser-Tests: Firefox und Safari aktivieren
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Aktivieren wenn gebraucht:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'safari', use: { ...devices['Desktop Safari'] } },
  ],

  // App automatisch starten vor den Tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },

  // Reporter: Text in Terminal + HTML-Report
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/report', open: 'never' }],
  ],

  // Screenshots etc. in diesem Ordner speichern
  outputDir: 'tests/e2e/artifacts',
});
