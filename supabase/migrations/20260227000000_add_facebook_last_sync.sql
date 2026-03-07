-- Add facebook_last_sync column to user_preferences
ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS facebook_last_sync TIMESTAMPTZ;

COMMENT ON COLUMN user_preferences.facebook_last_sync IS 'Last time Facebook Ads auto-sync ran successfully';
