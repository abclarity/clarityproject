import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // jsdom simuliert den Browser (window-Objekt verfuegbar)
    environment: 'jsdom',

    // Setup-Datei laedt alle IIFE-Scripts in den jsdom-Kontext
    setupFiles: ['./tests/setup.js'],

    // Test-Dateien nur in tests/unit/
    include: ['tests/unit/**/*.test.js'],

    // Coverage-Konfiguration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['scripts/core/**/*.js'],
      exclude: ['scripts/legacy/**']
    },

    // Verstaendliche Fehlermeldungen
    reporter: 'verbose'
  }
});
