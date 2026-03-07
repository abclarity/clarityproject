/**
 * tests/unit/kpi-calculations.test.js
 *
 * Unit Tests fuer ClarityUtils.calculateKPIs()
 * Testet alle KPI-Formeln aus scripts/core/utils.js
 *
 * Struktur: describe(Kategorie) → it(konkreter Fall)
 * Fehler bedeuten: Eine Formel liefert falsche Ergebnisse → sofortiger Handlungsbedarf!
 */

import { describe, it, expect, beforeAll } from 'vitest';

// ClarityUtils wird durch tests/setup.js in window geladen
// Wir holen es uns direkt aus window heraus
let calculateKPIs;
let formatValue;
let parseNumber;

beforeAll(() => {
  calculateKPIs = window.ClarityUtils.calculateKPIs;
  formatValue = window.ClarityUtils.formatValue;
  parseNumber = window.ClarityUtils.parseNumber;
});

// ============================================================
// HILFSFUNKTIONEN
// ============================================================

// Rundet auf 4 Dezimalstellen um Floating-Point-Probleme zu vermeiden
function round(val, decimals = 4) {
  return Math.round(val * 10 ** decimals) / 10 ** decimals;
}

// ============================================================
// TRAFFIC: PAID ADS
// ============================================================

describe('Traffic: Paid Ads KPIs', () => {
  it('CPM berechnet sich korrekt (Adspend / Impressionen * 1000)', () => {
    const result = calculateKPIs({ adspend: 1000, impr: 50000 });
    expect(round(result['CPM-€'])).toBe(20); // 1000 / 50000 * 1000 = 20
  });

  it('CTR berechnet sich korrekt (Clicks / Impressionen * 100)', () => {
    const result = calculateKPIs({ impr: 10000, clicks: 300 });
    expect(round(result['CTR-%'])).toBe(3); // 300 / 10000 * 100 = 3%
  });

  it('CPC berechnet sich korrekt (Adspend / Clicks)', () => {
    const result = calculateKPIs({ adspend: 500, clicks: 100 });
    expect(round(result['CPC-€'])).toBe(5); // 500 / 100 = 5€
  });

  it('CPM ist 0 wenn keine Impressionen', () => {
    const result = calculateKPIs({ adspend: 1000, impr: 0 });
    expect(result['CPM-€']).toBe(0);
  });

  it('CTR ist 0 wenn keine Impressionen und kein Cold-Email-Context', () => {
    const result = calculateKPIs({ clicks: 100 });
    expect(result['CTR-%']).toBe(0);
  });

  it('CPC ist 0 wenn keine Clicks', () => {
    const result = calculateKPIs({ adspend: 500, clicks: 0 });
    expect(result['CPC-€']).toBe(0);
  });
});

// ============================================================
// TRAFFIC: COLD EMAIL
// ============================================================

describe('Traffic: Cold Email KPIs', () => {
  it('Open-Rate berechnet sich korrekt (Opened / Emails Sent * 100)', () => {
    const result = calculateKPIs({ emailsSent: 1000, opened: 250 });
    expect(round(result['Open-%'])).toBe(25); // 250 / 1000 * 100 = 25%
  });

  it('CTR fuer Cold Email berechnet sich korrekt (Clicks / Opened * 100)', () => {
    // Wenn opened vorhanden aber kein impr → Cold Email CTR
    const result = calculateKPIs({ opened: 250, clicks: 50 });
    expect(round(result['CTR-%'])).toBe(20); // 50 / 250 * 100 = 20%
  });

  it('Open-Rate ist 0 wenn keine Emails gesendet', () => {
    const result = calculateKPIs({ emailsSent: 0, opened: 100 });
    expect(result['Open-%']).toBe(0);
  });
});

// ============================================================
// TRAFFIC: COLD CALLS
// ============================================================

describe('Traffic: Cold Calls KPIs', () => {
  it('Reach-Rate berechnet sich korrekt (Reached / Dialed * 100)', () => {
    const result = calculateKPIs({ callsDialed: 200, reached: 60 });
    expect(round(result['Reach-%'])).toBe(30); // 60 / 200 * 100 = 30%
  });

  it('Reach-Rate ist 0 wenn keine Calls dialed', () => {
    const result = calculateKPIs({ callsDialed: 0, reached: 60 });
    expect(result['Reach-%']).toBe(0);
  });
});

// ============================================================
// FUNNEL: CLASSIC VSL
// ============================================================

