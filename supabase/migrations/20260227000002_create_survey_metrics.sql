-- Create survey_metrics table (analog to traffic_metrics for Facebook Ads)
-- This table stores daily aggregated survey counts per funnel and source

CREATE TABLE IF NOT EXISTS survey_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  funnel_id TEXT NOT NULL,
  source TEXT NOT NULL, -- 'typeform', 'csv', 'youform', etc.
  date DATE NOT NULL,
  survey_count INT DEFAULT 0,
  survey_qualified_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, funnel_id, source, date)
);

-- Enable RLS
ALTER TABLE survey_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own survey metrics"
  ON survey_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own survey metrics"
  ON survey_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own survey metrics"
  ON survey_metrics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own survey metrics"
  ON survey_metrics FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_survey_metrics_user_date ON survey_metrics(user_id, date DESC);
CREATE INDEX idx_survey_metrics_funnel ON survey_metrics(funnel_id, date DESC);
CREATE INDEX idx_survey_metrics_source ON survey_metrics(source);

-- Comment
COMMENT ON TABLE survey_metrics IS 'Daily aggregated survey counts per funnel and source (analog to traffic_metrics)';
