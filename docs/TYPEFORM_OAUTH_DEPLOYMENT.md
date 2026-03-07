# Typeform OAuth Integration - Deployment Guide

## 📋 Übersicht

**Status:** Bereit für Deployment  
**Datum:** 2026-02-22  
**Typ:** OAuth-basierte Typeform-Integration (ersetzt manuelle Webhook-Setup)

---

## 🎯 Was wurde gebaut?

Ein vollständiges OAuth-basiertes Typeform-Integrationssystem, das den manuellen Webhook-Setup-Prozess durch einen automatisierten OAuth-Flow ersetzt (wie bei Facebook Ads).

### Vorher (Manuell):
1. User kopiert Webhook-URL
2. User geht zu Typeform
3. User fügt Webhook manuell hinzu
4. User findet Form ID
5. User gibt Form ID in Clarity ein
6. User findet Field IDs für Qualifikation

### Nachher (OAuth):
1. User klickt "Mit Typeform verbinden"
2. OAuth-Login bei Typeform
3. User wählt Formular aus Dropdown (automatisch geladen)
4. User wählt Qualifikations-Frage aus Dropdown (automatisch geladen)
5. Webhook wird **automatisch** erstellt ✅

---

## 📦 Dateien & Änderungen

### 1. Database Migration
**Datei:** `supabase/migrations/20260222_typeform_oauth.sql`
- Neue Tabellen:
  - `typeform_connections` - OAuth-Tokens und Account-Info
  - `typeform_forms` - Verbundene Formulare mit Webhook-IDs
  - `typeform_events_log` - Event-Tracking (ersetzt alte `typeform_webhook_log`)
- RLS Policies für User-Isolation
- Indexes für Performance

**Deployment:**
```bash
supabase db push
```

### 2. Edge Functions

#### `typeform-oauth` (NEU)
**Datei:** `supabase/functions/typeform-oauth/index.ts`
- Behandelt OAuth-Callback von Typeform
- Tauscht Authorization Code gegen Access Token
- Speichert Token in `typeform_connections`
- Zeigt Success-Page mit Auto-Close

**Deployment:**
```bash
supabase functions deploy typeform-oauth
```

**Env Vars benötigt:**
```bash
TYPEFORM_CLIENT_ID=<dein_client_id>
TYPEFORM_CLIENT_SECRET=<dein_client_secret>
```

#### `typeform-sync` (NEU)
**Datei:** `supabase/functions/typeform-sync/index.ts`
- **Action: `fetch_forms`** - Lädt Formulare von Typeform API
- **Action: `setup_webhook`** - Erstellt Webhook automatisch via Typeform API
- Speichert Form-Mapping in `typeform_forms`

**Deployment:**
```bash
supabase functions deploy typeform-sync
```

#### `typeform-webhook` (AKTUALISIERT)
**Datei:** `supabase/functions/typeform-webhook/index.ts`
- Webhook-Receiver (bleibt bestehen)
- **Geändert:** Nutzt neue Tabellen (`typeform_forms`, `typeform_events_log`)
- Logik bleibt gleich: Lead-Extraktion, Qualifikation, Event-Erstellung

**Deployment:**
```bash
supabase functions deploy typeform-webhook
```

### 3. Frontend

#### `typeform-api.js` (KOMPLETT NEU)
**Datei:** `scripts/api/typeform-api.js`
- OAuth-Flow wie Facebook Ads
- `initiateOAuth()` - Öffnet Typeform-Login-Popup
- `checkConnectionStatus()` - Prüft aktive Verbindung
- `fetchFormsFromTypeform()` - Lädt Formulare via API
- `setupWebhook()` - Erstellt Webhook automatisch
- `renderConnectionUI()` - Zeigt Connected/Not Connected State
- `renderFormSetupModal()` - Modal mit Form-Dropdown

#### `index.html` (AKTUALISIERT)
**Datei:** `index.html`
- Typeform-Modal vereinfacht (keine manuellen Inputs mehr)
- Alte `typeform-mapping-modal` entfernt
- Content-Container wird dynamisch von JS befüllt

#### `typeform.css` (ERWEITERT)
**Datei:** `styles/components/typeform.css`
- OAuth Connection Status Styles
- Connected Forms List Styles
- Form Setup Modal Styles

---

## 🔧 Typeform App Setup

### 1. Typeform OAuth App erstellen

1. Gehe zu: https://admin.typeform.com/account/#/section/tokens
2. Klicke "Register a new app"
3. App-Details:
   - **Name:** Clarity Funnel Tracker
   - **Redirect URI:** `https://bghelanwedtdkyfvqlhf.supabase.co/functions/v1/typeform-oauth`
   - **Scopes:** `forms:read`, `webhooks:write`, `responses:read`

4. Nach Erstellung erhältst du:
   - `client_id` (öffentlich)
   - `client_secret` (geheim)

### 2. Env Vars in Supabase setzen

```bash
supabase secrets set TYPEFORM_CLIENT_ID=<dein_client_id>
supabase secrets set TYPEFORM_CLIENT_SECRET=<dein_client_secret>
```

### 3. Client ID im Frontend eintragen

**Datei:** `scripts/api/typeform-api.js`  
**Zeile 7:**
```javascript
const TYPEFORM_CLIENT_ID = 'YOUR_TYPEFORM_CLIENT_ID'; // TODO: Replace
```

Ersetze mit deiner tatsächlichen Client ID (öffentlich, kann im Frontend stehen).

---

## 🚀 Deployment-Schritte

### 1. Database Migration
```bash
cd supabase
supabase db push
```

### 2. Edge Functions deployen
```bash
supabase functions deploy typeform-oauth
supabase functions deploy typeform-sync
supabase functions deploy typeform-webhook
```

