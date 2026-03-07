-- Fix: Drop and recreate funnels table with correct schema
-- Date: 2025-12-10
-- Purpose: Fix schema mismatch causing 409 errors

-- ============================================
-- DROP OLD TABLE
-- ============================================
DROP TABLE IF EXISTS funnels CASCADE;

-- ============================================
-- CREATE FUNNELS TABLE WITH CORRECT SCHEMA
-- ============================================
CREATE TABLE funnels (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  modules JSONB NOT NULL DEFAULT '[]',
  color TEXT NOT NULL DEFAULT '#3498db',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user-based queries
CREATE INDEX idx_funnels_user_id ON funnels(user_id);

-- Enable RLS
ALTER TABLE funnels ENABLE ROW LEVEL SECURITY;

-- RLS Policy for funnels
CREATE POLICY "Users can manage own funnels"
  ON funnels
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- CREATE TRIGGER FOR AUTO-UPDATE TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_funnels_updated_at
  BEFORE UPDATE ON funnels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFY SETUP
-- ============================================
SELECT 
  schemaname, 
  tablename, 
  rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename = 'funnels';

SELECT 
  schemaname, 
  tablename, 
  policyname, 
  cmd 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'funnels';
