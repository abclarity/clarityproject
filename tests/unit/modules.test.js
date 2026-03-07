/**
 * tests/unit/modules.test.js
 *
 * Unit Tests fuer das Modul-System (scripts/core/modules.js)
 * Stellt sicher dass alle Module korrekt definiert sind und die erwartete Struktur haben.
 *
 * FunnelModules API (laut modules.js):
 *   window.FunnelModules.buildFunnelFromModules(moduleIds) → { columns, inputs, kpiCols, modules }
 *   window.FunnelModules.traffic   → TRAFFIC_MODULES Objekt
 *   window.FunnelModules.funnel    → FUNNEL_MODULES Objekt
 *   window.FunnelModules.qualification → QUALIFICATION_MODULES Objekt
 *   window.FunnelModules.close     → CLOSE_MODULES Objekt
 *   window.FunnelModules.revenue   → REVENUE_MODULES Objekt
 *   window.FunnelModules.ALL_MODULES → alle Kategorien zusammen
 */

import { describe, it, expect, beforeAll } from 'vitest';

let FunnelModules;

// Hilfsfunktion: alle Module als flaches Array
function getAllModules() {
  return Object.values(FunnelModules.ALL_MODULES)
    .flatMap(category => Object.values(category));
}

// Hilfsfunktion: ein Modul per ID holen
function getModule(id) {
  for (const category of Object.values(FunnelModules.ALL_MODULES)) {
    if (category[id]) return category[id];
  }
  return undefined;
}

beforeAll(() => {
  FunnelModules = window.FunnelModules;
});

// ============================================================
// MODUL-REGISTRY EXISTENZ
// ============================================================

describe('FunnelModules API verfuegbar', () => {
  it('FunnelModules ist im window-Objekt verfuegbar', () => {
    expect(FunnelModules).toBeDefined();
  });

  it('FunnelModules hat buildFunnelFromModules-Funktion', () => {
    expect(typeof FunnelModules.buildFunnelFromModules).toBe('function');
  });

  it('FunnelModules hat alle 5 Modul-Kategorien', () => {
    expect(FunnelModules.traffic).toBeDefined();
    expect(FunnelModules.funnel).toBeDefined();
    expect(FunnelModules.qualification).toBeDefined();
    expect(FunnelModules.close).toBeDefined();
    expect(FunnelModules.revenue).toBeDefined();
  });

  it('ALL_MODULES ist verfuegbar und vollstaendig', () => {
    expect(FunnelModules.ALL_MODULES).toBeDefined();
    expect(Object.keys(FunnelModules.ALL_MODULES)).toEqual(
      expect.arrayContaining(['traffic', 'funnel', 'qualification', 'close', 'revenue'])
    );
  });
});

// ============================================================
// PFLICHT-FELDER ALLER MODULE
// ============================================================

