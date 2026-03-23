-- Close.io Integration Tables
-- Configurable mapping system: works for any Close.io user, not just one specific setup
-- Users map their own dispositions/stages/fields to Clarity events

-- API Connection (API Key based, not OAuth)
CREATE TABLE close_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  webhook_id TEXT,                -- Close.io webhook subscription ID (for deletion on disconnect)
  organization_name TEXT,         -- Close.io org name (for display)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ
);

ALTER TABLE close_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own close connection"
  ON close_connections FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Call Outcome Mappings: Close.io call dispositions → Clarity call_event updates
-- Example: "✅ Closing Call stattgefunden" → call_type='closing', status='showed'
-- Example: "Setting Call No Show" → call_type='setting', status='no_show'
CREATE TABLE close_call_outcome_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_disposition TEXT NOT NULL,    -- Exact disposition text from Close.io
  clarity_call_type TEXT CHECK (clarity_call_type IN ('setting', 'closing')),  -- null = auto-detect
  clarity_status TEXT NOT NULL CHECK (clarity_status IN (
    'showed', 'no_show', 'canceled', 'disqualified', 'rescheduled'
  )),
  clarity_outcome TEXT CHECK (clarity_outcome IN (
    'qualified', 'disqualified', 'sold', 'no_sale', 'follow_up'
  )),                                 -- null = no outcome update
  also_creates_closing_event BOOLEAN DEFAULT FALSE,  -- For "Setting showed + qualified → create closing call_event"
  UNIQUE(user_id, close_disposition)
);

ALTER TABLE close_call_outcome_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own close outcome mappings"
  ON close_call_outcome_mappings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Pipeline Stage Mappings: Opportunity stage changes → captured as context
-- Not used for "sold" tracking (sale = when money comes in, tracked elsewhere)
-- But useful for analytics: "how many leads are at CONTRACT SIGNED stage?"
CREATE TABLE close_stage_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_status_label TEXT NOT NULL,   -- E.g. "CONTRACT SIGNED", "CLOSING | NO OFFER"
  clarity_context TEXT,               -- Internal label for analytics
  UNIQUE(user_id, close_status_label)
);

ALTER TABLE close_stage_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own close stage mappings"
  ON close_stage_mappings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Custom Field Mappings: Close.io custom fields → Clarity call_event fields
-- Example: Close custom field "Closer" → assigned_to
CREATE TABLE close_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  close_field_id TEXT NOT NULL,       -- Close.io internal custom field ID
  close_field_name TEXT,              -- Display name (e.g. "Closer")
  clarity_field TEXT NOT NULL CHECK (clarity_field IN (
    'assigned_to',   -- Setter / Closer name
    'funnel_id'      -- Map lead to specific funnel
  )),
  UNIQUE(user_id, close_field_id)
);

ALTER TABLE close_field_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own close field mappings"
  ON close_field_mappings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Webhook Events Log: for idempotency (prevent duplicate processing)
CREATE TABLE close_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  close_event_id TEXT NOT NULL,       -- Close.io event ID
  event_type TEXT,                    -- e.g. "activity.call.created"
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(close_event_id)
);

ALTER TABLE close_webhook_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own close webhook log"
  ON close_webhook_log FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
