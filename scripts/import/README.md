# Import

CSV Import Module für verschiedene Ziele.

## Dateien

### `csv-month.js`
- **Funktion:** CSV Import in Month View
- **Features:**
  - 3-Step-Wizard: Upload → Column Mapping → Preview → Import
  - PapaParse Integration
  - Mapping zu Funnel Input-Feldern
  - Auto-Detect von Spalten (Adspend, Leads, etc.)
- **Wichtige Funktionen:**
  - `openImportModal()` - Öffnet Import-Wizard
  - `uploadCSV(file)` - Parst CSV-Datei
  - `mapColumns(mapping)` - Mapped CSV-Spalten zu Funnel-Inputs
  - `importData(data)` - Importiert gemappte Daten

### `csv-datapool.js`
- **Funktion:** CSV Import in Datapool (Supabase)
- **Features:**
  - 3-Step-Wizard analog zu csv-month.js
  - Duplicate Detection via `primary_email` / `primary_phone`
  - Bulk Insert in Supabase `leads` und `events` Tabellen
- **Wichtige Funktionen:**
  - `openDatapoolImport()` - Öffnet Import-Wizard
  - `validateLeadData(row)` - Prüft Pflichtfelder
  - `bulkInsert(rows)` - Fügt Leads in Supabase ein

## Design-Notizen

⚠️ **TODO:** Beide Module haben sehr ähnlichen Code (3-Step-Wizard, PapaParse).
In einer zukünftigen Session könnte ein generischer `CSVWizard` extrahiert werden:

```javascript
// Zukünftig:
window.CSVWizard = {
  start(config) { /* config = { target, schema, onComplete } */ }
}

// csv-month.js nutzt:
CSVWizard.start({ target: 'month', schema: funnelInputs, onComplete: importToMonth });

// csv-datapool.js nutzt:
CSVWizard.start({ target: 'datapool', schema: leadSchema, onComplete: insertToSupabase });
```

## Abhängigkeiten

- Core (StorageAPI, ClarityUtils)
- APIs (FunnelAPI, DataPool, Toast)
- External: PapaParse (CDN)

## Genutzt von

Views (via Header-Buttons: "CSV Import").
