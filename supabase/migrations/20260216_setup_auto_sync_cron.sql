-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job for daily auto-sync at 3 AM UTC
SELECT cron.schedule(
  'auto-sync-tracking-sheets',  -- Job name
  '0 3 * * *',                   -- Cron expression (daily at 3 AM UTC)
  $$
  SELECT
    net.http_post(
      url := 'https://bghelanwedtdkyfvqlhf.supabase.co/functions/v1/tracking-sheet-auto-sync',
      headers := '{"Authorization": "Bearer sb_publishable_Fg4qeMIyDZ7tMFCsVDh0iQ_qohXWYID", "Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    ) AS response;
  $$
);
