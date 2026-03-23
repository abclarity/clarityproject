-- Fix Close.io call outcome mappings: use outcome_id not disposition text
-- Close.io stores custom call outcomes as outcome_id references (e.g. "outcome_032abc...").
-- The 'disposition' field on activities is only the phone-level status (answered/busy/no-answer).
-- We now use outcome_id as the matching key and store the label in close_disposition for display.

ALTER TABLE close_call_outcome_mappings
  ADD COLUMN IF NOT EXISTS close_outcome_id TEXT;

-- close_disposition now stores the human-readable outcome label — make nullable
ALTER TABLE close_call_outcome_mappings
  ALTER COLUMN close_disposition DROP NOT NULL;

-- Drop old unique constraint (was keyed by disposition text)
ALTER TABLE close_call_outcome_mappings
  DROP CONSTRAINT IF EXISTS close_call_outcome_mappings_user_id_close_disposition_key;

-- New unique index on outcome_id per user
CREATE UNIQUE INDEX IF NOT EXISTS close_outcome_mappings_user_outcome_id_idx
  ON close_call_outcome_mappings(user_id, close_outcome_id)
  WHERE close_outcome_id IS NOT NULL;
