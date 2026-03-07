// Survey Aggregation Edge Function
// Aggregates daily survey events into survey_metrics table (analog to facebook-sync-insights)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get user from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Verify JWT and get user
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;
    const body = await req.json();
    const daysBack = body.days_back || 30;

    console.log(`📊 Aggregating surveys for user ${userId}, last ${daysBack} days`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch all survey events in date range
    // Note: events table doesn't have user_id, so we join with leads table
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select(`
        lead_id,
        funnel_id,
        source,
        event_date,
        event_type,
        leads!inner(user_id)
      `)
      .eq('event_type', 'survey')
      .eq('leads.user_id', userId)
      .gte('event_date', startDate.toISOString())
      .lte('event_date', endDate.toISOString())
      .order('event_date', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    console.log(`📋 Found ${events?.length || 0} survey events`);

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No survey events found',
        aggregated: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch survey_qualified events for qualification counts
    const { data: qualifiedEvents, error: qualError } = await supabase
      .from('events')
      .select(`
        lead_id,
        funnel_id,
        source,
        event_date,
        leads!inner(user_id)
      `)
      .eq('event_type', 'surveyQuali')
      .eq('leads.user_id', userId)
      .gte('event_date', startDate.toISOString())
      .lte('event_date', endDate.toISOString());

    if (qualError) {
      console.error('Error fetching qualified events:', qualError);
    }

    console.log(`✅ Found ${qualifiedEvents?.length || 0} qualified survey events`);

    // Group by funnel_id, source, and date
    const dailyCounts: Record<string, {
      funnel_id: string;
      source: string;
      date: string;
      leads: Set<string>;
      qualifiedLeads: Set<string>;
    }> = {};

    // Process survey events
    events.forEach(event => {
      if (!event.funnel_id || !event.source) return;

      const eventDate = new Date(event.event_date);
      const dateKey = eventDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const key = `${event.funnel_id}_${event.source}_${dateKey}`;

      if (!dailyCounts[key]) {
        dailyCounts[key] = {
          funnel_id: event.funnel_id,
          source: event.source,
          date: dateKey,
          leads: new Set(),
          qualifiedLeads: new Set(),
        };
      }

      dailyCounts[key].leads.add(event.lead_id);
    });

    // Process qualified events
    qualifiedEvents?.forEach(event => {
      if (!event.funnel_id || !event.source) return;

      const eventDate = new Date(event.event_date);
      const dateKey = eventDate.toISOString().split('T')[0];
      const key = `${event.funnel_id}_${event.source}_${dateKey}`;

      if (dailyCounts[key]) {
        dailyCounts[key].qualifiedLeads.add(event.lead_id);
      }
    });

    console.log(`📊 Grouped into ${Object.keys(dailyCounts).length} funnel-source-date combinations`);

    // Upsert into survey_metrics table
    let upsertedCount = 0;
    const metricsToUpsert = [];

    for (const key in dailyCounts) {
      const { funnel_id, source, date, leads, qualifiedLeads } = dailyCounts[key];
      
      metricsToUpsert.push({
        user_id: userId,
        funnel_id: funnel_id,
        source: source,
        date: date,
        survey_count: leads.size,
        survey_qualified_count: qualifiedLeads.size,
        updated_at: new Date().toISOString(),
      });
    }

    console.log(`💾 Upserting ${metricsToUpsert.length} records to survey_metrics...`);

    // Batch upsert (Supabase supports bulk upsert)
    const { data: upserted, error: upsertError } = await supabase
      .from('survey_metrics')
      .upsert(metricsToUpsert, {
        onConflict: 'user_id,funnel_id,source,date',
        ignoreDuplicates: false, // Update existing records
      });

    if (upsertError) {
      console.error('Error upserting metrics:', upsertError);
      throw upsertError;
    }

    upsertedCount = metricsToUpsert.length;

    console.log(`✅ Aggregation complete: ${upsertedCount} metrics upserted`);

    return new Response(JSON.stringify({
      message: `Aggregated ${upsertedCount} survey metrics`,
      aggregated: upsertedCount,
      date_range: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0],
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Survey aggregation error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
