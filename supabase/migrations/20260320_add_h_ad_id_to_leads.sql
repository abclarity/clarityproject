/*
  # Add h_ad_id to leads table

  Stores the Facebook Ad ID captured via the Hyros parameter h_ad_id={{ad.id}}.
  Allows lookup of campaign_name, adset_name etc. from traffic_metrics via:
    SELECT campaign_id, campaign_name, ad_set_id, ad_set_name
    FROM traffic_metrics WHERE ad_id = leads.h_ad_id LIMIT 1
*/

ALTER TABLE leads ADD COLUMN IF NOT EXISTS h_ad_id text DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_h_ad_id ON leads(h_ad_id);
