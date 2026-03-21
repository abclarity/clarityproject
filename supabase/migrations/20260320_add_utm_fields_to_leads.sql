/*
  # Add UTM Attribution Fields to Leads Table

  Adds proper columns for full UTM attribution from Facebook Ads via Typeform Hidden Fields.

  UTM Mapping:
  - utm_source   = traffic source (e.g. "facebook")
  - utm_medium   = medium (e.g. "paid")
  - utm_content  = Facebook Ad Set ID ({{adset.id}})
  - utm_term     = Facebook Ad ID ({{ad.id}})
  - utm_campaign = Facebook Campaign ID (already exists, {{campaign.id}})

  Names are looked up via JOIN with traffic_metrics (campaign_id → campaign_name).
*/

ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_source  text DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_medium  text DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_content text DEFAULT NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS utm_term    text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_leads_utm_source  ON leads(utm_source);
CREATE INDEX IF NOT EXISTS idx_leads_utm_content ON leads(utm_content);
