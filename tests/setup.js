/**
 * tests/setup.js
 *
 * Laedt alle Clarity IIFE-Scripts in den jsdom-Kontext von Vitest.
 * Dadurch stehen window.ClarityUtils, window.FunnelModules etc. in allen Tests zur Verfuegung.
 *
 * Hintergrund: Die Scripts verwenden das IIFE-Pattern:
 *   (function(window) { window.ClarityUtils = {...} })(window)
 * Mit jsdom haben wir ein echtes window-Objekt, sodass die Scripts direkt ausgefuehrt werden koennen.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Hilfsfunktion: Laedt ein Script relativ zum Projektstamm
function loadScript(relativePath) {
  const absolutePath = resolve(process.cwd(), relativePath);
  const code = readFileSync(absolutePath, 'utf-8');
  // Fuehrt den Code im aktuellen window-Kontext aus (jsdom stellt window bereit)
  // eslint-disable-next-line no-new-func
  new Function('window', code)(window);
}

// Ladereihenfolge: core zuerst (genau wie in index.html)
loadScript('scripts/core/utils.js');
loadScript('scripts/core/modules.js');
