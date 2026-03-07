# Views

UI-Layer für verschiedene Ansichten der App.

## Dateien

### `main.js`
- **Funktion:** App-Initialisierung, Navigation, Tabs, Modals, Zoom
- **Wichtige Funktionen:**
  - `mainInit()` - Startet App nach Login
  - `renderHeader()` - Rendert obere Leiste
  - `renderTabs()` - Rendert untere Tab-Bar
  - `globalZoomInit()` - Initialisiert Zoom-Funktionalität
  - `showMonthModal()` / `showWizardModal()` - Öffnet Modals

### `month-view.js`
- **Funktion:** Tägliche Tracking-Tabelle (31 Tage + 5 Wochen + Monatstotal)
- **Wichtige Funktionen:**
  - `renderMonthView()` - Rendert komplette Monatsansicht
  - `recalculateRowByDay(day)` - Berechnet KPIs für einen Tag
  - `recalculateSummaryRow()` - Berechnet Wochen-/Monats-Summen
  - `saveCell(day, col, value)` - Speichert Zell-Änderung

### `year-view.js`
- **Funktion:** Jahresübersicht (12 Monate + 4 Quartale + Jahrestotal)
- **Wichtige Funktionen:**
  - `renderYearView()` - Rendert komplette Jahresansicht
  - `aggregateMonthData(monthIndex)` - Aggregiert Tagesdaten zu Monat
  - `recalculateYearKPIs()` - Berechnet Quartals-/Jahres-KPIs

### `sidebar.js`
- **Funktion:** Linke Sidebar mit Funnel-Liste und Jahr/Monat-Navigation
- **Wichtige Funktionen:**
  - `initSidebar()` - Initialisiert Sidebar
  - `renderFunnelList()` - Rendert Funnel-Auswahl
  - `renderMonthList()` - Rendert Monats-Navigation

## Prinzipien

- **Views kennen KEINE interne Storage-Struktur**
- Views nutzen NUR öffentliche APIs (FunnelAPI, StorageAPI)
- Views sind voneinander isoliert
- Tab-Wechsel triggert View-Neurendering

## Abhängigkeiten

- Core (StorageAPI, ClarityUtils, FunnelModules)
- APIs (FunnelAPI, Toast)

## Genutzt von

- Features (z.B. Cell Selection hängt sich an View-Zellen)
