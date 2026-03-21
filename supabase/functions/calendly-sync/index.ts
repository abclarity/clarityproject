// Calendly Sync – fetches event types + recent booking UTMs for the mapping UI
// Called by the frontend after OAuth connection is established

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CALENDLY_API_URL = 'https://api.calendly.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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
      .select('access_token, refresh_token, account_uri, organization_uri')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!conn) return jsonError('No active Calendly connection', 404);

    // Refresh token if needed (call a test endpoint; if 401, refresh)
    let accessToken = conn.access_token;
    const testRes = await fetch(`${CALENDLY_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (testRes.status === 401 && conn.refresh_token) {
      const refreshed = await refreshCalendlyToken(conn.refresh_token, supabase, user.id);
      if (!refreshed) return jsonError('Calendly token expired and refresh failed. Please reconnect Calendly.', 401);
      accessToken = refreshed;
    }

    // ── Action: fetch_event_types ────────────────────────────────────────────
    if (action === 'fetch_event_types') {
      // Fetch organization-level event types (includes team/folder events)
      // Fall back to user-level if organization fetch fails (e.g. non-admin)
      let res = await fetch(
        `${CALENDLY_API_URL}/event_types?organization=${encodeURIComponent(conn.organization_uri)}&count=100&active=true`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) {
        res = await fetch(
          `${CALENDLY_API_URL}/event_types?user=${encodeURIComponent(conn.account_uri)}&count=100&active=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
      }

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

    // ── Action: list_webhooks ────────────────────────────────────────────────
    if (action === 'list_webhooks') {
      // Fetch both org-scope and user-scope webhooks, merge results
      const allWebhooks: any[] = [];

      const orgRes = await fetch(
        `${CALENDLY_API_URL}/webhook_subscriptions?organization=${encodeURIComponent(conn.organization_uri)}&scope=organization`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        allWebhooks.push(...(orgData.collection || []));
      }

      const userRes = await fetch(
        `${CALENDLY_API_URL}/webhook_subscriptions?user=${encodeURIComponent(conn.account_uri)}&scope=user`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (userRes.ok) {
        const userData = await userRes.json();
        allWebhooks.push(...(userData.collection || []));
      }

      return jsonResponse({ webhooks: allWebhooks });
    }

    // ── Action: register_webhook ─────────────────────────────────────────────
    if (action === 'register_webhook') {
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/calendly-webhook`;
      const signingKey = Deno.env.get('CALENDLY_WEBHOOK_SIGNING_KEY') || null;

      // Step 1: check for an existing (possibly disabled) webhook with our URL and delete it
      const allExisting: any[] = [];
      for (const listUrl of [
        `${CALENDLY_API_URL}/webhook_subscriptions?organization=${encodeURIComponent(conn.organization_uri)}&scope=organization`,
        `${CALENDLY_API_URL}/webhook_subscriptions?user=${encodeURIComponent(conn.account_uri)}&scope=user`,
      ]) {
        const lr = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (lr.ok) { const ld = await lr.json(); allExisting.push(...(ld.collection || [])); }
      }
      const existing = allExisting.find((w: any) => w.callback_url === webhookUrl);
      if (existing) {
        if (existing.state === 'active') {
          return jsonResponse({ success: true, already_exists: true });
        }
        // Disabled → delete so we can re-create it fresh
        const uuid = existing.uri.split('/').pop();
        await fetch(`${CALENDLY_API_URL}/webhook_subscriptions/${uuid}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        console.log(`Deleted disabled webhook ${uuid}, will re-create`);
      }

      // Step 2: create the webhook; try org scope first, fall back to user scope on 403
      const scopes: Array<Record<string, unknown>> = [
        { url: webhookUrl, events: ['invitee.created', 'invitee.canceled'], organization: conn.organization_uri, scope: 'organization' },
        { url: webhookUrl, events: ['invitee.created', 'invitee.canceled'], organization: conn.organization_uri, user: conn.account_uri, scope: 'user' },
      ];

      for (const payload of scopes) {
        if (signingKey) payload.signing_key = signingKey;
        const res = await fetch(`${CALENDLY_API_URL}/webhook_subscriptions`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const data = await res.json();
          return jsonResponse({ success: true, webhook: data.resource, scope: payload.scope });
        }
        if (res.status === 403 && payload.scope === 'organization') continue;
        const errText = await res.text();
        return jsonError(`Calendly webhook registration failed: ${errText}`, res.status);
      }

      return jsonError('Calendly webhook registration failed for all scopes', 500);
    }

    // ── Action: delete_webhook ───────────────────────────────────────────────
    if (action === 'delete_webhook') {
      const webhookUri: string = body.webhook_uri;
      if (!webhookUri) return jsonError('webhook_uri required', 400);
      const uuid = webhookUri.split('/').pop();
      const res = await fetch(`${CALENDLY_API_URL}/webhook_subscriptions/${uuid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return jsonResponse({ success: res.ok });
    }

    // ── Action: fetch_recent_utms ─────────────────────────────────────────────
    // Queries imported events in DB for distinct utm_campaign values.
    // Falls back to Calendly API if no imported data exists yet.
    if (action === 'fetch_recent_utms') {
      // First: query DB (fast, complete — no Calendly API call needed after import)
      const { data: eventRows } = await supabase
        .from('events')
        .select('metadata')
        .eq('user_id', user.id)
        .eq('event_source', 'calendly');

      // Include events with either utm_campaign OR utm_source set
      const importedEvents = (eventRows || []).filter(
        (r: any) => r.metadata?.utm_campaign || r.metadata?.utm_source
      );
      if (importedEvents.length > 0) {
        // Group by utm_source (human-readable) as primary key.
        // This merges entries like utm_campaign="120241..." + utm_source="Facebook(X)"
        // with utm_campaign="Facebook(X)" + utm_source="Facebook(X)" into one entry.
        const utmMap: Record<string, { utm_campaign: string; utm_source: string | null; count: number }> = {};
        for (const row of importedEvents) {
          const source: string | null = row.metadata.utm_source || null;
          const campaign: string = row.metadata.utm_campaign || source!;
          // Use utm_source as grouping key if available, otherwise utm_campaign
          const key: string = source || campaign;
          if (!utmMap[key]) {
            utmMap[key] = { utm_campaign: key, utm_source: source, count: 0 };
          }
          utmMap[key].count++;
        }
        const utms = Object.values(utmMap).sort((a, b) => b.count - a.count);
        return jsonResponse({ utms, source: 'db' });
      }

      // Fallback: live Calendly API (for users who haven't imported yet)
      const now = new Date().toISOString();
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const eventsRes = await fetch(
        `${CALENDLY_API_URL}/scheduled_events?organization=${encodeURIComponent(conn.organization_uri)}&count=100&sort=start_time:desc&min_start_time=${sixMonthsAgo}&max_start_time=${now}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!eventsRes.ok) return jsonResponse({ utms: [], source: 'api_error' });

      const eventsData = await eventsRes.json();
      const apiEvents: any[] = eventsData.collection || [];
      const inviteeResults = await Promise.all(apiEvents.map((ev: any) => {
        const uuid = ev.uri.split('/').pop();
        return fetch(`${CALENDLY_API_URL}/scheduled_events/${uuid}/invitees?count=10`,
          { headers: { Authorization: `Bearer ${accessToken}` } })
          .then(r => r.ok ? r.json() : null).catch(() => null);
      }));

      const utmMap: Record<string, { utm_campaign: string; utm_source: string | null; count: number }> = {};
      for (const result of inviteeResults) {
        for (const invitee of (result?.collection || [])) {
          const campaign = invitee.tracking?.utm_campaign;
          if (!campaign) continue;
          if (!utmMap[campaign]) utmMap[campaign] = { utm_campaign: campaign, utm_source: invitee.tracking?.utm_source || null, count: 0 };
          utmMap[campaign].count++;
        }
      }
      return jsonResponse({ utms: Object.values(utmMap).sort((a, b) => b.count - a.count), source: 'api' });
    }

    // ── Action: import_past_bookings ─────────────────────────────────────────
    if (action === 'import_past_bookings') {
      const daysBack: number = Math.min(Math.max(Number(body.days_back) || 90, 1), 730);
      // page_url: if provided, resume from this Calendly page; otherwise start fresh
      const resumePageUrl: string | null = body.page_url || null;
      // mapping_index: which event type mapping we're currently on
      const mappingIndex: number = Number(body.mapping_index) || 0;

      const { data: eventTypeMappings } = await supabase
        .from('calendly_event_type_mappings')
        .select('calendly_event_type_uri, calendly_event_type_name, clarity_event_type')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!eventTypeMappings?.length) {
        return jsonError('Keine Event-Typen gemappt. Bitte zuerst Event-Typen zuordnen.', 400);
      }

      const { data: utmMappings } = await supabase
        .from('calendly_utm_mappings')
        .select('utm_campaign, funnel_id')
        .eq('user_id', user.id);

      const utmToFunnel: Record<string, string> = {};
      for (const m of utmMappings || []) utmToFunnel[m.utm_campaign] = m.funnel_id;

      const minStartTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
      const maxStartTime = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      const mapping = eventTypeMappings[mappingIndex];
      if (!mapping) return jsonResponse({ imported: 0, skipped: 0, errors: 0, done: true });

      // Build page URL: resume or first page of this mapping
      let pageUrl: string;
      if (resumePageUrl) {
        pageUrl = resumePageUrl;
      } else {
        const u = new URL(`${CALENDLY_API_URL}/scheduled_events`);
        u.searchParams.set('organization', conn.organization_uri);
        u.searchParams.set('event_type', mapping.calendly_event_type_uri);
        u.searchParams.set('count', '100');
        u.searchParams.set('min_start_time', minStartTime);
        u.searchParams.set('max_start_time', maxStartTime);
        u.searchParams.set('sort', 'start_time:desc');
        pageUrl = u.toString();
      }

      let imported = 0, skipped = 0, errors = 0;
      const debugLog: string[] = [`Page for: ${mapping.calendly_event_type_name}`];

      let eventsRes = await fetch(pageUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      // On 429, wait 10s and retry once
      if (eventsRes.status === 429) {
        debugLog.push(`  ⏳ Rate limited on events fetch, waiting 10s...`);
        await new Promise(r => setTimeout(r, 10000));
        eventsRes = await fetch(pageUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      }
      if (!eventsRes.ok) {
        const errText = await eventsRes.text();
        debugLog.push(`❌ Events fetch failed: ${eventsRes.status} ${errText}`);
        // Return done:true so frontend stops instead of restarting from page 1
        return jsonResponse({ imported, skipped, errors, done: true, error: `Events fetch failed: ${eventsRes.status}`, debug: debugLog });
      }

      const eventsData = await eventsRes.json();
      // Filter client-side to the mapped event type URI (Calendly API event_type param is unreliable)
      const allFetched: any[] = eventsData.collection || [];
      const events: any[] = allFetched.filter((ev: any) => ev.event_type === mapping.calendly_event_type_uri);
      const nextCalendlyPage: string | null = eventsData.pagination?.next_page || null;
      debugLog.push(`  ${allFetched.length} fetched, ${events.length} match mapping, hasMore=${!!nextCalendlyPage}`);

      // Fetch invitees in batches of 30 with 300ms pause between batches
      const allInvitees: Array<{ invitee: any; scheduledEvent: any }> = [];
      for (let i = 0; i < events.length; i += 30) {
        const chunk = events.slice(i, i + 30);
        const results = await Promise.allSettled(chunk.map(async (scheduledEvent: any) => {
          const eventUuid = scheduledEvent.uri.split('/').pop();
          const r = await fetch(`${CALENDLY_API_URL}/scheduled_events/${eventUuid}/invitees?count=100`,
            { headers: { Authorization: `Bearer ${accessToken}` } });
          if (r.status === 429) {
            await new Promise(res => setTimeout(res, 2000));
            const retry = await fetch(`${CALENDLY_API_URL}/scheduled_events/${eventUuid}/invitees?count=100`,
              { headers: { Authorization: `Bearer ${accessToken}` } });
            if (!retry.ok) { debugLog.push(`  ⚠️ Invitees retry failed ${eventUuid}: ${retry.status}`); return; }
            const d = await retry.json();
            for (const inv of (d.collection || [])) allInvitees.push({ invitee: inv, scheduledEvent });
            return;
          }
          if (!r.ok) { debugLog.push(`  ⚠️ Invitees error ${eventUuid}: ${r.status}`); return; }
          const d = await r.json();
          for (const inv of (d.collection || [])) allInvitees.push({ invitee: inv, scheduledEvent });
        }));
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed > 0) debugLog.push(`  ⚠️ ${failed} invitee fetches threw errors in batch`);
        if (i + 30 < events.length) await new Promise(r => setTimeout(r, 300));
      }
      debugLog.push(`  Invitees fetched: ${allInvitees.length}`);

      // ── Bulk email pre-fetch: 1 query instead of N individual lookups ──────
      const emailList = [...new Set(
        allInvitees.map(i => (i.invitee.email || '').toLowerCase().trim()).filter(Boolean)
      )];
      const { data: existingLeadRows } = emailList.length
        ? await supabase.from('leads').select('id, primary_email')
            .eq('user_id', user.id).in('primary_email', emailList)
        : { data: [] };
      const leadEmailCache: Record<string, string> = {};
      for (const l of existingLeadRows || []) leadEmailCache[l.primary_email] = l.id;

      // Process invitees in batches of 30
      for (let i = 0; i < allInvitees.length; i += 30) {
        await Promise.all(allInvitees.slice(i, i + 30).map(async ({ invitee, scheduledEvent }) => {
          const { error: logError } = await supabase.from('calendly_events_log').insert({
            invitee_uri: invitee.uri, calendly_event_uri: scheduledEvent.uri,
            user_id: user.id, raw_payload: { invitee, event: scheduledEvent, event_type_mapping: mapping },
          });
          if (logError?.code === '23505') { skipped++; return; }
          if (logError) { errors++; return; }
          try {
            await processInvitee({ supabase, userId: user.id, invitee, scheduledEvent, mapping, utmToFunnel, leadEmailCache });
            imported++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : (err?.message || JSON.stringify(err));
            debugLog.push(`  ❌ ${invitee.email}: ${msg}`);
            errors++;
          }
        }));
      }

      // Determine what to do next
      let nextPageUrl: string | null = null;
      let nextMappingIndex: number = mappingIndex;
      let done = false;

      if (nextCalendlyPage) {
        // More pages for this mapping
        nextPageUrl = nextCalendlyPage;
      } else if (mappingIndex + 1 < eventTypeMappings.length) {
        // Move to next mapping
        nextMappingIndex = mappingIndex + 1;
      } else {
        done = true;
      }

      console.log(`Page done – imported: ${imported}, skipped: ${skipped}, errors: ${errors}, done: ${done}`);

      // When all pages are done: sync event counts to tracking sheets
      let trackingRowsSaved = 0;
      if (done) {
        try {
          trackingRowsSaved = await syncCalendlyEventsToTrackingSheet(supabase, user.id, daysBack);
          console.log(`✅ Synced ${trackingRowsSaved} rows to tracking_sheet_data`);
        } catch (syncErr) {
          console.error('❌ Tracking sheet sync failed (non-fatal):', syncErr);
        }
      }

      return jsonResponse({ imported, skipped, errors, done, next_page_url: nextPageUrl, next_mapping_index: nextMappingIndex, tracking_rows_saved: trackingRowsSaved, debug: debugLog });
    }

    return jsonError(`Unknown action: ${action}`, 400);

  } catch (error) {
    console.error('❌ calendly-sync error:', error);
    return jsonError(error.message, 500);
  }
});

