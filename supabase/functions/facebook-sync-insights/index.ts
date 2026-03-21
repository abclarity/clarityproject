// Supabase Edge Function: Sync Facebook Campaign Insights
// Fetches campaign metrics and stores in traffic_metrics table

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SyncRequest {
  ad_account_id?: string;
  days_back?: number; // How many days to sync (default: 2, initial: 90)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const userId = user.id;

    // Parse request body
    const body: SyncRequest = await req.json().catch(() => ({}));
    const daysBack = body.days_back || 2;

    // Get ad accounts to sync
    let accountsQuery = supabase
      .from('facebook_ad_accounts')
      .select('*, facebook_connections!inner(access_token, status)')
      .eq('user_id', userId)
      .eq('sync_enabled', true)
      .eq('facebook_connections.status', 'active');

    if (body.ad_account_id) {
      accountsQuery = accountsQuery.eq('ad_account_id', body.ad_account_id);
    }

    const { data: accounts, error: accountsError } = await accountsQuery;

    if (accountsError || !accounts || accounts.length === 0) {
      throw new Error('No ad accounts found for sync');
    }

    console.log(`Syncing ${accounts.length} ad accounts, ${daysBack} days back`);

    const results = [];
    let totalInserted = 0;
    let totalErrors = 0;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const dateFrom = startDate.toISOString().split('T')[0];
    const dateTo = endDate.toISOString().split('T')[0];

    // Sync each ad account
    for (const account of accounts) {
      try {
        const accessToken = account.facebook_connections.access_token;
        const adAccountId = account.ad_account_id;

        console.log(`Syncing account ${adAccountId} from ${dateFrom} to ${dateTo}`);

        // Mark as syncing
        await supabase
          .from('facebook_ad_accounts')
          .update({ is_syncing: true })
          .eq('id', account.id);

        // Fetch campaign insights from Facebook
        // NOTE: Some accounts reject `link_clicks` field. We derive link clicks from `actions`.
        const insightsUrl = `https://graph.facebook.com/v19.0/${adAccountId}/insights?` +
          `level=campaign` +
          `&fields=campaign_id,campaign_name,spend,impressions,clicks,reach,cpm,cpc,ctr,frequency,actions` +
          `&time_range={"since":"${dateFrom}","until":"${dateTo}"}` +
          `&time_increment=1` + // Daily breakdown
          `&access_token=${accessToken}` +
          `&limit=500`;

        const response = await fetch(insightsUrl);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Facebook API error for ${adAccountId}:`, errorText);
          totalErrors++;
          results.push({
            ad_account_id: adAccountId,
            name: account.name,
            insights_count: 0,
            filtered_count: 0,
            inserted_count: 0,
            status: 'facebook_error',
            errors: [errorText]
          });
          continue;
        }

        const data = await response.json();
        const insights = data.data || [];

        console.log(`Received ${insights.length} insights for account ${adAccountId}`);

        // Get campaign → funnel mappings for this user
        const { data: mappings } = await supabase
          .from('campaign_funnel_mapping')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('priority', { ascending: true });

        // Get campaign filter rules for this account
        const campaignFilter = account.campaign_filter || { enabled: false, rules: [] };

        // Helper function to check if campaign matches filter rules
        const matchesFilter = (campaignName: string): boolean => {
          if (!campaignFilter.enabled || !campaignFilter.rules || campaignFilter.rules.length === 0) {
            return true; // No filter = include all
          }

          // Check if campaign matches ANY rule (OR logic)
          return campaignFilter.rules.some((rule: any) => {
            const name = campaignName.toLowerCase();
            const value = rule.value.toLowerCase();

            switch (rule.type) {
              case 'contains':
                return name.includes(value);
              case 'starts_with':
                return name.startsWith(value);
              case 'ends_with':
                return name.endsWith(value);
              case 'excludes':
                return !name.includes(value);
              default:
                return true;
            }
          });
        };

        // Helper function to match campaign to funnel
        const matchFunnel = (campaignName: string): string | null => {
          if (!mappings) return null;
          for (const mapping of mappings) {
            if (campaignName.toLowerCase().includes(mapping.pattern_value.toLowerCase())) {
              return mapping.funnel_id;
            }
          }
          return null;
        };

        // Helper: calculate link clicks from actions
        const calcLinkClicks = (insight: any): number => {
          const allClicks = parseInt(insight.clicks || '0');
          const actions = Array.isArray(insight.actions) ? insight.actions : [];
          const getActionValue = (type: string) => {
            const entry = actions.find((a: any) => a.action_type === type);
            return entry ? parseInt(entry.value || '0') : 0;
          };
          let linkClicks = getActionValue('link_click') + getActionValue('outbound_click');
          if (linkClicks === 0 && allClicks > 0) linkClicks = allClicks;
          return linkClicks;
        };

        // Insert/update insights into traffic_metrics (with filter)
        let filtered = 0;
        let inserted = 0;
        const errors: string[] = [];

        // ── Campaign-level sync: delete existing rows, then bulk insert ───────
        await supabase
          .from('traffic_metrics')
          .delete()
          .eq('user_id', userId)
          .eq('source', 'facebook-ads')
          .eq('level', 'campaign')
          .gte('date', dateFrom)
          .lte('date', dateTo);

        const campaignRows = insights
          .filter((insight: any) => {
            if (!matchesFilter(insight.campaign_name)) { filtered++; return false; }
            return true;
          })
          .map((insight: any) => {
            const lc = calcLinkClicks(insight);
            const imp = parseInt(insight.impressions || '0');
            const sp = parseFloat(insight.spend || '0');
            return {
              user_id: userId,
              date: insight.date_start,
              source: 'facebook-ads',
              campaign_id: insight.campaign_id,
              campaign_name: insight.campaign_name,
              funnel_id: matchFunnel(insight.campaign_name),
              level: 'campaign',
              adspend: sp,
              impressions: imp,
              clicks: lc,
              reach: parseInt(insight.reach || '0'),
              metadata: {
                cpm: parseFloat(insight.cpm || '0'),
                cpc: lc > 0 ? sp / lc : 0,
                ctr: imp > 0 ? (lc / imp * 100) : 0,
                frequency: parseFloat(insight.frequency || '0'),
                ad_account_id: adAccountId,
                currency: account.currency,
                all_clicks: parseInt(insight.clicks || '0'),
                link_clicks: lc,
              }
            };
          });

        if (campaignRows.length > 0) {
          const { error: bulkCampaignError } = await supabase.from('traffic_metrics').insert(campaignRows);
          if (bulkCampaignError) {
            console.error('❌ Campaign bulk insert error:', bulkCampaignError);
            errors.push(bulkCampaignError.message);
            totalErrors += campaignRows.length;
          } else {
            inserted = campaignRows.length;
            totalInserted += inserted;
          }
        }

        // ── Ad-level sync (for h_ad_id lookup: ad_id → campaign/adset names) ─
        try {
          const adInsightsUrl = `https://graph.facebook.com/v19.0/${adAccountId}/insights?` +
            `level=ad` +
            `&fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,reach,actions` +
            `&time_range={"since":"${dateFrom}","until":"${dateTo}"}` +
            `&time_increment=1` +
            `&access_token=${accessToken}` +
            `&limit=500`;

          const adResponse = await fetch(adInsightsUrl);
          if (!adResponse.ok) {
            console.error('❌ Ad-level API error:', await adResponse.text());
          } else {
            const adData = await adResponse.json();
            const adInsights = adData.data || [];
            console.log(`Ad-level: ${adInsights.length} insights for ${adAccountId}`);

            // Delete existing ad-level rows for this date range, then re-insert
            await supabase
              .from('traffic_metrics')
              .delete()
              .eq('user_id', userId)
              .eq('source', 'facebook-ads')
              .eq('level', 'ad')
              .gte('date', dateFrom)
              .lte('date', dateTo);

            const adRows = adInsights
              .filter((ad: any) => ad.ad_id && matchesFilter(ad.campaign_name))
              .map((ad: any) => {
                const lc = calcLinkClicks(ad);
                const imp = parseInt(ad.impressions || '0');
                const sp = parseFloat(ad.spend || '0');
                return {
                  user_id: userId,
                  date: ad.date_start,
                  source: 'facebook-ads',
                  campaign_id: ad.campaign_id,
                  campaign_name: ad.campaign_name,
                  ad_set_id: ad.adset_id,
                  ad_set_name: ad.adset_name,
                  ad_id: ad.ad_id,
                  ad_name: ad.ad_name,
                  funnel_id: matchFunnel(ad.campaign_name),
                  level: 'ad',
                  adspend: sp,
                  impressions: imp,
                  clicks: lc,
                  reach: parseInt(ad.reach || '0'),
                  metadata: {
                    cpm: parseFloat(ad.cpm || '0'),
                    cpc: lc > 0 ? sp / lc : 0,
                    ctr: imp > 0 ? (lc / imp * 100) : 0,
                    ad_account_id: adAccountId,
                    currency: account.currency,
                  }
                };
              });

            if (adRows.length > 0) {
              const { error: bulkError } = await supabase.from('traffic_metrics').insert(adRows);
              if (bulkError) {
                console.error('❌ Ad bulk insert error:', bulkError);
              } else {
                console.log(`✅ Ad-level sync done: ${adRows.length} rows inserted`);
              }
            }
          }
        } catch (adSyncErr: any) {
          console.error('❌ Ad-level sync failed:', adSyncErr);
        }

        // Update last_sync timestamp
        await supabase
          .from('facebook_ad_accounts')
          .update({
            is_syncing: false,
            last_sync: new Date().toISOString()
          })
          .eq('id', account.id);

        results.push({
          ad_account_id: adAccountId,
          name: account.name,
          insights_count: insights.length,
          filtered_count: filtered,
          inserted_count: inserted,
          status: inserted > 0 ? 'success' : 'no_data_inserted',
          errors: errors.length > 0 ? errors : undefined,
        });
        
        console.log(`✅ Account ${account.name}: ${insights.length} insights fetched, ${filtered} filtered, ${inserted} inserted`);

      } catch (accountError) {
        console.error(`Error syncing account ${account.ad_account_id}:`, accountError);
        totalErrors++;

        await supabase
          .from('facebook_ad_accounts')
          .update({ is_syncing: false })
          .eq('id', account.id);

        results.push({
          ad_account_id: account.ad_account_id,
          name: account.name,
          status: 'error',
          error: accountError.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        accounts_synced: accounts.length,
        total_inserted: totalInserted,
        total_errors: totalErrors,
        date_range: { from: dateFrom, to: dateTo },
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Sync insights error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
