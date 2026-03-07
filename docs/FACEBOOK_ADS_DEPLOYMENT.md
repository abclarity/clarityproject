# Facebook Ads Integration - Deployment Guide

## Übersicht

Diese Anleitung beschreibt die vollständige Implementierung der Facebook Ads Integration mit OAuth, automatischer Synchronisierung und Multi-Touch Attribution.

---

## 1. Datenbank-Migration

### Migration ausführen

```bash
cd /Users/admin/Downloads/clarityv3\ 2/clarityv3

# Migration in Supabase ausführen
supabase db push

# Oder manuell in Supabase Dashboard:
# SQL Editor → New Query → Inhalt von supabase/migrations/20260118_meta_ads_integration.sql einfügen → Run
```

### Was wird erstellt?

- **4 neue Tabellen:**
  - `facebook_connections` - OAuth-Tokens und Verbindungsstatus
  - `facebook_ad_accounts` - Ad Accounts pro User
  - `campaign_funnel_mapping` - Pattern-Matching-Regeln für Kampagnen→Funnel-Zuordnung
  - `lead_touchpoints` - Historische Timeline aller Lead-Interaktionen

- **Erweiterte `leads` Tabelle:**
  - `first_touch_campaign`, `first_touch_date`, `first_touch_source` - First-Touch-Attribution
  - `last_touch_campaign`, `last_touch_date`, `last_touch_source` - Last-Touch für Re-Engagement
  - `attribution_window_days` - Konfigurierbare Attribution (Standard: 30 Tage)
  - `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` - UTM-Parameter

- **View für Performance-Analyse:**
  - `campaign_performance_view` - Aggregierte Conversions pro Kampagne

- **SQL-Funktion:**
  - `match_campaign_to_funnel(user_id, campaign_name)` - Pattern-Matching für automatische Zuordnung

---

## 2. Facebook App Setup

### 2.1 App erstellen

1. Gehe zu https://developers.facebook.com/apps
2. Klicke **"App erstellen"**
3. Wähle **"Business"** als App-Typ
4. App-Name: `Clarity Funnel Tracker` (oder dein Name)
5. App-Zweck: **"Deine eigenen Geschäftsdaten verwalten"**

### 2.2 Marketing API hinzufügen

1. Im Dashboard: **"Produkte hinzufügen"** → **"Marketing API"**
2. In den Einstellungen: Notiere **App-ID** und **App Secret**

### 2.3 OAuth Redirect URI

1. **Einstellungen** → **Allgemein** → **App-Domains**
2. Füge hinzu: `your-project.supabase.co`
3. **Facebook Login** → **Einstellungen**
4. **Gültige OAuth-Redirect-URIs:** 
   ```
   https://your-project.supabase.co/functions/v1/facebook-oauth
   ```

### 2.4 Berechtigungen anfordern

Erforderliche Permissions:
- `ads_read` - Kampagnendaten lesen
- `ads_management` - Ad Accounts verwalten
- `business_management` - Business Manager-Zugriff

**Hinweis:** Für Test-Accounts funktioniert die App sofort. Für Produktivnutzung muss die App von Facebook geprüft werden.

---

## 3. Supabase Edge Functions deployen

### 3.1 Supabase CLI installieren

```bash
# macOS
brew install supabase/tap/supabase

# Oder via npm
npm install -g supabase
```

### 3.2 Login und Projekt verknüpfen

```bash
# Supabase login
supabase login

# Projekt verknüpfen
cd /Users/admin/Downloads/clarityv3\ 2/clarityv3
supabase link --project-ref YOUR_PROJECT_REF

# Project Ref findest du in: Supabase Dashboard → Settings → General → Reference ID
```

### 3.3 Environment Variables setzen

```bash
supabase secrets set FB_APP_ID=deine_facebook_app_id
supabase secrets set FB_APP_SECRET=dein_facebook_app_secret
supabase secrets set FB_REDIRECT_URI=https://your-project.supabase.co/functions/v1/facebook-oauth
```

