// Close.io Sync & Configuration Handler
// Called from the Clarity frontend to:
// - Connect / disconnect Close.io (API key)
// - Fetch dispositions, stages, custom fields for mapping UI
// - Save mapping configurations
// - Register Close.io webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOSE_API_BASE = 'https://api.close.com/api/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, ...params } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Auth: get user from JWT
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    const userId = user.id;

    switch (action) {
      case 'connect':
        return await handleConnect(supabase, userId, params.api_key);

      case 'disconnect':
        return await handleDisconnect(supabase, userId);

      case 'fetch_setup_data':
        return await handleFetchSetupData(supabase, userId);

      case 'save_mappings':
        return await handleSaveMappings(supabase, userId, params);

      case 'get_mappings':
        return await handleGetMappings(supabase, userId);

      case 'import_historical':
        return await handleHistoricalImport(supabase, userId, params.days || 30);

      case 'sync_closing_termins':
        return await handleSyncClosingTermins(supabase, userId);

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }

  } catch (error) {
    console.error('❌ Close.io sync error:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});

// ── handleConnect ──────────────────────────────────────────────────────────────
async function handleConnect(supabase: any, userId: string, apiKey: string): Promise<Response> {
  if (!apiKey) return jsonResponse({ error: 'API key required' }, 400);

  // Test the API key by fetching org info
  const orgRes = await closeApiGet('/me/', apiKey);
  if (!orgRes.ok) {
    return jsonResponse({ error: 'Invalid API key or Close.io API error' }, 400);
  }
  const orgData = await orgRes.json();
  const organizationName = orgData.organizations?.[0]?.name || orgData.email || 'Close.io';

  // Save connection
  const { error } = await supabase
    .from('close_connections')
    .upsert({
      user_id: userId,
      api_key: apiKey,
      organization_name: organizationName,
      is_active: true,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  if (error) throw error;

  // Register webhook in Close.io
  const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/close-webhook`;
  const webhookRes = await closeApiPost('/webhook/', apiKey, {
    url: webhookUrl,
    events: ['activity.call.created', 'lead.status_changed', 'opportunity.status_changed'],
  });

  let webhookId: string | null = null;
  if (webhookRes.ok) {
    const webhookData = await webhookRes.json();
    webhookId = webhookData.id;
    await supabase
      .from('close_connections')
      .update({ webhook_id: webhookId })
      .eq('user_id', userId);
    console.log('✅ Close.io webhook registered:', webhookId);
  } else {
    console.error('❌ Failed to register Close.io webhook (non-fatal)');
  }

  return jsonResponse({
    success: true,
    organization_name: organizationName,
    webhook_registered: !!webhookId,
  });
}

// ── handleDisconnect ───────────────────────────────────────────────────────────
async function handleDisconnect(supabase: any, userId: string): Promise<Response> {
  const { data: conn } = await supabase
    .from('close_connections')
    .select('api_key, webhook_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (conn?.webhook_id && conn?.api_key) {
    // Delete webhook from Close.io
    await closeApiDelete(`/webhook/${conn.webhook_id}/`, conn.api_key);
  }

  await supabase
    .from('close_connections')
    .update({ is_active: false, webhook_id: null })
    .eq('user_id', userId);

  return jsonResponse({ success: true });
}

// ── handleFetchSetupData ───────────────────────────────────────────────────────
// Fetches all data needed for the mapping UI + auto-suggests mappings
async function handleFetchSetupData(supabase: any, userId: string): Promise<Response> {
  const { data: conn } = await supabase
    .from('close_connections')
    .select('api_key, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (!conn?.is_active) return jsonResponse({ error: 'Not connected to Close.io' }, 400);

  // Fetch call outcomes with their human-readable labels.
  // Close.io stores outcome configs in the organization object.
  // We also scan recent call activities to discover which outcomes are in use.
  let callOutcomes: Array<{ id: string; label: string }> = [];
  try {
    const outcomeLabels = new Map<string, string>(); // outcome_id → label

    // Step 1: Fetch outcome definitions from /outcome/ — the correct Close.io endpoint
    const outcomeRes = await closeApiGet('/outcome/', conn.api_key);
    if (outcomeRes.ok) {
      const outcomeData = await outcomeRes.json();
      const items: any[] = outcomeData.data || [];
      for (const item of items) {
        if (item.id && item.name) outcomeLabels.set(item.id, item.name);
      }
      console.log(`Got ${outcomeLabels.size} outcome labels from /outcome/`);
    } else {
      console.log('/outcome/ status:', outcomeRes.status);
    }

    // Step 2: Scan recent call activities to find outcome_ids in use + pick up any labels the API includes
    const seen = new Map<string, string>(); // outcome_id → best label
    let cursor: string | null = null;
    let pages = 0;

    do {
      const url = cursor
        ? `/activity/call/?_limit=100&_cursor=${encodeURIComponent(cursor)}`
        : '/activity/call/?_limit=100';
      const callsRes = await closeApiGet(url, conn.api_key);
      if (!callsRes.ok) { console.error('❌ Call activities fetch failed:', callsRes.status); break; }

      const callsData = await callsRes.json();
      // On first page, log available fields on a call object for future debugging
      if (pages === 0 && callsData.data?.[0]) {
        const sample = callsData.data[0];
        console.log('Call activity fields:', Object.keys(sample).join(', '));
        console.log('outcome_id:', sample.outcome_id, '| outcome_label:', sample.outcome_label, '| outcome:', sample.outcome);
      }

      for (const call of (callsData.data || [])) {
        // outcome_id: used on older calls; conversation_type_id: Close.io's current internal name
        for (const oid of [call.outcome_id, call.conversation_type_id]) {
          if (oid && typeof oid === 'string') {
            const label = outcomeLabels.get(oid) || call.outcome_label || oid;
            seen.set(oid, label);
          }
        }
      }

      cursor = callsData.cursor_next || null;
      pages++;
    } while (cursor && pages < 5);

    // Merge: also include org-configured outcomes not yet used in calls
    for (const [id, label] of outcomeLabels) {
      if (!seen.has(id)) seen.set(id, label);
    }

    callOutcomes = Array.from(seen.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
    console.log(`Found ${callOutcomes.length} call outcomes:`, callOutcomes);
  } catch (e) {
    console.error('❌ Failed to fetch call outcomes:', e);
  }

  // Fetch pipeline stages
  const statusesRes = await closeApiGet('/status/lead/', conn.api_key);
  let stages: Array<{ id: string; label: string }> = [];
  if (statusesRes.ok) {
    const data = await statusesRes.json();
    stages = (data.data || []).map((s: any) => ({ id: s.id, label: s.label }));
  }

  // Fetch custom fields
  const fieldsRes = await closeApiGet('/custom_field/lead/', conn.api_key);
  let customFields: Array<{ id: string; name: string; type: string }> = [];
  if (fieldsRes.ok) {
    const data = await fieldsRes.json();
    customFields = (data.data || []).map((f: any) => ({ id: f.id, name: f.name, type: f.type }));
  }

  // Auto-suggest mappings based on keywords
  const suggestedOutcomeMappings = callOutcomes.map((o) => suggestOutcomeMapping(o));
  const suggestedFieldMappings = customFields
    .filter(f => /closer|setter|sales rep|owner|assigned/i.test(f.name))
    .map(f => ({ close_field_id: f.id, close_field_name: f.name, clarity_field: 'assigned_closer' }));

  return jsonResponse({
    success: true,
    call_outcomes: callOutcomes,
    stages,
    custom_fields: customFields,
    suggested_outcome_mappings: suggestedOutcomeMappings,
    suggested_field_mappings: suggestedFieldMappings,
  });
}

// ── handleSaveMappings ─────────────────────────────────────────────────────────
async function handleSaveMappings(supabase: any, userId: string, params: any): Promise<Response> {
  const { outcome_mappings, stage_mappings, field_mappings } = params;

  if (Array.isArray(outcome_mappings) && outcome_mappings.length > 0) {
    // Delete existing and re-insert
    await supabase.from('close_call_outcome_mappings').delete().eq('user_id', userId);
    const rows = outcome_mappings.map((m: any) => ({ ...m, user_id: userId }));
    const { error } = await supabase.from('close_call_outcome_mappings').insert(rows);
    if (error) throw error;
  }

  if (Array.isArray(stage_mappings) && stage_mappings.length > 0) {
    await supabase.from('close_stage_mappings').delete().eq('user_id', userId);
    const rows = stage_mappings.map((m: any) => ({ ...m, user_id: userId }));
    const { error } = await supabase.from('close_stage_mappings').insert(rows);
    if (error) throw error;
  }

  if (Array.isArray(field_mappings) && field_mappings.length > 0) {
    await supabase.from('close_field_mappings').delete().eq('user_id', userId);
    const rows = field_mappings.map((m: any) => ({ ...m, user_id: userId }));
    const { error } = await supabase.from('close_field_mappings').insert(rows);
    if (error) throw error;
  }

  return jsonResponse({ success: true });
}

// ── handleGetMappings ──────────────────────────────────────────────────────────
async function handleGetMappings(supabase: any, userId: string): Promise<Response> {
  const [outcomesRes, stagesRes, fieldsRes, connRes] = await Promise.all([
    supabase.from('close_call_outcome_mappings').select('*').eq('user_id', userId),
    supabase.from('close_stage_mappings').select('*').eq('user_id', userId),
    supabase.from('close_field_mappings').select('*').eq('user_id', userId),
    supabase.from('close_connections').select('organization_name, is_active, connected_at').eq('user_id', userId).maybeSingle(),
  ]);

  return jsonResponse({
    success: true,
    connection: connRes.data,
    outcome_mappings: outcomesRes.data || [],
    stage_mappings: stagesRes.data || [],
    field_mappings: fieldsRes.data || [],
  });
}

// ── Auto-suggest mapping based on outcome label text ───────────────────────────
function suggestOutcomeMapping(outcome: { id: string; label: string }): Record<string, any> {
  const lower = outcome.label.toLowerCase();
  const result: Record<string, any> = {
    close_outcome_id: outcome.id,
    close_disposition: outcome.label,   // label stored in disposition field for display
    clarity_call_type: null,
    clarity_status: null,
    clarity_outcome: null,
    also_creates_closing_event: false,
  };

  // Detect call type
  if (lower.includes('setting') || lower.includes('setter')) result.clarity_call_type = 'setting';
  else if (lower.includes('closing') || lower.includes('closer') || lower.includes('sales call')) result.clarity_call_type = 'closing';

  // Detect status
  if (lower.includes('no show') || lower.includes('noshow') || lower.includes('nicht erschienen')) {
    result.clarity_status = 'no_show';
  } else if (lower.includes('abgesagt') || lower.includes('cancel') || lower.includes('absage')) {
    result.clarity_status = 'canceled';
  } else if (lower.includes('disqualifiziert') || lower.includes('dq') || lower.includes('disqualif')) {
    result.clarity_status = 'disqualified';
    if (lower.includes('long term') || lower.includes('fu') || lower.includes('follow')) {
      result.clarity_outcome = 'follow_up';
    } else {
      result.clarity_outcome = 'disqualified';
    }
  } else if (lower.includes('stattgefunden') || lower.includes('completed') || lower.includes('done') || lower.includes('erfolgt')) {
    result.clarity_status = 'showed';
    // Setting + stattgefunden + für Closing → also_creates_closing_event
    if (result.clarity_call_type === 'setting' && (lower.includes('closing') || lower.includes('für'))) {
      result.clarity_outcome = 'qualified';
      result.also_creates_closing_event = true;
    }
  }

  return result;
}

// ── handleSyncClosingTermins ───────────────────────────────────────────────────
// For every call_event with call_type=setting AND status=showed:
// → find the lead by email → create a closingTermin event in the events table
// Idempotent: skips if a closingTermin with the same close_activity_id already exists
async function handleSyncClosingTermins(supabase: any, userId: string): Promise<Response> {
  const { data: callEvents, error: ceError } = await supabase
    .from('call_events')
    .select('*')
    .eq('user_id', userId)
    .eq('call_type', 'setting')
    .eq('status', 'showed');

  if (ceError) throw ceError;
  if (!callEvents?.length) return jsonResponse({ success: true, created: 0, skipped: 0, errors: 0 });

  let created = 0, skipped = 0, errors = 0;

  for (const ce of callEvents) {
    if (!ce.close_activity_id || !ce.lead_email) { skipped++; continue; }

    // Dedup: check if closingTermin already exists for this close_activity_id
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('user_id', userId)
      .eq('event_type', 'closingTermin')
      .filter('metadata->>close_activity_id', 'eq', ce.close_activity_id)
      .maybeSingle();

    if (existing) { skipped++; continue; }

    // Find lead by primary_email
    const { data: lead } = await supabase
      .from('leads')
      .select('id, funnel_id')
      .eq('user_id', userId)
      .eq('primary_email', ce.lead_email)
      .maybeSingle();

    if (!lead) { skipped++; continue; }

    // Position closingTermin just after the lead's closingBooking (so timeline order is correct)
    // If no booking found, use appointment_date at noon to avoid midnight UTC → CET offset issues
    const { data: booking } = await supabase
      .from('events')
      .select('event_date')
      .eq('user_id', userId)
      .eq('lead_id', lead.id)
      .eq('event_type', 'closingBooking')
      .order('event_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const eventDate = booking?.event_date
      ? new Date(new Date(booking.event_date).getTime() + 60 * 1000).toISOString()
      : `${ce.appointment_date || new Date().toISOString().split('T')[0]}T12:00:00.000Z`;

    const { error } = await supabase.from('events').insert({
      user_id: userId,
      lead_id: lead.id,
      event_type: 'closingTermin',
      event_date: eventDate,
      funnel_id: lead.funnel_id,
      event_source: 'close_crm',
      metadata: {
        close_activity_id: ce.close_activity_id,
        assigned_to: ce.assigned_to,
      },
    });

    if (error) { errors++; console.error('❌ closingTermin insert error:', error.message); }
    else created++;
  }

  console.log(`✅ sync_closing_termins done: ${created} created, ${skipped} skipped, ${errors} errors`);
  return jsonResponse({ success: true, created, skipped, errors });
}

// ── handleHistoricalImport ─────────────────────────────────────────────────────
// Fetches Close.io call activities for the last N days and creates call_events
async function handleHistoricalImport(supabase: any, userId: string, days: number): Promise<Response> {
  const { data: conn } = await supabase
    .from('close_connections')
    .select('api_key, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (!conn?.is_active) return jsonResponse({ error: 'Not connected to Close.io' }, 400);

  // Load outcome mappings
  const { data: mappings } = await supabase
    .from('close_call_outcome_mappings')
    .select('*')
    .eq('user_id', userId);

  if (!mappings?.length) {
    return jsonResponse({ error: 'Keine Outcome-Mappings konfiguriert. Bitte zuerst Mappings speichern.' }, 400);
  }
  const mappingMap = new Map<string, any>(mappings.map((m: any) => [m.close_outcome_id, m]));

  // Load field mappings to resolve assigned_to
  const { data: fieldMappings } = await supabase
    .from('close_field_mappings')
    .select('*')
    .eq('user_id', userId);
  const setterMapping = fieldMappings?.find((m: any) => m.clarity_field === 'assigned_setter');
  const closerMapping = fieldMappings?.find((m: any) => m.clarity_field === 'assigned_closer');

  // Date cutoff
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  let imported = 0, skipped = 0, errors = 0;
  let skipReasonNoOutcome = 0, skipReasonNoMapping = 0, skipReasonNoEmail = 0, skipReasonDuplicate = 0;
  const leadEmailCache = new Map<string, string>();
  let skip = 0;
  let pages = 0;

  console.log(`📥 Starting historical import: last ${days} days, since ${sinceIso}`);
  console.log(`📋 Loaded ${mappings.length} outcome mappings:`, mappings.map((m: any) => m.close_outcome_id));

  do {
    const url = `/activity/call/?_limit=100&_skip=${skip}&date_created__gt=${encodeURIComponent(sinceIso)}`;

    const res = await closeApiGet(url, conn.api_key);
    if (!res.ok) {
      console.error('❌ Close.io call activities fetch failed:', res.status);
      break;
    }

    const data = await res.json();
    const calls: any[] = data.data || [];

    console.log(`Page ${pages + 1} (skip=${skip}): ${calls.length} calls fetched`);
    if (pages === 0 && calls[0]) {
      const s = calls[0];
      console.log(`Sample call — outcome_id: "${s.outcome_id}" | disposition: "${s.disposition}" | lead_id: "${s.lead_id}"`);
    }

    if (calls.length === 0) break;

    for (const call of calls) {
      const outcomeId: string | null = call.outcome_id || null;
      if (!outcomeId) { skipped++; skipReasonNoOutcome++; continue; }

      const mapping = mappingMap.get(outcomeId);
      if (!mapping?.clarity_status) { skipped++; skipReasonNoMapping++; continue; }

      // Resolve lead email (cached per lead_id)
      const leadId: string = call.lead_id;
      let leadEmail = leadEmailCache.get(leadId) || '';
      if (!leadEmail && leadId) {
        try {
          const leadRes = await closeApiGet(`/lead/${leadId}/`, conn.api_key);
          if (leadRes.ok) {
            const leadData = await leadRes.json();
            for (const contact of (leadData.contacts || [])) {
              const addr = contact.emails?.[0]?.email || '';
              if (addr) { leadEmail = addr; break; }
            }
            if (leadEmail) leadEmailCache.set(leadId, leadEmail);
          }
        } catch (_) { /* non-fatal */ }
      }

      if (!leadEmail) { skipped++; skipReasonNoEmail++; continue; }

      // Determine assigned_to based on call_type and field mapping config
      let assignedTo: string | null = null;
      const callType = mapping.clarity_call_type || 'setting';
      const useCloseUser =
        (callType === 'setting' && (!setterMapping || setterMapping.close_field_id === '__close_user__')) ||
        (callType === 'closing' && (!closerMapping || closerMapping.close_field_id === '__close_user__'));
      if (useCloseUser) assignedTo = call.user_name || null;

      const appointmentDate: string | null = call.date_created
        ? call.date_created.split('T')[0]
        : null;

      const { error } = await supabase.from('call_events').insert({
        user_id: userId,
        lead_email: leadEmail,
        call_type: callType,
        status: mapping.clarity_status,
        appointment_date: appointmentDate,
        close_lead_id: leadId,
        close_activity_id: call.id,
        assigned_to: assignedTo,
        source: 'close_crm',
      });

      if (error) {
        if (error.code === '23505') {
          skipped++; skipReasonDuplicate++;
        } else {
          errors++;
          console.error('❌ call_event insert error:', error.message, '| call:', call.id);
        }
      } else {
        imported++;
      }
    }

    skip += calls.length;
    pages++;
  } while (pages < 100); // stop after 10.000 calls max

  console.log(`✅ Close.io historical import done: ${imported} imported, ${skipped} skipped (no_outcome=${skipReasonNoOutcome}, no_mapping=${skipReasonNoMapping}, no_email=${skipReasonNoEmail}, duplicate=${skipReasonDuplicate}), ${errors} errors`);

  // Auto-sync closing termins after import
  let terminResult = { created: 0, skipped: 0, errors: 0 };
  try {
    const terminRes = await handleSyncClosingTermins(supabase, userId);
    const terminData = await terminRes.json();
    terminResult = { created: terminData.created || 0, skipped: terminData.skipped || 0, errors: terminData.errors || 0 };
    console.log(`✅ Auto-sync closing termins: ${terminResult.created} created, ${terminResult.skipped} skipped`);
  } catch (err) {
    console.error('❌ Auto-sync closing termins failed (non-fatal):', err);
  }

  return jsonResponse({ success: true, imported, skipped, errors, days, closing_termins: terminResult });
}

// ── Close.io API Helpers ───────────────────────────────────────────────────────

function closeApiGet(path: string, apiKey: string): Promise<globalThis.Response> {
  return fetch(`${CLOSE_API_BASE}${path}`, {
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':')}`,
      'Content-Type': 'application/json',
    },
  });
}

function closeApiPost(path: string, apiKey: string, body: unknown): Promise<globalThis.Response> {
  return fetch(`${CLOSE_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function closeApiDelete(path: string, apiKey: string): Promise<globalThis.Response> {
  return fetch(`${CLOSE_API_BASE}${path}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${btoa(apiKey + ':')}`,
    },
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
