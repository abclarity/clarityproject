-- Migration: Calendly Integration Tables
-- Created: 2026-03-18

-- 1. Calendly OAuth Connections (one per user)
CREATE TABLE IF NOT EXISTS calendly_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  account_uri TEXT,              -- e.g. https://api.calendly.com/users/XXXX
  organization_uri TEXT,         -- e.g. https://api.calendly.com/organizations/XXXX
  account_email TEXT,
  account_name TEXT,
  webhook_uri TEXT,              -- Calendly webhook subscription URI (for deletion on disconnect)
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id)
);

-- 2. Calendly Event Type Mappings (which Calendly event = setting/closing call)
CREATE TABLE IF NOT EXISTS calendly_event_type_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  calendly_event_type_uri TEXT NOT NULL,   -- Calendly event type URI
  calendly_event_type_name TEXT NOT NULL,  -- Human-readable name, e.g. "Setting Call 30 Min"
  clarity_event_type TEXT NOT NULL         -- 'settingBooking' or 'closingBooking'
    CHECK (clarity_event_type IN ('settingBooking', 'closingBooking')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, calendly_event_type_uri)
);

-- 3. Calendly UTM Mappings (utm_campaign value → Clarity funnel)
CREATE TABLE IF NOT EXISTS calendly_utm_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  utm_campaign TEXT NOT NULL,   -- e.g. "facebook-main-funnel"
  utm_source TEXT,              -- optional, for display only
  funnel_id TEXT NOT NULL,      -- Clarity funnel ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, utm_campaign)
);

-- 4. Calendly Events Log (idempotency – prevents duplicate processing)
CREATE TABLE IF NOT EXISTS calendly_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calendly_event_uri TEXT NOT NULL,    -- Calendly scheduled event URI
  invitee_uri TEXT NOT NULL,           -- Calendly invitee URI (unique per booking)
  invitee_email TEXT,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  event_type TEXT,                     -- 'settingBooking' or 'closingBooking'
  raw_payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(invitee_uri)
);

-- Enable RLS on all tables
ALTER TABLE calendly_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_event_type_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_utm_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendly_events_log ENABLE ROW LEVEL SECURITY;

-- ── RLS Policies: calendly_connections ──────────────────────────────────────
CREATE POLICY "Users can view own calendly connection"
  ON calendly_connections FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendly connection"
  ON calendly_connections FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendly connection"
  ON calendly_connections FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendly connection"
  ON calendly_connections FOR DELETE USING (auth.uid() = user_id);

-- Service role (Edge Functions) can do everything
CREATE POLICY "Service role full access on calendly_connections"
  ON calendly_connections FOR ALL USING (true) WITH CHECK (true);

-- ── RLS Policies: calendly_event_type_mappings ───────────────────────────────
CREATE POLICY "Users can manage own event type mappings"
  ON calendly_event_type_mappings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on event_type_mappings"
  ON calendly_event_type_mappings FOR ALL USING (true) WITH CHECK (true);

-- ── RLS Policies: calendly_utm_mappings ──────────────────────────────────────
CREATE POLICY "Users can manage own utm mappings"
  ON calendly_utm_mappings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on utm_mappings"
  ON calendly_utm_mappings FOR ALL USING (true) WITH CHECK (true);

-- ── RLS Policies: calendly_events_log ────────────────────────────────────────
CREATE POLICY "Users can view own calendly events log"
  ON calendly_events_log FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on calendly_events_log"
  ON calendly_events_log FOR ALL USING (true) WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_calendly_connections_user_id ON calendly_connections(user_id);
CREATE INDEX idx_calendly_event_type_mappings_user_id ON calendly_event_type_mappings(user_id);
CREATE INDEX idx_calendly_utm_mappings_user_id ON calendly_utm_mappings(user_id);
CREATE INDEX idx_calendly_events_log_invitee_uri ON calendly_events_log(invitee_uri);
CREATE INDEX idx_calendly_events_log_user_id ON calendly_events_log(user_id);
CREATE INDEX idx_calendly_events_log_processed_at ON calendly_events_log(processed_at DESC);
