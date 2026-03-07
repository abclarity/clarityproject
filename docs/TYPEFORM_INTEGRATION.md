# Typeform Integration - Setup Guide

## 📋 Overview

Die Typeform-Integration erfasst automatisch Leads und Survey-Daten aus Typeform-Formularen und speichert sie im Clarity Datenpool.

**Features:**
- ✅ Automatische Lead-Erfassung via Webhook
- ✅ Survey-Qualification-Logik (qualified/unqualified)
- ✅ Funnel-Zuordnung pro Form
- ✅ Duplikat-Erkennung via Email
- ✅ Hidden Fields Support (UTM-Parameter, Funnel-ID)

---

## 🚀 Deployment

### 1. Database Migration ausführen

```bash
cd /Users/admin/Downloads/clarityv3\ 2/clarityv3
supabase db push
```

Oder via Supabase Dashboard:
1. SQL Editor öffnen
2. `supabase/migrations/20260222_create_typeform_integration.sql` kopieren
3. Ausführen

**Ergebnis:** Tabellen `typeform_form_mappings` und `typeform_webhook_log` erstellt.

### 2. Edge Function deployen

```bash
supabase functions deploy typeform-webhook
```

**Webhook-URL:** `https://bghelanwedtdkyfvqlhf.supabase.co/functions/v1/typeform-webhook`

### 3. (Optional) Webhook Secret konfigurieren

Für Signatur-Verifikation:

```bash
supabase secrets set TYPEFORM_WEBHOOK_SECRET=dein_geheimer_schlüssel
```

---

## 🔧 Typeform Configuration

### 1. Webhook in Typeform einrichten

1. Öffne dein Typeform im Editor
2. Gehe zu **Connect** → **Webhooks**
3. Klicke **Add a webhook**
4. Füge URL ein:
   ```
   https://bghelanwedtdkyfvqlhf.supabase.co/functions/v1/typeform-webhook
   ```
5. Wähle Event: **form_response**
6. (Optional) Secret für Signatur-Verifikation eintragen
7. **Save** klicken

### 2. Hidden Fields hinzufügen (empfohlen)

Hidden Fields ermöglichen automatische Funnel-Zuordnung:

1. Öffne Typeform im Editor
2. Klicke **Variables** (oben rechts)
3. Füge hinzu:
   - `funnel_id` (z.B. `fb-ads`)
   - `utm_campaign` (z.B. `VSL-Q1`)
   - `utm_source` (z.B. `facebook`)
   - `utm_medium` (z.B. `cpc`)

4. In deinem Link:
   ```
   https://your-form.typeform.com/to/ABC123?funnel_id=fb-ads&utm_campaign=VSL-Q1
   ```

---

## 📝 Clarity UI Configuration

### 1. Typeform mit Funnel verbinden

1. In Clarity: **Datenpool** öffnen
2. Klicke **Typeform**-Tab
3. Klicke **+ Neues Formular**
4. Konfiguration:
   - **Form ID**: Aus Typeform-URL (z.B. `AbCd1234`)
   - **Form Name**: Beschreibender Name (optional)
   - **Funnel**: Wähle Clarity-Funnel aus Dropdown
   - **Qualification Question ID**: Field-ID für Qualification (optional)
   - **Qualifizierende Antworten**: Komma-getrennte Liste (z.B. `Ja, Yes`)

5. **Speichern** klicken

### 2. Qualification Logic konfigurieren

**Beispiel:**

Frage: "Hast du Budget für Coaching?"
- Field ID: `field_abc123`
- Qualifizierende Antworten: `Ja, Yes, Definitiv`

→ Wenn User eine dieser Antworten gibt: `surveyQuali` Event  
→ Sonst: `survey` Event

---

## 🧪 Testing

### 1. Test-Submission senden

1. Fülle dein Typeform aus
2. Submit klicken

### 2. Prüfen im Clarity Datenpool

1. Öffne **Datenpool** → **Übersicht**
2. Neuer Lead sollte erscheinen
3. Event-Timeline sollte `survey` oder `surveyQuali` enthalten

### 3. Prüfen in Supabase

```sql
-- Check webhook log
SELECT * FROM typeform_webhook_log ORDER BY processed_at DESC LIMIT 10;

-- Check lead created
SELECT * FROM leads WHERE source = 'typeform' ORDER BY created_at DESC LIMIT 10;

-- Check events
SELECT * FROM events WHERE source = 'typeform' ORDER BY event_date DESC LIMIT 10;
```

### 4. Check Tracking Sheet

1. Öffne **Tracking Sheets** → Dein Funnel
2. Gehe zum heutigen Datum
3. **Leads** sollte +1 sein
4. **Survey Qualified** sollte +1 sein (falls qualified)

---

## 🔍 Troubleshooting

### Webhook wird nicht ausgelöst

**Check 1:** Webhook-URL korrekt?
```
https://bghelanwedtdkyfvqlhf.supabase.co/functions/v1/typeform-webhook
```

**Check 2:** Event `form_response` ausgewählt?

**Check 3:** Typeform Webhook Logs prüfen:
- Typeform Editor → Connect → Webhooks → View logs

### Lead wird nicht erstellt

**Check 1:** Email-Feld vorhanden?
- Typeform muss ein Email-Feld enthalten
- Type muss `email` sein

**Check 2:** Form Mapping existiert?
```sql
SELECT * FROM typeform_form_mappings WHERE form_id = 'DEINE_FORM_ID';
```

**Check 3:** Edge Function Logs:
```bash
supabase functions logs typeform-webhook --tail
```

### Qualification funktioniert nicht

**Check 1:** Field ID korrekt?
- In Typeform: Questions → Click Frage → Logic → Field ID anzeigen

**Check 2:** Answer Case-Sensitive?
- Nein! Vergleich ist case-insensitive
- `Ja` = `ja` = `JA`

**Check 3:** Answer-Type unterstützt?
- ✅ Multiple Choice (`choice.label`)
- ✅ Yes/No (`boolean` → `true`/`false`)
- ✅ Short Text (`text`)
- ❌ File Upload, Payment (nicht unterstützt)

---

## 📊 Event Mapping

| Typeform Event | Clarity Event | Tracking Sheet Feld |
|----------------|---------------|---------------------|
| `form_response` (unqualified) | `survey` | Leads |
| `form_response` (qualified) | `surveyQuali` | Survey Qualified |

**Automatische Felder:**
- `event_date`: Typeform `submitted_at`
- `funnel_id`: Hidden Field oder Mapping-Config
- `source`: Immer `typeform`
- `metadata`: Vollständige Answers + Hidden Fields

---

## 🔄 Auto-Sync to Tracking Sheets

**Status:** ⏳ Noch nicht implementiert (kommt in Phase 2)

Aktuell manuell via:
1. Datenpool Events sammeln sich
2. Tracking Sheet Manual Sync Button (später automatisch)

---

## 📞 Support

Bei Problemen:
1. Edge Function Logs prüfen: `supabase functions logs typeform-webhook`
2. Webhook Log prüfen: `SELECT * FROM typeform_webhook_log WHERE raw_payload::text LIKE '%error%';`
3. Typeform Support kontaktieren (falls Webhook nicht sendet)

**Bekannte Limitierungen:**
- Max 1 Million Webhooks/Monat (Typeform Free: 10/Monat)
- Webhook-Retry: 3x bei Fehler (danach manuell neu senden)
- Signatur-Verifikation: Nur mit kostenpflichtigem Typeform-Plan

---

**Erstellt:** 22. Februar 2026  
**Version:** 1.0  
**Status:** ✅ Ready for Production
