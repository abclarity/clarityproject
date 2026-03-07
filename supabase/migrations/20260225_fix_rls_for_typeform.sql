-- Fix RLS policies for leads and events to allow typeform imports
-- The issue: Imported leads/events have no user_id, so RLS blocks them

-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Allow full access to leads" ON leads;
DROP POLICY IF EXISTS "Allow full access to events" ON events;

-- Recreate with proper permissive policies
CREATE POLICY "Allow authenticated access to leads"
  ON leads FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated access to events"
  ON events FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
