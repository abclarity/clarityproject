-- Add campaign filter rules to ad accounts
-- Allows users to filter which campaigns to sync per account

ALTER TABLE facebook_ad_accounts
ADD COLUMN IF NOT EXISTS campaign_filter JSONB DEFAULT '{"enabled": false, "rules": []}'::jsonb;

COMMENT ON COLUMN facebook_ad_accounts.campaign_filter IS 'Campaign filtering rules: {"enabled": true, "rules": [{"type": "contains", "value": "SZM"}]}';

-- Example filter structure:
-- {
--   "enabled": true,
--   "rules": [
--     {"type": "contains", "value": "SZM"},
--     {"type": "starts_with", "value": "Lead Gen"},
--     {"type": "excludes", "value": "Test"}
--   ]
-- }
