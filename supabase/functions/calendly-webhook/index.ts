// Calendly Webhook Handler
// Receives invitee.created / invitee.canceled events from Calendly
// Matches leads by email → name → phone → creates new lead if nothing matches

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
};

const CALENDLY_API_URL = 'https://api.calendly.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Calendly webhook received');

    const bodyText = await req.text();
    const payload = JSON.parse(bodyText);
    console.log('Event:', payload.event);

    // Only handle invitee.created (and optionally invitee.canceled)
    if (!['invitee.created', 'invitee.canceled'].includes(payload.event)) {
      return jsonResponse({ message: 'Event type not handled' });
    }

    // Calendly v2 API: invitee data is directly in payload.payload (no nested invitee object)
    const p = payload.payload;
    const inviteeUri: string = p.uri;
    const calendlyEventUri: string = p.scheduled_event?.uri || p.event;
    const eventTypeUri: string = p.scheduled_event?.event_type;
    const tracking = p.tracking;
    const questions_and_answers = p.questions_and_answers;
    const isCanceled = payload.event === 'invitee.canceled';

    console.log('inviteeUri:', inviteeUri, '| eventTypeUri:', eventTypeUri);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── Idempotency ────────────────────────────────────────────────────────────
    // For cancellations: the invitee_uri was already inserted at booking time.
    // We skip the insert and just look up the existing log entry.
    let logEntryId: string | null = null;

    if (!isCanceled) {
      const { data: logClaim, error: logClaimError } = await supabase
        .from('calendly_events_log')
        .insert({ invitee_uri: inviteeUri, calendly_event_uri: calendlyEventUri, raw_payload: payload })
        .select('id')
        .single();

      if (logClaimError) {
        if (logClaimError.code === '23505') {
          console.log('Already processed (duplicate webhook):', inviteeUri);
          return jsonResponse({ message: 'Already processed' });
        }
        throw logClaimError;
      }
      logEntryId = logClaim.id;
    } else {
      // For cancellations: look up existing log entry (don't insert)
      const { data: existingLog } = await supabase
        .from('calendly_events_log')
        .select('id, event_id, user_id')
        .eq('invitee_uri', inviteeUri)
        .maybeSingle();
      if (existingLog) {
        logEntryId = existingLog.id;
      }
    }

    const { data: connection } = await supabase
      .from('calendly_connections')
      .select('user_id, access_token')
      .eq('is_active', true)
      .maybeSingle();

    // Note: in a multi-tenant setup we'd match by organization_uri.
    // For now we find the user by looking up their event type mappings.
    const { data: eventTypeMapping } = await supabase
      .from('calendly_event_type_mappings')
      .select('user_id, clarity_event_type')
      .eq('calendly_event_type_uri', eventTypeUri)
      .eq('is_active', true)
      .maybeSingle();

    // Only process event types that are explicitly mapped — skip everything else
    if (!eventTypeMapping) {
      console.log('No mapping for event type, skipping:', eventTypeUri);
      return jsonResponse({ message: 'Event type not mapped, skipped' });
    }

    const userId: string = eventTypeMapping.user_id;
    const clarityEventType: string = eventTypeMapping.clarity_event_type;
    const callType: string = clarityEventType === 'settingBooking' ? 'setting' : 'closing';

    // Determine funnel from UTM mapping
    const utmCampaign: string | null = tracking?.utm_campaign || null;
    const utmSource: string | null = tracking?.utm_source || null;
    let funnelId: string | null = null;

    const utmLookupKey = utmCampaign || utmSource;
    if (utmLookupKey) {
      const { data: utmMapping } = await supabase
        .from('calendly_utm_mappings')
        .select('funnel_id')
        .eq('user_id', userId)
        .eq('utm_campaign', utmLookupKey)
        .maybeSingle();

      funnelId = utmMapping?.funnel_id || null;
    }

    // Extract invitee data (all fields are directly on p in Calendly v2 API)
    const email: string = p.email?.toLowerCase().trim();
    const fullName: string = p.name || '';
    const firstName: string = p.first_name || '';
    const lastName: string = p.last_name || '';
    const phone: string | null = extractPhone(p);
    const callScheduledTime: string = p.scheduled_event?.start_time;
    const bookingCreatedAt: string = p.created_at || callScheduledTime;

    // Derive dates
    const bookingDate: string | null = bookingCreatedAt
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(bookingCreatedAt))
      : null;
    const appointmentDate: string | null = callScheduledTime
      ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(callScheduledTime))
      : null;

    // Build Q&A metadata
    const bookingAnswers: Record<string, string> = {};
    if (Array.isArray(questions_and_answers)) {
      for (const qa of questions_and_answers) {
        if (qa.question && qa.answer) {
          bookingAnswers[qa.question] = qa.answer;
        }
      }
    }

    // ── Handle Cancellation ───────────────────────────────────────────────────
    if (isCanceled) {
      console.log('Processing cancellation for invitee:', inviteeUri);

      // Update events table (mark metadata.canceled = true)
      if (logEntryId) {
        const { data: existingLog } = await supabase
          .from('calendly_events_log')
          .select('event_id')
          .eq('id', logEntryId)
          .maybeSingle();

        if (existingLog?.event_id) {
          // Fetch existing metadata first to merge (avoid overwriting)
          const { data: existingEvent } = await supabase
            .from('events')
            .select('metadata')
            .eq('id', existingLog.event_id)
            .maybeSingle();

          await supabase
            .from('events')
            .update({
              metadata: {
                ...(existingEvent?.metadata || {}),
                canceled: true,
                canceled_at: new Date().toISOString(),
              },
            })
            .eq('id', existingLog.event_id);
        }
      }

      // Update call_events: set status = 'canceled'
      const { error: callEventCancelError } = await supabase
        .from('call_events')
        .update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('calendly_invitee_uri', inviteeUri)
        .eq('status', 'scheduled'); // Only cancel if still scheduled (not already showed/no_show/etc.)

      if (callEventCancelError) {
        console.error('❌ Failed to cancel call_event (non-fatal):', callEventCancelError);
      } else {
        console.log('✅ call_event canceled for invitee:', inviteeUri);

        // Sync call_events → tracking_sheet after cancellation
        if (userId && funnelId) {
          try {
            const rowsSaved = await syncCallEventsToTrackingSheet(supabase, userId, 60);
            console.log(`✅ Tracking sheet sync after cancel: ${rowsSaved} rows updated`);
          } catch (syncErr) {
            console.error('❌ Tracking sheet sync failed (non-fatal):', syncErr);
          }
        }
      }

      return jsonResponse({ success: true, action: 'canceled', invitee_uri: inviteeUri });
    }

    // ── Lead Matching ─────────────────────────────────────────────────────────
    let leadId: string | null = null;
    let matchType = 'none';

    // 1. Match by email
    if (email) {
      const { data: byEmail } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('primary_email', email)
        .maybeSingle();

      if (byEmail) {
        leadId = byEmail.id;
        matchType = 'email';
      }
    }

    // 2. Match by full name (if email didn't match)
    if (!leadId && fullName) {
      const { data: byName } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', fullName)
        .maybeSingle();

      if (byName) {
        leadId = byName.id;
        matchType = 'name';
      }
    }

    // 3. Match by phone (if neither email nor name matched)
    if (!leadId && phone) {
      const normalizedPhone = phone.replace(/\s/g, '');
      const { data: byPhone } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', userId)
        .eq('primary_phone', normalizedPhone)
        .maybeSingle();

      if (byPhone) {
        leadId = byPhone.id;
        matchType = 'phone';
      }
    }

    console.log(`Lead match type: ${matchType}, lead_id: ${leadId}`);

    // ── Spam Detection ──────────────────────────────────────────────────────
    // For calendar bookings only check name/email/phone — booking_answers contain time slots etc. that are not spam signals
    const spam = detectSpam(fullName || null, email, phone, {});
    if (spam.isSpam) {
      console.log(`🚫 Spam detected (score ${spam.score}): ${spam.reasons.join(', ')} — ${email}`);
    }

    if (leadId) {
      // Update existing lead with booking info
      const { data: existingLead } = await supabase
        .from('leads')
        .select('metadata')
        .eq('id', leadId)
        .single();

      await supabase
        .from('leads')
        .update({
          updated_at: new Date().toISOString(),
          metadata: {
            ...(existingLead?.metadata || {}),
            call_scheduled_time: callScheduledTime,
            calendly_event_type: p.scheduled_event?.name || eventTypeUri,
            calendly_answers: bookingAnswers,
            utm_campaign: utmCampaign,
            utm_source: utmSource,
          },
        })
        .eq('id', leadId);

    } else {
      // Create new lead (booking-only, no survey data yet)
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
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
            calendly_invitee_uri: inviteeUri,
            calendly_event_uri: calendlyEventUri,
            calendly_event_type: p.scheduled_event?.name || eventTypeUri,
            call_scheduled_time: callScheduledTime,
            calendly_answers: bookingAnswers,
            utm_source: utmSource,
            created_from: 'calendly_booking',
            ...(spam.isSpam ? { spam_reasons: spam.reasons, spam_score: spam.score } : {}),
          },
          created_at: bookingCreatedAt,
        })
        .select()
        .single();

      if (leadError) throw leadError;
      leadId = newLead.id;
      console.log('Created new lead from Calendly booking:', leadId);
    }

    // ── Create Event (existing events table — tracks Booking count) ───────────
    let eventId: string | null = null;

    // Check if this is a rebooking (lead already has an event of this type)
    const { data: existingEvent } = await supabase.from('events')
      .select('id').eq('user_id', userId).eq('lead_id', leadId)
      .eq('event_type', clarityEventType).eq('event_source', 'calendly')
      .maybeSingle();
    const isRebooking = !!existingEvent;

    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        user_id: userId,
        lead_id: leadId,
        event_type: clarityEventType,
        event_date: bookingCreatedAt,
        funnel_id: funnelId,
        event_source: 'calendly',
        is_spam: spam.isSpam,
        metadata: {
          calendly_invitee_uri: inviteeUri,
          calendly_event_uri: calendlyEventUri,
          calendly_event_type_name: p.scheduled_event?.name || eventTypeUri,
          call_scheduled_time: callScheduledTime,
          booking_created_at: bookingCreatedAt,
          invitee_name: fullName,
          invitee_email: email,
          utm_campaign: utmCampaign,
          utm_source: utmSource,
          booking_answers: bookingAnswers,
          lead_match_type: matchType,
          is_rebooking: isRebooking,
          ...(spam.isSpam ? { spam_reasons: spam.reasons, spam_score: spam.score } : {}),
        },
      })
      .select()
      .single();

    if (eventError) throw eventError;
    eventId = event.id;

    // ── Create call_event (new table — tracks Termin/Call lifecycle) ──────────
    // Uses appointment_date (not booking_date) for Termin/Call tracking
    const { error: callEventError } = await supabase
      .from('call_events')
      .insert({
        user_id: userId,
        lead_id: leadId,
        lead_email: email,
        funnel_id: funnelId,
        call_type: callType,
        booking_date: bookingDate,
        appointment_date: appointmentDate,
        status: 'scheduled',
        calendly_event_uri: calendlyEventUri,
        calendly_invitee_uri: inviteeUri,
        source: 'calendly',
      });

    if (callEventError && callEventError.code !== '23505') {
      // 23505 = duplicate (rebooking same invitee URI) — safe to ignore
      console.error('❌ Failed to create call_event (non-fatal):', callEventError);
    } else if (!callEventError) {
      console.log('✅ call_event created:', callType, appointmentDate);
    }

    // Update log entry with full data
    if (logEntryId) {
      await supabase
        .from('calendly_events_log')
        .update({
          user_id: userId,
          invitee_email: email,
          lead_id: leadId,
          event_id: eventId,
          event_type: clarityEventType,
        })
        .eq('id', logEntryId);
    }

    console.log('✅ Calendly webhook processed');
    console.log('Lead ID:', leadId, '| Event ID:', eventId, '| Type:', clarityEventType);

    // ── Sync to Tracking Sheets ────────────────────────────────────────────────
    if (!spam.isSpam && userId) {
      try {
        // Sync Booking counts (existing logic — uses events table)
        const bookingRowsSaved = await syncCalendlyEventsToTrackingSheet(supabase, userId, 60);
        console.log(`✅ Booking tracking sheet sync: ${bookingRowsSaved} rows updated`);
      } catch (syncErr) {
        console.error('❌ Booking tracking sheet sync failed (non-fatal):', syncErr);
      }
    }

    return jsonResponse({
      success: true,
      lead_id: leadId,
      event_id: eventId,
      event_type: clarityEventType,
      match_type: matchType,
    });

  } catch (error) {
    console.error('❌ Error processing Calendly webhook:', error);
    return jsonResponse({ error: error.message }, 500);
  }
});

