# Legacy Code (Deprecated)

⚠️ **Dieser Ordner enthält veralteten Code, der nicht mehr verwendet wird.**

## Dateien

### `config.js.deprecated`
- **Status:** DEPRECATED seit 12. Februar 2026
- **Grund:** Ersetzt durch modulares System (`core/modules.js`)
- **Alte Funktion:** Statische Spalten-/KPI-Definitionen
- **Neue Lösung:** `FunnelModules.buildFunnelFromModules()` generiert Config dynamisch

**Warum nicht gelöscht?**
Historische Referenz für Fall, dass alte Funnels ohne Module existieren.

**TODO:** Komplett entfernen, sobald sicher ist, dass keine Legacy-Funnels mehr existieren.

---

**Regel:** Dateien in diesem Ordner werden **NICHT** in `index.html` geladen!