describe('Funnel: Classic VSL KPIs', () => {
  it('LP-Rate berechnet sich korrekt (Leads / Clicks * 100)', () => {
    const result = calculateKPIs({ clicks: 500, leads: 50 });
    expect(round(result['LP-%'])).toBe(10); // 50 / 500 * 100 = 10%
  });

  it('CPL berechnet sich korrekt (Adspend / Leads)', () => {
    const result = calculateKPIs({ adspend: 1000, leads: 20 });
    expect(round(result['CPL-€'])).toBe(50); // 1000 / 20 = 50€
  });

  it('VideoCR berechnet sich korrekt (Survey / Leads * 100)', () => {
    const result = calculateKPIs({ leads: 100, survey: 40 });
    expect(round(result['VideoCR-%'])).toBe(40); // 40 / 100 * 100 = 40%
  });

  it('VideoCR fuer Direct VSL (Survey / Clicks * 100) wenn keine Leads', () => {
    const result = calculateKPIs({ clicks: 200, survey: 60 });
    expect(round(result['VideoCR-%'])).toBe(30); // 60 / 200 * 100 = 30%
  });

  it('Survey-Kosten berechnen sich korrekt (Adspend / Survey)', () => {
    const result = calculateKPIs({ adspend: 1000, survey: 25 });
    expect(round(result['Survey-€'])).toBe(40); // 1000 / 25 = 40€
  });

  it('LP-Rate ist 0 wenn keine Clicks', () => {
    const result = calculateKPIs({ leads: 50, clicks: 0 });
    expect(result['LP-%']).toBe(0);
  });

  it('CPL ist 0 wenn keine Leads', () => {
    const result = calculateKPIs({ adspend: 1000, leads: 0 });
    expect(result['CPL-€']).toBe(0);
  });
});

// ============================================================
// QUALIFICATION
// ============================================================

describe('Qualification KPIs', () => {
  it('SurveyQuali-Rate berechnet sich korrekt (SurveyQuali / Survey * 100)', () => {
    const result = calculateKPIs({ survey: 50, surveyQuali: 30 });
    expect(round(result['SurveyQuali-%'])).toBe(60); // 30 / 50 * 100 = 60%
  });

  it('SurveyQuali-Kosten berechnen sich korrekt (Adspend / SurveyQuali)', () => {
    const result = calculateKPIs({ adspend: 900, surveyQuali: 30 });
    expect(round(result['SurveyQuali-€'])).toBe(30); // 900 / 30 = 30€
  });

  it('SurveyQuali-Rate ist 0 wenn keine Surveys', () => {
    const result = calculateKPIs({ survey: 0, surveyQuali: 30 });
    expect(result['SurveyQuali-%']).toBe(0);
  });
});

// ============================================================
// CLOSE: 1-CALL CLOSE
// ============================================================

describe('Close: 1-Call Close KPIs', () => {
  it('Booking-Rate von SurveyQuali (ClosingBooking / SurveyQuali * 100)', () => {
    const result = calculateKPIs({ surveyQuali: 30, closingBooking: 18 });
    expect(round(result['Booking-%'])).toBe(60); // 18 / 30 * 100 = 60%
  });

  it('Booking-Rate von Survey wenn kein SurveyQuali (ClosingBooking / Survey * 100)', () => {
    const result = calculateKPIs({ survey: 40, closingBooking: 20 });
    expect(round(result['Booking-%'])).toBe(50); // 20 / 40 * 100 = 50%
  });

  it('Booking-Rate von Leads wenn kein Survey und kein SurveyQuali', () => {
    const result = calculateKPIs({ leads: 100, closingBooking: 25 });
    expect(round(result['Booking-%'])).toBe(25); // 25 / 100 * 100 = 25%
  });

  it('Booking-Kosten berechnen sich korrekt (Adspend / ClosingBooking)', () => {
    const result = calculateKPIs({ adspend: 1000, closingBooking: 20 });
    expect(round(result['Booking-€'])).toBe(50); // 1000 / 20 = 50€
  });

  it('Quali-Rate berechnet sich korrekt (ClosingTermin / ClosingBooking * 100)', () => {
    const result = calculateKPIs({ closingBooking: 20, closingTermin: 15 });
    expect(round(result['Quali-%'])).toBe(75); // 15 / 20 * 100 = 75%
  });

  it('SUR berechnet sich korrekt (ClosingCall / ClosingTermin * 100)', () => {
    const result = calculateKPIs({ closingTermin: 15, closingCall: 12 });
    expect(round(result['SUR-%'])).toBe(80); // 12 / 15 * 100 = 80%
  });

  it('Termin-Kosten berechnen sich korrekt (Adspend / ClosingTermin)', () => {
    const result = calculateKPIs({ adspend: 1000, closingTermin: 10 });
    expect(round(result['Termin-€'])).toBe(100);
  });

  it('SUR-Kosten berechnen sich korrekt (Adspend / ClosingCall)', () => {
    const result = calculateKPIs({ adspend: 1000, closingCall: 8 });
    expect(round(result['SUR-€'])).toBe(125); // 1000 / 8 = 125€
  });
});

