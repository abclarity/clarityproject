/*
  # Change event_date from date to timestamptz
  
  This migration changes the event_date column in the events table
  from 'date' to 'timestamptz' to preserve time information.
*/

-- Change event_date column type from date to timestamptz
ALTER TABLE events 
ALTER COLUMN event_date TYPE timestamptz 
USING event_date::timestamptz;

-- Add comment to explain the column
COMMENT ON COLUMN events.event_date IS 'When the event occurred (with time)';
