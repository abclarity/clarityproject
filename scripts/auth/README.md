# Auth

Authentifizierungs- und API-Settings Module.

## Dateien

### `auth.js`
- **API:** `window.AuthAPI` (vermutlich)
- **Funktion:** User Authentication (Supabase Auth)
- **Features:**
  - Login/Logout
  - Session Management
  - OAuth (Facebook, Google, etc.)
- **Wichtige Funktionen:**
  - `login(email, password)` - Email/Passwort Login
  - `logout()` - Beendet Session
  - `getUser()` - Gibt aktuellen User zurück
  - `onAuthStateChange(callback)` - Listener für Auth-Änderungen

### `api-settings.js`
- **Funktion:** UI für API-Verbindungen (Facebook Ads, etc.)
- **Features:**
  - Facebook Ads Account Management
  - API Token Verwaltung
  - Connection Status

## Design-Notizen

Auth ist bewusst **isoliert** von Core/APIs/Views:
- Auth lädt VOR Views
- Auth bestimmt, ob User überhaupt Zugriff hat
- Alle anderen Module setzen voraus, dass User authentifiziert ist

## Abhängigkeiten

- Core (StorageAPI für Token-Speicherung)
- Integrations (Supabase Client für Auth)

## Genutzt von

- Views (nur nach erfolgreicher Auth)
- APIs (User ID für RLS)
