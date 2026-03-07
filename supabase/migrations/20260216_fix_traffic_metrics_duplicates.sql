-- Migration: Fix Traffic Metrics Duplicates
-- Created: 2026-02-16
-- Purpose: Clean up duplicates and enforce unique constraint for campaign-level data

-- =====================================================
-- 1. CLEANUP: Remove existing duplicates
-- =====================================================

-- Keep only the most recent row for each (user_id, campaign_id, date) combination
DELETE FROM traffic_metrics a
USING traffic_metrics b
WHERE a.id < b.id 
  AND a.user_id = b.user_id
  AND a.campaign_id = b.campaign_id
  AND a.date = b.date
  AND COALESCE(a.level, 'campaign') = 'campaign'
  AND COALESCE(b.level, 'campaign') = 'campaign';

-- =====================================================
-- 2. UPDATE CONSTRAINT: Simplify for campaign-level
-- =====================================================

-- Drop old constraint if exists
ALTER TABLE traffic_metrics 
  DROP CONSTRAINT IF EXISTS traffic_metrics_unique_key;

-- Drop old unique index if exists
DROP INDEX IF EXISTS traffic_metrics_campaign_unique_idx;

-- Create UNIQUE INDEX for campaign-level data
-- This enforces uniqueness for (user_id, campaign_id, date) at campaign level
CREATE UNIQUE INDEX traffic_metrics_campaign_unique_idx 
  ON traffic_metrics(user_id, campaign_id, date)
  WHERE level = 'campaign' OR level IS NULL;

-- =====================================================
-- 3. INDEXES: Optimize for UPSERT operations
-- =====================================================

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_traffic_metrics_campaign_date;

-- Create index for fast upsert lookups (non-unique, for queries)
CREATE INDEX IF NOT EXISTS idx_traffic_metrics_campaign_date 
  ON traffic_metrics(user_id, campaign_id, date)
  WHERE level = 'campaign' OR level IS NULL;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON INDEX traffic_metrics_campaign_unique_idx IS 
  'Ensures no duplicate campaign data for same user/campaign/date. Allows UPSERT in Facebook sync.';
