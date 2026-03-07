/*
  # Create Data Pool System Tables

  1. New Tables
    - `leads`
      - `id` (uuid, primary key)
      - `name` (text)
      - `emails` (jsonb array) - Multiple email addresses
      - `phones` (jsonb array) - Multiple phone numbers
      - `primary_email` (text) - Main email for quick search
      - `primary_phone` (text) - Main phone for quick search
      - `source` (text) - Original traffic source
      - `funnel_id` (text) - Associated funnel
      - `metadata` (jsonb) - Additional data
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `events`
      - `id` (uuid, primary key)
      - `lead_id` (uuid, foreign key to leads)
      - `event_type` (text) - lead, survey, surveyQuali, settingBooking, settingTermin, settingCall, closingBooking, closingTermin, closingCall, unit
      - `event_date` (date) - When the event occurred
      - `funnel_id` (text) - Which funnel this event belongs to
      - `source` (text) - Traffic source at time of event
      - `revenue` (numeric) - For unit events
      - `cash` (numeric) - For unit events
      - `metadata` (jsonb) - Additional event data
      - `created_at` (timestamptz) - When record was created
      - `updated_at` (timestamptz)
    
    - `api_connections`
      - `id` (uuid, primary key)
      - `provider` (text) - clickfunnels, typeform, calendly, facebook, google
      - `credentials` (jsonb) - Encrypted API keys/tokens
      - `config` (jsonb) - Provider-specific configuration
      - `status` (text) - active, error, disconnected
      - `last_sync` (timestamptz)
      - `error_message` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `sync_log`
      - `id` (uuid, primary key)
      - `connection_id` (uuid, foreign key to api_connections)
      - `sync_type` (text) - manual, scheduled, webhook
      - `status` (text) - success, error, partial
      - `records_processed` (integer)
      - `records_created` (integer)
      - `records_updated` (integer)
      - `error_details` (jsonb)
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `traffic_metrics`
      - `id` (uuid, primary key)
      - `date` (date) - The date these metrics apply to
      - `funnel_id` (text)
      - `source` (text) - facebook, google, organic, etc
      - `campaign_id` (text) - External campaign identifier
      - `campaign_name` (text)
      - `adspend` (numeric)
      - `impressions` (integer)
      - `reach` (integer)
      - `clicks` (integer)
      - `metadata` (jsonb)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated access

  3. Indexes
    - Create indexes for common query patterns
*/

-- Create leads table
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  emails jsonb DEFAULT '[]'::jsonb,
  phones jsonb DEFAULT '[]'::jsonb,
  primary_email text,
  primary_phone text,
  source text,
  funnel_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create events table
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_date date NOT NULL,
  funnel_id text,
  source text,
  revenue numeric DEFAULT 0,
  cash numeric DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create api_connections table
CREATE TABLE IF NOT EXISTS api_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  credentials jsonb DEFAULT '{}'::jsonb,
  config jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'disconnected',
  last_sync timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sync_log table
CREATE TABLE IF NOT EXISTS sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES api_connections(id) ON DELETE CASCADE,
  sync_type text NOT NULL,
  status text NOT NULL,
  records_processed integer DEFAULT 0,
  records_created integer DEFAULT 0,
  records_updated integer DEFAULT 0,
  error_details jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create traffic_metrics table
CREATE TABLE IF NOT EXISTS traffic_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  funnel_id text,
  source text,
  campaign_id text,
  campaign_name text,
  adspend numeric DEFAULT 0,
  impressions integer DEFAULT 0,
  reach integer DEFAULT 0,
  clicks integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(date, funnel_id, source, campaign_id)
);

-- Create indexes for leads
CREATE INDEX IF NOT EXISTS idx_leads_primary_email ON leads(primary_email);
CREATE INDEX IF NOT EXISTS idx_leads_primary_phone ON leads(primary_phone);
CREATE INDEX IF NOT EXISTS idx_leads_funnel_id ON leads(funnel_id);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Create indexes for events
CREATE INDEX IF NOT EXISTS idx_events_lead_id ON events(lead_id);
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_event_date ON events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_funnel_id ON events(funnel_id);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);

-- Create indexes for traffic_metrics
CREATE INDEX IF NOT EXISTS idx_traffic_date ON traffic_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_funnel_id ON traffic_metrics(funnel_id);
CREATE INDEX IF NOT EXISTS idx_traffic_source ON traffic_metrics(source);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_metrics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for leads
CREATE POLICY "Allow full access to leads"
  ON leads FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for events
CREATE POLICY "Allow full access to events"
  ON events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for api_connections
CREATE POLICY "Allow full access to api_connections"
  ON api_connections FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for sync_log
CREATE POLICY "Allow full access to sync_log"
  ON sync_log FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create RLS policies for traffic_metrics
CREATE POLICY "Allow full access to traffic_metrics"
  ON traffic_metrics FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_events_updated_at ON events;
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_api_connections_updated_at ON api_connections;
CREATE TRIGGER update_api_connections_updated_at
  BEFORE UPDATE ON api_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_traffic_metrics_updated_at ON traffic_metrics;
CREATE TRIGGER update_traffic_metrics_updated_at
  BEFORE UPDATE ON traffic_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();