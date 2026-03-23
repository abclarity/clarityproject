-- Call Tracking System: call_events table
-- Tracks Setting and Closing calls with full status lifecycle
-- Supplements existing `events` table (which tracks Bookings)
-- appointment_date is used for Termin/Call counts (Option B: by call date, not booking date)

CREATE TABLE call_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  lead_email TEXT NOT NULL,
  funnel_id TEXT,

  -- Call classification
  call_type TEXT NOT NULL CHECK (call_type IN ('setting', 'closing')),

  -- Date split: booking date vs appointment date (tracked separately for analytics)
  booking_date DATE,        -- Tag der Buchung (von Calendly)
  appointment_date DATE,    -- Tag des geplanten Calls (Termin/Call counts by this date)

  -- Status lifecycle:
  -- scheduled → showed / no_show / canceled / rescheduled / disqualified
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',    -- Gebucht, noch ausstehend
    'showed',       -- Call hat stattgefunden
    'no_show',      -- Nicht erschienen
    'canceled',     -- Abgesagt (canceled_at gesetzt)
    'rescheduled',  -- Verschoben (neues call_event entsteht)
    'disqualified'  -- Pre-Call disqualifiziert (vor dem Call)
  )),

  -- Outcome after showed:
  -- Setting: qualified / disqualified
  -- Closing: sold / no_sale / follow_up
  outcome TEXT CHECK (outcome IN (
    'qualified', 'disqualified',
    'sold', 'no_sale', 'follow_up'
  )),

  assigned_to TEXT,               -- Setter / Closer Name
  offer_made BOOLEAN DEFAULT FALSE, -- Closing: wurde ein Angebot gemacht?

  -- Cancellation tracking (for Late-Cancel-Threshold logic)
  -- If canceled_at < 4h before appointment_date → counts as no_show in reporting
  canceled_at TIMESTAMPTZ,

  -- Source references for idempotency
  calendly_event_uri TEXT,
  calendly_invitee_uri TEXT,      -- Unique per Calendly booking (for idempotency)
  close_lead_id TEXT,             -- Close.io Lead ID
  close_activity_id TEXT,         -- Close.io Activity ID (for idempotency)
  close_opportunity_id TEXT,      -- Close.io Opportunity ID

  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN (
    'calendly', 'close_crm', 'chrome_extension', 'manual'
  )),

  notes TEXT,

  -- Reschedule chain
  rescheduled_to_id UUID REFERENCES call_events(id),
  rescheduled_from_id UUID REFERENCES call_events(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indices
CREATE INDEX idx_call_events_user_id ON call_events(user_id);
CREATE INDEX idx_call_events_lead_id ON call_events(lead_id);
CREATE INDEX idx_call_events_lead_email ON call_events(lead_email);
CREATE INDEX idx_call_events_appointment_date ON call_events(appointment_date);
CREATE INDEX idx_call_events_booking_date ON call_events(booking_date);
CREATE INDEX idx_call_events_call_type ON call_events(call_type);
CREATE INDEX idx_call_events_status ON call_events(status);
CREATE INDEX idx_call_events_funnel_id ON call_events(funnel_id);
CREATE INDEX idx_call_events_close_lead_id ON call_events(close_lead_id);

-- Partial unique indices for idempotency
CREATE UNIQUE INDEX idx_call_events_calendly_invitee
  ON call_events(user_id, calendly_invitee_uri)
  WHERE calendly_invitee_uri IS NOT NULL;

CREATE UNIQUE INDEX idx_call_events_close_activity
  ON call_events(user_id, close_activity_id)
  WHERE close_activity_id IS NOT NULL;

-- RLS
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own call events"
  ON call_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_call_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER call_events_updated_at
  BEFORE UPDATE ON call_events
  FOR EACH ROW EXECUTE FUNCTION update_call_events_updated_at();
