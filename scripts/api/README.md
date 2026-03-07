# Global APIs

IIFE-Pattern APIs, die über `window` verfügbar sind.

## Dateien

### `funnel-api.js`
- **API:** `window.FunnelAPI`
- **Funktion:** Funnel CRUD, Active Funnel Management
- **Wichtige Methoden:**
  - `loadFunnels()` - Lädt alle Funnels
  - `saveFunnels(funnels)` - Speichert Funnel-Liste
  - `getActiveFunnel()` - Gibt aktiven Funnel zurück
  - `switchToFunnel(funnelId)` - Wechselt zu anderem Funnel
  - `buildFunnelConfig(funnel)` - Generiert Config aus Modules

### `datapool-api.js`
- **API:** `window.DataPool`
- **Funktion:** Supabase Event Management
- **Wichtige Methoden:**
  - `fetchLeads(filters)` - Lädt Leads aus Supabase
  - `insertLead(leadData)` - Fügt neuen Lead hinzu
  - `fetchEvents(filters)` - Lädt Events mit Pagination
  - `insertEvent(eventData)` - Fügt neues Event hinzu

### `toast-api.js`
- **API:** `window.Toast`
- **Funktion:** User Notifications
- **Wichtige Methoden:**
  - `Toast.success(message)` - Grüne Erfolgsmeldung
  - `Toast.error(message)` - Rote Fehlermeldung
  - `Toast.info(message)` - Blaue Info-Meldung

### `facebook-traffic-api.js`
- **API:** `window.FacebookTraffic`
- **Funktion:** Facebook Ads Integration
- **Wichtige Methoden:**
  - `fetchAdAccounts()` - Lädt verbundene Ad Accounts
  - `syncInsights(accountId, dateRange)` - Synchronisiert Metriken
  - `disconnectAccount(accountId)` - Trennt Verbindung

## Abhängigkeiten

- Core (StorageAPI, ClarityUtils, FunnelModules)
- Integrations (Supabase Client für DataPool)

## Genutzt von

- Views
- Features
