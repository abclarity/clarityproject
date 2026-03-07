// Supabase Edge Function: Auto-Sync Tracking Sheets
// Runs daily at 3 AM via cron job
// Syncs Facebook Ads data to tracking sheets for all enabled users

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log('🕐 Starting auto-sync job at', new Date().toISOString());

    // Step 1: Get all users with auto-sync enabled
    const { data: usersWithAutoSync, error: usersError } = await supabase
      .from('user_preferences')
      .select('user_id, facebook_auto_sync_months_back')
      .eq('facebook_auto_sync_enabled', true);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!usersWithAutoSync || usersWithAutoSync.length === 0) {
      console.log('ℹ️ No users with auto-sync enabled');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No users with auto-sync enabled',
          users_processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`👥 Found ${usersWithAutoSync.length} users with auto-sync enabled`);

    const results = [];

    // Step 2: Process each user
    for (const userPref of usersWithAutoSync) {
      const userId = userPref.user_id;
      const monthsBack = userPref.facebook_auto_sync_months_back || 1;

      console.log(`\n🔄 Processing user ${userId}`);

      try {
        // Get active Facebook connections for this user
        const { data: connections, error: connError } = await supabase
          .from('facebook_connections')
          .select('id, fb_user_id')
          .eq('user_id', userId)
          .eq('status', 'active');

        if (connError || !connections || connections.length === 0) {
          console.log(`⚠️ No active Facebook connection for user ${userId}`);
          results.push({
            user_id: userId,
            success: false,
            error: 'No active Facebook connection'
          });
          continue;
        }

        const connectionId = connections[0].id;

        // Get enabled ad accounts for this user
        const { data: adAccounts, error: adError } = await supabase
          .from('facebook_ad_accounts')
          .select('id, account_id, name')
          .eq('user_id', userId)
          .eq('sync_enabled', true);

        if (adError || !adAccounts || adAccounts.length === 0) {
          console.log(`⚠️ No enabled ad accounts for user ${userId}`);
          results.push({
            user_id: userId,
            success: false,
            error: 'No enabled ad accounts'
          });
          continue;
        }

        console.log(`📊 Found ${adAccounts.length} enabled ad accounts`);

        // Step 3: Sync campaigns to traffic_metrics (call facebook-sync-insights)
        const syncInsightsUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/facebook-sync-insights`;
        
        const syncResponse = await fetch(syncInsightsUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`
          },
          body: JSON.stringify({
            user_id: userId,
            days_back: monthsBack * 31 // Rough estimate: 1 month ≈ 31 days
          })
        });

        if (!syncResponse.ok) {
          const errorText = await syncResponse.text();
          throw new Error(`Sync insights failed: ${errorText}`);
        }

        const syncData = await syncResponse.json();
        console.log(`✅ Synced insights:`, syncData);

        // Step 4: Aggregate campaigns by funnel and date
        const { data: campaignMappings, error: mappingError } = await supabase
          .from('campaign_funnel_mapping')
          .select('*')
          .eq('user_id', userId)
          .order('priority', { ascending: false });

        if (mappingError) {
          console.warn('No campaign mappings found:', mappingError);
        }

        // Get traffic metrics for this user
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (monthsBack * 31));

        const { data: metrics, error: metricsError } = await supabase
          .from('traffic_metrics')
          .select('*')
          .eq('user_id', userId)
          .eq('level', 'campaign')
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0]);

        if (metricsError) {
          throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
        }

        console.log(`📈 Processing ${metrics?.length || 0} campaign metrics`);

        // Step 5: Build aggregation map: {funnel_id: {date: {field: value}}}
        const aggregationMap = new Map();

        for (const metric of metrics || []) {
          // Determine funnel_id using campaign mappings
          let funnelId = null;

          if (campaignMappings && campaignMappings.length > 0) {
            for (const mapping of campaignMappings) {
              const campaignName = metric.campaign_name || '';
              let matches = false;

              if (mapping.pattern_type === 'contains') {
                matches = campaignName.toLowerCase().includes(mapping.pattern.toLowerCase());
              } else if (mapping.pattern_type === 'starts_with') {
                matches = campaignName.toLowerCase().startsWith(mapping.pattern.toLowerCase());
              } else if (mapping.pattern_type === 'ends_with') {
                matches = campaignName.toLowerCase().endsWith(mapping.pattern.toLowerCase());
              } else if (mapping.pattern_type === 'exact') {
                matches = campaignName.toLowerCase() === mapping.pattern.toLowerCase();
              }

              if (matches) {
                funnelId = mapping.funnel_id;
                break;
              }
            }
          }

          // Skip if no funnel match
          if (!funnelId) continue;

          // Parse date components
          const metricDate = new Date(metric.date);
          const year = metricDate.getFullYear();
          const month = metricDate.getMonth(); // 0-based
          const day = metricDate.getDate();

          // Create aggregation key
          const key = `${funnelId}_${year}_${month}`;
          
          if (!aggregationMap.has(key)) {
            aggregationMap.set(key, new Map());
          }

          const dateMap = aggregationMap.get(key);
          if (!dateMap.has(day)) {
            dateMap.set(day, {});
          }

          const dayData = dateMap.get(day);

          // Aggregate metrics
          dayData['Adspend'] = (dayData['Adspend'] || 0) + (metric.spend || 0);
          dayData['Leads'] = (dayData['Leads'] || 0) + (metric.results || 0);
          dayData['Impressionen'] = (dayData['Impressionen'] || 0) + (metric.impressions || 0);
          dayData['Clicks'] = (dayData['Clicks'] || 0) + (metric.clicks || 0);
        }

        // Step 6: Save to tracking_sheet_data
        const batchRows = [];

        for (const [key, dateMap] of aggregationMap) {
          const [funnelId, year, month] = key.split('_');

          for (const [day, fields] of dateMap) {
            for (const [fieldName, value] of Object.entries(fields)) {
              batchRows.push({
                user_id: userId,
                funnel_id: funnelId,
                year: parseInt(year),
                month: parseInt(month),
                day: parseInt(day),
                field_name: fieldName,
                value: value,
                updated_at: new Date().toISOString()
              });
            }
          }
        }

        if (batchRows.length > 0) {
          console.log(`💾 Saving ${batchRows.length} rows to tracking_sheet_data`);

          const { error: insertError } = await supabase
            .from('tracking_sheet_data')
            .upsert(batchRows, {
              onConflict: 'user_id,funnel_id,year,month,day,field_name',
              ignoreDuplicates: false
            });

          if (insertError) {
            throw new Error(`Failed to save to tracking_sheet_data: ${insertError.message}`);
          }

          console.log(`✅ Successfully saved ${batchRows.length} rows for user ${userId}`);
        } else {
          console.log(`ℹ️ No data to save for user ${userId}`);
        }

        results.push({
          user_id: userId,
          success: true,
          campaigns_synced: metrics?.length || 0,
          rows_saved: batchRows.length
        });

      } catch (userError) {
        console.error(`❌ Error processing user ${userId}:`, userError);
        results.push({
          user_id: userId,
          success: false,
          error: userError.message
        });
      }
    }

    // Step 7: Return summary
    const summary = {
      success: true,
      timestamp: new Date().toISOString(),
      users_processed: results.length,
      users_succeeded: results.filter(r => r.success).length,
      users_failed: results.filter(r => !r.success).length,
      results: results
    };

    console.log('✅ Auto-sync job completed:', summary);

    return new Response(
      JSON.stringify(summary),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Auto-sync job failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
