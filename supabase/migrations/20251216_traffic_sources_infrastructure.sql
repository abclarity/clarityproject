-- Migration: Traffic Sources Infrastructure (Phase 1)
-- Date: 2025-12-16
-- Description: Erweitert traffic_metrics für Multi-User + Campaign Hierarchy,
--              erstellt sync_queue für Batch-Management,
--              erstellt traffic_overview View für Hybrid-Ansatz

-- =====================================================
-- 1. TRAFFIC_METRICS: User Isolation + Campaign Hierarchy
-- =====================================================

-- Add user_id for multi-user isolation
ALTER TABLE traffic_metrics 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add campaign hierarchy fields (Ad Sets & Ads)
ALTER TABLE traffic_metrics
  ADD COLUMN IF NOT EXISTS ad_set_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_set_name TEXT,
  ADD COLUMN IF NOT EXISTS ad_id TEXT,
  ADD COLUMN IF NOT EXISTS ad_name TEXT;

-- Add level field to distinguish Campaign/AdSet/Ad rows
ALTER TABLE traffic_metrics
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT 'campaign'; -- 'campaign', 'ad_set', 'ad'

-- Update UNIQUE constraint to include user_id
ALTER TABLE traffic_metrics 
  DROP CONSTRAINT IF EXISTS traffic_metrics_date_funnel_id_source_campaign_id_key;

ALTER TABLE traffic_metrics
  ADD CONSTRAINT traffic_metrics_unique_key 
  UNIQUE(user_id, date, source, campaign_id, ad_set_id, ad_id, level);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_traffic_user_id ON traffic_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_traffic_date ON traffic_metrics(date DESC);
CREATE INDEX IF NOT EXISTS idx_traffic_source ON traffic_metrics(source);
CREATE INDEX IF NOT EXISTS idx_traffic_campaign_id ON traffic_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_traffic_ad_set_id ON traffic_metrics(ad_set_id) WHERE ad_set_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_traffic_ad_id ON traffic_metrics(ad_id) WHERE ad_id IS NOT NULL;

-- Update RLS policies
DROP POLICY IF EXISTS "Allow full access to traffic_metrics for authenticated users" ON traffic_metrics;

ALTER TABLE traffic_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own traffic metrics"
  ON traffic_metrics
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- =====================================================
-- 2. SYNC_QUEUE: Batch Management für API Syncs
-- =====================================================

CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- 'meta', 'google', 'organic', etc.
  batch_number INTEGER NOT NULL,
  batch_offset INTEGER NOT NULL,
  batch_limit INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  scheduled_for TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  calls_used INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for sync_queue
CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_scheduled ON sync_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_queue_provider ON sync_queue(provider);

-- RLS for sync_queue
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sync queue"
  ON sync_queue
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all sync queue"
  ON sync_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =====================================================
-- 3. TRAFFIC_OVERVIEW: Hybrid View (Traffic + Conversions)
-- =====================================================

