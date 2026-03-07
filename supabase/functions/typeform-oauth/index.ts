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
        { headers: { 'Content-Type': 'text/html' } }
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

    // Step 5: Return success page with auto-close
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>Typeform Verbunden</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 3rem;
            border-radius: 1rem;
            backdrop-filter: blur(10px);
          }
          .checkmark {
            font-size: 4rem;
            margin-bottom: 1rem;
            animation: scale 0.5s ease-in-out;
          }
          @keyframes scale {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.2); }
          }
          h1 { margin: 0 0 0.5rem 0; font-size: 1.5rem; }
          p { margin: 0; opacity: 0.9; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Typeform erfolgreich verbunden!</h1>
          <p>Konto: ${meData.email}</p>
          <p style="margin-top: 1rem; font-size: 0.9rem;">Dieses Fenster schließt sich automatisch...</p>
        </div>
        <script>
          // Notify parent window
          if (window.opener) {
            window.opener.postMessage({
              type: 'TYPEFORM_OAUTH_SUCCESS',
              email: '${meData.email}'
            }, '*');
          }
          // Auto-close after 2 seconds
          setTimeout(() => {
            window.close();
          }, 2000);
        </script>
      </body>
      </html>`,
      { headers: { 'Content-Type': 'text/html' } }
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
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
});