// ============================================================
// CLOSE: 2-CALL CLOSE - SETTING
// ============================================================

describe('Close: 2-Call Close Setting KPIs', () => {
  it('SB-Rate berechnet sich korrekt (SettingBooking / SurveyQuali * 100)', () => {
    const result = calculateKPIs({ surveyQuali: 40, settingBooking: 28 });
    expect(round(result['SB-%'])).toBe(70); // 28 / 40 * 100 = 70%
  });

  it('SQ-Rate berechnet sich korrekt (SettingTermin / SettingBooking * 100)', () => {
    const result = calculateKPIs({ settingBooking: 28, settingTermin: 21 });
    expect(round(result['SQ-%'])).toBe(75); // 21 / 28 * 100 = 75%
  });

  it('SS-Rate berechnet sich korrekt (SettingCall / SettingTermin * 100)', () => {
    const result = calculateKPIs({ settingTermin: 21, settingCall: 18 });
    expect(round(result['SS-%'])).toBe(round(18 / 21 * 100));
  });

  it('CB-Rate berechnet sich korrekt (ClosingBooking / SettingCall * 100)', () => {
    const result = calculateKPIs({ settingCall: 18, closingBooking: 12 });
    expect(round(result['CB-%'])).toBe(round(12 / 18 * 100));
  });

  it('CQ-Rate berechnet sich korrekt (ClosingTermin / ClosingBooking * 100)', () => {
    const result = calculateKPIs({ closingBooking: 12, closingTermin: 10 });
    expect(round(result['CQ-%'])).toBe(round(10 / 12 * 100));
  });

  it('CS-Rate berechnet sich korrekt (ClosingCall / ClosingTermin * 100)', () => {
    const result = calculateKPIs({ closingTermin: 10, closingCall: 8 });
    expect(round(result['CS-%'])).toBe(80); // 8 / 10 * 100 = 80%
  });
});

// ============================================================
// REVENUE
// ============================================================

describe('Revenue KPIs', () => {
  it('CC% berechnet sich korrekt (Units / ClosingCall * 100)', () => {
    const result = calculateKPIs({ closingCall: 10, units: 4 });
    expect(round(result['CC%'])).toBe(40); // 4 / 10 * 100 = 40%
  });

  it('LC% berechnet sich korrekt (Units / Leads * 100)', () => {
    const result = calculateKPIs({ leads: 100, units: 5 });
    expect(round(result['LC%'])).toBe(5); // 5 / 100 * 100 = 5%
  });

  it('Cash-Collection-Rate berechnet sich korrekt (Cash / Revenue * 100)', () => {
    const result = calculateKPIs({ revenue: 10000, cash: 7500 });
    expect(round(result['CC-Rate%'])).toBe(75); // 7500 / 10000 * 100 = 75%
  });

  it('CPA berechnet sich korrekt (Adspend / Units)', () => {
    const result = calculateKPIs({ adspend: 2000, units: 4 });
    expect(round(result['CPA'])).toBe(500); // 2000 / 4 = 500€
  });

  it('EPA-C berechnet sich korrekt (Cash / Units)', () => {
    const result = calculateKPIs({ cash: 12000, units: 4 });
    expect(round(result['EPA-C'])).toBe(3000); // 12000 / 4 = 3000€
  });

  it('R-P/L berechnet sich korrekt (Revenue - Adspend)', () => {
    const result = calculateKPIs({ revenue: 10000, adspend: 2000 });
    expect(round(result['R-P/L'])).toBe(8000); // 10000 - 2000 = 8000€
  });

  it('C-P/L berechnet sich korrekt (Cash - Adspend)', () => {
    const result = calculateKPIs({ cash: 7500, adspend: 2000 });
    expect(round(result['C-P/L'])).toBe(5500); // 7500 - 2000 = 5500€
  });

  it('R-ROI berechnet sich korrekt (Revenue / Adspend)', () => {
    const result = calculateKPIs({ revenue: 10000, adspend: 2000 });
    expect(round(result['R-ROI'])).toBe(5); // 10000 / 2000 = 5x
  });

  it('C-ROI berechnet sich korrekt (Cash / Adspend)', () => {
    const result = calculateKPIs({ cash: 7500, adspend: 2000 });
    expect(round(result['C-ROI'])).toBe(3.75); // 7500 / 2000 = 3.75x
  });

  it('ROI ist 0 wenn kein Adspend', () => {
    const result = calculateKPIs({ revenue: 10000, adspend: 0 });
    expect(result['R-ROI']).toBe(0);
  });

  it('CC% ist 0 wenn keine ClosingCalls', () => {
    const result = calculateKPIs({ closingCall: 0, units: 4 });
    expect(result['CC%']).toBe(0);
  });
});

