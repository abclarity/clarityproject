-- Fix traffic_metrics unique constraint for UPSERT
-- Drop old index if exists
DROP INDEX IF EXISTS traffic_metrics_campaign_unique_idx;

-- Create unique index on the exact columns used in UPSERT
CREATE UNIQUE INDEX IF NOT EXISTS traffic_metrics_unique_idx 
ON traffic_metrics(user_id, campaign_id, date) 
WHERE level = 'campaign';
