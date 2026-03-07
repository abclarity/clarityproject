# Auto-Sync Deployment Guide

## 1. Datenbank Migration ausführen

In Supabase Dashboard → SQL Editor:

```sql
-- User preferences table for auto-sync and other settings
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  facebook_auto_sync_enabled BOOLEAN DEFAULT false,
  facebook_auto_sync_months_back INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see and modify their own preferences
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);
```

## 2. Edge Function deployen

Supabase Dashboard → Edge Functions → Deploy a new function

**Function Name:** `tracking-sheet-auto-sync`

**Code:** Copy from `supabase/functions/tracking-sheet-auto-sync/index.ts`

**Deploy Command (falls CLI verfügbar):**
```bash
supabase functions deploy tracking-sheet-auto-sync
```

## 3. Cron Job konfigurieren

Supabase Dashboard → Database → Cron Jobs → Add new cron job

**Name:** `auto-sync-tracking-sheets`

**Schedule (Cron Expression):** `0 3 * * *` (täglich um 3:00 Uhr)

**SQL Command:**
```sql
SELECT net.http_post(
  url := '<SUPABASE_URL>/functions/v1/tracking-sheet-auto-sync',
  headers := '{"Authorization": "Bearer <SUPABASE_ANON_KEY>", "Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
) AS response;
```

**WICHTIG:** Ersetze `<SUPABASE_URL>` und `<SUPABASE_ANON_KEY>` mit deinen tatsächlichen Werten!

## 4. Manueller Test

Teste die Edge Function manuell, bevor du den Cron Job aktivierst:

```bash
curl -X POST https://<PROJECT_REF>.supabase.co/functions/v1/tracking-sheet-auto-sync \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Erwartete Response:
```json
{
  "success": true,
  "timestamp": "2026-02-16T...",
  "users_processed": 1,
  "users_succeeded": 1,
  "users_failed": 0,
  "results": [...]
}
```

## 5. Verification

1. **Auto-Sync aktivieren:**
   - Öffne Clarity
   - Gehe zu Datapool → "Sync zu Tracking Sheets"
   - Aktiviere Checkbox "Automatisch täglich synchronisieren"
   - Klicke "Synchronisieren"

2. **Check in Database:**
```sql
SELECT * FROM user_preferences WHERE facebook_auto_sync_enabled = true;
```

3. **Test Cron Job manuell:**
Supabase Dashboard → Cron Jobs → Run now

4. **Check Logs:**
Supabase Dashboard → Edge Functions → tracking-sheet-auto-sync → Logs

## Troubleshooting

**Problem:** Cron Job läuft nicht
- Check Supabase Logs für Fehler
- Verify Cron Expression ist korrekt
- Ensure Edge Function ist deployed

**Problem:** No users processed
- Check `user_preferences` table hat Einträge mit `facebook_auto_sync_enabled = true`
- Verify user hat aktive Facebook connection

**Problem:** Authentication errors
- Check Service Role Key in Edge Function Environment Variables
- Verify RLS Policies auf `user_preferences` table
