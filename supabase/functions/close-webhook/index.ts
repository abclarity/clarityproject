// Close.io Webhook Handler
// Receives call activity and opportunity status change events from Close.io
// Uses configurable mappings (close_call_outcome_mappings, close_stage_mappings, close_field_mappings)
// to update call_events in Clarity

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    const payload = JSON.parse(bodyText);
    const eventType: string = payload.event;

    console.log('Close.io webhook received:', eventType);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Idempotency ────────────────────────────────────────────────────────────
    const closeEventId: string = payload.id || `${eventType}-${payload.data?.id}-${Date.now()}`;

    const { error: logError } = await supabase
      .from('close_webhook_log')
      .insert({ close_event_id: closeEventId, event_type: eventType });

    if (logError) {
      if (logError.code === '23505') {
        console.log('Already processed (duplicate):', closeEventId);
        return jsonResponse({ message: 'Already processed' });
      }
      throw logError;
    }

    // ── Find user by Close.io lead (via lead email) ────────────────────────────
    // Close.io webhook payload structure varies by event type
    const data = payload.data || {};
    const leadId: string | null = data.lead_id || null;
    const contactEmail: string | null = extractEmail(data);

    if (!leadId && !contactEmail) {
      console.log('No lead_id or email in payload, skipping');
      return jsonResponse({ message: 'No lead identifier found' });
    }

    // Find Clarity user via close_connections (match by stored close_lead_id or contact email)
    let userId: string | null = null;
    let clarityLeadId: string | null = null;
    let clarityCallEventId: string | null = null;

    // Find user who has an active Close.io connection
    // In multi-tenant: we'd need to identify which user this webhook belongs to
    // For now: find by matching the lead email to a Clarity lead
    if (contactEmail) {
      const { data: clarityLead } = await supabase
        .from('leads')
        .select('id, user_id')
        .eq('primary_email', contactEmail.toLowerCase().trim())
        .maybeSingle();

      if (clarityLead) {
        userId = clarityLead.user_id;
        clarityLeadId = clarityLead.id;
      }
    }

    // Fallback: find by close_lead_id stored in call_events
    if (!userId && leadId) {
      const { data: callEventByCloseId } = await supabase
        .from('call_events')
        .select('id, user_id, lead_id')
        .eq('close_lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (callEventByCloseId) {
        userId = callEventByCloseId.user_id;
        clarityLeadId = callEventByCloseId.lead_id;
        clarityCallEventId = callEventByCloseId.id;
      }
    }

    if (!userId) {
      console.log('No matching Clarity user found for Close lead:', leadId, contactEmail);
      return jsonResponse({ message: 'No matching Clarity user' });
    }

    // Update close_webhook_log with user_id now that we have it
    await supabase
      .from('close_webhook_log')
      .update({ user_id: userId })
      .eq('close_event_id', closeEventId);

    // ── Route by event type ────────────────────────────────────────────────────
    let rowsAffected = 0;

    if (eventType === 'activity.call.created' || eventType === 'activity.call') {
      rowsAffected = await handleCallActivity(supabase, userId, clarityLeadId, clarityCallEventId, leadId, data);
    } else if (eventType === 'lead.status_changed' || eventType === 'opportunity.status_changed') {
      rowsAffected = await handleStatusChange(supabase, userId, clarityLeadId, leadId, data);
    } else {
      console.log('Unhandled event type:', eventType);
      return jsonResponse({ message: `Event type ${eventType} not handled` });
    }

    // Sync call_events → tracking sheet (non-fatal)
    if (rowsAffected > 0) {
      try {
        const synced = await syncCallEventsToTrackingSheet(supabase, userId, 90);
        console.log(`✅ Tracking sheet sync: ${synced} rows updated`);
      } catch (syncErr) {
        console.error('❌ Tracking sheet sync failed (non-fatal):', syncErr);
      }
    }

    return jsonResponse({ success: true, event_type: eventType, rows_affected: rowsAffected });

  } catch (error) {
    console.error('❌ Error processing Close.io webhook:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});

// ── handleCallActivity ─────────────────────────────────────────────────────────
// Maps Close.io call disposition → call_event status/outcome update
async function handleCallActivity(
  supabase: any,
  userId: string,
  clarityLeadId: string | null,
  clarityCallEventId: string | null,
  closeLeadId: string | null,
  data: any
): Promise<number> {
  const closeActivityId: string = data.id;
  const outcomeId: string | null = data.outcome_id || null;
  const outcomeLabel: string | null = data.outcome_label || null;
  const closeUserId: string | null = data.user_id || null;

  if (!outcomeId) {
    console.log('No outcome_id on call activity, skipping (phone status only)');
    return 0;
  }

  console.log('Processing call outcome:', outcomeId, outcomeLabel, '| Close lead:', closeLeadId);

  // Look up the user's configured mapping for this outcome_id
  const { data: mapping } = await supabase
    .from('close_call_outcome_mappings')
    .select('*')
    .eq('user_id', userId)
    .eq('close_outcome_id', outcomeId)
    .maybeSingle();

  if (!mapping) {
    console.log('No mapping configured for disposition:', disposition);
    return 0;
  }

  // Find the most recent scheduled/active call_event for this lead
  let callEvent: any = null;

  if (clarityCallEventId) {
    const { data: ce } = await supabase
      .from('call_events')
      .select('*')
      .eq('id', clarityCallEventId)
      .maybeSingle();
    callEvent = ce;
  }

  if (!callEvent && clarityLeadId) {
    // Find the most recent call_event matching the call_type
    const query = supabase
      .from('call_events')
      .select('*')
      .eq('user_id', userId)
      .eq('lead_id', clarityLeadId)
      .in('status', ['scheduled', 'showed', 'no_show'])
      .order('appointment_date', { ascending: false })
      .limit(1);

    if (mapping.clarity_call_type) {
      query.eq('call_type', mapping.clarity_call_type);
    }

    const { data: ce } = await query.maybeSingle();
    callEvent = ce;
  }

  if (!callEvent) {
    // No existing call_event — create one from Close.io data
    if (!clarityLeadId) {
      console.log('Cannot create call_event: no Clarity lead found');
      return 0;
    }

    const callType = mapping.clarity_call_type || inferCallTypeFromLabel(outcomeLabel || '');
    const { data: newCe, error: ceError } = await supabase
      .from('call_events')
      .insert({
        user_id: userId,
        lead_id: clarityLeadId,
        lead_email: data.contact_email || '',
        call_type: callType,
        appointment_date: data.date_created ? data.date_created.split('T')[0] : new Date().toISOString().split('T')[0],
        status: mapping.clarity_status,
        outcome: mapping.clarity_outcome || null,
        close_lead_id: closeLeadId,
        close_activity_id: closeActivityId,
        source: 'close_crm',
      })
      .select()
      .single();

    if (ceError) {
      console.error('❌ Failed to create call_event from Close.io:', ceError);
      return 0;
    }

    callEvent = newCe;
    console.log('✅ Created call_event from Close.io:', callEvent.id);
  }

  // Build update payload
  const update: Record<string, any> = {
    status: mapping.clarity_status,
    close_activity_id: closeActivityId,
    source: 'close_crm',
  };

  if (mapping.clarity_outcome) {
    update.outcome = mapping.clarity_outcome;
  }

  if (mapping.clarity_status === 'canceled') {
    update.canceled_at = new Date().toISOString();
  }

  // Resolve assigned_to based on call_type:
  // - Setting calls → Setter name (from Close.io user who logged the call, or setter custom field)
  // - Closing calls → Closer name (from custom field)
  const callType = callEvent?.call_type || mapping.clarity_call_type || 'closing';
  const assignedName = await resolveAssignedName(supabase, userId, callType, closeUserId, data);
  if (assignedName) update.assigned_to = assignedName;

  // Store close_lead_id for future matching
  if (closeLeadId) update.close_lead_id = closeLeadId;

  const { error: updateError } = await supabase
    .from('call_events')
    .update(update)
    .eq('id', callEvent.id);

  if (updateError) {
    console.error('❌ Failed to update call_event:', updateError);
    return 0;
  }

  console.log(`✅ call_event ${callEvent.id} updated: status=${mapping.clarity_status}, outcome=${mapping.clarity_outcome}`);

  // If this disposition should also create a new closing call_event
  if (mapping.also_creates_closing_event && mapping.clarity_status === 'showed') {
    await supabase
      .from('call_events')
      .insert({
        user_id: userId,
        lead_id: callEvent.lead_id,
        lead_email: callEvent.lead_email,
        funnel_id: callEvent.funnel_id,
        call_type: 'closing',
        status: 'scheduled',
        close_lead_id: closeLeadId,
        source: 'close_crm',
      });
    console.log('✅ Created closing call_event after setting qualification');
  }

  return 1;
}

// ── handleStatusChange ─────────────────────────────────────────────────────────
// Maps Close.io pipeline stage changes → stored as context on call_event
// Note: Pipeline stage ≠ sold. Sale is tracked when payment is received.
async function handleStatusChange(
  supabase: any,
  userId: string,
  clarityLeadId: string | null,
  closeLeadId: string | null,
  data: any
): Promise<number> {
  const newStatus: string = data.new_status_label || data.status_label || '';

  if (!newStatus) return 0;

  // Check if user has a mapping for this stage
  const { data: stageMapping } = await supabase
    .from('close_stage_mappings')
    .select('*')
    .eq('user_id', userId)
    .eq('close_status_label', newStatus)
    .maybeSingle();

  if (!stageMapping) {
    console.log('No stage mapping configured for:', newStatus);
    return 0;
  }

  // Store stage change in the most recent call_event for analytics
  if (clarityLeadId) {
    const { data: recentCallEvent } = await supabase
      .from('call_events')
      .select('id')
      .eq('user_id', userId)
      .eq('lead_id', clarityLeadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentCallEvent) {
      await supabase
        .from('call_events')
        .update({
          notes: `Close.io stage: ${newStatus}`,
          close_lead_id: closeLeadId,
        })
        .eq('id', recentCallEvent.id);

      console.log(`✅ Stored stage change "${newStatus}" on call_event ${recentCallEvent.id}`);
      return 1;
    }
  }

  return 0;
}

// ── syncCallEventsToTrackingSheet ──────────────────────────────────────────────
// Aggregates call_events → tracking_sheet_data
// Termin = showed + no_show; Call = showed only
// Groups by appointment_date (not booking_date)
async function syncCallEventsToTrackingSheet(supabase: any, userId: string, daysBack = 90): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split('T')[0];

  const { data: callEvents, error } = await supabase
    .from('call_events')
    .select('id, call_type, appointment_date, status, funnel_id, lead_id')
    .eq('user_id', userId)
    .not('funnel_id', 'is', null)
    .not('appointment_date', 'is', null)
    .gte('appointment_date', startDateStr);

  if (error) throw new Error(`Failed to fetch call_events: ${error.message}`);

  const FIELD_MAP: Record<string, { termin: string; call: string }> = {
    setting: { termin: 'SettingTermin', call: 'SettingCall' },
    closing: { termin: 'ClosingTermin', call: 'ClosingCall' },
  };

  const aggregation = new Map<string, {
    funnel_id: string; year: number; month: number; day: number;
    field_name: string; leads: Set<string>;
  }>();

  for (const ce of callEvents || []) {
    const fields = FIELD_MAP[ce.call_type];
    if (!fields || !ce.funnel_id || !ce.appointment_date) continue;

    const [yearStr, monthStr, dayStr] = ce.appointment_date.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1;
    const day = parseInt(dayStr);
    const leadKey = ce.lead_id || `anon-${ce.id}`;

    if (['showed', 'no_show'].includes(ce.status)) {
      const terminKey = `${ce.funnel_id}|${year}|${month}|${day}|${fields.termin}`;
      if (!aggregation.has(terminKey)) {
        aggregation.set(terminKey, { funnel_id: ce.funnel_id, year, month, day, field_name: fields.termin, leads: new Set() });
      }
      aggregation.get(terminKey)!.leads.add(leadKey);
    }

    if (ce.status === 'showed') {
      const callKey = `${ce.funnel_id}|${year}|${month}|${day}|${fields.call}`;
      if (!aggregation.has(callKey)) {
        aggregation.set(callKey, { funnel_id: ce.funnel_id, year, month, day, field_name: fields.call, leads: new Set() });
      }
      aggregation.get(callKey)!.leads.add(leadKey);
    }
  }

  if (aggregation.size === 0) return 0;

  const rows = Array.from(aggregation.values()).map(({ funnel_id, year, month, day, field_name, leads }) => ({
    user_id: userId, funnel_id, year, month, day, field_name,
    value: leads.size,
    updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('tracking_sheet_data')
    .upsert(rows, { onConflict: 'user_id,funnel_id,year,month,day,field_name', ignoreDuplicates: false });

  if (upsertError) throw new Error(`Failed to save to tracking_sheet_data: ${upsertError.message}`);
  return rows.length;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractEmail(data: any): string | null {
  if (data.contact_email) return data.contact_email.toLowerCase().trim();
  if (Array.isArray(data.contacts)) {
    for (const c of data.contacts) {
      if (c.emails && c.emails.length > 0) return c.emails[0].email?.toLowerCase().trim();
    }
  }
  if (data.lead?.contacts) {
    for (const c of data.lead.contacts) {
      if (c.emails && c.emails.length > 0) return c.emails[0].email?.toLowerCase().trim();
    }
  }
  return null;
}

function inferCallTypeFromLabel(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes('setting')) return 'setting';
  if (lower.includes('closing') || lower.includes('close')) return 'closing';
  return 'closing'; // default
}

// Resolve assigned_to name based on call_type:
// - setting calls → assigned_setter mapping (usually the Close.io user who logged the call)
// - closing calls → assigned_closer mapping (usually a custom field like "Closer")
async function resolveAssignedName(
  supabase: any, userId: string, callType: string, closeUserId: string | null, data: any
): Promise<string | null> {
  const clarityField = callType === 'setting' ? 'assigned_setter' : 'assigned_closer';

  const { data: fieldMapping } = await supabase
    .from('close_field_mappings')
    .select('close_field_id, close_field_name')
    .eq('user_id', userId)
    .eq('clarity_field', clarityField)
    .maybeSingle();

  if (!fieldMapping) return null;

  // Special value: use the Close.io user who logged the call
  if (fieldMapping.close_field_id === '__close_user__') {
    return data.user_name || data.created_by_name || null;
  }

  // Custom field: look up value in payload
  const fieldValue = data[fieldMapping.close_field_id]
    || data.custom?.[fieldMapping.close_field_id]
    || data.lead_custom?.[fieldMapping.close_field_id];

  return fieldValue ? String(fieldValue) : null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
