# CLAUDE.md – Instruktionen fuer Claude Code

Diese Datei wird von Claude Code bei jeder Session automatisch gelesen.
Sie enthaelt alle notwendigen Informationen um effizient und korrekt an Clarity zu arbeiten.

---

## Projekt auf einen Blick

**Clarity** ist ein Vanilla-JavaScript SPA (Single Page Application) fuer Funnel-Tracking und Analytics.
- Kein Framework (kein React, Vue, Angular)
- Kein Build-Tool (kein Webpack, Vite, etc.)
- Reines HTML/CSS/JS, geladen via CDN
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- Sprache der UI: Deutsch

---

## GitHub (Backup & Versionierung)

```bash
# Aenderungen auf GitHub sichern (manuell nach jeder Session)
git add .
git commit -m "Kurze Beschreibung was geaendert wurde"
git push

# Status pruefen (was ist noch nicht committed?)
git status
```

**Wichtig:** GitHub synchronisiert NICHT automatisch. Nach jeder Arbeits-Session
oder vor groesseren Aenderungen manuell committen und pushen.
- Remote: https://github.com/abclarity/clarityproject
- Branch: main

---

## Lokale Entwicklung

```bash
# App starten (http://localhost:5173, kein Cache)
npm run dev

# Aenderungen testen: einfach Browser-Tab refreshen (F5)
# Kein Build-Schritt noetig
```

---

## Test-Befehle

```bash
# Unit Tests (KPI-Berechnungen, Modul-Validierung)
npm test

# Unit Tests im Watch-Modus (automatisch neu ausfuehren bei Aenderungen)
npm run test:watch

# Unit Tests mit Coverage-Report
npm run test:coverage

# E2E Tests (Playwright, Chromium)
# Vorher: npm run dev in separatem Terminal starten!
npm run test:e2e

# E2E Tests mit UI (interaktiv, Debug-Modus)
npm run test:e2e:ui
```

---

## Supabase CLI

```bash
# Lokale Supabase-Instanz starten (benoetigt Docker)
npm run db:start

# Lokale Instanz stoppen
npm run db:stop

# Datenbank zuruecksetzen (Migrationen + Seed neu)
npm run db:reset

# Edge Functions lokal ausfuehren
npm run functions:serve

# Neue Migration erstellen
supabase migration new <name>

# Migrationen anwenden (lokal)
supabase db push

# Edge Function deployen (Production)
supabase functions deploy <function-name>
```

**Supabase Project:** `bghelanwedtdkyfvqlhf`
**URL:** `https://bghelanwedtdkyfvqlhf.supabase.co`

---

## Datei-Struktur

```
clarityv3/
├── index.html                    # Einziger HTML-Einstiegspunkt. DOM, Modals, Script-Ladereihenfolge
├── oauth-success.html            # Redirect-Ziel nach OAuth (Facebook, Typeform)
├── CLAUDE.md                     # Diese Datei – Claude liest sie automatisch
├── package.json                  # npm Scripts + devDependencies
├── vitest.config.js              # Vitest Konfiguration
├── playwright.config.js          # Playwright Konfiguration
├── .env                          # Supabase Keys (NICHT in Git)
├── .env.test                     # Test-Credentials fuer E2E (NICHT in Git)
│
├── docs/                         # Referenz-Dokumentation (nicht aktiv im Code)
│   ├── PRODUCT_VISION.md         # Produktstrategie & Roadmap
│   ├── FACEBOOK_ADS_*.md         # Facebook Integration Doku
│   ├── TYPEFORM_*.md             # Typeform Integration Doku
│   └── AUTO_SYNC_DEPLOYMENT.md  # Auto-Sync Deployment Notizen
│
├── styles/
│   ├── base/                     # reset.css, variables.css (CSS Custom Properties)
│   ├── components/               # Wiederverwendbare UI-Komponenten
│   ├── layout/                   # Responsive Grid, Sidebar
│   └── modules/                  # Feature-spezifische Styles (wizard, import)
│
├── scripts/
│   ├── core/                     # Fundament (darf NICHTS importieren von ausserhalb)
│   │   ├── modules.js            # *** Modul-Definitionen (Herz des Systems) ***
│   │   ├── utils.js              # *** KPI-Berechnungen, Formatter, Datum-Helfer ***
│   │   └── storage.js            # localStorage-Abstraktion
│   ├── api/                      # Business-Logik (darf core importieren)
│   │   ├── funnel-api.js         # Funnel CRUD, Preset-Verwaltung
│   │   ├── datapool-api.js       # Supabase Event-Management
│   │   ├── facebook-traffic-api.js # Facebook Ads Integration
│   │   ├── typeform-api.js       # Typeform OAuth + Webhook-Verwaltung
│   │   └── toast-api.js          # Toast-Benachrichtigungen
│   ├── auth/
│   │   ├── auth.js               # Supabase Auth, Session-Management
│   │   └── api-settings.js       # API-Konfiguration
│   ├── views/                    # UI-Rendering (darf nur public APIs nutzen)
│   │   ├── main.js               # Tab-Navigation, Modals, Zoom
│   │   ├── month-view.js         # Tages-Tracking-Tabelle (31 Tage)
│   │   ├── year-view.js          # Jahres-Uebersicht (12 Monate)
│   │   └── sidebar.js            # Funnel-Switcher, Navigation
│   ├── features/                 # UI-Features
│   │   ├── wizard.js             # 7-Schritt Funnel-Ersteller
│   │   ├── cell-selection.js     # Zell-Editing, Copy/Paste, Excel-Import
│   │   ├── loading.js            # Loading-Spinner (verschachtelter Counter)
│   │   └── utm-tracker.js        # UTM-Parameter-Erfassung (30 Tage)
│   └── import/
│       ├── csv-month.js          # Monats-Daten CSV-Import
│       └── csv-datapool.js       # Datenpool Event CSV-Import
│
├── supabase/
│   ├── functions/                # Deno/TypeScript Edge Functions
│   │   ├── facebook-oauth/
│   │   ├── facebook-sync-accounts/
│   │   ├── facebook-sync-insights/
│   │   ├── typeform-oauth/
│   │   ├── typeform-sync/
│   │   ├── typeform-webhook/
│   │   ├── tracking-sheet-auto-sync/
│   │   └── survey-aggregate/
│   └── migrations/               # SQL-Migrationen (chronologisch, niemals aendern)
│
└── tests/
    ├── setup.js                  # jsdom Script-Loader fuer Unit Tests
    ├── unit/                     # Vitest Unit Tests
    └── e2e/                      # Playwright E2E Tests
```