// ── syncCallEventsToTrackingSheet ──────────────────────────────────────────────
// Aggregates call_events → tracking_sheet_data for Termin and Call fields
// Uses appointment_date (not booking_date) — "what happened on that day?"
// Termin = showed + no_show (appointment was valid at call time)
// Call   = showed only (call actually happened)
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

  // Field name mapping per call type
  const FIELD_MAP: Record<string, { termin: string; call: string }> = {
    setting: { termin: 'SettingTermin', call: 'SettingCall' },
    closing: { termin: 'ClosingTermin', call: 'ClosingCall' },
  };

  // Aggregate by funnel_id + appointment_date + field
  // Use Sets of lead_ids to deduplicate (same lead, multiple call_events → count once)
  const aggregation = new Map<string, {
    funnel_id: string; year: number; month: number; day: number;
    field_name: string; leads: Set<string>;
  }>();

  for (const ce of callEvents || []) {
    const fields = FIELD_MAP[ce.call_type];
    if (!fields || !ce.funnel_id || !ce.appointment_date) continue;

    // Parse appointment_date (DATE type = 'YYYY-MM-DD', no timezone conversion needed)
    const [yearStr, monthStr, dayStr] = ce.appointment_date.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr) - 1; // 0-based (JS convention)
    const day = parseInt(dayStr);
    const leadKey = ce.lead_id || `anon-${ce.id}`;

    // Termin count: showed or no_show
    if (['showed', 'no_show'].includes(ce.status)) {
      const terminKey = `${ce.funnel_id}|${year}|${month}|${day}|${fields.termin}`;
      if (!aggregation.has(terminKey)) {
        aggregation.set(terminKey, { funnel_id: ce.funnel_id, year, month, day, field_name: fields.termin, leads: new Set() });
      }
      aggregation.get(terminKey)!.leads.add(leadKey);
    }

    // Call count: showed only
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

