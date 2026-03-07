/*
  # Add UTM Campaign and Country Fields to Leads Table

  1. Changes
    - Add `utm_campaign` column to `leads` table
      - Type: text
      - Default: empty string
      - For tracking marketing campaign information
    
    - Add `country` column to `leads` table
      - Type: text
      - Default: empty string
      - For tracking lead location/country

  2. Notes
    - Using IF NOT EXISTS pattern for safe migration
    - Default empty strings to maintain data consistency
    - These fields will be populated via CSV import or API sync
*/

-- Add utm_campaign field to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'utm_campaign'
  ) THEN
    ALTER TABLE leads ADD COLUMN utm_campaign text DEFAULT '';
  END IF;
END $$;

-- Add country field to leads table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'country'
  ) THEN
    ALTER TABLE leads ADD COLUMN country text DEFAULT '';
  END IF;
END $$;

-- Create index for utm_campaign for faster filtering
CREATE INDEX IF NOT EXISTS idx_leads_utm_campaign ON leads(utm_campaign);

-- Create index for country for faster filtering
CREATE INDEX IF NOT EXISTS idx_leads_country ON leads(country);
