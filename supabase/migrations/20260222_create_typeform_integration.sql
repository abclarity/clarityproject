-- Migration: Typeform Integration Tables
-- Created: 2026-02-22

-- 1. Typeform Form Mappings (which form fills which funnel)
CREATE TABLE IF NOT EXISTS typeform_form_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL, -- Typeform form ID
  form_name TEXT, -- Human-readable form name
  funnel_id TEXT NOT NULL, -- Clarity funnel ID
  qualification_question_id TEXT, -- Typeform question field ID for qualification
  qualifying_answers TEXT[], -- Array of answers that = qualified (e.g., ['Ja', 'Yes'])
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, form_id)
);

-- 2. Typeform Webhook Log (track submissions)
CREATE TABLE IF NOT EXISTS typeform_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  form_id TEXT NOT NULL,
  response_id TEXT NOT NULL, -- Typeform response token
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  is_qualified BOOLEAN,
  raw_payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(response_id)
);

-- Enable RLS
ALTER TABLE typeform_form_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE typeform_webhook_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for typeform_form_mappings
CREATE POLICY "Users can view their own form mappings"
  ON typeform_form_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own form mappings"
  ON typeform_form_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own form mappings"
  ON typeform_form_mappings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own form mappings"
  ON typeform_form_mappings FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for typeform_webhook_log
CREATE POLICY "Users can view their own webhook logs"
  ON typeform_webhook_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert webhook logs (Edge Function writes here)
CREATE POLICY "Service role can insert webhook logs"
  ON typeform_webhook_log FOR INSERT
  WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_typeform_mappings_user_id ON typeform_form_mappings(user_id);
CREATE INDEX idx_typeform_mappings_form_id ON typeform_form_mappings(form_id);
CREATE INDEX idx_typeform_webhook_log_form_id ON typeform_webhook_log(form_id);
CREATE INDEX idx_typeform_webhook_log_lead_id ON typeform_webhook_log(lead_id);
CREATE INDEX idx_typeform_webhook_log_processed_at ON typeform_webhook_log(processed_at DESC);

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_typeform_mapping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_typeform_mapping_updated_at
  BEFORE UPDATE ON typeform_form_mappings
  FOR EACH ROW
  EXECUTE FUNCTION update_typeform_mapping_updated_at();
