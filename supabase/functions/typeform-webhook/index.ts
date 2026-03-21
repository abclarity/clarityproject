import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, typeform-signature',
};

interface TypeformAnswer {
  field: {
    id: string;
    type: string;
    ref?: string;
  };
  type: string;
  text?: string;
  email?: string;
  phone_number?: string;
  choice?: {
    label: string;
  };
  choices?: {
    labels: string[];
  };
  number?: number;
  boolean?: boolean;
}

interface TypeformPayload {
  event_id: string;
  event_type: string;
  form_response: {
    form_id: string;
    token: string; // response ID
    landed_at: string;
    submitted_at: string;
    hidden?: Record<string, string>; // funnel_id, utm_campaign, etc.
    definition: {
      id: string;
      title: string;
      fields: Array<{
        id: string;
        title: string;
        type: string;
        ref?: string;
      }>;
    };
    answers: TypeformAnswer[];
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('Typeform webhook received');

    // Get signature from header
    const signature = req.headers.get('typeform-signature');
    
    // Read body as text for signature verification
    const bodyText = await req.text();
    
    // Verify webhook signature (if configured)
    const webhookSecret = Deno.env.get('TYPEFORM_WEBHOOK_SECRET');
    if (webhookSecret && signature) {
      const isValid = await verifySignature(signature, bodyText, webhookSecret);
      if (!isValid) {
        console.error('Invalid Typeform signature');
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Parse payload
    const payload: TypeformPayload = JSON.parse(bodyText);
    console.log('Parsed payload:', JSON.stringify(payload, null, 2));

    // Validate payload
    if (!payload.form_response || !payload.form_response.form_id) {
      throw new Error('Invalid payload: missing form_response or form_id');
    }

    const { form_response } = payload;
    const formId = form_response.form_id;
    const responseId = form_response.token;

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Claim this response_id atomically – insert a placeholder log entry first.
    // If another concurrent request already inserted it (race condition / Typeform retry),
    // the UNIQUE constraint on response_id causes this insert to return 0 rows → we exit early.
    // This prevents duplicate leads/events when Typeform retries a slow webhook.
    const { data: logClaim, error: logClaimError } = await supabase
      .from('typeform_events_log')
      .insert({ form_id: formId, response_id: responseId, raw_payload: payload })
      .select('id')
      .single();

    if (logClaimError) {
      // Unique-constraint violation (code 23505) = already processing or processed
      if (logClaimError.code === '23505') {
        console.log('Response already claimed/processed (duplicate webhook call):', responseId);
        return new Response(JSON.stringify({ message: 'Already processed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw logClaimError;
    }
    const logEntryId = logClaim.id;

    // Get form mapping (which funnel does this form fill?) - NEW SCHEMA
    const { data: mapping, error: mappingError } = await supabase
      .from('typeform_forms')
      .select('*')
      .eq('form_id', formId)
      .eq('is_active', true)
      .maybeSingle();

    if (mappingError) {
      console.error('Error fetching form mapping:', mappingError);
      throw mappingError;
    }
    if (!mapping) {
      console.log('No mapping found for form:', formId);
      // Placeholder log entry was already inserted above – nothing more to do
      return new Response(JSON.stringify({ message: 'Form not mapped to any funnel' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract lead data from answers
    const leadData = extractLeadData(form_response.answers, form_response.definition?.fields);

    // Extract all survey answers (same logic as typeform-sync: answer[answer.type])
    const allSurveyAnswers = extractAllAnswers(form_response.answers, form_response.definition.fields || []);
    console.log(`📋 All extracted answers (${Object.keys(allSurveyAnswers).length}):`, JSON.stringify(allSurveyAnswers));

    // Filter to selected_questions if configured
    const surveyAnswers = filterBySelectedQuestions(
      allSurveyAnswers,
      form_response.answers,
      mapping.selected_questions || null,
      mapping.fields || []
    );
    console.log(`✅ Survey answers after filter (${Object.keys(surveyAnswers).length}):`, JSON.stringify(surveyAnswers));
    console.log(`📌 selected_questions in mapping:`, JSON.stringify(mapping.selected_questions));

    if (!leadData.email) {
      throw new Error('No email found in form submission');
    }

    // Get funnel_id from hidden fields or mapping
    const funnelId = form_response.hidden?.funnel_id || mapping.funnel_id;

    // Spam detection
    const spam = detectSpam(leadData.name || null, leadData.email, leadData.phone || null, surveyAnswers);
    if (spam.isSpam) {
      console.log(`🚫 Spam detected (score ${spam.score}): ${spam.reasons.join(', ')}`);
    }

    // Check if lead already exists
    const { data: existingLead } = await supabase
      .from('leads')
      .select('*')
      .eq('primary_email', leadData.email)
      .maybeSingle();

    let leadId: string;

    if (existingLead) {
      // Update existing lead
      leadId = existingLead.id;
      console.log('Updating existing lead:', leadId);

      const updateData: any = {
        updated_at: new Date().toISOString(),
        is_spam: spam.isSpam,
        // Merge new survey answers into existing metadata so the Survey tab stays populated
        metadata: {
          ...(existingLead.metadata || {}),
          typeform_answers: {
            ...((existingLead.metadata?.typeform_answers) || {}),
            ...surveyAnswers,
          },
          typeform_last_submitted_at: form_response.submitted_at,
          ...(spam.isSpam ? { spam_reasons: spam.reasons, spam_score: spam.score } : {}),
        },
      };

      if (leadData.name && !existingLead.full_name) {
        updateData.full_name = leadData.name;
      }
      if (leadData.phone && !existingLead.primary_phone) {
        updateData.primary_phone = leadData.phone;
      }
      // Fill UTM fields if not yet set (first time we see this lead with UTM data)
      if (!existingLead.utm_campaign && form_response.hidden?.utm_campaign) {
        updateData.utm_campaign = form_response.hidden.utm_campaign;
      }
      if (!existingLead.utm_source && form_response.hidden?.utm_source) {
        updateData.utm_source = form_response.hidden.utm_source;
      }
      if (!existingLead.utm_medium && form_response.hidden?.utm_medium) {
        updateData.utm_medium = form_response.hidden.utm_medium;
      }
      if (!existingLead.utm_content && form_response.hidden?.utm_content) {
        updateData.utm_content = form_response.hidden.utm_content;
      }
      if (!existingLead.utm_term && form_response.hidden?.utm_term) {
        updateData.utm_term = form_response.hidden.utm_term;
      }
      if (!existingLead.h_ad_id && form_response.hidden?.h_ad_id) {
        updateData.h_ad_id = form_response.hidden.h_ad_id;
      }

      await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);

    } else {
      // Create new lead
      console.log('Creating new lead:', leadData.email);

      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert({
          user_id: mapping.user_id,
          primary_email: leadData.email,
          name: leadData.name || null,
          primary_phone: leadData.phone || null,
          emails: [leadData.email],
          phones: leadData.phone ? [leadData.phone] : [],
          funnel_id: funnelId,
          source: 'typeform',
          lead_source: 'typeform',
          lead_status: spam.isSpam ? 'spam' : 'new',
          is_spam: spam.isSpam,
          utm_campaign: form_response.hidden?.utm_campaign || null,
          utm_source:  form_response.hidden?.utm_source  || null,
          utm_medium:  form_response.hidden?.utm_medium  || null,
          utm_content: form_response.hidden?.utm_content || null,
          utm_term:    form_response.hidden?.utm_term    || null,
          h_ad_id:     form_response.hidden?.h_ad_id     || null,
          metadata: {
            typeform_form_id: formId,
            typeform_response_id: responseId,
            typeform_submitted_at: form_response.submitted_at,
            typeform_answers: surveyAnswers,
            ...(spam.isSpam ? { spam_reasons: spam.reasons, spam_score: spam.score } : {}),
          },
          created_at: form_response.submitted_at,
        })
        .select()
        .single();

      if (leadError) {
        console.error('Error creating lead:', leadError);
        throw leadError;
      }

      leadId = newLead.id;
    }

    // Check qualification
    const isQualified = checkQualification(
      form_response.answers,
      mapping.qualification_field_id, // column name in typeform_forms table
      mapping.qualifying_answers
    );

    console.log('Qualification result:', isQualified);

    // Create event (survey or surveyQuali)
    const eventType = isQualified ? 'surveyQuali' : 'survey';
    
    const { data: event, error: eventError } = await supabase
      .from('events')
      .insert({
        user_id: mapping.user_id,
        lead_id: leadId,
        event_type: eventType,
        event_date: form_response.submitted_at,
        funnel_id: funnelId,
        event_source: 'typeform',
        is_spam: spam.isSpam,
        metadata: {
          form_id: formId,
          response_id: responseId,
          form_title: form_response.definition.title,
          typeform_answers: surveyAnswers, // formatted key-value, matches what UI checks for
          answers: form_response.answers,  // raw array, kept for reference
          hidden_fields: form_response.hidden || {},
        },
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error creating event:', eventError);
      throw eventError;
    }

    // Update the placeholder log entry (inserted at the top as idempotency lock) with full data
    await supabase.from('typeform_events_log').update({
      user_id: mapping.user_id,
      lead_id: leadId,
      event_id: event.id,
      event_type: eventType,
      is_qualified: isQualified,
    }).eq('id', logEntryId);

    console.log('Successfully processed Typeform webhook');
    console.log('Lead ID:', leadId);
    console.log('Event ID:', event.id);
    console.log('Event Type:', eventType);

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadId,
        event_id: event.id,
        event_type: eventType,
        is_qualified: isQualified,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error processing Typeform webhook:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Helper: Verify Typeform webhook signature
async function verifySignature(signature: string, body: string, secret: string): Promise<boolean> {
  try {
    const [algo, hash] = signature.split('=');
    if (algo !== 'sha256') return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computedHash = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    return computedHash === hash;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Helper: Extract lead data (email, name, phone) from Typeform answers
function extractLeadData(answers: TypeformAnswer[], fields?: { id: string; title: string; type: string }[]): { email?: string; name?: string; phone?: string } {
  const data: { email?: string; name?: string; phone?: string } = {};

  // Build a title lookup from the definition fields (more reliable than answer.field.ref)
  const titleById: Record<string, string> = {};
  if (fields) {
    for (const f of fields) titleById[f.id] = f.title?.toLowerCase() || '';
  }

  let firstName: string | undefined;
  let lastName: string | undefined;

  for (const answer of answers) {
    // Email
    if (answer.type === 'email' && answer.email) {
      data.email = answer.email;
      continue;
    }
    // Phone
    if (answer.type === 'phone_number' && answer.phone_number) {
      data.phone = answer.phone_number;
      continue;
    }
    // Name fields (short_text only)
    if (answer.field.type === 'short_text' && answer.text) {
      const title = titleById[answer.field.id] || answer.field.ref?.toLowerCase() || '';
      const isLastName = title.includes('nachname') || title.includes('last name') || title.includes('lastname') || title.includes('surname');
      const isFirstName = title.includes('vorname') || title.includes('first name') || title.includes('firstname');
      const isAnyName = title.includes('name');

      if (isLastName) {
        lastName = answer.text;
      } else if (isFirstName) {
        firstName = answer.text;
      } else if (isAnyName && !firstName && !lastName) {
        // Generic "name" field – use as full name fallback
        data.name = answer.text;
      }
    }
  }

  // Combine first + last name if both found
  if (firstName && lastName) {
    data.name = `${firstName} ${lastName}`;
  } else if (firstName) {
    data.name = firstName;
  } else if (lastName) {
    data.name = lastName;
  }
  // else: data.name stays as generic fallback set above

  return data;
}

// Helper: Extract all answers by field ID (same approach as typeform-sync)
// Uses answer[answer.type] to cover every Typeform answer type automatically.
// Skips email and phone_number (system fields, not survey questions).
// Returns { fieldId: value } with question titles as keys where available.
function extractAllAnswers(
  answers: TypeformAnswer[],
  definitionFields: Array<{ id: string; title: string; type: string }>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const answer of answers) {
    // Skip system fields
    if (answer.type === 'email' || answer.type === 'phone_number') continue;

    const fieldId = answer.field.id;
    // Get field title from definition (webhook answers don't include title directly)
    const defField = definitionFields.find(f => f.id === fieldId);
    const fieldTitle = defField?.title || fieldId;

    // Universal extraction: answer[answer.type] covers text, choice, choices, boolean, number, date, url, etc.
    let value: any = (answer as any)[answer.type];

    // Choices object → extract label
    if (value && typeof value === 'object' && value.label) value = value.label;
    // Multiple choices array → join labels
    if (value && typeof value === 'object' && Array.isArray(value.labels)) value = value.labels.join(', ');
    // Boolean → human-readable
    if (typeof value === 'boolean') value = value ? 'Ja' : 'Nein';
    // Number → string
    if (typeof value === 'number') value = String(value);

    if (value !== undefined && value !== null && value !== '') {
      result[fieldTitle] = String(value);
    }
  }

  return result;
}

// Helper: Check if lead is qualified based on specific answer
function checkQualification(
  answers: TypeformAnswer[],
  qualificationQuestionId: string | null,
  qualifyingAnswers: string[] | null
): boolean {
  // If no qualification logic configured, treat as regular survey (not qualified)
  if (!qualificationQuestionId || !qualifyingAnswers || qualifyingAnswers.length === 0) {
    return false;
  }

  // Find the qualification question answer
  const qualAnswer = answers.find(a => a.field.id === qualificationQuestionId);
  if (!qualAnswer) {
    console.log('Qualification question not found in answers');
    return false; // Question not answered = not qualified
  }

  // Check answer type and compare
  let answerValue: string | null = null;

  if (qualAnswer.type === 'choice' && qualAnswer.choice) {
    answerValue = qualAnswer.choice.label;
  } else if (qualAnswer.type === 'boolean' && qualAnswer.boolean !== undefined) {
    answerValue = qualAnswer.boolean ? 'true' : 'false';
  } else if (qualAnswer.type === 'text' && qualAnswer.text) {
    answerValue = qualAnswer.text;
  }

  if (!answerValue) {
    console.log('Could not extract answer value');
    return false;
  }

  // Check if answer is in qualifying answers (case-insensitive)
  const isQualified = qualifyingAnswers.some(
    qa => qa.toLowerCase() === answerValue!.toLowerCase()
  );

  console.log('Answer value:', answerValue);
  console.log('Qualifying answers:', qualifyingAnswers);
  console.log('Is qualified:', isQualified);

  return isQualified;
}

// Helper: Spam detection – score-based, threshold = 3
// Returns isSpam=true only when multiple signals combine (conservative to avoid false positives)
interface SpamResult { isSpam: boolean; score: number; reasons: string[]; }

function detectSpam(
  name: string | null,
  email: string,
  phone: string | null,
  surveyAnswers: Record<string, string>
): SpamResult {
  const reasons: string[] = [];
  let score = 0;

  const n = (name || '').toLowerCase().trim();
  const emailLower = email.toLowerCase().trim();
  const local = emailLower.split('@')[0] || '';
  const domain = emailLower.split('@')[1] || '';
  const answers = Object.values(surveyAnswers).join(' ').toLowerCase();
  const digits = (phone || '').replace(/\D/g, '');
  // Fix 1: 'y' added as vowel (Slavic names like Volodymyr use y as vowel)
  const VOWELS = /[aeiouyäöüàáâãèéêëìíîïòóôõùúûýæœ]/i;
  // Fix 2: threshold raised from 5 to 7 (German surnames like Redschlag have natural 5-6 consonant clusters)
  const CONS4 = /[bcdfghjklmnpqrstvwxyz]{7,}/i;

  // ── Hard rules (+3 each → instant spam at threshold 3) ─────────────────────
  if (/\btest\b/.test(n)) { score += 3; reasons.push('name contains "test"'); }

  if (['test','fake','spam','xyz','asdf'].includes(local)) {
    score += 3; reasons.push(`email local is "${local}"`);
  }

  const TEST_DOMAINS = ['test.com','test.de','test.org','test.net','example.com','example.de','example.org'];
  if (TEST_DOMAINS.includes(domain)) { score += 3; reasons.push(`test domain "${domain}"`); }
  // Fix 3: trusted providers – real last names in email shouldn't score points
  const TRUSTED_EMAIL_DOMAINS = ['gmail.com','googlemail.com','gmx.de','gmx.net','gmx.at','gmx.ch','web.de','outlook.com','outlook.de','hotmail.com','hotmail.de','icloud.com','yahoo.com','yahoo.de','t-online.de','protonmail.com','proton.me'];

  if (/(scam|abzocken|spam|penis|pussy|fick|wichser|nutte|porno|dildo|vagina|schwanz|titten)/i.test(answers)) { score += 3; reasons.push('spam keyword in answers'); }
  if (/(fake|fuck|shit|scam|spam|hurensohn|arschloch|penis|pussy|fick|wichser|nutte|porno|dildo|vagina|schwanz|titten)/i.test(n)) { score += 3; reasons.push('profanity/spam in name'); }
  if (/\b(blabla|blablabla|xyz)\b/.test(n)) { score += 3; reasons.push('obvious fake name pattern'); }

  // Phone clearly too short (real DE numbers ≥ 10 digits total incl. country code)
  if (digits.length > 0 && digits.length < 6) { score += 3; reasons.push(`phone too short (${digits.length} digits)`); }

  // ── Scoring rules (+1/+2) ─────────────────────────────────────────────────
  // Suspicious email domain: SLD or TLD is 1 char (g.g, a@b.de)
  const parts = domain.split('.');
  // Hard rule: both SLD and TLD are single chars (g.g, a.b) → instant spam
  if (parts.length >= 2 && parts[parts.length - 2].length <= 1 && parts[parts.length - 1].length <= 1) {
    score += 3; reasons.push(`both SLD and TLD are 1 char "${domain}"`);
  } else if (parts.length >= 2 && (parts[parts.length - 2].length <= 1 || parts[parts.length - 1].length <= 1)) {
    score += 2; reasons.push(`suspicious domain "${domain}"`);
  }

  // Keyboard mash: 4+ consecutive consonants in name
  if (CONS4.test(n)) { score += 2; reasons.push('keyboard mash in name'); }

  // Name has a part ≥ 2 chars with zero vowels (e.g. "ds", "hhh", "sfsdfs")
  const hasAllConsonantPart = n.split(/\s+/).some(p => p.length >= 4 && !/\d/.test(p) && !VOWELS.test(p));
  if (hasAllConsonantPart) { score += 2; reasons.push('consonant-only word in name'); }

  // All name parts are single letters ("G G", "H H")
  const nameParts = n.split(/\s+/).filter(p => p.length > 0);
  if (nameParts.length >= 2 && nameParts.every(p => p.length === 1)) {
    score += 3; reasons.push('name is only single letters');
  }

  // Phone: all same digit (111111, 999999)
  if (digits.length >= 5 && new Set(digits).size === 1) { score += 2; reasons.push('phone all same digit'); }

  // Single-char name (any letter — "A", "J", "H") is suspicious as a full name
  if (n.length === 1) { score += 3; reasons.push('single letter as name'); }

  // Keyboard mash in email local part (3+ consecutive consonants) – skipped for trusted providers
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(local) && !TRUSTED_EMAIL_DOMAINS.includes(domain)) { score += 1; reasons.push('keyboard mash in email'); }

  // Keyboard mash in survey answers (4+ consecutive consonants)
  if (CONS4.test(answers)) { score += 1; reasons.push('keyboard mash in answers'); }

  // Any individual answer that contains zero vowels (e.g. "Ff", "ds", "byjyk") — skip phone-like values
  const PHONE_LIKE = /^[+\d\s\-().\/]{4,}$/;
  const anyAnswerNoVowels = Object.values(surveyAnswers).some(v => {
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

// Helper: Filter survey answers to only the questions selected during import
// selected_questions format: { "field_id": "Short Label" }
// Falls back to allAnswers if no selection configured OR if filter yields nothing.
function filterBySelectedQuestions(
  allAnswers: Record<string, string>,
  rawAnswers: TypeformAnswer[],
  selectedQuestions: Record<string, string> | null,
  formFields: Array<{ id: string; title: string; type: string }>
): Record<string, string> {
  if (!selectedQuestions || Object.keys(selectedQuestions).length === 0) {
    return allAnswers; // no filter configured → return everything
  }

  const filtered: Record<string, string> = {};
  for (const [fieldId, label] of Object.entries(selectedQuestions)) {
    // Find raw answer by field id
    const raw = rawAnswers.find(a => a.field.id === fieldId);
    if (!raw) {
      console.log(`⚠️ No raw answer found for selected field: ${fieldId} ("${label}")`);
      continue;
    }

    // Universal extraction (same as extractAllAnswers)
    let value: any = (raw as any)[raw.type];
    if (value && typeof value === 'object' && value.label) value = value.label;
    if (value && typeof value === 'object' && Array.isArray(value.labels)) value = value.labels.join(', ');
    if (typeof value === 'boolean') value = value ? 'Ja' : 'Nein';
    if (typeof value === 'number') value = String(value);

    if (value !== undefined && value !== null && value !== '') {
      // Use custom label if it's different from the field_id, else use field title from definition
      const field = formFields.find(f => f.id === fieldId);
      const questionLabel = (label && label !== fieldId) ? label : (field?.title || fieldId);
      filtered[questionLabel] = String(value);
    } else {
      console.log(`⚠️ Could not extract value for field ${fieldId} (type: ${raw.type})`);
    }
  }

  // Fallback: if filtering produced nothing but we have answers, return all answers
  // This ensures the Survey tab always shows even if field IDs changed since last import
  if (Object.keys(filtered).length === 0 && Object.keys(allAnswers).length > 0) {
    console.log(`⚠️ Filter produced 0 results, falling back to all answers (${Object.keys(allAnswers).length} entries)`);
    return allAnswers;
  }

  return filtered;
}
