-- Add selected_questions column to typeform_forms
-- Stores which Typeform questions the user selected during import setup
-- Format: { "field_id": "Short Label / Question Title" }
ALTER TABLE typeform_forms
  ADD COLUMN IF NOT EXISTS selected_questions JSONB;
