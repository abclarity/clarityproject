-- Fix ad-level upsert: add partial unique index for ad-level rows
-- (The general UNIQUE constraint on nullable columns doesn't work reliably for upsert)

CREATE UNIQUE INDEX IF NOT EXISTS traffic_metrics_ad_unique_idx
ON traffic_metrics(user_id, date, source, ad_id)
WHERE level = 'ad' AND ad_id IS NOT NULL;
