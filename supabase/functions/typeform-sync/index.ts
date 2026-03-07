// Typeform Forms Sync & Webhook Setup
// Fetches user's forms from Typeform API and creates webhooks automatically

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TYPEFORM_API_URL = 'https://api.typeform.com';

interface TypeformForm {
  id: string;
  title: string;
  self: {
    href: string;
  };
  fields: Array<{
    id: string;
    title: string;
    type: string;
    properties?: any;
  }>;
}

interface TypeformWebhookResponse {
  id: string;
  form_id: string;
  tag: string;
  url: string;
  enabled: boolean;
  created_at: string;
}

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
    const action = body.action; // 'fetch_forms' or 'setup_webhook'

    // ==================== FETCH FORMS ====================
    if (action === 'fetch_forms') {
      console.log(`Fetching forms for user: ${userId}`);

      // Get Typeform access token
      const { data: connection, error: connError } = await supabase
        .from('typeform_connections')
        .select('access_token')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (connError || !connection) {
        return new Response(JSON.stringify({ 
          error: 'Keine aktive Typeform-Verbindung gefunden. Bitte neu verbinden.' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch forms from Typeform API
      const formsResponse = await fetch(`${TYPEFORM_API_URL}/forms`, {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
        },
      });

      if (!formsResponse.ok) {
        const errorText = await formsResponse.text();
        console.error('Failed to fetch forms:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Fehler beim Laden der Formulare' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formsData = await formsResponse.json();
      const forms = formsData.items || [];

      console.log(`Found ${forms.length} forms`);

      // Fetch full details for each form (including fields)
      const detailedForms = await Promise.all(
        forms.map(async (form: any) => {
          const detailResponse = await fetch(`${TYPEFORM_API_URL}/forms/${form.id}`, {
            headers: {
              'Authorization': `Bearer ${connection.access_token}`,
            },
          });

          if (!detailResponse.ok) {
            console.error(`Failed to fetch form details for ${form.id}`);
            return {
              id: form.id,
              title: form.title,
              url: form._links?.display || null,
              fields: [],
            };
          }

          const detailData: TypeformForm = await detailResponse.json();
          
          return {
            id: detailData.id,
            title: detailData.title,
            url: detailData.self?.href || null,
            fields: detailData.fields.map(f => ({
              id: f.id,
              title: f.title,
              type: f.type,
            })),
          };
        })
      );

      return new Response(JSON.stringify({ forms: detailedForms }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== SETUP WEBHOOK ====================
    if (action === 'setup_webhook') {
      const { form_id, funnel_id, qualification_field_id, qualifying_answers } = body;

      if (!form_id || !funnel_id) {
        return new Response(JSON.stringify({ 
          error: 'Formular-ID und Funnel-ID erforderlich' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Setting up webhook for form: ${form_id}, funnel: ${funnel_id}`);

      // Get Typeform access token
      const { data: connection, error: connError } = await supabase
        .from('typeform_connections')
        .select('access_token')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (connError || !connection) {
        return new Response(JSON.stringify({ 
          error: 'Keine aktive Typeform-Verbindung' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get form details
      const formResponse = await fetch(`${TYPEFORM_API_URL}/forms/${form_id}`, {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
        },
      });

      if (!formResponse.ok) {
        return new Response(JSON.stringify({ 
          error: 'Formular nicht gefunden' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const formData: TypeformForm = await formResponse.json();

      // Generate unique webhook tag
      const webhookTag = `clarity_${userId.substring(0, 8)}_${Date.now()}`;
      
      // Webhook URL (points to typeform-webhook Edge Function)
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/typeform-webhook`;

      // Create webhook via Typeform API
      console.log(`Creating webhook with tag: ${webhookTag}`);
      const webhookResponse = await fetch(
        `${TYPEFORM_API_URL}/forms/${form_id}/webhooks/${webhookTag}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${connection.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
          }),
        }
      );

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error('Failed to create webhook:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Webhook konnte nicht erstellt werden' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const webhookData: TypeformWebhookResponse = await webhookResponse.json();
      console.log(`✅ Webhook created: ${webhookData.id}`);

      // Save form mapping to database
      const { error: dbError } = await supabase
        .from('typeform_forms')
        .upsert({
          user_id: userId,
          form_id: form_id,
          form_title: formData.title,
          form_url: formData.self?.href || null,
          fields: formData.fields,
          funnel_id: funnel_id,
          qualification_field_id: qualification_field_id || null,
          qualifying_answers: qualifying_answers || null,
          webhook_id: webhookData.id,
          webhook_tag: webhookTag,
          is_active: true,
        }, {
          onConflict: 'user_id,form_id',
        });

      if (dbError) {
        console.error('Database error:', dbError);
        return new Response(JSON.stringify({ 
          error: 'Datenbank-Fehler beim Speichern' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log('✅ Form mapping saved to database');

      return new Response(JSON.stringify({ 
        success: true,
        webhook_id: webhookData.id,
        form_title: formData.title,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== IMPORT HISTORICAL RESPONSES ====================
    if (action === 'import_responses') {
      const { form_id, days_back, selected_questions } = body;

      if (!form_id) {
        return new Response(JSON.stringify({ 
          error: 'Formular-ID erforderlich' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Importing responses for form: ${form_id}, days back: ${days_back || 30}`);
      console.log(`Selected questions:`, selected_questions);

      // Get Typeform access token
      const { data: connection, error: connError } = await supabase
        .from('typeform_connections')
        .select('access_token')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (connError || !connection) {
        return new Response(JSON.stringify({ 
          error: 'Keine aktive Typeform-Verbindung' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get form mapping from database
      const { data: formMapping, error: mappingError } = await supabase
        .from('typeform_forms')
        .select('*')
        .eq('user_id', userId)
        .eq('form_id', form_id)
        .single();

      if (mappingError || !formMapping) {
        return new Response(JSON.stringify({ 
          error: 'Formular nicht verbunden. Bitte zuerst Webhook einrichten.' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Calculate date range
      const daysBack = days_back || 30;
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - daysBack);
      const since = sinceDate.toISOString();

      // Fetch responses from Typeform API
      console.log(`Fetching responses since ${since}`);
      const responsesUrl = new URL(`${TYPEFORM_API_URL}/forms/${form_id}/responses`);
      responsesUrl.searchParams.set('since', since);
      responsesUrl.searchParams.set('page_size', '1000'); // Max per request

      const responsesResponse = await fetch(responsesUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${connection.access_token}`,
        },
      });

      if (!responsesResponse.ok) {
        const errorText = await responsesResponse.text();
        console.error('Failed to fetch responses:', errorText);
        return new Response(JSON.stringify({ 
          error: 'Fehler beim Laden der Antworten' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const responsesData = await responsesResponse.json();
      const responses = responsesData.items || [];

      console.log(`Found ${responses.length} responses to import`);
      console.log(`First response structure:`, JSON.stringify(responses[0], null, 2));

      // Process each response (same logic as webhook)
      let importedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const response of responses) {
        try {
          console.log(`\n=== Processing response ${response.response_id} ===`);
          // Check if already processed (use maybeSingle to avoid error on no match)
          const { data: existing, error: existError } = await supabase
            .from('typeform_events_log')
            .select('response_id')
            .eq('response_id', response.response_id)
            .maybeSingle();

          if (existing && !existError) {
            console.log(`Skipping ${response.response_id}: Already processed`);
            skippedCount++;
            continue; // Already processed
          }

          console.log(`Not a duplicate, proceeding with import...`);

          // Extract answers into key-value map with human-readable labels
          const answers: Record<string, any> = {};
          const answersWithLabels: Record<string, any> = {};
          
          for (const answer of response.answers || []) {
            const field = answer.field;
            const fieldId = field.id;
            let value = answer[answer.type]; // email, text, choice, etc.
            
            // Extract label from choice/multiple_choice objects
            if (value && typeof value === 'object' && value.label) {
              value = value.label;
            }
            
            answers[fieldId] = value;
            answersWithLabels[field.title || fieldId] = value;
          }

          // Filter survey answers based on selected_questions (if provided)
          // selected_questions format: { "field_id": "Short Label" } or { "field_id": "field_id" }
          let filteredSurveyAnswers: Record<string, any> = {};
          
          if (selected_questions && Object.keys(selected_questions).length > 0) {
            console.log(`Filtering survey answers based on ${Object.keys(selected_questions).length} selected questions`);
            
            for (const [fieldId, label] of Object.entries(selected_questions)) {
              if (answers[fieldId] !== undefined) {
                // Use custom label or fallback to field title
                const field = formMapping.fields?.find((f: any) => f.id === fieldId);
                const questionLabel = (label && label !== fieldId) ? label : (field?.title || fieldId);
                filteredSurveyAnswers[questionLabel] = answers[fieldId];
              }
            }
            console.log(`Filtered survey answers:`, filteredSurveyAnswers);
          }

          console.log(`Extracted ${Object.keys(answers).length} answers`);
          console.log(`Form fields:`, formMapping.fields);

          // Extract email (required)
          const emailField = formMapping.fields?.find((f: any) => f.type === 'email');
          console.log(`Email field found:`, emailField);
          
          const email = emailField ? answers[emailField.id] : null;
          console.log(`Extracted email:`, email);

          if (!email) {
            console.log(`❌ Skipping response ${response.response_id}: No email found`);
            errorCount++;
            continue;
          }

          // Extract phone (optional)
          const phoneField = formMapping.fields?.find((f: any) => f.type === 'phone_number');
          const phone = phoneField ? answers[phoneField.id] : null;
          console.log(`Extracted phone:`, phone);

          // Extract name (optional, try multiple field types)
          const nameField = formMapping.fields?.find((f: any) => 
            f.type === 'short_text' && 
            (f.title?.toLowerCase().includes('name') || f.title?.toLowerCase().includes('vorname'))
          );
          const name = nameField ? answers[nameField.id] : null;
          console.log(`Extracted name:`, name);

          // Check qualification
          // Default: if no qualification configured, treat as unqualified survey
          let isQualified = false;
          
          if (formMapping.qualification_field_id && formMapping.qualifying_answers) {
            const qualAnswer = answers[formMapping.qualification_field_id];
            isQualified = formMapping.qualifying_answers.includes(qualAnswer);
            console.log(`Qualification check: ${qualAnswer} → ${isQualified ? 'QUALIFIED' : 'NOT QUALIFIED'}`);
          } else {
            console.log(`No qualification configured → treating as unqualified survey`);
          }

          console.log(`Creating lead for email: ${email}`);

          // Create/update lead with all extracted data
          // Only include typeform_answers in metadata if survey questions were selected
          const leadMetadata: Record<string, any> = {
            typeform_response_id: response.response_id,
            typeform_form_id: form_id,
            typeform_submitted_at: response.submitted_at,
            imported_at: new Date().toISOString(),
          };

          // Add filtered survey answers only if questions were selected
          if (selected_questions && Object.keys(filteredSurveyAnswers).length > 0) {
            leadMetadata.typeform_answers = filteredSurveyAnswers;
          }

          const { data: lead, error: leadError } = await supabase
            .from('leads')
            .upsert({
              user_id: userId,
              primary_email: email,
              primary_phone: phone,
              name: name,
              emails: [email],
              phones: phone ? [phone] : [],
              source: 'typeform',
              funnel_id: formMapping.funnel_id,
              lead_source: 'typeform',
              lead_status: 'new',
              metadata: leadMetadata,
              created_at: response.submitted_at || new Date().toISOString(),
            }, {
              onConflict: 'primary_email',
              ignoreDuplicates: false,
            })
            .select()
            .single();

          if (leadError || !lead) {
            console.error('❌ Lead creation failed:', leadError);
            errorCount++;
            continue;
          }

          console.log(`✅ Lead created/updated: ${lead.id}`);

          // Create event
          const eventType = isQualified ? 'surveyQuali' : 'survey';
          console.log(`Creating event: ${eventType}`);
          
          const { error: eventError } = await supabase
            .from('events')
            .insert({
              user_id: userId,
              lead_id: lead.id,
              funnel_id: formMapping.funnel_id,
              event_type: eventType,
              event_date: response.submitted_at || new Date().toISOString(),
              event_source: 'typeform',
            });

          if (eventError) {
            console.error('❌ Event creation failed:', eventError);
            errorCount++;
            continue;
          }

          console.log(`✅ Event created: ${eventType}`);

          // Log to typeform_events_log
          const { error: logError } = await supabase
            .from('typeform_events_log')
            .insert({
              user_id: userId,
              form_id: form_id,
              response_id: response.response_id,
              lead_id: lead.id,
              event_id: null, // Could fetch event.id if needed
              event_type: eventType,
              is_qualified: isQualified,
              raw_payload: response,
              processed_at: new Date().toISOString(),
            });

          if (logError) {
            console.error('❌ Log creation failed:', logError);
          } else {
            console.log(`✅ Logged to typeform_events_log`);
          }

          importedCount++;
          console.log(`✅ Response ${response.response_id} successfully imported!\n`);
        } catch (err) {
          console.error(`❌ Error processing response ${response.response_id}:`, err);
          errorCount++;
        }
      }

      console.log(`\n=== IMPORT SUMMARY ===`);
      console.log(`Total responses: ${responses.length}`);
      console.log(`✅ Imported: ${importedCount}`);
      console.log(`⏭️ Skipped (duplicates): ${skippedCount}`);
      console.log(`❌ Errors: ${errorCount}`);

      return new Response(JSON.stringify({ 
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: responses.length,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== GET FORM FIELDS ====================
    if (action === 'get_form_fields') {
      const { form_id } = body;

      if (!form_id) {
        return new Response(JSON.stringify({ 
          error: 'Formular-ID erforderlich' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      console.log(`Fetching fields for form: ${form_id}`);

      // Get Typeform access token
      const { data: connection, error: connError } = await supabase
        .from('typeform_connections')
        .select('access_token')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (connError || !connection) {
        return new Response(JSON.stringify({ 
          error: 'Keine aktive Typeform-Verbindung' 
        }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get form mapping to retrieve stored fields
      const { data: formMapping, error: mappingError } = await supabase
        .from('typeform_forms')
        .select('fields, form_title')
        .eq('user_id', userId)
        .eq('form_id', form_id)
        .single();

      if (mappingError || !formMapping) {
        return new Response(JSON.stringify({ 
          error: 'Formular nicht verbunden' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Filter out system fields (email, phone_number) - only return question fields
      const questionFields = (formMapping.fields || []).filter((f: any) => 
        !['email', 'phone_number'].includes(f.type)
      );

      console.log(`Found ${questionFields.length} question fields`);

      return new Response(JSON.stringify({ 
        success: true,
        form_title: formMapping.form_title,
        fields: questionFields,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Invalid action
    return new Response(JSON.stringify({ 
      error: 'Ungültige Aktion. Verwenden Sie "fetch_forms", "setup_webhook", "import_responses" oder "get_form_fields"' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Error in typeform-sync:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
