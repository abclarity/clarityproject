// Calendly Webhook Handler
// Receives invitee.created / invitee.canceled events from Calendly
// Matches leads by email → name → phone → creates new lead if nothing matches

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, calendly-webhook-signature',
};

const CALENDLY_API_URL = 'https://api.calendly.com';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Calendly webhook received');

    const bodyText = await req.text();

    // Verify Calendly webhook signature
    const signatureHeader = req.headers.get('calendly-webhook-signature');
    const signingKey = Deno.env.get('CALENDLY_WEBHOOK_SIGNING_KEY');
    if (signingKey && signatureHeader) {
      const isValid = await verifySignature(signatureHeader, bodyText, signingKey);
      if (!isValid) {
        console.error('Invalid Calendly webhook signature');
        return jsonResponse({ error: 'Invalid signature' }, 401);
      }
    }

    const payload = JSON.parse(bodyText);
    console.log('Event:', payload.event);

    // Only handle invitee.created (and optionally invitee.canceled)
    if (!['invitee.created', 'invitee.canceled'].includes(payload.event)) {
      return jsonResponse({ message: 'Event type not handled' });
    }

    const { invitee, event: scheduledEvent, event_type, tracking, questions_and_answers } = payload.payload;

    const inviteeUri: string = invitee.uri;
    const calendlyEventUri: string = scheduledEvent.uri;
    const isCanceled = payload.event === 'invitee.canceled';

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Idempotency check – claim this invitee_uri atomically
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
    const logEntryId = logClaim.id;

    // Find the Clarity user who owns this Calendly connection
    // We match by organization_uri from the event_type owner, or by checking all active connections
    const eventTypeUri: string = event_type.uri;
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

    // If no event type mapping, try to find any active connection and use default
    let userId: string | null = eventTypeMapping?.user_id || connection?.user_id || null;
    let clarityEventType: string = eventTypeMapping?.clarity_event_type || 'settingBooking';

    if (!userId) {
      console.log('No active Calendly connection found');
      return jsonResponse({ message: 'No matching user connection' });
    }

    // Determine funnel from UTM mapping
    const utmCampaign: string | null = tracking?.utm_campaign || null;
    const utmSource: string | null = tracking?.utm_source || null;
    let funnelId: string | null = null;

    if (utmCampaign) {
      const { data: utmMapping } = await supabase
        .from('calendly_utm_mappings')
        .select('funnel_id')
        .eq('user_id', userId)
        .eq('utm_campaign', utmCampaign)
        .maybeSingle();

      funnelId = utmMapping?.funnel_id || null;
    }

    // Extract invitee data
    const email: string = invitee.email?.toLowerCase().trim();
    const fullName: string = invitee.name || '';
    const firstName: string = invitee.first_name || '';
    const lastName: string = invitee.last_name || '';
    const phone: string | null = invitee.text_reminder_number || null;
    const bookingTime: string = scheduledEvent.start_time;

    // Build Q&A metadata
    const bookingAnswers: Record<string, string> = {};
    if (Array.isArray(questions_and_answers)) {
      for (const qa of questions_and_answers) {
        if (qa.question && qa.answer) {
          bookingAnswers[qa.question] = qa.answer;
        }
      }
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
        .ilike('full_name', fullName)
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

    if (leadId && !isCanceled) {
      // Update existing lead with booking info
      await supabase
        .from('leads')
        .update({
          updated_at: new Date().toISOString(),
          metadata: supabase.rpc ? undefined : undefined, // handled below via raw update
        })
        .eq('id', leadId);

      // Merge booking answers into metadata
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
            calendly_booking_time: bookingTime,
            calendly_event_type: event_type.name,
            calendly_answers: bookingAnswers,
            utm_campaign: utmCampaign,
            utm_source: utmSource,
          },
        })
        .eq('id', leadId);

    } else if (!leadId && !isCanceled) {
      // Create new lead (booking-only, no survey data yet)
      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_id: userId,
          primary_email: email || null,
          full_name: fullName || null,
          primary_phone: phone || null,
          emails: email ? [email] : [],
          phones: phone ? [phone] : [],
          funnel_id: funnelId,
          source: 'calendly',
          lead_source: 'calendly',
          lead_status: 'new',
          utm_campaign: utmCampaign,
          metadata: {
            calendly_invitee_uri: inviteeUri,
            calendly_event_uri: calendlyEventUri,
            calendly_event_type: event_type.name,
            calendly_booking_time: bookingTime,
            calendly_answers: bookingAnswers,
            utm_source: utmSource,
            created_from: 'calendly_booking',
          },
          created_at: bookingTime,
        })
        .select()
        .single();

      if (leadError) throw leadError;
      leadId = newLead.id;
      console.log('Created new lead from Calendly booking:', leadId);
    }

    // ── Create Event ──────────────────────────────────────────────────────────
    let eventId: string | null = null;

    if (!isCanceled && leadId) {
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          user_id: userId,
          lead_id: leadId,
          event_type: clarityEventType,
          event_date: bookingTime,
          funnel_id: funnelId,
          event_source: 'calendly',
          is_spam: false,
          metadata: {
            calendly_invitee_uri: inviteeUri,
            calendly_event_uri: calendlyEventUri,
            calendly_event_type_name: event_type.name,
            booking_time: bookingTime,
            invitee_name: fullName,
            invitee_email: email,
            utm_campaign: utmCampaign,
            utm_source: utmSource,
            booking_answers: bookingAnswers,
            lead_match_type: matchType,
          },
        })
        .select()
        .single();

      if (eventError) throw eventError;
      eventId = event.id;
    }

    // Handle cancellation: mark event as canceled if exists
    if (isCanceled && inviteeUri) {
      const { data: existingLog } = await supabase
        .from('calendly_events_log')
        .select('event_id')
        .eq('invitee_uri', inviteeUri)
        .not('id', 'eq', logEntryId)
        .maybeSingle();

      if (existingLog?.event_id) {
        await supabase
          .from('events')
          .update({ metadata: { canceled: true, canceled_at: new Date().toISOString() } })
          .eq('id', existingLog.event_id);
      }
    }

    // Update log entry with full data
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

    console.log('✅ Calendly webhook processed');
    console.log('Lead ID:', leadId, '| Event ID:', eventId, '| Type:', clarityEventType);

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
