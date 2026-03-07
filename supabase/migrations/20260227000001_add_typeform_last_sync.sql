-- Add typeform_last_sync column to user_preferences table
-- This tracks the last time we synced Typeform responses for auto-sync

ALTER TABLE user_preferences
ADD COLUMN IF NOT EXISTS typeform_last_sync TIMESTAMPTZ;

COMMENT ON COLUMN user_preferences.typeform_last_sync IS 'Timestamp of last Typeform auto-sync';