CREATE OR REPLACE VIEW traffic_overview AS
SELECT 
  tm.id,
  tm.user_id,
  tm.date,
  tm.source,
  tm.funnel_id,
  tm.campaign_id,
  tm.campaign_name,
  tm.ad_set_id,
  tm.ad_set_name,
  tm.ad_id,
  tm.ad_name,
  tm.level,
  
  -- Traffic Metrics (from traffic_metrics)
  tm.adspend,
  tm.impressions,
  tm.reach,
  tm.clicks,
  
  -- Calculated Traffic KPIs
  CASE 
    WHEN tm.impressions > 0 THEN (tm.adspend / tm.impressions * 1000)
    ELSE 0 
  END as cpm,
  CASE 
    WHEN tm.impressions > 0 THEN (tm.clicks::numeric / tm.impressions * 100)
    ELSE 0 
  END as ctr,
  CASE 
    WHEN tm.clicks > 0 THEN (tm.adspend / tm.clicks)
    ELSE 0 
  END as cpc,
  
  -- Platform Leads (from metadata, e.g., FB Leads API)
  COALESCE((tm.metadata->>'fb_leads')::integer, 0) as platform_leads,
  
  -- Backend Conversions (from leads + events tables)
  COUNT(DISTINCT l.id) as backend_leads,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'survey') as surveys,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'surveyQuali') as qualified_surveys,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'settingBooking') as setting_bookings,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'settingTermin') as setting_termine,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'settingCall') as setting_calls,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'closingBooking') as closing_bookings,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'closingTermin') as closing_termine,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'closingCall') as closing_calls,
  COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'unit') as units,
  
  -- Revenue Metrics
  COALESCE(SUM(e.revenue) FILTER (WHERE e.event_type = 'unit'), 0) as revenue,
  COALESCE(SUM(e.cash) FILTER (WHERE e.event_type = 'unit'), 0) as cash,
  
  -- Calculated Conversion KPIs
  CASE 
    WHEN COUNT(DISTINCT l.id) > 0 THEN (tm.adspend / COUNT(DISTINCT l.id))
    ELSE 0 
  END as cpl,
  CASE 
    WHEN COUNT(DISTINCT l.id) > 0 THEN (COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'survey')::numeric / COUNT(DISTINCT l.id) * 100)
    ELSE 0 
  END as survey_rate,
  CASE 
    WHEN COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'survey') > 0 
      THEN (COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'surveyQuali')::numeric / 
            COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'survey') * 100)
    ELSE 0 
  END as qualification_rate,
  CASE 
    WHEN COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'unit') > 0 THEN (tm.adspend / COUNT(DISTINCT e.id) FILTER (WHERE e.event_type = 'unit'))
    ELSE 0 
  END as cpa,
  CASE 
    WHEN tm.adspend > 0 THEN ((COALESCE(SUM(e.revenue) FILTER (WHERE e.event_type = 'unit'), 0) - tm.adspend) / tm.adspend * 100)
    ELSE 0 
  END as roi,
  
  -- Metadata
  tm.metadata,
  tm.created_at,
  tm.updated_at

FROM traffic_metrics tm

-- LEFT JOIN leads (match via utm_campaign + date + user)
LEFT JOIN leads l 
  ON l.utm_campaign = tm.campaign_id 
  AND l.created_at::date = tm.date
  AND l.user_id = tm.user_id
  AND (l.source = tm.source OR l.source IS NULL)

-- LEFT JOIN events (for conversion tracking)
LEFT JOIN events e 
  ON e.lead_id = l.id

GROUP BY 
  tm.id,
  tm.user_id,
  tm.date,
  tm.source,
  tm.funnel_id,
  tm.campaign_id,
  tm.campaign_name,
  tm.ad_set_id,
  tm.ad_set_name,
  tm.ad_id,
  tm.ad_name,
  tm.level,
  tm.adspend,
  tm.impressions,
  tm.reach,
  tm.clicks,
  tm.metadata,
  tm.created_at,
  tm.updated_at;

-- RLS for traffic_overview (inherits from traffic_metrics)
-- Views automatically filter based on user_id via traffic_metrics policy


-- =====================================================
-- 4. HELPER FUNCTION: Prepare Daily Sync Queue
-- =====================================================

CREATE OR REPLACE FUNCTION prepare_daily_sync_queue()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  connection_record RECORD;
  total_campaigns INTEGER;
  batches_needed INTEGER;
  batch_num INTEGER;
  batch_hour INTEGER;
