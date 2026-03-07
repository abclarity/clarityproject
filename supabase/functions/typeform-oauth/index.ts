// Typeform OAuth Callback Handler
// Handles OAuth redirect from Typeform, exchanges code for tokens

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TYPEFORM_CLIENT_ID = Deno.env.get('TYPEFORM_CLIENT_ID')!;
const TYPEFORM_CLIENT_SECRET = Deno.env.get('TYPEFORM_CLIENT_SECRET')!;
const TYPEFORM_TOKEN_URL = 'https://api.typeform.com/oauth/token';
const TYPEFORM_API_URL = 'https://api.typeform.com';

interface TypeformTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in?: number;
  scope: string;
}

interface TypeformMeResponse {
  user_id: string;
  email: string;
  alias?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      } 
    });
  }

  try {
    // Parse query parameters
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const state = url.searchParams.get('state'); // Contains user_id

    // Error from Typeform OAuth
    if (error) {
      console.error('Typeform OAuth error:', error);
      return new Response(
        `<!DOCTYPE html>
        <html>
        <head><title>Typeform Verbindung Fehlgeschlagen</title></head>
        <body>
          <h1>Verbindung fehlgeschlagen</h1>
          <p>Fehler: ${error}</p>
          <p><a href="${url.origin}">Zurück zu Clarity</a></p>
          <script>
            setTimeout(() => {
              window.opener?.postMessage({ type: 'TYPEFORM_OAUTH_ERROR', error: '${error}' }, '*');
              window.close();
            }, 2000);
          </script>
        </body>
        </html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    // Missing authorization code
    if (!code) {
      throw new Error('Missing authorization code');
    }

    if (!state) {
      throw new Error('Missing state parameter (user_id)');
    }

    // Extract user_id from state
    const userId = state;
    // App URL from env variable (set in Supabase dashboard)
    const appUrl = Deno.env.get('CLARITY_APP_URL');
    const returnUrl = appUrl ? `${appUrl}/oauth-success.html` : null;

    // Step 1: Exchange code for access token
    console.log('Exchanging code for access token...');
    
    // CRITICAL: redirect_uri must match EXACTLY what was sent in the authorization request
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/typeform-oauth`;
    
    const tokenResponse = await fetch(TYPEFORM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: TYPEFORM_CLIENT_ID,
        client_secret: TYPEFORM_CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Typeform token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokenData: TypeformTokenResponse = await tokenResponse.json();
    console.log('Access token received:', tokenData.access_token.substring(0, 20) + '...');

    // Step 2: Fetch Typeform account info (email)
    console.log('Fetching Typeform account info...');
    const meResponse = await fetch(`${TYPEFORM_API_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!meResponse.ok) {
      console.error('Failed to fetch Typeform account info');
      throw new Error('Failed to fetch account info');
    }

    const meData: TypeformMeResponse = await meResponse.json();
    console.log('Typeform account:', meData.email);

    // Step 3: Calculate token expiration
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Step 4: Save connection to database
    console.log('Saving connection to database for user:', userId);
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

    const { error: dbError } = await supabase
      .from('typeform_connections')
      .upsert({
        user_id: userId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_expires_at: tokenExpiresAt,
        account_id: meData.user_id,
        account_email: meData.email,
        connected_at: new Date().toISOString(),
        is_active: true,
      }, {
        onConflict: 'user_id', // Update if connection already exists
      });

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log('✅ Typeform connection saved successfully');

    // Step 5: Redirect to success page (avoids browser HTML rendering issues)
    if (returnUrl) {
      const successUrl = new URL(returnUrl);
      successUrl.searchParams.set('type', 'typeform');
      successUrl.searchParams.set('email', meData.email);
      return Response.redirect(successUrl.toString(), 302);
    }

    // Fallback if no returnUrl in state
    return new Response(
      `<!DOCTYPE html><html><head><title>Typeform Verbunden</title></head>
      <body><p>Typeform erfolgreich verbunden! Dieses Fenster kann geschlossen werden.</p>
      <script>
        if (window.opener) window.opener.postMessage({ type: 'TYPEFORM_OAUTH_SUCCESS', email: '${meData.email}' }, '*');
        setTimeout(() => window.close(), 2000);
      </script></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );

  } catch (error) {
    console.error('❌ Typeform OAuth error:', error);
    
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head><title>Fehler</title></head>
      <body>
        <h1>Verbindung fehlgeschlagen</h1>
        <p>${error.message}</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'TYPEFORM_OAUTH_ERROR',
              error: '${error.message}'
            }, '*');
          }
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
      </html>`,
      { 
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      }
    );
  }
});
