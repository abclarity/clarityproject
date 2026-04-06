-- Add appointment_timestamp to call_events for full datetime precision
-- appointment_date (DATE) stays for analytics/aggregation
-- appointment_timestamp (TIMESTAMPTZ) stores the exact time for timeline ordering and display

ALTER TABLE call_events
  ADD COLUMN IF NOT EXISTS appointment_timestamp TIMESTAMPTZ;
