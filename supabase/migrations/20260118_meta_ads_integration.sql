-- Migration: Meta Ads Integration with Multi-Touch Attribution
-- Date: 2026-01-18
-- Description: Facebook OAuth, Ad Accounts, Campaign Sync, Multi-Touch Attribution

-- =====================================================
-- 1. FACEBOOK CONNECTIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS facebook_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'long_lived',
  expires_at TIMESTAMPTZ,
  scopes TEXT DEFAULT 'ads_read,ads_management,business_management',
  status TEXT DEFAULT 'active', -- 'active', 'expired', 'revoked'
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, fb_user_id)
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_facebook_connections_user_id ON facebook_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_connections_status ON facebook_connections(status);

-- RLS
ALTER TABLE facebook_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own facebook connections"
  ON facebook_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own facebook connections"
  ON facebook_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own facebook connections"
  ON facebook_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own facebook connections"
  ON facebook_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- =====================================================
-- 2. FACEBOOK AD ACCOUNTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS facebook_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES facebook_connections(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL, -- 'act_123456789' format
  account_id TEXT, -- '123456789' format (without 'act_')
  name TEXT,
  currency TEXT,
  account_status INTEGER, -- 1=ACTIVE, 2=DISABLED, etc.
  timezone_name TEXT,
  is_syncing BOOLEAN DEFAULT false,
  last_sync TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true,
  initial_sync_days INTEGER DEFAULT 90, -- How far back to sync initially
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ad_account_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_facebook_ad_accounts_user_id ON facebook_ad_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_ad_accounts_connection_id ON facebook_ad_accounts(connection_id);
CREATE INDEX IF NOT EXISTS idx_facebook_ad_accounts_ad_account_id ON facebook_ad_accounts(ad_account_id);

-- RLS
ALTER TABLE facebook_ad_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own facebook ad accounts"
  ON facebook_ad_accounts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own facebook ad accounts"
  ON facebook_ad_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own facebook ad accounts"
  ON facebook_ad_accounts FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own facebook ad accounts"
  ON facebook_ad_accounts FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());


-- =====================================================
-- 3. CAMPAIGN FUNNEL MAPPING TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS campaign_funnel_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type TEXT DEFAULT 'name', -- 'name', 'utm', 'url' (for future)
  pattern_value TEXT NOT NULL, -- e.g., "SZM - VSL"
  funnel_id TEXT NOT NULL, -- Maps to funnels.id
  priority INTEGER DEFAULT 1, -- Lower number = higher priority
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaign_funnel_mapping_user_id ON campaign_funnel_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_funnel_mapping_pattern_value ON campaign_funnel_mapping(pattern_value);
CREATE INDEX IF NOT EXISTS idx_campaign_funnel_mapping_funnel_id ON campaign_funnel_mapping(funnel_id);

