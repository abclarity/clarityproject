-- Migration: Unit Import & Payment Schedule
-- Created: 2026-03-18
-- Purpose:
--   1. UNIQUE(user_id, primary_email) auf leads – verhindert doppelte Leads pro User
--   2. payment_schedule Tabelle – speichert Raten-Plan für Unit-Abschlüsse (für Projections)

-- ── 1. Deduplizierung: behalte ältesten Lead, entferne neuere Duplikate ────────
--    (sicher ausführbar auf leerer oder kleiner Tabelle)
DELETE FROM leads
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, primary_email) id
  FROM leads
  WHERE primary_email IS NOT NULL
  ORDER BY user_id, primary_email, created_at ASC
);

-- ── 2. UNIQUE-Constraint auf (user_id, primary_email) ────────────────────────
--    Ermöglicht sauberes Upsert via onConflict in Edge Functions
ALTER TABLE leads
  ADD CONSTRAINT leads_user_id_primary_email_unique
  UNIQUE (user_id, primary_email);

-- ── 3. payment_schedule Tabelle ───────────────────────────────────────────────
--    Speichert Raten-Plan für einen Unit-Abschluss.
--    Jede Zeile = eine Rate (Datum + Betrag).
--    Wird für Projections genutzt: "Wie viel Cash kommt nächsten Monat rein?"
CREATE TABLE IF NOT EXISTS payment_schedule (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unit_event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  lead_id             UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  installment_number  INTEGER NOT NULL,        -- 1 = erste Rate, 2 = zweite Rate, ...
  due_date            DATE NOT NULL,           -- Fälligkeitsdatum
  amount              NUMERIC NOT NULL,        -- Betrag dieser Rate
  collected           BOOLEAN DEFAULT FALSE,   -- wurde die Rate bereits eingezogen?
  collected_at        TIMESTAMPTZ,             -- wann eingezogen (für spätere Cash-Tracking Funktion)
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unit_event_id, installment_number)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment schedule"
  ON payment_schedule FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own payment schedule"
  ON payment_schedule FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own payment schedule"
  ON payment_schedule FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own payment schedule"
  ON payment_schedule FOR DELETE
  USING (auth.uid() = user_id);

-- Service role (Edge Functions) – vollen Zugriff
CREATE POLICY "Service role full access on payment_schedule"
  ON payment_schedule FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX idx_payment_schedule_user_id       ON payment_schedule(user_id);
CREATE INDEX idx_payment_schedule_unit_event_id ON payment_schedule(unit_event_id);
CREATE INDEX idx_payment_schedule_lead_id       ON payment_schedule(lead_id);
CREATE INDEX idx_payment_schedule_due_date      ON payment_schedule(due_date);
-- Für Projections: "alle offenen Raten in Monat X"
CREATE INDEX idx_payment_schedule_due_collected ON payment_schedule(due_date, collected)
  WHERE collected = FALSE;