### Konvention: Wo neue Dateien hingehoeren
- **Neues JS-Feature** → `scripts/features/` oder `scripts/views/`
- **Neue API/Business-Logik** → `scripts/api/`
- **Neue SQL-Migration** → `supabase/migrations/` (Format: `YYYYMMDD_beschreibung.sql`)
- **Neue Edge Function** → `supabase/functions/<name>/index.ts`
- **Neue CSS-Komponente** → `styles/components/`
- **Dokumentation/Notizen** → `docs/`
- **Temporaere Debug-Dateien** → nach Gebrauch sofort loeschen, NICHT committen
- **Backup-Dateien** → nie erstellen (Git ist das Backup)

---

## Architektur-Regeln (absolut verbindlich)

### 1. IIFE-Pattern fuer alle Scripts
```javascript
(function(window) {
  // privater Code hier
  window.MeinAPI = { ... };
})(window);
```
- Kein globales Scope-Leaking
- Alle oeffentlichen APIs via `window.APIName`

### 2. Schichten-Trennung
- `core/` darf NICHTS von anderen Schichten importieren
- `api/` darf nur `core/` nutzen
- `views/` darf nur oeffentliche APIs nutzen, NIEMALS direkt auf Storage zugreifen
- `features/` darf nur oeffentliche APIs und DOM manipulieren

### 3. Storage-Zugriff
- NIEMALS `localStorage.getItem/setItem` direkt aufrufen
- Immer `StorageAPI.*` oder `FunnelAPI.*` nutzen
- Alle localStorage-Operationen sind in try/catch gekapselt

### 4. KPI-Berechnungen
- Alle Formeln sind in `scripts/core/utils.js` → `ClarityUtils.calculateKPIs()`
- Formeln sind pure functions (kein State, kein DOM, kein Side-Effect)
- Niemals NaN oder Infinity zurueckgeben – immer 0 als Fallback

### 5. DOM-Manipulation
- Immer auf Existenz pruefen: `const el = document.getElementById('x'); if (!el) return;`
- Keine DOM-Queries in Loops wenn vermeidbar
- Event-Listener nur einmal attachen (keine doppelten Listener)

---

## Wichtige globale APIs

| API | Datei | Zweck |
|-----|-------|-------|
| `window.ClarityUtils` | core/utils.js | KPI-Berechnungen, Formatter |
| `window.FunnelModules` | core/modules.js | Modul-Registry, Funnel-Builder |
| `window.FunnelAPI` | api/funnel-api.js | Funnel CRUD |
| `window.StorageAPI` | core/storage.js | localStorage-Abstraktion |
| `window.DataPool` | api/datapool-api.js | Supabase Events |
| `window.Toast` | api/toast-api.js | User-Benachrichtigungen |
| `window.ClarityAuth` | auth/auth.js | Supabase Auth |

---

## Modul-System

