// Calendly OAuth Callback Handler
// Exchanges authorization code for tokens, saves connection, auto-creates webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CALENDLY_CLIENT_ID = Deno.env.get('CALENDLY_CLIENT_ID')!;
const CALENDLY_CLIENT_SECRET = Deno.env.get('CALENDLY_CLIENT_SECRET')!;
const CALENDLY_TOKEN_URL = 'https://auth.calendly.com/oauth/token';
const CALENDLY_API_URL = 'https://api.calendly.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state'); // Contains user_id

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const appUrl = Deno.env.get('CLARITY_APP_URL') || '';
    const redirectUri = `${supabaseUrl}/functions/v1/calendly-oauth`;

    if (error) {
      console.error('Calendly OAuth error:', error);
      return redirectWithError(appUrl, error);
    }

    if (!code) throw new Error('Missing authorization code');
    if (!state) throw new Error('Missing state parameter (user_id)');

    const userId = state;

    // Step 1: Exchange code for access token
    console.log('Exchanging code for access token...');
    const tokenRes = await fetch(CALENDLY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CALENDLY_CLIENT_ID,
        client_secret: CALENDLY_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Token exchange failed: ${errText}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in;
    const tokenExpiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    // Step 2: Fetch Calendly user + organization info
    console.log('Fetching Calendly account info...');
    const meRes = await fetch(`${CALENDLY_API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!meRes.ok) throw new Error('Failed to fetch Calendly account info');

    const meData = await meRes.json();
    const userUri = meData.resource.uri;
    const orgUri = meData.resource.current_organization;
    const accountEmail = meData.resource.email;
    const accountName = meData.resource.name;

    console.log('Calendly account:', accountEmail, 'org:', orgUri);

    // Step 3: Save connection to Supabase
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: dbError } = await supabase
      .from('calendly_connections')
      .upsert({
        user_id: userId,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        account_uri: userUri,
        organization_uri: orgUri,
        account_email: accountEmail,
        account_name: accountName,
        connected_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: 'user_id' });

    if (dbError) throw new Error(`Database error: ${dbError.message}`);

    // Step 4: Auto-create Calendly webhook subscription
    console.log('Creating Calendly webhook subscription...');
    const webhookUrl = `${supabaseUrl}/functions/v1/calendly-webhook`;

    // First delete any existing webhook for this user to avoid duplicates
    const existingConn = await supabase
      .from('calendly_connections')
      .select('webhook_uri')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingConn.data?.webhook_uri) {
      await deleteCalendlyWebhook(existingConn.data.webhook_uri, accessToken);
    }

    const webhookRes = await fetch(`${CALENDLY_API_URL}/webhook_subscriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        events: ['invitee.created', 'invitee.canceled'],
        organization: orgUri,
        user: userUri,
        scope: 'user',
        signing_key: Deno.env.get('CALENDLY_WEBHOOK_SIGNING_KEY') || undefined,
      }),
    });

    let webhookUri: string | null = null;
    if (webhookRes.ok) {
      const webhookData = await webhookRes.json();
      webhookUri = webhookData.resource?.uri || null;
      console.log('✅ Webhook created:', webhookUri);
    } else {
      const webhookErr = await webhookRes.text();
      console.error('⚠️ Webhook creation failed (non-fatal):', webhookErr);
    }

    // Step 5: Save webhook URI back to connection
    if (webhookUri) {
      await supabase
        .from('calendly_connections')
        .update({ webhook_uri: webhookUri })
        .eq('user_id', userId);
    }

    console.log('✅ Calendly connection saved successfully');

    // Step 6: Redirect to success page
    if (appUrl) {
      const successUrl = new URL(`${appUrl}/oauth-success.html`);
      successUrl.searchParams.set('type', 'calendly');
      successUrl.searchParams.set('email', accountEmail);
      return Response.redirect(successUrl.toString(), 302);
    }

    return new Response(
      `<!DOCTYPE html><html><head><title>Calendly Verbunden</title></head>
      <body><p>Calendly erfolgreich verbunden! Dieses Fenster kann geschlossen werden.</p>
      <script>
        if (window.opener) window.opener.postMessage({ type: 'CALENDLY_OAUTH_SUCCESS', email: '${accountEmail}' }, '*');
        setTimeout(() => window.close(), 2000);
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );

  } catch (error) {
    console.error('❌ Calendly OAuth error:', error);
    const appUrl = Deno.env.get('CLARITY_APP_URL') || '';
    return redirectWithError(appUrl, error.message);
  }
});

async function deleteCalendlyWebhook(webhookUri: string, accessToken: string) {
  try {
    await fetch(webhookUri, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Non-fatal
  }
}

function redirectWithError(appUrl: string, error: string) {
  const errorMsg = encodeURIComponent(error);
  if (appUrl) {
    return Response.redirect(`${appUrl}/oauth-success.html?type=calendly&error=${errorMsg}`, 302);
  }
  return new Response(
    `<!DOCTYPE html><html><head><title>Fehler</title></head>
    <body>
      <h1>Verbindung fehlgeschlagen</h1><p>${error}</p>
      <script>
        if (window.opener) window.opener.postMessage({ type: 'CALENDLY_OAUTH_ERROR', error: '${error}' }, '*');
        setTimeout(() => window.close(), 3000);
      </script>
    </body></html>`,
    { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
