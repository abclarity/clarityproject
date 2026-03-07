# Scripts - Modular Architecture

Clarity verwendet eine **modulare Ordner-Struktur** für bessere Wartbarkeit und Skalierbarkeit.

## 📁 Ordner-Übersicht

```
scripts/
├── core/              # Fundament (lädt zuerst)
├── api/               # Globale APIs (IIFE-Pattern)
├── auth/              # Authentifizierung & API-Settings
├── integrations/      # Externe Systeme (Supabase, etc.)
├── views/             # UI-Layer (Month, Year, Main)
├── features/          # Feature-Module (Wizard, Cell Selection)
└── import/            # CSV Import (Month, Datapool)
```

## 🔄 Load-Reihenfolge (wichtig!)

Die Reihenfolge in [`index.html`](../../index.html) ist **kritisch**:

1. **Core** - StorageAPI, ClarityUtils, FunnelModules, Config
2. **APIs** - FunnelAPI, DataPool, Toast, Facebook Traffic
3. **Integrations** - Supabase Client
4. **Auth** - Authentifizierung vor Views
5. **Views** - Main, Month, Year, Sidebar
6. **Features** - Wizard, Cell Selection, Loading, UTM
7. **Import** - CSV Import Module

## 🎯 Design-Prinzipien

### **1. Separation of Concerns**
Jeder Ordner hat eine klare Verantwortung:
- `core/` - Daten & Logik (keine UI)
- `api/` - Business Logic (keine direkte Storage-Zugriffe)
- `views/` - UI-Rendering (keine Business Logic)
- `features/` - UI-Erweiterungen (keine Core-Logik)

### **2. IIFE-Pattern**
Alle Module wrappen in `(function(window) { ... })(window)` und exposen via:
```javascript
window.FunnelAPI = { ... };
window.StorageAPI = { ... };
window.ClarityUtils = { ... };
```

### **3. No Direct Storage Access**
Views nutzen **nie** direkt `localStorage`:
```javascript
// ❌ Falsch:
const data = JSON.parse(localStorage.getItem('vsl_funnels'));

// ✅ Richtig:
const data = FunnelAPI.loadFunnels();
```

### **4. Pure Functions**
KPI-Berechnungen sind pure functions in `core/utils.js`:
```javascript
// Input → Output, keine Side Effects
const kpis = ClarityUtils.calculateKPIs(rowData);
```

## 🔧 Entwickler-Workflows

### Neues Feature hinzufügen
1. Frage: "Wo gehört das hin?"
   - Daten/Logik → `core/`
   - API-Oberfläche → `api/`
   - UI-Komponente → `views/` oder `features/`
   - Import-Logik → `import/`
2. Erstelle Datei im passenden Ordner
3. Füge `<script>` in [`index.html`](../../index.html) ein (korrekte Position!)
4. Teste Load-Reihenfolge (Console-Check)

### Datei finden
- **KPI berechnen?** → `core/utils.js`
- **Funnel wechseln?** → `api/funnel-api.js`
- **Tabelle rendern?** → `views/month-view.js` oder `views/year-view.js`
- **CSV importieren?** → `import/csv-month.js` oder `import/csv-datapool.js`
- **Supabase-Abfrage?** → `api/datapool-api.js`

### Refactoring
Wenn Code in mehreren Dateien dupliziert ist:
1. Extrahiere in Utility-Funktion → `core/utils.js`
2. Oder: Erstelle neue API in `api/`
3. Ersetze Duplikate durch API-Calls

## 📚 Weitere Dokumentation

Jeder Ordner hat eine eigene `README.md` mit:
- Detaillierte Datei-Beschreibungen
- API-Referenz
- Abhängigkeiten
- Design-Notizen

**Lies diese zuerst, bevor du Code änderst!**

## ⚠️ Deprecated Code

- `core/config.js` - Wird durch `modules.js` ersetzt
  - **Status:** Noch vorhanden für Kompatibilität
  - **TODO:** In Session 2 entfernen

## 🚀 Nächste Schritte (Session 2)

1. **Config.js eliminieren** (30 Min)
2. **KPI-Duplikate konsolidieren** (2-3h)
   - `views/month-view.js` nutzt `ClarityUtils.calculateKPIs()`
   - `views/year-view.js` nutzt `ClarityUtils.calculateKPIs()`
3. **Cell Selection splitten** (Optional, 1 Tag)
   - `features/cell-editing/` Unterordner erstellen
   - `cell-editor.js`, `cell-copy-paste.js`, `excel-import.js`, `cell-selection.js`

---

**Letzte Aktualisierung:** 12. Februar 2026  
**Architektur-Refactor:** Session 1 abgeschlossen ✅
