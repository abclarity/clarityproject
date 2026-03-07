-- Add all missing columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_status TEXT DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_source TEXT DEFAULT 'manual';

-- Add missing columns to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_source TEXT DEFAULT 'manual';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_lead_source ON leads(lead_source);
CREATE INDEX IF NOT EXISTS idx_leads_lead_status ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_events_event_source ON events(event_source);

-- Update existing NULL values
UPDATE leads SET lead_status = 'new' WHERE lead_status IS NULL;
UPDATE leads SET lead_source = 'manual' WHERE lead_source IS NULL;
UPDATE events SET event_source = 'manual' WHERE event_source IS NULL;
