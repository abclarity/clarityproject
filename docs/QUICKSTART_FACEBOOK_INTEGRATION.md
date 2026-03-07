# Quick Start - Facebook Ads Integration

## 🚀 Schnelle Installation (3 Schritte)

### Schritt 1: Supabase CLI installieren

**Option A - via Homebrew (empfohlen für macOS):**
```bash
# Homebrew installieren (falls noch nicht vorhanden)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Supabase CLI installieren
brew install supabase/tap/supabase
```

**Option B - via npm:**
```bash
# Node.js installieren (falls noch nicht vorhanden)
# Download von: https://nodejs.org/

# Supabase CLI installieren
npm install -g supabase
```

**Option C - Direct Download:**
```bash
# Für macOS (Apple Silicon)
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_darwin_arm64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/

# Für macOS (Intel)
curl -L https://github.com/supabase/cli/releases/latest/download/supabase_darwin_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/
```

### Schritt 2: Facebook App erstellen

1. Gehe zu https://developers.facebook.com/apps
2. Klicke **"App erstellen"** → **Business** Typ
3. Name: `Clarity Funnel Tracker`
4. **Produkte hinzufügen** → **Marketing API**
5. Notiere **App-ID** und **App Secret**

### Schritt 3: Deployment-Skript ausführen

```bash
cd "/Users/admin/Downloads/clarityv3 2/clarityv3"
./deploy-facebook-integration.sh
```

Das Skript führt automatisch aus:
- ✅ Supabase Login
- ✅ Projekt verknüpfen
- ✅ Environment Variables setzen
- ✅ Datenbank-Migration
- ✅ Edge Functions deployen

**Fertig! 🎉**

---

## 📖 Detaillierte Anleitung

Siehe `FACEBOOK_ADS_DEPLOYMENT.md` für:
- Facebook App Konfiguration
- OAuth Redirect URI Setup
- Troubleshooting
- Cron Job Setup
- Testing-Checkliste

---

## ⚡ Manuelle Installation (falls Skript nicht funktioniert)

### 1. Supabase Login
```bash
supabase login
```

### 2. Projekt verknüpfen
```bash
cd "/Users/admin/Downloads/clarityv3 2/clarityv3"
supabase link --project-ref DEIN_PROJECT_REF
```

### 3. Environment Variables setzen
```bash
supabase secrets set FB_APP_ID=deine_facebook_app_id
supabase secrets set FB_APP_SECRET=dein_facebook_app_secret
supabase secrets set FB_REDIRECT_URI=https://DEIN_PROJECT_REF.supabase.co/functions/v1/facebook-oauth
```

### 4. Datenbank-Migration
```bash
supabase db push
```

### 5. Edge Functions deployen
```bash
supabase functions deploy facebook-oauth --no-verify-jwt
supabase functions deploy facebook-sync-accounts
supabase functions deploy facebook-sync-insights
```

### 6. Überprüfen
```bash
supabase functions list
```

---

## 🧪 Testing

1. App starten: `python3 -m http.server 5000` (oder `npm run dev`)
2. Browser: http://localhost:5000
3. Login → Sidebar → API Settings
4. "Mit Facebook verbinden" → Authorize
5. Ad Accounts synchronisieren
6. Datenpool → Traffic Sources → Facebook Ads

---

## ❓ Troubleshooting

### "Supabase CLI not found"
→ Siehe Schritt 1 oben

### "Project not linked"
→ `supabase link --project-ref DEIN_REF`

### "OAuth failed - invalid redirect_uri"
→ Prüfe Facebook App Settings → OAuth Redirect URIs

### "No ad accounts found"
→ User braucht Zugriff auf Ad Account im Facebook Business Manager

### Logs anzeigen
```bash
supabase functions logs facebook-oauth
supabase functions logs facebook-sync-insights
```

---

## 🆘 Support

Bei Problemen:
1. Prüfe `FACEBOOK_ADS_DEPLOYMENT.md` Troubleshooting-Sektion
2. Logs mit `supabase functions logs` überprüfen
3. GitHub Issue erstellen mit Fehlermeldung

---

**Viel Erfolg! 🚀**