BEGIN
  -- Delete old completed/failed batches (older than 7 days)
  DELETE FROM sync_queue 
  WHERE status IN ('completed', 'failed') 
    AND created_at < NOW() - INTERVAL '7 days';
  
  -- Delete pending batches for today (in case function runs twice)
  DELETE FROM sync_queue 
  WHERE status = 'pending' 
    AND scheduled_for::date = (CURRENT_DATE + INTERVAL '1 day')::date;
  
  -- For each active API connection
  FOR connection_record IN 
    SELECT 
      ac.user_id,
      ac.provider,
      ac.config
    FROM api_connections ac
    WHERE ac.status = 'active'
      AND ac.provider IN ('meta', 'google') -- Nur Provider mit API-Sync
  LOOP
    -- Get campaign count from config (set during OAuth or manual update)
    total_campaigns := COALESCE((connection_record.config->>'campaign_count')::INTEGER, 0);
    
    -- Skip if no campaigns
    IF total_campaigns = 0 THEN
      CONTINUE;
    END IF;
    
    -- Calculate needed batches (20 campaigns per batch)
    batches_needed := CEIL(total_campaigns / 20.0);
    
    -- Limit to max 6 batches per night (1-6 AM)
    IF batches_needed > 6 THEN
      batches_needed := 6;
      RAISE NOTICE 'User % has % campaigns, limiting to 6 batches (120 campaigns)', 
        connection_record.user_id, total_campaigns;
    END IF;
    
    -- Create batches scheduled for 1 AM, 2 AM, 3 AM, ...
    FOR batch_num IN 1..batches_needed LOOP
      batch_hour := batch_num; -- 1, 2, 3, 4, 5, 6
      
      INSERT INTO sync_queue (
        user_id,
        provider,
        batch_number,
        batch_offset,
        batch_limit,
        scheduled_for,
        status
      ) VALUES (
        connection_record.user_id,
        connection_record.provider,
        batch_num,
        (batch_num - 1) * 20,  -- Offset: 0, 20, 40, 60, 80, 100
        20,                     -- Limit: 20 campaigns per batch
        (CURRENT_DATE + INTERVAL '1 day' + (batch_hour * INTERVAL '1 hour'))::TIMESTAMPTZ,
        'pending'
      );
    END LOOP;
    
    RAISE NOTICE 'Created % batches for user % (provider: %)', 
      batches_needed, connection_record.user_id, connection_record.provider;
  END LOOP;
  
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION prepare_daily_sync_queue() TO service_role;


-- =====================================================
-- 5. HELPER FUNCTION: Update Campaign Count
-- =====================================================

-- Function to update campaign_count in api_connections.config
-- Called by Edge Function after fetching campaigns from API
CREATE OR REPLACE FUNCTION update_campaign_count(
  p_user_id UUID,
  p_provider TEXT,
  p_campaign_count INTEGER
)
RETURNS void AS $$
BEGIN
  UPDATE api_connections
  SET 
    config = jsonb_set(
      COALESCE(config, '{}'::jsonb),
      '{campaign_count}',
      to_jsonb(p_campaign_count)
    ),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND provider = p_provider;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION update_campaign_count(UUID, TEXT, INTEGER) TO service_role;


-- =====================================================
-- 6. TRIGGER: Auto-update updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to traffic_metrics
DROP TRIGGER IF EXISTS update_traffic_metrics_updated_at ON traffic_metrics;
CREATE TRIGGER update_traffic_metrics_updated_at
  BEFORE UPDATE ON traffic_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply to sync_queue
DROP TRIGGER IF EXISTS update_sync_queue_updated_at ON sync_queue;
CREATE TRIGGER update_sync_queue_updated_at
  BEFORE UPDATE ON sync_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- 7. MIGRATION: Set user_id for existing traffic_metrics
-- =====================================================

-- If there are existing rows without user_id, you need to assign them
-- Option 1: Assign to first authenticated user (for single-user apps)
-- Option 2: Delete orphaned rows (if this is fresh deployment)

-- Uncomment ONE of these if you have existing data:

-- Option 1: Assign to first user
-- UPDATE traffic_metrics 
-- SET user_id = (SELECT id FROM auth.users LIMIT 1)
-- WHERE user_id IS NULL;

-- Option 2: Delete orphaned rows
-- DELETE FROM traffic_metrics WHERE user_id IS NULL;

-- For new deployments, no action needed


-- =====================================================
-- DONE: Phase 1 Infrastructure Complete
-- =====================================================

-- Next steps:
-- 1. Apply this migration: psql -U postgres -d clarity -f 20251216_traffic_sources_infrastructure.sql
-- 2. Test traffic_overview view: SELECT * FROM traffic_overview LIMIT 10;
-- 3. Test prepare_daily_sync_queue(): SELECT prepare_daily_sync_queue();
-- 4. Proceed to Phase 2: Meta Ads API Integration
