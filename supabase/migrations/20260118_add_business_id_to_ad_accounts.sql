-- Add business_id and business_name to facebook_ad_accounts table
-- This allows filtering ad accounts by business manager

ALTER TABLE facebook_ad_accounts 
ADD COLUMN IF NOT EXISTS business_id TEXT,
ADD COLUMN IF NOT EXISTS business_name TEXT;

-- Create index for business filtering
CREATE INDEX IF NOT EXISTS idx_facebook_ad_accounts_business_id 
ON facebook_ad_accounts(business_id);

-- Add comment
COMMENT ON COLUMN facebook_ad_accounts.business_id IS 'Facebook Business Manager ID that owns this ad account';
COMMENT ON COLUMN facebook_ad_accounts.business_name IS 'Name of the Business Manager for display purposes';
