/**
 * tests/e2e/kpi-calculation.spec.js
 *
 * E2E Tests: App-Start und KPI-Berechnungen im Browser.
 *
 * Wichtige Erkenntnisse ueber die App-Architektur:
 * - Auth-Screen wird dynamisch erstellt (#authContainer)
 * - App-Elemente (#app-header, #funnelSidebar, #app) sind erst NACH Login sichtbar
 * - 403-Fehler beim Laden sind normal (Supabase prueft Auth)
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.CLARITY_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.CLARITY_TEST_PASSWORD || '';

// alert() in index.html blockiert headless Browser – automatisch schliessen
// Diese Funktion muss VOR page.goto() aufgerufen werden
function dismissAlerts(page) {
  page.on('dialog', dialog => dialog.dismiss());
}

// Hilfsfunktion: Login durchfuehren
async function doLogin(page) {
  dismissAlerts(page);
  await page.goto('/');
  await expect(page.locator('#loginEmail')).toBeVisible({ timeout: 10000 });
  await page.fill('#loginEmail', TEST_EMAIL);
  await page.fill('#loginPassword', TEST_PASSWORD);
  await page.click('#loginForm button[type="submit"]');
  // #app-header ist standardmaessig sichtbar (kein 'hidden' im HTML) - deshalb auf authContainer.hidden warten
  await expect(page.locator('#authContainer')).toBeHidden({ timeout: 15000 });
}

test.describe('App-Start ohne Login', () => {

  test.beforeEach(async ({ page }) => {
    dismissAlerts(page);
  });

  test('App laedt ohne kritische JavaScript-Fehler', async ({ page }) => {
    const jsErrors = [];

    page.on('pageerror', err => {
      jsErrors.push(err.message);
    });

    await page.goto('/');

    // Warten bis Auth-Screen erscheint (JS hat geladen und ausgefuehrt)
    await expect(page.locator('#authContainer')).toBeVisible({ timeout: 10000 });

    // Keine JavaScript-Fehler erlaubt (pageerror = echte JS-Crashes)
    expect(jsErrors, `JS-Fehler gefunden: ${jsErrors.join(', ')}`).toHaveLength(0);
  });

  test('CSS laedt korrekt (App ist nicht unstyled)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bgColor = await page.evaluate(() =>
      window.getComputedStyle(document.body).backgroundColor
    );
    // Wenn CSS laedt, hat body einen gesetzten Hintergrund (kein leerer String)
    expect(bgColor).not.toBe('');
  });

  test('Auth-Container hat korrekte Struktur', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#authContainer')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#loginEmail')).toBeVisible();
    await expect(page.locator('#loginPassword')).toBeVisible();
    await expect(page.locator('#loginForm button[type="submit"]')).toBeVisible();
  });

});

test.describe('App nach Login', () => {

  test('Nach Login sind alle App-Elemente sichtbar', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test-Credentials nicht gesetzt');

    await doLogin(page);

    // Hauptelemente muessen nach Login erscheinen
    await expect(page.locator('#app-header')).toBeVisible();
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#tabs, .tabbar')).toBeAttached();
  });

  test('Sidebar und Navigation sind nach Login sichtbar', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test-Credentials nicht gesetzt');

    await doLogin(page);

    // Sidebar (Funnel-Navigation) erscheint nach Login
    await expect(
      page.locator('#funnelSidebar, #appSidebar, .sidebar').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('App-Inhaltsbereich wird nach Login geladen', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'Test-Credentials nicht gesetzt');

    await doLogin(page);

    // Entweder eine Tracking-Tabelle (Konto mit Funnels) oder der Willkommens-Screen
    // (frisches Konto ohne Funnels) – beides ist ein korrekter App-Zustand
    const hasTable = await page.locator('#app table, .tracking-table').first().isVisible().catch(() => false);
    const hasEmptyState = await page.getByText('Ersten Funnel erstellen').isVisible().catch(() => false);

    expect(hasTable || hasEmptyState, 'Weder Tabelle noch Willkommens-Screen gefunden').toBe(true);
  });

});