### 3.4 Functions deployen

```bash
# Alle drei Functions deployen
supabase functions deploy facebook-oauth
supabase functions deploy facebook-sync-accounts
supabase functions deploy facebook-sync-insights

# Erfolgs-Check
supabase functions list
```

**Expected Output:**
```
facebook-oauth          deployed
facebook-sync-accounts  deployed
facebook-sync-insights  deployed
```

---

## 4. Frontend testen

### 4.1 Lokaler Test

```bash
cd /Users/admin/Downloads/clarityv3\ 2/clarityv3
npm run dev
```

Browser öffnen: `http://localhost:5000`

### 4.2 Facebook Verbindung testen

1. **Einloggen** (falls noch nicht geschehen)
2. **Sidebar** → **API Einstellungen** öffnen
3. **Facebook Ads** → **"Mit Facebook verbinden"**
4. Facebook OAuth-Popup erscheint → **Login und Berechtigungen erteilen**
5. Nach Redirect: **"Verbindung erfolgreich"**-Toast sollte erscheinen
6. **Ad Accounts synchronisieren** klicken
7. **Initiale Synchronisierung** → Zeitraum wählen (z.B. 30 Tage) → **"Synchronisieren"**

### 4.3 Datapool öffnen

1. **Sidebar** → **Datenpool**
2. **Traffic Sources** Tab
3. **📘 Facebook Ads** sollte aktiv sein
4. **Übersicht** zeigt:
   - Verbundene Ad Accounts
   - Anzahl Kampagnen
   - Zugeordnete vs. nicht zugeordnete Kampagnen

### 4.4 Kampagnen zuordnen

**Automatisch via Pattern Matching:**
1. **Funnel-Zuordnung** Tab
2. **"Neue Regel hinzufügen"**
3. Pattern: z.B. `"VSL"` → Funnel: `VSL-Funnel` → Priorität: `1`
4. **"Regel hinzufügen"**
5. Alle Kampagnen mit "VSL" im Namen werden automatisch zugeordnet

**Manuell pro Kampagne:**
1. **Kampagnen** Tab
2. Bei nicht zugeordneten Kampagnen: Dropdown öffnen → Funnel wählen
3. Kampagne wird sofort zugeordnet

---

## 5. Automatische Synchronisierung

### 5.1 Cron Job für tägliche Syncs

```sql
-- In Supabase SQL Editor ausführen:

-- pg_cron Extension aktivieren (falls noch nicht geschehen)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Tägliche Synchronisierung um 2:00 Uhr morgens
SELECT cron.schedule(
  'facebook-daily-sync',
  '0 2 * * *',  -- Jeden Tag um 2:00 Uhr
  $$
  SELECT 
    net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/facebook-sync-insights',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
      ),
      body := jsonb_build_object('days_back', 2)
    ) AS request_id;
  $$
);
```

**Wichtig:** Ersetze `YOUR_SERVICE_ROLE_KEY` mit dem **Service Role Key** aus Supabase Dashboard → Settings → API → service_role key.

### 5.2 Cron-Jobs verwalten

```sql
-- Alle Cron-Jobs anzeigen
SELECT * FROM cron.job;

-- Cron-Job löschen
SELECT cron.unschedule('facebook-daily-sync');

-- Cron-Job deaktivieren
UPDATE cron.job SET active = false WHERE jobname = 'facebook-daily-sync';
```

---

## 6. Lead-Attribution integrieren

### 6.1 Neue Leads mit Attribution erstellen

Wenn ein Lead erstellt wird (z.B. via Form, CSV Import), muss UTM-Daten erfasst werden:

```javascript
// Beispiel: Lead-Erstellung mit Attribution
const attributionData = window.UTMTracker.getAttributionData();

const { data, error } = await window.SupabaseClient
  .from('leads')
  .insert({
    primary_email: 'lead@example.com',
    first_name: 'John',
    last_name: 'Doe',
    funnel_id: 'vsl-funnel',
    
    // Attribution-Daten
    first_touch_campaign: attributionData.campaign,
    first_touch_date: new Date().toISOString(),
    first_touch_source: attributionData.source || 'direct',
    utm_source: attributionData.source,
    utm_medium: attributionData.medium,
    utm_campaign: attributionData.campaign,
    utm_content: attributionData.content,
    attribution_window_days: 30
  });

// Touchpoint erstellen
if (data && data[0]) {
  await window.SupabaseClient
    .from('lead_touchpoints')
    .insert({
      lead_id: data[0].id,
      campaign_name: attributionData.campaign,
      touchpoint_date: new Date().toISOString(),
      touchpoint_type: 'first_touch',
      source: attributionData.source
    });
}
```

### 6.2 Re-Engagement tracken

Bei erneutem Kontakt (z.B. neuer Ad-Klick):

```javascript
// Lead existiert bereits → Last-Touch aktualisieren
const { error } = await window.SupabaseClient
  .from('leads')
  .update({
    last_touch_campaign: newCampaign,
    last_touch_date: new Date().toISOString(),
    last_touch_source: newSource
  })
  .eq('id', leadId);

// Neuen Touchpoint erstellen
await window.SupabaseClient
  .from('lead_touchpoints')
  .insert({
    lead_id: leadId,
    campaign_name: newCampaign,
    touchpoint_date: new Date().toISOString(),
    touchpoint_type: 're_engagement',
    source: newSource
  });
```

---

## 7. Troubleshooting

### Problem: "OAuth failed - invalid redirect_uri"

**Lösung:**
- Prüfe, ob Redirect URI in Facebook App exakt übereinstimmt
- Format: `https://your-project.supabase.co/functions/v1/facebook-oauth`
- **Kein Trailing Slash!**

### Problem: "No ad accounts found"

**Lösung:**
- Stelle sicher, dass der Facebook-User Zugriff auf Ad Accounts hat
- Im Facebook Business Manager: Ad Account → Personen → User hinzufügen
- Mindestens "Ad Account Advertiser"-Rolle erforderlich

### Problem: "Edge Function timeout"

**Lösung:**
- Große Ad Accounts mit vielen Kampagnen können länger dauern
- Reduziere `days_back` Parameter (z.B. von 90 auf 30)
- Oder: Sync Account-by-Account statt alle gleichzeitig

### Problem: "Rate limit exceeded"

**Lösung:**
- Facebook Marketing API hat Rate Limits
- Standard: 200 Calls pro Stunde pro User
- Bei vielen Accounts: Sync-Frequenz reduzieren oder zeitlich staffeln

### Logs überprüfen

```bash
# Edge Function Logs anzeigen
supabase functions logs facebook-sync-insights

# Letzte 50 Einträge
supabase functions logs facebook-sync-insights --tail 50
```

---

## 8. Nächste Schritte

### ✅ Abgeschlossen:
- Datenbank-Schema
- Edge Functions für OAuth und Sync
- UTM-Tracking-Script
- Datapool Traffic Sources UI
- Kampagnen-Zuordnung via Pattern Matching

### 🔄 In Progress:
- Lead-Attribution in Lead-Erstellung integrieren
- CSV-Import mit Attribution erweitern

### 📋 Geplant (Phase 2):
- Facebook Lead Forms Integration
- Multi-Touch Attribution Modelle (Linear, Time-Decay)
- Campaign Performance Dashboard (Scale It Tab)
- A/B-Test-Tracking
- Ad-Level und Ad Set-Level Granularität
- Conversion API (CAPI) für Server-Side Tracking

---

## 9. Support & Ressourcen

- **Facebook Marketing API Docs:** https://developers.facebook.com/docs/marketing-apis
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **UTM Best Practices:** https://support.google.com/analytics/answer/1033863

---

## Kontakt

Bei Fragen oder Problemen:
- GitHub Issues öffnen
- Dokumentation im Wiki erweitern
- Community Discord beitreten

---

**Viel Erfolg mit der Facebook Ads Integration! 🚀**