Funnels bestehen aus 5 Modul-Schichten (in dieser Reihenfolge):
1. **Traffic:** `paid-ads`, `organic`, `cold-email`, `cold-calls`
2. **Funnel:** `classic-vsl`, `direct-vsl`, `classic-vsl-no-survey`, etc.
3. **Qualification:** `survey-qualified`, `no-survey`, `direct-call-booking`, etc.
4. **Close:** `1-call-close`, `2-call-close` (+ organic-Varianten)
5. **Revenue:** `revenue-paid`, `revenue-organic`

Jedes Modul definiert: `columns`, `inputs`, `inputKeys`, `provides`
Daten fliessen von oben nach unten (Traffic → Revenue).

---

## Storage-Pattern

```javascript
// Monats-Daten Schluessel-Format:
// {field}_{day}  z.B. "Adspend_15", "Leads_7"
StorageAPI.loadMonthDataForFunnel(funnelId, year, monthIndex)

// Funnel-Liste:
FunnelAPI.loadFunnels()  // gibt Array von Funnel-Objekten zurueck

// Aktiver Funnel:
localStorage-Schluessel: "vsl_active_funnel"
```

---

## Datenbank-Schema (Kern-Tabellen)

| Tabelle | Zweck |
|---------|-------|
| `leads` | Alle Leads mit UTM-Daten, Multi-Touch-Attribution |
| `events` | Konversionsereignisse (lead, survey, settingBooking, unit, etc.) |
| `traffic_metrics` | Taeglich aggregierte Ad-Metriken (Facebook, Google) |
| `funnels` | Funnel-Definitionen (user_id, modules als jsonb) |
| `tracking_data` | Monatliche Trackingsheet-Daten (data als jsonb) |
| `facebook_connections` | OAuth-Tokens fuer Facebook |
| `typeform_connections` | OAuth-Tokens fuer Typeform |
| `typeform_forms` | Form-Mappings + Webhook-Konfiguration |

**RLS aktiviert:** Jeder User sieht nur seine eigenen Daten (`user_id = auth.uid()`).

---

## Event-Typen (Datenpool)

```
lead          → Opt-in / Lead erfasst
survey        → Survey abgeschlossen
surveyQuali   → Survey qualifiziert
settingBooking → Setting-Termin gebucht
settingTermin  → Setting-Termin besraetigt
settingCall    → Setting-Call stattgefunden
closingBooking → Closing-Termin gebucht
closingTermin  → Closing-Termin bestaetigt
closingCall    → Closing-Call stattgefunden
unit           → Verkauf abgeschlossen (hat revenue + cash Felder)
```

---

## Konventionen

### Benennung
- **Storage-Keys:** lowercase_underscore: `vsl_active_funnel`
- **Modul-IDs:** kebab-case: `classic-vsl`, `paid-ads`
- **API-Objekte:** PascalCase: `FunnelAPI`, `ClarityUtils`
- **Private Funktionen:** camelCase: `calculateKPIs`, `parseNumber`
- **CSS-Variablen:** `--primary-color`, `--spacing-md`
- **Alles UI-seitige:** auf Deutsch

### Was NICHT erlaubt ist
- Duplizierten Code (DRY-Prinzip)
- Direkte localStorage-Zugriffe ausserhalb von `StorageAPI`
- DOM-Queries ohne Existenz-Check
- NaN oder Infinity in KPI-Ausgaben
- Inline-Event-Handler in HTML (`onclick="..."`) – immer via JS attachen
- Neue globale Variablen ohne IIFE-Wrapper

---

## Nach jeder Aenderung testen

### Bei Aenderungen in `utils.js` (KPI-Formeln):
```bash
npm test  # Unit Tests pruefen ob Formeln korrekt
```

### Bei Aenderungen in `modules.js`:
```bash
npm test  # Modul-Struktur-Tests
# Browser: Neuen Funnel erstellen, pruefen ob Spalten korrekt erscheinen
```

### Bei Aenderungen in Views (month-view, year-view, etc.):
```bash
npm run dev
# Browser: Daten eingeben, KPIs pruefen, Funnel wechseln
```

### Bei Aenderungen an Edge Functions:
```bash
npm run functions:serve  # Lokal testen
# Dann: Webhook oder API-Aufruf simulieren
```

### Bei SQL-Migrationen:
```bash
supabase db push  # Lokal anwenden
# Testen, dann: supabase db push --linked (Production)
```

---

## Debugging

```javascript
// Alle Funnels in localStorage anzeigen:
localStorage.getItem('vsl_funnels')

// Monatsdaten eines Funnels:
localStorage.getItem('vsl_fb-ads_2025_11')

// Alles zuruecksetzen (Vorsicht!):
localStorage.clear()

// Supabase-Fehler erscheinen via Toast.error() im UI
```

---