// ── processInvitee: shared lead matching + event creation ────────────────────
async function processInvitee({ supabase, userId, invitee, scheduledEvent, mapping, utmToFunnel, leadEmailCache }: {
  supabase: any;
  userId: string;
  invitee: any;
  scheduledEvent: any;
  mapping: { calendly_event_type_name: string; clarity_event_type: string };
  utmToFunnel: Record<string, string>;
  leadEmailCache?: Record<string, string>;
}) {
  const email: string = (invitee.email || '').toLowerCase().trim();
  const fullName: string = invitee.name || '';
  const phone: string | null = extractPhone(invitee);
  const utmCampaign: string | null = invitee.tracking?.utm_campaign || null;
  const utmSource: string | null = invitee.tracking?.utm_source || null;
  const funnelId: string | null = (utmCampaign ? utmToFunnel[utmCampaign] : null)
    ?? (utmSource ? utmToFunnel[utmSource] : null)
    ?? null;
  const callScheduledTime: string = scheduledEvent.start_time;   // when the call takes place
  const bookingCreatedAt: string = invitee.created_at || scheduledEvent.created_at || callScheduledTime; // when they booked
  const clarityEventType: string = mapping.clarity_event_type;

  // Build Q&A map
  const bookingAnswers: Record<string, string> = {};
  if (Array.isArray(invitee.questions_and_answers)) {
    for (const qa of invitee.questions_and_answers) {
      if (qa.question && qa.answer) bookingAnswers[qa.question] = qa.answer;
    }
  }

  // ── Lead Matching ──────────────────────────────────────────────────────────
  let leadId: string | null = null;
  let matchType = 'none';

  if (email) {
    // Use pre-fetched cache first (avoids individual DB query per invitee)
    const cachedId = leadEmailCache?.[email];
    if (cachedId) {
      leadId = cachedId;
      matchType = 'email';
    } else {
      const { data } = await supabase.from('leads').select('id')
        .eq('user_id', userId).eq('primary_email', email).maybeSingle();
      if (data) {
        leadId = data.id;
        matchType = 'email';
        if (leadEmailCache) leadEmailCache[email] = data.id; // cache for future invitees
      }
    }
  }

  if (!leadId && fullName) {
    const { data } = await supabase.from('leads').select('id')
      .eq('user_id', userId).ilike('name', fullName).maybeSingle();
    if (data) { leadId = data.id; matchType = 'name'; }
  }

  if (!leadId && phone) {
    const { data } = await supabase.from('leads').select('id')
      .eq('user_id', userId).eq('primary_phone', phone).maybeSingle();
    if (data) { leadId = data.id; matchType = 'phone'; }
  }

  // ── Spam Detection ────────────────────────────────────────────────────────
  // For calendar bookings only check name/email/phone — booking_answers contain time slots etc. that are not spam signals
  const spam = detectSpam(fullName || null, email, phone, {});
  if (spam.isSpam) {
    console.log(`🚫 Spam detected (score ${spam.score}): ${spam.reasons.join(', ')} — ${email}`);
  }

  if (leadId) {
    // Update existing lead metadata
    const { data: existing } = await supabase.from('leads').select('metadata').eq('id', leadId).single();
    await supabase.from('leads').update({
      updated_at: new Date().toISOString(),
      metadata: {
        ...(existing?.metadata || {}),
        call_scheduled_time: callScheduledTime,
        calendly_event_type: mapping.calendly_event_type_name,
        calendly_answers: bookingAnswers,
        utm_campaign: utmCampaign,
        utm_source: utmSource,
      },
    }).eq('id', leadId);
  } else {
    // Create new lead – created_at = when they booked, NOT when the call takes place
    const { data: newLead, error: leadError } = await supabase.from('leads').insert({
      user_id: userId,
      primary_email: email || null,
      name: fullName || null,
      primary_phone: phone || null,
      emails: email ? [email] : [],
      phones: phone ? [phone] : [],
      funnel_id: funnelId,
      source: 'calendly',
      lead_source: 'calendly',
      lead_status: spam.isSpam ? 'spam' : 'new',
      is_spam: spam.isSpam,
      utm_campaign: utmCampaign,
      metadata: {
        calendly_invitee_uri: invitee.uri,
        calendly_event_uri: scheduledEvent.uri,
        calendly_event_type: mapping.calendly_event_type_name,
        call_scheduled_time: callScheduledTime,
        calendly_answers: bookingAnswers,
        utm_source: utmSource,
        created_from: 'calendly_import',
        ...(spam.isSpam ? { spam_reasons: spam.reasons, spam_score: spam.score } : {}),
      },
      created_at: bookingCreatedAt,  // when they booked
    }).select().single();

    if (leadError?.code === '23505') {
      // Race condition: parallel batch thread just created this lead – fetch it
      const { data: raced } = await supabase.from('leads').select('id')
        .eq('user_id', userId).eq('primary_email', email).maybeSingle();
      if (raced) {
        leadId = raced.id;
        if (leadEmailCache && email) leadEmailCache[email] = raced.id;
      } else {
        throw leadError;
      }
    } else if (leadError) {
      throw leadError;
    } else {
      leadId = newLead.id;
      if (leadEmailCache && email) leadEmailCache[email] = newLead.id;
    }
  }

  // ── Create Event ──────────────────────────────────────────────────────────
  if (leadId) {
    // Check if this is a rebooking (lead already has an event of this type)
    const { data: existingEvent } = await supabase.from('events')
      .select('id').eq('user_id', userId).eq('lead_id', leadId)
      .eq('event_type', clarityEventType).eq('event_source', 'calendly')
      .maybeSingle();
    const isRebooking = !!existingEvent;

    const { error: eventError } = await supabase.from('events').insert({
      user_id: userId,
      lead_id: leadId,
      event_type: clarityEventType,
      event_date: bookingCreatedAt,  // when they booked (not when call takes place)
      funnel_id: funnelId,
      event_source: 'calendly',
      is_spam: spam.isSpam,
      metadata: {
        calendly_invitee_uri: invitee.uri,
        calendly_event_uri: scheduledEvent.uri,
        calendly_event_type_name: mapping.calendly_event_type_name,
        call_scheduled_time: callScheduledTime,
        booking_created_at: bookingCreatedAt,
        invitee_name: fullName,
        invitee_email: email,
        utm_campaign: utmCampaign,
        utm_source: utmSource,
        booking_answers: bookingAnswers,
        lead_match_type: matchType,
        imported_from: 'calendly_import',
        is_rebooking: isRebooking,
        ...(spam.isSpam ? { spam_reasons: spam.reasons, spam_score: spam.score } : {}),
      },
    });
    if (eventError) throw eventError;
  }

  // Update log entry with final IDs
  await supabase.from('calendly_events_log')
    .update({ user_id: userId, invitee_email: email, lead_id: leadId, event_type: clarityEventType })
    .eq('invitee_uri', invitee.uri);
}

