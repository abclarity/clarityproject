// Supabase Edge Function: Sync Facebook Ad Accounts
// Fetches and stores user's ad accounts after OAuth

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get active Facebook connection for this user
    const { data: connection, error: connError } = await supabase
      .from('facebook_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (connError || !connection) {
      throw new Error('No active Facebook connection found');
    }

    const accessToken = connection.access_token;

    // Step 1: Try to get businesses that user has access to
    console.log('📘 Step 1: Fetching businesses...');
    const businessResponse = await fetch(
      `https://graph.facebook.com/v19.0/me/businesses?` +
      `fields=id,name` +
      `&access_token=${accessToken}`
    );

    const allAccounts = [];
    let businesses = [];

    console.log('Business API response status:', businessResponse.status);
    
    if (businessResponse.ok) {
      const businessData = await businessResponse.json();
      console.log('Business API response:', JSON.stringify(businessData));
      businesses = businessData.data || [];
      console.log(`✅ Found ${businesses.length} businesses`);
    } else {
      const errorText = await businessResponse.text();
      console.warn('⚠️ Could not fetch businesses:', errorText);
    }

    // Step 2: If we found businesses, get their ad accounts
    if (businesses.length > 0) {
      for (const business of businesses) {
        console.log(`📊 Fetching ad accounts for business: ${business.name} (${business.id})`);
        
        const accountsResponse = await fetch(
          `https://graph.facebook.com/v19.0/${business.id}/adaccounts?` +
          `fields=id,account_id,name,currency,account_status,timezone_name` +
          `&access_token=${accessToken}`
        );

        console.log(`  Response status for ${business.id}:`, accountsResponse.status);

        if (accountsResponse.ok) {
          const accountsData = await accountsResponse.json();
          console.log(`  Response data:`, JSON.stringify(accountsData));
          const businessAccounts = accountsData.data || [];
          
          console.log(`  ✅ Found ${businessAccounts.length} ad accounts in ${business.name}`);
          
          // Add business info to each account
          businessAccounts.forEach(account => {
            account.business_id = business.id;
            account.business_name = business.name;
          });
          
          allAccounts.push(...businessAccounts);
        } else {
          const errorText = await accountsResponse.text();
          console.warn(`  ❌ Could not fetch accounts for business ${business.id}:`, errorText);
        }
      }
    }

    // Step 3: Fallback - if no businesses found or no accounts from businesses, try direct access
    if (allAccounts.length === 0) {
      console.log('📌 No accounts found via businesses, trying direct access...');
      
      const directResponse = await fetch(
        `https://graph.facebook.com/v19.0/me/adaccounts?` +
        `fields=id,account_id,name,currency,account_status,timezone_name` +
        `&access_token=${accessToken}`
      );

      console.log('Direct access response status:', directResponse.status);

      if (directResponse.ok) {
        const directData = await directResponse.json();
        console.log('Direct access response:', JSON.stringify(directData));
        const directAccounts = directData.data || [];
        console.log(`✅ Found ${directAccounts.length} ad accounts via direct access`);
        
        // No business info for directly accessed accounts
        directAccounts.forEach(account => {
          account.business_id = null;
          account.business_name = null;
        });
        
        allAccounts.push(...directAccounts);
      } else {
        const error = await directResponse.text();
        console.error('❌ Direct ad account access failed:', error);
        throw new Error('Could not fetch ad accounts: ' + error);
      }
    }

    const accounts = allAccounts;
    console.log(`🎯 Total ad accounts found: ${accounts.length}`);

    // Store or update ad accounts in database
    // Default: sync_enabled = false (user must select which accounts to sync)
    const results = [];
    for (const account of accounts) {
      const { data: savedAccount, error: saveError } = await supabase
        .from('facebook_ad_accounts')
        .upsert({
          user_id: userId,
          connection_id: connection.id,
          ad_account_id: account.id,
          account_id: account.account_id,
          name: account.name,
          currency: account.currency,
          account_status: account.account_status,
          timezone_name: account.timezone_name,
          business_id: account.business_id,
          business_name: account.business_name,
          sync_enabled: false, // Changed to false - user selects in UI
          initial_sync_days: 90,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,ad_account_id'
        })
        .select()
        .single();

      if (saveError) {
        console.error('Error saving account:', account.id, saveError);
      } else {
        results.push(savedAccount);
      }
    }

    // Update last_sync on connection
    await supabase
      .from('facebook_connections')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        accounts_synced: results.length,
        accounts: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Sync accounts error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
