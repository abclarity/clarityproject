-- Fix RLS Policies - Ensure RLS is enabled and policies work correctly
-- Date: 2025-12-10

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE traffic_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view own leads" ON leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON leads;
DROP POLICY IF EXISTS "Users can update own leads" ON leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON leads;

DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Users can insert own events" ON events;
DROP POLICY IF EXISTS "Users can update own events" ON events;
DROP POLICY IF EXISTS "Users can delete own events" ON events;

DROP POLICY IF EXISTS "Users can view own traffic_metrics" ON traffic_metrics;
DROP POLICY IF EXISTS "Users can insert own traffic_metrics" ON traffic_metrics;
DROP POLICY IF EXISTS "Users can update own traffic_metrics" ON traffic_metrics;
DROP POLICY IF EXISTS "Users can delete own traffic_metrics" ON traffic_metrics;

DROP POLICY IF EXISTS "Users can view own api_connections" ON api_connections;
DROP POLICY IF EXISTS "Users can insert own api_connections" ON api_connections;
DROP POLICY IF EXISTS "Users can update own api_connections" ON api_connections;
DROP POLICY IF EXISTS "Users can delete own api_connections" ON api_connections;

DROP POLICY IF EXISTS "Users can view own sync_log" ON sync_log;
DROP POLICY IF EXISTS "Users can insert own sync_log" ON sync_log;

-- Recreate policies for leads (all operations for authenticated users on their own data)
CREATE POLICY "Users can manage own leads"
  ON leads
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Recreate policies for events (all operations for authenticated users on their own data)
CREATE POLICY "Users can manage own events"
  ON events
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Recreate policies for traffic_metrics (all operations for authenticated users on their own data)
CREATE POLICY "Users can manage own traffic_metrics"
  ON traffic_metrics
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Recreate policies for api_connections (all operations for authenticated users on their own data)
CREATE POLICY "Users can manage own api_connections"
  ON api_connections
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Recreate policies for sync_log (all operations for authenticated users on their own data)
CREATE POLICY "Users can manage own sync_log"
  ON sync_log
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Verify RLS is enabled (this will show true for all tables)
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('leads', 'events', 'traffic_metrics', 'api_connections', 'sync_log');
