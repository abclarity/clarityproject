-- Migration: Cloud Tracking Sheet Storage
-- Created: 2026-02-15
-- Purpose: Store all tracking sheet data in Supabase for cloud sync

-- Create tracking_sheet_data table
CREATE TABLE IF NOT EXISTS public.tracking_sheet_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funnel_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 0 AND month <= 11),
  day INTEGER NOT NULL CHECK (day >= 1 AND day <= 31),
  field_name TEXT NOT NULL,
  value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique combination per user/funnel/date/field
  UNIQUE(user_id, funnel_id, year, month, day, field_name)
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_tracking_sheet_user_funnel 
  ON public.tracking_sheet_data(user_id, funnel_id, year, month);

CREATE INDEX IF NOT EXISTS idx_tracking_sheet_lookup 
  ON public.tracking_sheet_data(user_id, funnel_id, year, month, day);

-- Enable Row Level Security
ALTER TABLE public.tracking_sheet_data ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "Users can view their own tracking data"
  ON public.tracking_sheet_data
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own data
CREATE POLICY "Users can insert their own tracking data"
  ON public.tracking_sheet_data
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own data
CREATE POLICY "Users can update their own tracking data"
  ON public.tracking_sheet_data
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own data
CREATE POLICY "Users can delete their own tracking data"
  ON public.tracking_sheet_data
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_tracking_sheet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER tracking_sheet_updated_at
  BEFORE UPDATE ON public.tracking_sheet_data
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_tracking_sheet_updated_at();

-- Comments for documentation
COMMENT ON TABLE public.tracking_sheet_data IS 'Stores all tracking sheet cell values for cloud sync';
COMMENT ON COLUMN public.tracking_sheet_data.month IS 'Month is 0-based (0=January, 11=December) to match JavaScript Date';
COMMENT ON COLUMN public.tracking_sheet_data.field_name IS 'Field identifier like Adspend, Leads_1, VSL_Views_15, etc.';
COMMENT ON COLUMN public.tracking_sheet_data.value IS 'Numeric value of the field (can be decimal)';
