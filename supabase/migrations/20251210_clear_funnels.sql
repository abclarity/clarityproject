-- Clear all funnels and start fresh
-- Date: 2025-12-10
-- Purpose: Remove all existing funnels to test proper RLS isolation

DELETE FROM funnels;

-- Verify empty
SELECT COUNT(*) as funnel_count FROM funnels;
