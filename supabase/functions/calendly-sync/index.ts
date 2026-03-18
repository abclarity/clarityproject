// Calendly Sync – fetches event types + recent booking UTMs for the mapping UI
// Called by the frontend after OAuth connection is established

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CALENDLY_API_URL = 'https://api.calendly.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate the requesting Clarity user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonError('Unauthorized', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return jsonError('Unauthorized', 401);

    const body = await req.json();
    const action: string = body.action;

    // Fetch the user's Calendly access token
    const { data: conn } = await supabase
      .from('calendly_connections')
      .select('access_token, account_uri, organization_uri')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!conn) return jsonError('No active Calendly connection', 404);

    const accessToken = conn.access_token;

    // ── Action: fetch_event_types ────────────────────────────────────────────
    if (action === 'fetch_event_types') {
      const res = await fetch(
        `${CALENDLY_API_URL}/event_types?user=${encodeURIComponent(conn.account_uri)}&count=100&active=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Calendly API error: ${err}`);
      }

      const data = await res.json();
      const eventTypes = (data.collection || []).map((et: any) => ({
        uri: et.uri,
        name: et.name,
        slug: et.slug,
        duration: et.duration,
        kind: et.kind, // 'solo' or 'group'
        scheduling_url: et.scheduling_url,
      }));

      return jsonResponse({ event_types: eventTypes });
    }

    // ── Action: fetch_recent_utms ─────────────────────────────────────────────
    // Fetches last 50 scheduled events and extracts unique utm_campaign values
    if (action === 'fetch_recent_utms') {
      const now = new Date().toISOString();
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch recent scheduled events (includes past ones)
      const eventsRes = await fetch(
        `${CALENDLY_API_URL}/scheduled_events?user=${encodeURIComponent(conn.account_uri)}&count=50&sort=start_time:desc&min_start_time=${sixMonthsAgo}&max_start_time=${now}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!eventsRes.ok) {
        const err = await eventsRes.text();
        throw new Error(`Calendly events API error: ${err}`);
      }

      const eventsData = await eventsRes.json();
      const events: any[] = eventsData.collection || [];

      if (events.length === 0) {
        return jsonResponse({ utms: [] });
      }

      // Fetch invitees for each event in parallel (to get tracking/UTM data)
      const inviteeRequests = events.map((ev: any) => {
        const eventUuid = ev.uri.split('/').pop();
        return fetch(
          `${CALENDLY_API_URL}/scheduled_events/${eventUuid}/invitees?count=10`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        ).then(r => r.ok ? r.json() : null).catch(() => null);
      });

      const inviteeResults = await Promise.all(inviteeRequests);

      // Extract unique utm_campaign values
      const utmMap: Record<string, { utm_campaign: string; utm_source: string | null; count: number }> = {};

      for (const result of inviteeResults) {
        if (!result?.collection) continue;
        for (const invitee of result.collection) {
          const campaign = invitee.tracking?.utm_campaign;
          if (!campaign) continue;
          if (!utmMap[campaign]) {
            utmMap[campaign] = {
              utm_campaign: campaign,
              utm_source: invitee.tracking?.utm_source || null,
              count: 0,
            };
          }
          utmMap[campaign].count++;
        }
      }

      const utms = Object.values(utmMap).sort((a, b) => b.count - a.count);
      return jsonResponse({ utms });
    }

    return jsonError(`Unknown action: ${action}`, 400);

  } catch (error) {
    console.error('❌ calendly-sync error:', error);
    return jsonError(error.message, 500);
  }
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
