# Integrations

Module für externe Systeme (Datenbanken, APIs, Third-Party Services).

## Dateien

### `supabase-client.js`
- **API:** `window.supabaseClient`
- **Funktion:** Initialisiert Supabase Client
- **Config:**
  - Supabase URL: Hardcoded (öffentlich)
  - Supabase Anon Key: Hardcoded (öffentlich, RLS-gesichert)
- **Genutzt von:** DataPool API, Auth

## Design-Prinzipien

- **Thin Wrapper:** Diese Datei macht nur Client-Initialisierung
- **Business Logic gehört in APIs:** DataPool API nutzt den Client
- **Security:** Anon Key ist absichtlich öffentlich, Row Level Security (RLS) schützt Daten

## Zukünftige Erweiterungen

Weitere Integration-Module könnten hier hinzugefügt werden:

```
integrations/
├── supabase-client.js
├── google-analytics.js (zukünftig)
├── stripe-client.js (zukünftig)
├── zapier-webhook.js (zukünftig)
```

## Abhängigkeiten

- External: `@supabase/supabase-js` (CDN)

## Genutzt von

- APIs (DataPool, Facebook Traffic)
- Auth
