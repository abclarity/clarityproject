-- Migration: Tracking Sheets to Supabase (Funnels & Tracking Data)
-- Date: 2025-12-10
-- Purpose: Enable device-independent, multi-user tracking with full data isolation

-- ============================================
-- FUNNELS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS funnels (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'paid-ads', 'organic', 'cold-email', etc.
  modules JSONB NOT NULL DEFAULT '[]', -- Array of module IDs: ["paid-ads", "classic-vsl", ...]
  color TEXT NOT NULL DEFAULT '#3498db',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user-based queries
CREATE INDEX IF NOT EXISTS idx_funnels_user_id ON funnels(user_id);

-- Enable RLS
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for funnels
CREATE POLICY "Users can manage own funnels"
  ON funnels
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- TRACKING_DATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS tracking_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funnel_id TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL, -- 0-based (0 = January, 11 = December)
  data JSONB NOT NULL DEFAULT '{}', -- Full month data: {"Adspend_1": 1500, "Leads_1": 23, ...}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: One entry per user/funnel/year/month
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_data_unique 
  ON tracking_data(user_id, funnel_id, year, month);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_tracking_data_user_funnel 
  ON tracking_data(user_id, funnel_id);

-- Enable RLS
ALTER TABLE tracking_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tracking_data
CREATE POLICY "Users can manage own tracking data"
  ON tracking_data
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTION: Update timestamp on change
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic updated_at
CREATE TRIGGER update_funnels_updated_at
  BEFORE UPDATE ON funnels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracking_data_updated_at
  BEFORE UPDATE ON tracking_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFY SETUP
-- ============================================
-- Check if tables exist and RLS is enabled
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('funnels', 'tracking_data');

-- Check policies
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('funnels', 'tracking_data');