describe('Alle Module haben die Pflicht-Felder', () => {
  const REQUIRED_KEYS = ['id', 'name', 'columns', 'inputs', 'inputKeys', 'provides'];

  it('Jedes Modul hat id, name, columns, inputs, inputKeys, provides', () => {
    const all = getAllModules();
    expect(all.length).toBeGreaterThan(0);

    all.forEach(mod => {
      REQUIRED_KEYS.forEach(key => {
        expect(mod, `Modul "${mod?.id}" fehlt "${key}"`).toHaveProperty(key);
      });
    });
  });

  it('columns ist immer ein Array', () => {
    getAllModules().forEach(mod => {
      expect(Array.isArray(mod.columns), `"${mod.id}" columns ist kein Array`).toBe(true);
    });
  });

  it('inputs ist immer ein Array', () => {
    getAllModules().forEach(mod => {
      expect(Array.isArray(mod.inputs), `"${mod.id}" inputs ist kein Array`).toBe(true);
    });
  });

  it('inputKeys ist immer ein Array', () => {
    getAllModules().forEach(mod => {
      expect(Array.isArray(mod.inputKeys), `"${mod.id}" inputKeys ist kein Array`).toBe(true);
    });
  });

  it('provides ist immer ein Array', () => {
    getAllModules().forEach(mod => {
      expect(Array.isArray(mod.provides), `"${mod.id}" provides ist kein Array`).toBe(true);
    });
  });

  it('id ist ein nicht-leerer String', () => {
    getAllModules().forEach(mod => {
      expect(typeof mod.id).toBe('string');
      expect(mod.id.length).toBeGreaterThan(0);
    });
  });

  it('name ist ein nicht-leerer String', () => {
    getAllModules().forEach(mod => {
      expect(typeof mod.name).toBe('string');
      expect(mod.name.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================
// BEKANNTE MODULE EXISTIEREN
// ============================================================

describe('Bekannte Module sind vorhanden und korrekt', () => {
  it('paid-ads Modul existiert mit korrekten provides', () => {
    const mod = getModule('paid-ads');
    expect(mod).toBeDefined();
    expect(mod.provides).toContain('adspend');
    expect(mod.provides).toContain('clicks');
  });

  it('classic-vsl Modul existiert mit korrekten provides', () => {
    const mod = getModule('classic-vsl');
    expect(mod).toBeDefined();
    expect(mod.provides).toContain('leads');
    expect(mod.provides).toContain('survey');
  });

  it('1-call-close Modul existiert mit korrekten provides', () => {
    const mod = getModule('1-call-close');
    expect(mod).toBeDefined();
    expect(mod.provides).toContain('closingCall');
    expect(mod.provides).toContain('closingBooking');
  });

  it('2-call-close Modul existiert mit korrekten provides', () => {
    const mod = getModule('2-call-close');
    expect(mod).toBeDefined();
    expect(mod.provides).toContain('settingBooking');
    expect(mod.provides).toContain('closingCall');
  });

  it('revenue-paid Modul existiert mit korrekten provides', () => {
    const mod = getModule('revenue-paid');
    expect(mod).toBeDefined();
    expect(mod.provides).toContain('units');
    expect(mod.provides).toContain('revenue');
    expect(mod.provides).toContain('cash');
  });

  it('survey-qualified Modul existiert mit korrekten provides', () => {
    const mod = getModule('survey-qualified');
    expect(mod).toBeDefined();
    expect(mod.provides).toContain('surveyQuali');
  });
});

// ============================================================
// FUNNEL BUILDER
// ============================================================

describe('buildFunnelFromModules()', () => {
  it('Typischer Paid-Ads Funnel wird korrekt gebaut', () => {
    const moduleIds = [
      'paid-ads',
      'classic-vsl',
      'survey-qualified',
      '2-call-close',
      'revenue-paid'
    ];
    const config = FunnelModules.buildFunnelFromModules(moduleIds);

    expect(config).toBeDefined();
    expect(config.columns).toBeDefined();
    expect(Array.isArray(config.columns)).toBe(true);
    // Mindestens Tag + Datum + Modul-Spalten
    expect(config.columns.length).toBeGreaterThan(2);
  });

  it('Funnel-Spalten enthalten die Standard-Spalten Tag und Datum', () => {
    const config = FunnelModules.buildFunnelFromModules(['paid-ads']);
    expect(config.columns).toContain('Tag');
    expect(config.columns).toContain('Datum');
  });

  it('Funnel-Spalten enthalten Traffic-Spalten aus paid-ads', () => {
    const config = FunnelModules.buildFunnelFromModules(['paid-ads', 'classic-vsl', 'no-survey', '1-call-close', 'revenue-paid']);
    expect(config.columns).toContain('Adspend');
    expect(config.columns).toContain('Clicks');
  });

  it('Funnel-Spalten enthalten Revenue-Spalten aus revenue-paid', () => {
    const config = FunnelModules.buildFunnelFromModules(['paid-ads', 'classic-vsl', 'no-survey', '1-call-close', 'revenue-paid']);
    expect(config.columns).toContain('Units');
    expect(config.columns).toContain('Revenue');
    expect(config.columns).toContain('Cash');
  });

  it('Keine doppelten Spalten im gebauten Funnel', () => {
    const moduleIds = ['paid-ads', 'classic-vsl', 'survey-qualified', '2-call-close', 'revenue-paid'];
    const config = FunnelModules.buildFunnelFromModules(moduleIds);
    const unique = [...new Set(config.columns)];
    expect(config.columns.length).toBe(unique.length);
  });

  it('config.inputs enthaelt nur editierbare Felder (keine KPI-Spalten)', () => {
    const config = FunnelModules.buildFunnelFromModules(['paid-ads', 'classic-vsl', 'no-survey', '1-call-close', 'revenue-paid']);
    // Adspend ist ein Input
    expect(config.inputs).toContain('Adspend');
    // CPM ist ein KPI, kein Input
    expect(config.inputs).not.toContain('CPM-€');
  });

  it('config.kpiCols enthaelt berechnete Spalten', () => {
    const config = FunnelModules.buildFunnelFromModules(['paid-ads', 'classic-vsl', 'no-survey', '1-call-close', 'revenue-paid']);
    // CPM, CTR, CPC sind KPIs (berechnet, nicht editierbar)
    expect(config.kpiCols).toContain('CPM-€');
    expect(config.kpiCols).toContain('CTR-%');
  });

  it('Leere Modul-Liste liefert nur Tag und Datum Spalten', () => {
    // buildFunnelFromModules([]) gibt immer ["Tag", "Datum"] zurueck (Mindeststruktur)
    const config = FunnelModules.buildFunnelFromModules([]);
    expect(config.columns).toContain('Tag');
    expect(config.columns).toContain('Datum');
    // Nur diese beiden Standard-Spalten
    expect(config.columns.length).toBe(2);
  });
});

// ============================================================
// PRESET-KOMBINATIONEN
// ============================================================

describe('Preset-Kombinationen sind konsistent', () => {
  const PRESETS = [
    ['paid-ads', 'classic-vsl', 'survey-qualified', '1-call-close', 'revenue-paid'],
    ['paid-ads', 'classic-vsl', 'survey-qualified', '2-call-close', 'revenue-paid'],
    ['paid-ads', 'classic-vsl', 'no-survey', '1-call-close', 'revenue-paid'],
    ['paid-ads', 'direct-vsl', 'survey-unqualified', '1-call-close', 'revenue-paid'],
    ['organic', 'classic-vsl-organic', 'survey-qualified-organic', '2-call-close-organic', 'revenue-organic'],
  ];

  PRESETS.forEach((moduleIds, index) => {
    it(`Preset ${index + 1} [${moduleIds.join(', ')}] baut ohne Fehler`, () => {
      expect(() => {
        const config = FunnelModules.buildFunnelFromModules(moduleIds);
        expect(config).toBeDefined();
        expect(config.columns.length).toBeGreaterThan(2);
      }).not.toThrow();
    });
  });
});