## Wichtige Hinweise

1. **Script-Ladereihenfolge ist kritisch** – In `index.html` muessen Scripts in der richtigen Reihenfolge geladen werden: core → api → auth → features → views
2. **Monat-Index ist 0-basiert** – Januar = 0, Dezember = 11 (JavaScript Date-Konvention)
3. **Zoom beeinflusst Layout** – `globalZoomInit()` passt Wrapper-Dimensionen an
4. **Supabase Anon-Key ist bewusst oeffentlich** – RLS-Policies schuetzen die Daten
5. **parseNumber('.') behandelt Punkt als Tausender-Separator** – `parseNumber('1234.56')` → `123456`. Korrekt: `'1234,56'` → `1234.56`
6. **Node.js PATH** – Node ist via Homebrew installiert. Im Terminal: `eval "$(/opt/homebrew/bin/brew shellenv)"` vor npm-Befehlen, oder Terminal neu starten.

---

## Supabase Debugging

### Wo Fehler erscheinen
- **Im Browser:** Rote Toast-Meldungen unten rechts (via `window.Toast.error()`)
- **Browser-Konsole (F12):** Alle `console.error()` Ausgaben, erkennbar am ❌ Prefix
- **Supabase Dashboard:** https://supabase.com/dashboard/project/bghelanwedtdkyfvqlhf/logs/edge-functions
  - Edge Function Logs (Webhook-Fehler, Sync-Fehler)
  - Database Logs (SQL-Fehler, RLS-Violations)
  - Auth Logs (Login-Fehler)

### Haeufige Fehlerquellen
- **RLS-Violation:** `new row violates row-level security` → user_id fehlt oder falsch
- **404 bei Edge Function:** Function nicht deployed oder falscher Name
- **401 Unauthorized:** Token abgelaufen oder fehlerhafter Auth-Header
- **Duplicate Key:** Unique-Constraint verletzt (z.B. doppelter Typeform-Response)

### Wenn Claude einen Fehler debuggen soll
Kopiere den vollstaendigen Fehlertext aus:
1. Browser-Konsole (F12 → Console Tab → rote Fehler)
2. ODER Supabase Dashboard → Logs
Und fuege ihn direkt in den Chat ein. Claude identifiziert dann Root Cause und Fix.

---

## Was Unit Tests testen (und was nicht)

### Getestet (automatisch via `npm test`):
- KPI-Berechnungsformeln (utils.js) – alle 70+ Formeln
- Modul-Struktur (modules.js) – alle Pflichtfelder, Preset-Kombinationen

### NICHT getestet (manuell oder via E2E):
- Supabase API-Calls (Datenbank-Lese/Schreiboperationen)
- Datenpool Events (ob Leads korrekt angelegt werden)
- Facebook Ads Sync (erfordert echte API-Verbindung)
- Typeform Webhooks (erfordert echten Webhook-Call)
- UI-Rendering (ob Tabellen korrekt angezeigt werden)

### E2E Tests (Playwright) testen:
- Browser-Konsolen-Fehler beim App-Start
- Ob alle DOM-Elemente existieren
- Login/Logout Flow (benoetigt Test-Credentials in .env.test)
- KPI-Berechnungen im echten Browser

### Um E2E Tests mit Login zu aktivieren:
Erstelle `.env.test` im Projektstamm (wird von Git ignoriert):
```
CLARITY_TEST_EMAIL=deine@email.com
CLARITY_TEST_PASSWORD=deinPasswort
```
Dann: `npm run test:e2e`

---

## Aktuelle Prioritaeten (Stand Maerz 2026)

**MVP fehlt noch:**
1. Datenpool-View UI – Events werden gesammelt aber nicht angezeigt
2. Projections-Tab – Goal-Setting, KPI-Breakdown, Live-Fortschritt
3. Calendly-Integration – Setting-Bookings automatisch erfassen

**Technische Schulden (klein):**
- `cell-selection.js` ist zu gross (4 Funktionen in einer Datei)
- KPI-Berechnung leicht dupliziert zwischen month-view und year-view

---

## Produktvision (Zusammenfassung)

Clarity ist ein "Operating System fuer High-Ticket Coaches & Agencies".
Aktuelle Phasen:
- **Jetzt (Phase 1):** Datenpool-Automation (Calendly, GHL, Stripe-Webhooks)
- **Phase 2:** Projections-Tab (Goal-Setting, KPI-Breakdown, Bottleneck-Detection)
- **Phase 3:** Call Intelligence (Transkripte, Setter/Closer-Performance)
- **Phase 4:** Scale It (AI-Optimierung, Ad-Copy-Generator)

Zielgruppe: High-Ticket Coaches & Agencies mit $2.000+ Produkten, Funnel-basierter Lead-Generierung.
