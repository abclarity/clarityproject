-- Migration: Typeform OAuth Integration
-- Created: 2026-02-22
-- Replaces manual webhook setup with OAuth flow (like Facebook Ads)

-- 1. Drop old manual tables (if they exist)
DROP TABLE IF EXISTS typeform_webhook_log CASCADE;
DROP TABLE IF EXISTS typeform_form_mappings CASCADE;

-- 2. Typeform Connections (OAuth tokens)
CREATE TABLE IF NOT EXISTS typeform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL, -- Typeform OAuth access token
  refresh_token TEXT, -- For token refresh (if needed)
  token_expires_at TIMESTAMPTZ, -- Token expiration
  account_id TEXT, -- Typeform account/workspace ID (if available)
  account_email TEXT, -- Connected Typeform account email
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id) -- One connection per user
);

-- 3. Typeform Forms (synced from Typeform API)
CREATE TABLE IF NOT EXISTS typeform_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL, -- Typeform form ID
  form_title TEXT NOT NULL,
  form_url TEXT,
  fields JSONB, -- Form structure (questions)
  funnel_id TEXT, -- Mapped Clarity funnel
  qualification_field_id TEXT, -- Which question is qualification?
  qualifying_answers TEXT[], -- Which answers = qualified
  webhook_id TEXT, -- Typeform webhook ID (created via API)
  webhook_tag TEXT, -- Unique tag for this webhook
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, form_id)
);

-- 4. Typeform Webhook Events Log
CREATE TABLE IF NOT EXISTS typeform_events_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  response_id TEXT NOT NULL UNIQUE, -- Typeform response token (for idempotency)
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  event_type TEXT, -- 'survey' or 'surveyQuali'
  is_qualified BOOLEAN,
  raw_payload JSONB,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE typeform_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE typeform_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE typeform_events_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies: typeform_connections
CREATE POLICY "Users can view their own connections"
  ON typeform_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own connections"
  ON typeform_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own connections"
  ON typeform_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own connections"
  ON typeform_connections FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: typeform_forms
CREATE POLICY "Users can view their own forms"
  ON typeform_forms FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own forms"
  ON typeform_forms FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own forms"
  ON typeform_forms FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own forms"
  ON typeform_forms FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies: typeform_events_log
CREATE POLICY "Users can view their own events"
  ON typeform_events_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert events"
  ON typeform_events_log FOR INSERT WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_typeform_connections_user_id ON typeform_connections(user_id);
CREATE INDEX idx_typeform_forms_user_id ON typeform_forms(user_id);
CREATE INDEX idx_typeform_forms_form_id ON typeform_forms(form_id);
CREATE INDEX idx_typeform_forms_funnel_id ON typeform_forms(funnel_id) WHERE funnel_id IS NOT NULL;
CREATE INDEX idx_typeform_events_log_form_id ON typeform_events_log(form_id);
CREATE INDEX idx_typeform_events_log_response_id ON typeform_events_log(response_id);
CREATE INDEX idx_typeform_events_log_lead_id ON typeform_events_log(lead_id) WHERE lead_id IS NOT NULL;

-- Trigger: Update updated_at on typeform_forms
CREATE OR REPLACE FUNCTION update_typeform_forms_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_typeform_forms_updated_at
  BEFORE UPDATE ON typeform_forms
  FOR EACH ROW
  EXECUTE FUNCTION update_typeform_forms_updated_at();
