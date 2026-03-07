-- Add lead_source column to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- Add event_source column to events table (if not exists)
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_source TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_leads_lead_source ON leads(lead_source);
CREATE INDEX IF NOT EXISTS idx_events_event_source ON events(event_source);

-- Update existing rows to have default value
UPDATE leads SET lead_source = 'manual' WHERE lead_source IS NULL;
UPDATE events SET event_source = 'manual' WHERE event_source IS NULL;