### 3. Env Vars setzen
```bash
supabase secrets set TYPEFORM_CLIENT_ID=<deine_client_id>
supabase secrets set TYPEFORM_CLIENT_SECRET=<dein_client_secret>
```

### 4. Frontend Client ID setzen
Editiere `scripts/api/typeform-api.js` und ersetze `YOUR_TYPEFORM_CLIENT_ID`.

### 5. Frontend deployen
```bash
# Wenn du CDN/Hosting nutzt:
npm run build && npm run deploy

# Oder einfach Git Push (wenn Auto-Deploy aktiv):
git add .
git commit -m "feat: Typeform OAuth Integration"
git push
```

---

## ✅ Testing Workflow

### 1. Verbindung herstellen
1. Öffne Clarity App
2. Klicke "🔌 Integrationen" im Header
3. Klicke Typeform-Karte → "Verbinden"
4. OAuth-Popup öffnet sich
5. Login bei Typeform
6. Approve Access
7. Popup schließt automatisch
8. Status zeigt: "✓ Verbunden: <email>"

### 2. Formular verbinden
1. Klicke "➕ Formular hinzufügen"
2. Wähle Formular aus Dropdown
3. Wähle Ziel-Funnel
4. (Optional) Wähle Qualifikations-Frage
5. (Optional) Gib qualifizierende Antworten ein
6. Klicke "Formular verbinden"
7. Webhook wird automatisch erstellt ✅

### 3. Test-Submission
1. Gehe zu deinem Typeform
2. Fülle Formular aus (mit Email-Feld!)
3. Submit
4. Prüfe Clarity Datenpool:
   - Lead sollte erstellt sein
   - Event "survey" oder "surveyQuali" sollte existieren
5. Prüfe `typeform_events_log` Tabelle für Details

---

## 🐛 Troubleshooting

### OAuth-Fehler: "Invalid redirect_uri"
**Problem:** Redirect URI stimmt nicht mit Typeform App überein  
**Lösung:** 
- Prüfe Typeform App Settings
- Redirect URI muss exakt sein: `https://bghelanwedtdkyfvqlhf.supabase.co/functions/v1/typeform-oauth`

### Formulare werden nicht geladen
**Problem:** Token ungültig oder Scopes fehlen  
**Lösung:**
- Prüfe Scopes: `forms:read webhooks:write responses:read`
- Trenne Verbindung und verbinde neu

### Webhook wird nicht erstellt
**Problem:** Fehlende Berechtigung oder Form ID ungültig  
**Lösung:**
- Prüfe `typeform-sync` Logs: `supabase functions logs typeform-sync`
- Stelle sicher, dass User Owner des Forms ist

### Leads werden nicht erstellt
**Problem:** Webhook-Receiver funktioniert nicht  
**Lösung:**
- Prüfe `typeform-webhook` Logs: `supabase functions logs typeform-webhook`
- Prüfe `typeform_events_log` Tabelle für Errors
- Stelle sicher, dass Form-Mapping existiert (`typeform_forms`)

---

## 📊 Datenbank-Queries (Monitoring)

### Aktive Verbindungen prüfen
```sql
SELECT * FROM typeform_connections WHERE is_active = true;
```

### Verbundene Formulare anzeigen
```sql
SELECT 
  form_title,
  funnel_id,
  webhook_id,
  is_active,
  created_at
FROM typeform_forms
WHERE is_active = true
ORDER BY created_at DESC;
```

### Letzte Events anzeigen
```sql
SELECT 
  form_id,
  event_type,
  is_qualified,
  processed_at
FROM typeform_events_log
ORDER BY processed_at DESC
LIMIT 20;
```

### Conversion-Rate berechnen
```sql
SELECT 
  form_id,
  COUNT(*) AS total_responses,
  SUM(CASE WHEN is_qualified THEN 1 ELSE 0 END) AS qualified,
  ROUND(
    (SUM(CASE WHEN is_qualified THEN 1 ELSE 0 END)::float / COUNT(*)) * 100, 
    2
  ) AS qualification_rate
FROM typeform_events_log
GROUP BY form_id;
```

---

## 🔄 Migration von alter Version

Falls du bereits die manuelle Webhook-Version im Einsatz hattest:

### 1. Alte Tabellen sichern (optional)
```sql
CREATE TABLE typeform_form_mappings_backup AS 
SELECT * FROM typeform_form_mappings;

CREATE TABLE typeform_webhook_log_backup AS 
SELECT * FROM typeform_webhook_log;
```

### 2. Migration laufen lassen
Die neue Migration droppt automatisch alte Tabellen und erstellt neue.

### 3. Benutzer informieren
- Alte Webhooks in Typeform müssen **nicht** gelöscht werden (inaktiv)
- User müssen OAuth-Verbindung neu herstellen
- User müssen Formulare neu verbinden

---

## 📈 Nächste Schritte

Nach erfolgreichem Deployment:

1. **Calendly Integration** (nächste Conversion-Integration)
   - Ähnlicher OAuth-Flow
   - Auto-Webhook für Booking-Events
   - Fills "Setting Termine" in Tracking Sheets

2. **Auto-Sync von Form-Änderungen**
   - Periodisch Form-Structure neu laden
   - Warnung bei gelöschten Qualification-Fragen

3. **Erweiterte Qualification-Logic**
   - Multi-Question-Logic (UND/ODER)
   - Score-basierte Qualification
   - Custom JavaScript-Formeln

---

## 📞 Support

Bei Problemen:
1. Prüfe Edge Function Logs: `supabase functions logs <function-name>`
2. Prüfe Browser Console (F12)
3. Prüfe Datenbank-Tabellen (`typeform_events_log` für Errors)

---

**🎉 Deployment Ready!**
