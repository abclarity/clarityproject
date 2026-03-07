# Features

Feature-Module, die Funktionalität zu Views hinzufügen.

## Dateien

### `wizard.js`
- **API:** `window.WizardAPI`
- **Funktion:** Step-by-Step Funnel Builder
- **Wichtige Methoden:**
  - `openWizard()` - Öffnet Wizard
  - `nextStep()` / `prevStep()` - Navigation
  - `createFunnel()` - Erstellt Funnel aus Wizard-Auswahl

### `cell-selection.js`
- **API:** `window.CellSelection`
- **Funktion:** Cell Editing, Copy/Paste, Excel Import, Drag Selection
- **Wichtige Methoden:**
  - `init()` - Initialisiert Event Listeners
  - `makeEditable(cell)` - Macht Zelle editierbar
  - `handlePaste(event)` - Verarbeitet Paste-Event
  - `importFromExcel(data)` - Importiert Excel-Daten

⚠️ **TODO:** Diese Datei sollte in Session 2+ gesplittet werden in:
- `cell-editor.js` - Basis-Editing
- `cell-copy-paste.js` - Copy/Paste
- `excel-import.js` - Excel-Import
- `cell-selection.js` - Drag-to-Select

### `loading.js`
- **Funktion:** Loading Spinner für async Operationen
- **Wichtige Funktionen:**
  - `showLoading(message)` - Zeigt Spinner
  - `hideLoading()` - Versteckt Spinner

### `utm-tracker.js`
- **API:** `window.UTMTracker`
- **Funktion:** Tracking von UTM-Parametern aus URL
- **Wichtige Methoden:**
  - `getUTMParams()` - Extrahiert UTM-Parameter
  - `saveToLocalStorage()` - Speichert für spätere Nutzung

## Abhängigkeiten

- Core (StorageAPI, ClarityUtils)
- APIs (FunnelAPI, Toast)
- Views (Features hängen sich an View-DOM an)

## Genutzt von

Views rufen Feature-Initialisierung auf (z.B. `CellSelection.init()`).