-- RLS
ALTER TABLE campaign_funnel_mapping ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own campaign mappings"
  ON campaign_funnel_mapping
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- =====================================================
-- 4. LEAD TOUCHPOINTS TABLE (Multi-Touch Attribution)
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  campaign_id TEXT, -- Facebook campaign_id or utm_campaign
  campaign_name TEXT,
  ad_set_id TEXT,
  ad_set_name TEXT,
  ad_id TEXT,
  ad_name TEXT,
  source TEXT, -- 'facebook-ads', 'google-ads', 'organic', etc.
  funnel_id TEXT,
  touchpoint_date TIMESTAMPTZ NOT NULL,
  utm_params JSONB DEFAULT '{}', -- {utm_source, utm_medium, utm_content, utm_term}
  page_url TEXT, -- Landing page URL
  referrer TEXT,
  device TEXT, -- 'desktop', 'mobile', 'tablet'
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_touchpoints_user_id ON lead_touchpoints(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_touchpoints_lead_id ON lead_touchpoints(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_touchpoints_campaign_id ON lead_touchpoints(campaign_id);
CREATE INDEX IF NOT EXISTS idx_lead_touchpoints_date ON lead_touchpoints(touchpoint_date DESC);
CREATE INDEX IF NOT EXISTS idx_lead_touchpoints_source ON lead_touchpoints(source);

-- RLS
ALTER TABLE lead_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lead touchpoints"
  ON lead_touchpoints FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own lead touchpoints"
  ON lead_touchpoints FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());


-- =====================================================
-- 5. EXTEND LEADS TABLE FOR ATTRIBUTION
-- =====================================================

-- Add attribution columns to leads table
DO $$
BEGIN
  -- First touch fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'first_touch_campaign'
  ) THEN
    ALTER TABLE leads ADD COLUMN first_touch_campaign TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'first_touch_date'
  ) THEN
    ALTER TABLE leads ADD COLUMN first_touch_date TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'first_touch_source'
  ) THEN
    ALTER TABLE leads ADD COLUMN first_touch_source TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'first_touch_funnel'
  ) THEN
    ALTER TABLE leads ADD COLUMN first_touch_funnel TEXT;
  END IF;

  -- Last touch fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'last_touch_campaign'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_touch_campaign TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'last_touch_date'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_touch_date TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'last_touch_source'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_touch_source TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'last_touch_funnel'
  ) THEN
    ALTER TABLE leads ADD COLUMN last_touch_funnel TEXT;
  END IF;

  -- Attribution settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'attribution_window_days'
  ) THEN
    ALTER TABLE leads ADD COLUMN attribution_window_days INTEGER DEFAULT 30;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'total_touchpoints'
  ) THEN
    ALTER TABLE leads ADD COLUMN total_touchpoints INTEGER DEFAULT 1;
  END IF;
END $$;

-- Create indexes for attribution queries
CREATE INDEX IF NOT EXISTS idx_leads_first_touch_campaign ON leads(first_touch_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_last_touch_campaign ON leads(last_touch_campaign);
CREATE INDEX IF NOT EXISTS idx_leads_first_touch_date ON leads(first_touch_date);


-- =====================================================
-- 6. CAMPAIGN PERFORMANCE VIEW (for Scale It later)
-- =====================================================

CREATE OR REPLACE VIEW campaign_performance_view AS
SELECT 
  tm.user_id,
  tm.source,
  tm.campaign_id,
  tm.campaign_name,
  tm.funnel_id,
  tm.ad_set_id,
  tm.ad_set_name,
  tm.ad_id,
  tm.ad_name,
  tm.level,
  
  -- Date range
  MIN(tm.date) as date_from,
  MAX(tm.date) as date_to,
  
  -- Traffic Metrics (Aggregated)
  SUM(tm.adspend) as total_spend,
  SUM(tm.impressions) as total_impressions,
  SUM(tm.reach) as total_reach,
  SUM(tm.clicks) as total_clicks,
  
  -- Calculated Traffic KPIs
  CASE 
    WHEN SUM(tm.impressions) > 0 THEN (SUM(tm.adspend) / SUM(tm.impressions) * 1000)
    ELSE 0 
  END as avg_cpm,
  CASE 
    WHEN SUM(tm.impressions) > 0 THEN (SUM(tm.clicks)::numeric / SUM(tm.impressions) * 100)
    ELSE 0 
  END as avg_ctr,
  CASE 
    WHEN SUM(tm.clicks) > 0 THEN (SUM(tm.adspend) / SUM(tm.clicks))
    ELSE 0 
  END as avg_cpc,
  
  -- First-Touch Attribution Conversions
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.first_touch_campaign = tm.campaign_id 
    AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
  ) as first_touch_leads,
  
  COUNT(DISTINCT e.id) FILTER (
    WHERE e.event_type = 'survey' 
    AND l.first_touch_campaign = tm.campaign_id
    AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
  ) as first_touch_surveys,
  
  COUNT(DISTINCT e.id) FILTER (
    WHERE e.event_type = 'surveyQuali'
    AND l.first_touch_campaign = tm.campaign_id
    AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
  ) as first_touch_qualified,
  
  COUNT(DISTINCT e.id) FILTER (
    WHERE e.event_type IN ('settingCall', 'settingTermin', 'settingBooking')
    AND l.first_touch_campaign = tm.campaign_id
    AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
  ) as first_touch_settings,
  
  COUNT(DISTINCT e.id) FILTER (
    WHERE e.event_type IN ('closingCall', 'closingTermin', 'closingBooking')
    AND l.first_touch_campaign = tm.campaign_id
    AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
  ) as first_touch_closings,
  
  COUNT(DISTINCT e.id) FILTER (
    WHERE e.event_type = 'unit'
    AND l.first_touch_campaign = tm.campaign_id
    AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
  ) as first_touch_sales,
  
  -- Revenue Attribution
  SUM(e.revenue) FILTER (
    WHERE e.event_type = 'unit'
    AND l.first_touch_campaign = tm.campaign_id
    AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
  ) as first_touch_revenue,
  
  SUM(e.cash) FILTER (
    WHERE e.event_type = 'unit'
    AND l.first_touch_campaign = tm.campaign_id
    AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
  ) as first_touch_cash,
  
  -- Calculated Performance KPIs
  CASE 
    WHEN COUNT(DISTINCT l.id) FILTER (
      WHERE l.first_touch_campaign = tm.campaign_id 
      AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
    ) > 0 
    THEN (SUM(tm.adspend) / COUNT(DISTINCT l.id) FILTER (
      WHERE l.first_touch_campaign = tm.campaign_id 
      AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
    ))
    ELSE 0 
  END as cpl,
  
  CASE 
    WHEN COUNT(DISTINCT e.id) FILTER (
      WHERE e.event_type = 'unit'
      AND l.first_touch_campaign = tm.campaign_id
      AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
    ) > 0 
    THEN (SUM(tm.adspend) / COUNT(DISTINCT e.id) FILTER (
      WHERE e.event_type = 'unit'
      AND l.first_touch_campaign = tm.campaign_id
      AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
    ))
    ELSE 0 
  END as cpa,
  
  CASE 
    WHEN SUM(tm.adspend) > 0 
    THEN (
      (COALESCE(SUM(e.revenue) FILTER (
        WHERE e.event_type = 'unit'
        AND l.first_touch_campaign = tm.campaign_id
        AND l.first_touch_date >= (CURRENT_DATE - COALESCE(l.attribution_window_days, 30))
      ), 0) - SUM(tm.adspend)) / SUM(tm.adspend) * 100
    )
    ELSE 0 
  END as roi_percentage

