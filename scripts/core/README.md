# Core System

Fundamentale Module, die **zuerst** geladen werden müssen.

## Dateien

### `storage.js`
- **API:** `window.StorageAPI`
- **Funktion:** localStorage Abstraction mit Error Handling
- **Wichtige Methoden:**
  - `saveMonthDataForFunnel(funnelId, year, month, data)`
  - `loadMonthDataForFunnel(funnelId, year, month)`
  - `saveItem(key, value)` / `loadItem(key)`

### `utils.js`
- **API:** `window.ClarityUtils`
- **Funktion:** KPI-Berechnungen, Formatierung, Date Helpers
- **Wichtige Methoden:**
  - `calculateKPIs(data)` - Zentrale KPI-Engine
  - `formatCellValue(value, colName)` - Zahlen/Währung/Prozent
  - `getWeekdayName(day)` - Wochentag für Tag 1-31

### `modules.js`
- **API:** `window.FunnelModules`
- **Funktion:** Modul-Registry und Funnel-Config-Builder
- **Module:** Traffic, Funnel, Survey, Close, Revenue
- **Wichtige Methoden:**
  - `buildFunnelFromModules(modules)` - Generiert Funnel-Config

### `config.js`
- ⚠️ **DEPRECATED**
- Wird durch `modules.js` ersetzt
- Existiert nur noch für Legacy-Kompatibilität
- **TODO:** In Session 2 entfernen

## Abhängigkeiten

Keine - diese Module laden als erste.

## Genutzt von

Alle anderen Module (APIs, Views, Features, Import).