// ── syncCalendlyEventsToTrackingSheet ─────────────────────────────────────────
// Original function — syncs Booking counts from events table (by booking_date)
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

  const aggregation = new Map<string, { funnel_id: string; year: number; month: number; day: number; field_name: string; leads: Set<string> }>();

  for (const ev of events || []) {
    const fieldName = EVENT_FIELD_MAP[ev.event_type];
    if (!fieldName || !ev.funnel_id) continue;
    if (ev.metadata?.is_rebooking) continue;

    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ev.event_date));
    const [yearStr, monthStr, dayStr] = localDate.split('-');
    const year = parseInt(yearStr), month = parseInt(monthStr) - 1, day = parseInt(dayStr);
    const key = `${ev.funnel_id}|${year}|${month}|${day}|${fieldName}`;
    if (!aggregation.has(key)) {
      aggregation.set(key, { funnel_id: ev.funnel_id, year, month, day, field_name: fieldName, leads: new Set<string>() });
    }
    const leadKey = ev.lead_id || `no-lead-${ev.funnel_id}-${year}-${month}-${day}`;
    aggregation.get(key)!.leads.add(leadKey);
  }

  if (aggregation.size === 0) return 0;

  const rows = Array.from(aggregation.values()).map(({ funnel_id, year, month, day, field_name, leads }) => ({
    user_id: userId, funnel_id, year, month, day, field_name, value: leads.size, updated_at: new Date().toISOString(),
  }));

  const { error: upsertError } = await supabase
    .from('tracking_sheet_data')
    .upsert(rows, { onConflict: 'user_id,funnel_id,year,month,day,field_name', ignoreDuplicates: false });

  if (upsertError) throw new Error(`Failed to save to tracking_sheet_data: ${upsertError.message}`);
  return rows.length;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPhone(invitee: any): string | null {
  if (invitee.text_reminder_number) return invitee.text_reminder_number.replace(/\s/g, '');
  const phoneKeywords = /telefon|phone|handy|mobil|whatsapp|nummer|number/i;
  const phonePattern = /^[+\d][\d\s\-().\/+]{6,20}$/;
  for (const qa of (invitee.questions_and_answers || [])) {
    const a: string = qa.answer || '';
    if (!a) continue;
    if (phoneKeywords.test(qa.question || '') || phonePattern.test(a.trim())) {
      const cleaned = a.replace(/\s/g, '');
      if ((cleaned.match(/\d/g) || []).length >= 6) return cleaned;
    }
  }
  return null;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
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
    if ((trimmed.match(/[a-zA-ZäöüÄÖÜ]/g) || []).length < 2) return false;
    return !VOWELS.test(trimmed);
  });
  if (anyAnswerNoVowels) { score += 2; reasons.push('answer with no vowels'); }

  return { isSpam: score >= 3, score, reasons };
}

// Calendly signature format: "t=<timestamp>,v1=<hmac>"
async function verifySignature(header: string, body: string, signingKey: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature) return false;

    const message = `${timestamp}.${body}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
    const computed = Array.from(new Uint8Array(sigBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computed === signature;
  } catch {
    return false;
  }
}