FROM traffic_metrics tm

LEFT JOIN leads l 
  ON l.user_id = tm.user_id
  AND l.first_touch_campaign = tm.campaign_id

LEFT JOIN events e 
  ON e.lead_id = l.id

GROUP BY 
  tm.user_id,
  tm.source,
  tm.campaign_id,
  tm.campaign_name,
  tm.funnel_id,
  tm.ad_set_id,
  tm.ad_set_name,
  tm.ad_id,
  tm.ad_name,
  tm.level;


-- =====================================================
-- 7. HELPER FUNCTION: Match Campaign to Funnel
-- =====================================================

CREATE OR REPLACE FUNCTION match_campaign_to_funnel(
  p_user_id UUID,
  p_campaign_name TEXT
) RETURNS TEXT AS $$
DECLARE
  v_funnel_id TEXT;
BEGIN
  -- Try to find matching pattern (order by priority)
  SELECT funnel_id INTO v_funnel_id
  FROM campaign_funnel_mapping
  WHERE user_id = p_user_id
    AND is_active = true
    AND p_campaign_name ILIKE '%' || pattern_value || '%'
  ORDER BY priority ASC, created_at ASC
  LIMIT 1;
  
  RETURN v_funnel_id;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- 8. TRIGGER: Auto-update timestamps
-- =====================================================

-- facebook_connections
CREATE TRIGGER update_facebook_connections_updated_at
  BEFORE UPDATE ON facebook_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- facebook_ad_accounts
CREATE TRIGGER update_facebook_ad_accounts_updated_at
  BEFORE UPDATE ON facebook_ad_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- campaign_funnel_mapping
CREATE TRIGGER update_campaign_funnel_mapping_updated_at
  BEFORE UPDATE ON campaign_funnel_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =====================================================
-- DONE: Meta Ads Integration Schema Complete
-- =====================================================