// ============================================================
// EDGE CASES: Keine NaN, keine Infinity
// ============================================================

describe('Edge Cases: Kein NaN, keine Infinity', () => {
  it('Leere Daten produzieren keine NaN-Werte', () => {
    const result = calculateKPIs({});
    Object.entries(result).forEach(([key, val]) => {
      expect(isNaN(val), `${key} ist NaN`).toBe(false);
      expect(val === Infinity || val === -Infinity, `${key} ist Infinity`).toBe(false);
    });
  });

  it('Division durch 0 ergibt immer 0, nie Infinity', () => {
    const result = calculateKPIs({ adspend: 1000, leads: 0, impr: 0, clicks: 0 });
    expect(result['CPL-€']).toBe(0);
    expect(result['CPM-€']).toBe(0);
    expect(result['CPC-€']).toBe(0);
  });

  it('String-Werte werden als 0 behandelt', () => {
    const result = calculateKPIs({ adspend: 'abc', leads: null, impr: undefined });
    expect(isNaN(result['CPL-€'])).toBe(false);
    expect(isNaN(result['CPM-€'])).toBe(false);
  });

  it('Vollstaendiger typischer Funnel-Datensatz berechnet alle KPIs korrekt', () => {
    // Realistisches Beispiel: Facebook Ads → Classic VSL → 2-Call Close
    const data = {
      adspend: 5000,
      impr: 200000,
      reach: 150000,
      clicks: 1000,
      leads: 80,
      survey: 40,
      surveyQuali: 24,
      settingBooking: 18,
      settingTermin: 14,
      settingCall: 12,
      closingBooking: 8,
      closingTermin: 7,
      closingCall: 6,
      units: 2,
      revenue: 10000,
      cash: 7000
    };

    const result = calculateKPIs(data);

    // Alle Werte muessen valide Zahlen sein
    Object.entries(result).forEach(([key, val]) => {
      expect(typeof val, `${key} sollte eine Zahl sein`).toBe('number');
      expect(isNaN(val), `${key} ist NaN`).toBe(false);
    });

    // Stichproben-Checks
    expect(round(result['CPM-€'])).toBe(25);            // 5000 / 200000 * 1000
    expect(round(result['CPL-€'])).toBe(round(5000/80)); // 62.5
    expect(round(result['R-ROI'])).toBe(2);              // 10000 / 5000
    expect(round(result['CC-Rate%'])).toBe(70);          // 7000 / 10000 * 100
  });
});

// ============================================================
// FORMATIERUNG
// ============================================================

describe('Formatierung: formatValue()', () => {
  it('Euro-Felder werden mit € formatiert', () => {
    const result = formatValue(50, 'CPL-€');
    expect(result).toContain('€');
  });

  it('Prozent-Felder enthalten %', () => {
    const result = formatValue(25, 'CTR-%');
    expect(result).toContain('%');
  });

  it('ROI-Felder enthalten ×', () => {
    const result = formatValue(3.5, 'R-ROI');
    expect(result).toContain('×');
  });

  it('Null/NaN/Infinity wird als Strich dargestellt', () => {
    expect(formatValue(null, 'CPL-€')).toBe('–');
    expect(formatValue(NaN, 'CPL-€')).toBe('–');
    expect(formatValue(Infinity, 'CPL-€')).toBe('–');
  });
});

// ============================================================
// ZAHLEN PARSEN
// ============================================================

describe('parseNumber()', () => {
  it('Deutsche Zahlenformate werden korrekt geparst', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
  });

  it('Punkt ohne Komma wird als Tausender-Separator behandelt (DE-Locale by design)', () => {
    // parseNumber ist fuer deutsches Format (1.234,56) ausgelegt.
    // Ein Punkt ohne nachfolgendes Komma wird als Tausender-Separator entfernt.
    // "1234.56" → entfernt Punkt → "123456" → kein Komma → 123456
    // Fuer US-Dezimalzahlen: Eingabe als "1234,56" oder ohne Punkt verwenden.
    expect(parseNumber('1234.56')).toBe(123456); // Dokumentiertes Verhalten!
  });

  it('Einfache Dezimalzahl ohne Tausender-Separator wird korrekt geparst', () => {
    expect(parseNumber('1234,56')).toBe(1234.56); // Deutsches Dezimalformat
  });

  it('Ganze Zahlen werden korrekt geparst', () => {
    expect(parseNumber('42')).toBe(42);
  });

  it('Leerer String ergibt NaN', () => {
    expect(isNaN(parseNumber(''))).toBe(true);
  });

  it('Negative Zahlen werden korrekt geparst', () => {
    expect(parseNumber('-500')).toBe(-500);
  });
});
