/**
 * tests/e2e/auth.spec.js
 *
 * E2E Tests fuer den Login/Logout-Flow.
 *
 * Wichtig: Die Auth-Seite wird DYNAMISCH per JS erstellt (nicht im HTML).
 * Auth-Container ID: #authContainer
 * Login-Felder: #loginEmail, #loginPassword
 * Login-Button: #loginForm button[type="submit"]
 *
 * Ablauf beim Seitenaufruf:
 * 1. Seite laedt (weiss, kein Inhalt)
 * 2. Supabase prueft Session (async, ~1-2 Sek)
 * 3. Kein Login → Auth-Formular wird in DOM eingefuegt
 * 4. Login erfolgreich → App-Hauptbereich erscheint
 */

import { test, expect } from '@playwright/test';

const TEST_EMAIL = process.env.CLARITY_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.CLARITY_TEST_PASSWORD || '';

test.describe('Auth Flow', () => {

  // alert() in index.html blockiert headless Browser – automatisch schliessen
  test.beforeEach(async ({ page }) => {
    page.on('dialog', dialog => dialog.dismiss());
  });

  test('Login-Seite erscheint nach Seitenladen', async ({ page }) => {
    await page.goto('/');

    // Warten bis Auth-Container dynamisch erstellt wurde (max 10 Sek)
    await expect(page.locator('#authContainer')).toBeVisible({ timeout: 10000 });

    // Login-Formular muss sichtbar sein
    await expect(page.locator('#loginEmail')).toBeVisible();
    await expect(page.locator('#loginPassword')).toBeVisible();
  });

  test('Login mit gueltigen Credentials funktioniert', async ({ page }) => {
    test.skip(!TEST_EMAIL || !TEST_PASSWORD, 'CLARITY_TEST_EMAIL / CLARITY_TEST_PASSWORD nicht in .env.test');

    await page.goto('/');

    // Warten bis Auth-Formular erscheint
    await expect(page.locator('#loginEmail')).toBeVisible({ timeout: 10000 });

    // Credentials eingeben
    await page.fill('#loginEmail', TEST_EMAIL);
    await page.fill('#loginPassword', TEST_PASSWORD);
    await page.click('#loginForm button[type="submit"]');

    // Nach erfolgreichem Login: App-Hauptbereich muss erscheinen
    // Auth-Container verschwindet, App-Header wird sichtbar
    await expect(page.locator('#authContainer')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('#app-header')).toBeVisible({ timeout: 15000 });
  });

  test('Login mit falschen Credentials zeigt Fehlermeldung', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('#loginEmail')).toBeVisible({ timeout: 10000 });

    await page.fill('#loginEmail', 'falsch@example.com');
    await page.fill('#loginPassword', 'wrongpassword123');
    await page.click('#loginForm button[type="submit"]');

    // Fehlermeldung muss erscheinen (Toast oder Auth-Error-Element)
    // Wir warten auf irgendeinen Fehler-Hinweis
    await expect(
      page.locator('.toast-error, #authError, .auth-error, [class*="error"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

});
