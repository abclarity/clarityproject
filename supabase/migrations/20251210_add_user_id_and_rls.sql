-- Migration: Add user_id to all tables and update RLS policies
-- Date: 2025-12-10
-- Purpose: Multi-user support with data isolation

-- Add user_id column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to traffic_metrics table
ALTER TABLE traffic_metrics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to api_connections table
ALTER TABLE api_connections ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to sync_log table
ALTER TABLE sync_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_metrics_user_id ON traffic_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_api_connections_user_id ON api_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_user_id ON sync_log(user_id);

-- Drop existing policies
DROP POLICY IF EXISTS "Allow full access to leads" ON leads;
DROP POLICY IF EXISTS "Allow full access to events" ON events;
DROP POLICY IF EXISTS "Allow full access to traffic_metrics" ON traffic_metrics;
DROP POLICY IF EXISTS "Allow full access to api_connections" ON api_connections;
DROP POLICY IF EXISTS "Allow full access to sync_log" ON sync_log;

-- Create user-specific RLS policies for leads
CREATE POLICY "Users can view own leads"
  ON leads FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own leads"
  ON leads FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own leads"
  ON leads FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own leads"
  ON leads FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create user-specific RLS policies for events
CREATE POLICY "Users can view own events"
  ON events FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own events"
  ON events FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own events"
  ON events FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create user-specific RLS policies for traffic_metrics
CREATE POLICY "Users can view own traffic_metrics"
  ON traffic_metrics FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own traffic_metrics"
  ON traffic_metrics FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own traffic_metrics"
  ON traffic_metrics FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own traffic_metrics"
  ON traffic_metrics FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create user-specific RLS policies for api_connections
CREATE POLICY "Users can view own api_connections"
  ON api_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own api_connections"
  ON api_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own api_connections"
  ON api_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own api_connections"
  ON api_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create user-specific RLS policies for sync_log
CREATE POLICY "Users can view own sync_log"
  ON sync_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sync_log"
  ON sync_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Note: For existing data without user_id, you'll need to either:
-- 1. Manually assign a user_id to existing records
-- 2. Delete existing test data and start fresh
-- 3. Create a temporary migration to assign existing data to a specific user

-- Example: Assign all existing data to a specific user (replace UUID with your user ID)
-- UPDATE leads SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE events SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE traffic_metrics SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE api_connections SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
-- UPDATE sync_log SET user_id = 'YOUR-USER-UUID' WHERE user_id IS NULL;