// ── syncCalendlyEventsToTrackingSheet ─────────────────────────────────────────
// Aggregates non-spam Calendly events by funnel + date and writes counts to tracking_sheet_data
async function syncCalendlyEventsToTrackingSheet(supabase: any, userId: string, daysBack = 90): Promise<number> {
  const EVENT_FIELD_MAP: Record<string, string> = {
    settingBooking: 'SettingBooking',
    settingTermin: 'SettingTermin',
    settingCall: 'SettingCall',
    closingBooking: 'ClosingBooking',
    closingTermin: 'ClosingTermin',
    closingCall: 'ClosingCall',
  };

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const { data: events, error } = await supabase
    .from('events')
    .select('event_type, event_date, funnel_id, metadata, lead_id')
    .in('event_type', Object.keys(EVENT_FIELD_MAP))
    .eq('user_id', userId)
    .eq('is_spam', false)
    .not('funnel_id', 'is', null)
    .gte('event_date', startDate.toISOString().split('T')[0]);

  if (error) throw new Error(`Failed to fetch events: ${error.message}`);

  // Deduplicate by lead per funnel/date/type (same lead may have manual + calendly event)
  const aggregation = new Map<string, { funnel_id: string; year: number; month: number; day: number; field_name: string; leads: Set<string> }>();

  for (const ev of events || []) {
    const fieldName = EVENT_FIELD_MAP[ev.event_type];
    if (!fieldName || !ev.funnel_id) continue;
    if (ev.metadata?.is_rebooking) continue;

    // Parse date in German local time (Europe/Berlin) so midnight-bookings land on the correct day
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ev.event_date));
    const [yearStr, monthStr, dayStr] = localDate.split('-');
    const year = parseInt(yearStr), month = parseInt(monthStr) - 1, day = parseInt(dayStr);
    const key = `${ev.funnel_id}|${year}|${month}|${day}|${fieldName}`;
    if (!aggregation.has(key)) {
      aggregation.set(key, { funnel_id: ev.funnel_id, year, month, day, field_name: fieldName, leads: new Set<string>() });
    }
    // Deduplicate by lead_id so manual + calendly events for same lead count once
    const leadKey = ev.lead_id || `no-lead-${ev.funnel_id}-${year}-${month}-${day}`;
    aggregation.get(key)!.leads.add(leadKey);
  }

  if (aggregation.size === 0) return 0;

  const rows = Array.from(aggregation.values()).map(({ funnel_id, year, month, day, field_name, leads }) => ({
    user_id: userId,
    funnel_id,
    year,
    month,
    day,
    field_name,
    value: leads.size,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('tracking_sheet_data')
    .upsert(rows, { onConflict: 'user_id,funnel_id,year,month,day,field_name', ignoreDuplicates: false });

  if (upsertError) throw new Error(`Failed to save to tracking_sheet_data: ${upsertError.message}`);
  return rows.length;
}

// Refresh Calendly access token using refresh_token
async function refreshCalendlyToken(refreshToken: string, supabase: any, userId: string): Promise<string | null> {
  try {
    const res = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: Deno.env.get('CALENDLY_CLIENT_ID')!,
        client_secret: Deno.env.get('CALENDLY_CLIENT_SECRET')!,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newAccessToken = data.access_token;
    const newRefreshToken = data.refresh_token || refreshToken;
    const expiresIn = data.expires_in;
    await supabase.from('calendly_connections').update({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_expires_at: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    }).eq('user_id', userId);
    return newAccessToken;
  } catch {
    return null;
  }
}

// Extract phone from text_reminder_number OR from booking form Q&A
function extractPhone(invitee: any): string | null {
  // 1. SMS reminder number (explicit opt-in)
  if (invitee.text_reminder_number) {
    return invitee.text_reminder_number.replace(/\s/g, '');
  }

  // 2. Scan questions_and_answers for phone-like fields
  const phoneKeywords = /telefon|phone|handy|mobil|whatsapp|nummer|number/i;
  const phonePattern = /^[+\d][\d\s\-().\/+]{6,20}$/;

  for (const qa of (invitee.questions_and_answers || [])) {
    const q: string = qa.question || '';
    const a: string = qa.answer || '';
    if (!a) continue;
    if (phoneKeywords.test(q) || phonePattern.test(a.trim())) {
      const cleaned = a.replace(/\s/g, '');
      // Sanity check: at least 6 digits
      if ((cleaned.match(/\d/g) || []).length >= 6) return cleaned;
    }
  }
  return null;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface SpamResult { isSpam: boolean; score: number; reasons: string[]; }

function detectSpam(name: string | null, email: string, phone: string | null, answers: Record<string, string>): SpamResult {
  const reasons: string[] = [];
  let score = 0;
  const n = (name || '').toLowerCase().trim();
  const emailLower = email.toLowerCase().trim();
  const local = emailLower.split('@')[0] || '';
  const domain = emailLower.split('@')[1] || '';
  const answersText = Object.values(answers).join(' ').toLowerCase();
  const digits = (phone || '').replace(/\D/g, '');
  const VOWELS = /[aeiouyäöüàáâãèéêëìíîïòóôõùúûýæœ]/i;
  const CONS4 = /[bcdfghjklmnpqrstvwxyz]{7,}/i;
  const TRUSTED_EMAIL_DOMAINS = ['gmail.com','googlemail.com','gmx.de','gmx.net','gmx.at','gmx.ch','web.de','outlook.com','outlook.de','hotmail.com','hotmail.de','icloud.com','yahoo.com','yahoo.de','t-online.de','protonmail.com','proton.me'];

  if (/\btest\b/.test(n)) { score += 3; reasons.push('name contains "test"'); }
  if (['test','fake','spam','xyz','asdf'].includes(local)) { score += 3; reasons.push(`email local is "${local}"`); }
  const TEST_DOMAINS = ['test.com','test.de','test.org','test.net','example.com','example.de','example.org'];
  if (TEST_DOMAINS.includes(domain)) { score += 3; reasons.push(`test domain "${domain}"`); }
  if (/(scam|abzocken|spam|penis|pussy|fick|wichser|nutte|porno|dildo|vagina|schwanz|titten)/i.test(answersText)) { score += 3; reasons.push('spam keyword in answers'); }
  if (/(fake|fuck|shit|scam|spam|hurensohn|arschloch|penis|pussy|fick|wichser|nutte|porno|dildo|vagina|schwanz|titten)/i.test(n)) { score += 3; reasons.push('profanity/spam in name'); }
  if (/\b(blabla|blablabla|xyz)\b/.test(n)) { score += 3; reasons.push('obvious fake name pattern'); }
  if (digits.length > 0 && digits.length < 6) { score += 3; reasons.push(`phone too short (${digits.length} digits)`); }
  const parts = domain.split('.');
  if (parts.length >= 2 && parts[parts.length - 2].length <= 1 && parts[parts.length - 1].length <= 1) {
    score += 3; reasons.push(`both SLD and TLD are 1 char "${domain}"`);
  } else if (parts.length >= 2 && (parts[parts.length - 2].length <= 1 || parts[parts.length - 1].length <= 1)) {
    score += 2; reasons.push(`suspicious domain "${domain}"`);
  }
  if (CONS4.test(n)) { score += 2; reasons.push('keyboard mash in name'); }
  const hasAllConsonantPart = n.split(/\s+/).some(p => p.length >= 4 && !/\d/.test(p) && !VOWELS.test(p));
  if (hasAllConsonantPart) { score += 2; reasons.push('consonant-only word in name'); }
  const nameParts = n.split(/\s+/).filter(p => p.length > 0);
  if (nameParts.length >= 2 && nameParts.every(p => p.length === 1)) { score += 3; reasons.push('name is only single letters'); }
  if (digits.length >= 5 && new Set(digits).size === 1) { score += 2; reasons.push('phone all same digit'); }
  if (n.length === 1) { score += 3; reasons.push('single letter as name'); }
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(local) && !TRUSTED_EMAIL_DOMAINS.includes(domain)) { score += 1; reasons.push('keyboard mash in email'); }
  if (CONS4.test(answersText)) { score += 1; reasons.push('keyboard mash in answers'); }
  const PHONE_LIKE = /^[+\d\s\-().\/]{4,}$/;
  const anyAnswerNoVowels = Object.values(answers).some(v => {
    if (typeof v !== 'string') return false;
    const trimmed = v.trim();
    if (trimmed.length < 2) return false;
    if (PHONE_LIKE.test(trimmed)) return false;
    if ((trimmed.match(/[a-zA-ZäöüÄÖÜ]/g) || []).length < 2) return false; // skip values with no/few letters (times, dates, numbers)
    return !VOWELS.test(trimmed);
  });
  if (anyAnswerNoVowels) { score += 2; reasons.push('answer with no vowels'); }

  return { isSpam: score >= 3, score, reasons };
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
