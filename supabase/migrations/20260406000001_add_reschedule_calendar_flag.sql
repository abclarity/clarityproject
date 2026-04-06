-- Add is_reschedule_calendar flag to calendly_event_type_mappings
-- When true: webhook does not create a new closingBooking event,
-- but instead updates the appointment_date on the existing call_event (reschedule chain).

ALTER TABLE calendly_event_type_mappings
  ADD COLUMN IF NOT EXISTS is_reschedule_calendar BOOLEAN DEFAULT FALSE;
