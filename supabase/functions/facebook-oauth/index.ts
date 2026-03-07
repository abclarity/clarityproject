// Supabase Edge Function: Facebook OAuth Handler
// Handles OAuth code exchange and token storage

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const FB_APP_ID = Deno.env.get("FB_APP_ID")!;
    const FB_APP_SECRET = Deno.env.get("FB_APP_SECRET")!;
    const FB_REDIRECT_URI = Deno.env.get("FB_REDIRECT_URI")!;

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const error = url.searchParams.get("error");
    const authHeader = req.headers.get('Authorization');

    // If error from Facebook
    if (error) {
      return new Response(
        JSON.stringify({ error: 'OAuth error', details: error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: If no code, redirect to Facebook OAuth
    if (!code) {
      const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?` +
        `client_id=${FB_APP_ID}` +
        `&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}` +
        `&state=${state || 'fb-auth'}` +
        `&scope=ads_read,ads_management,business_management`;

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Exchange code for access token
    const tokenResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `client_id=${FB_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(FB_REDIRECT_URI)}` +
      `&client_secret=${FB_APP_SECRET}` +
      `&code=${code}`
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, expires_in } = tokenData;

    // Step 3: Exchange for long-lived token (60 days)
    const longLivedResponse = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      `grant_type=fb_exchange_token` +
      `&client_id=${FB_APP_ID}` +
      `&client_secret=${FB_APP_SECRET}` +
      `&fb_exchange_token=${access_token}`
    );

    if (!longLivedResponse.ok) {
      const error = await longLivedResponse.text();
      throw new Error(`Long-lived token exchange failed: ${error}`);
    }

    const longLivedData = await longLivedResponse.json();
    const longLivedToken = longLivedData.access_token;
    const longLivedExpires = longLivedData.expires_in || 5184000; // ~60 days

    // Step 4: Get Facebook user info
    const userResponse = await fetch(
      `https://graph.facebook.com/v19.0/me?access_token=${longLivedToken}`
    );

    if (!userResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userData = await userResponse.json();
    const fbUserId = userData.id;

    // Step 5: Get Clarity user ID from state parameter
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract user_id from state (format: clarity_oauth_{timestamp}_{user_id})
    let userId = null;
    
    console.log('State received:', state);
    
    if (state && state.includes('_')) {
      const parts = state.split('_');
      console.log('State parts:', parts);
      if (parts.length >= 4) { // clarity_oauth_timestamp_userid
        userId = parts[3]; // Fourth part is user_id
      }
    }

    console.log('Extracted userId:', userId);

    // If no user_id found, we cannot proceed - return error HTML
    if (!userId) {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Error</title>
            <meta charset="UTF-8">
          </head>
          <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h2>❌ Fehler</h2>
            <p>User-ID konnte nicht ermittelt werden.</p>
            <p style="color: #666;">State: ${state || 'none'}</p>
            <button onclick="window.close()" style="margin-top: 20px; padding: 10px 20px;">
              Fenster schließen
            </button>
          </body>
        </html>
      `;
      
      return new Response(html, {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // Step 6: Store connection in database
    const expiresAt = new Date(Date.now() + longLivedExpires * 1000);

    const { data: connection, error: dbError } = await supabase
      .from('facebook_connections')
      .upsert({
        user_id: userId,
        fb_user_id: fbUserId,
        access_token: longLivedToken,
        token_type: 'long_lived',
        expires_at: expiresAt.toISOString(),
        scopes: 'ads_read,ads_management,business_management',
        status: 'active',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,fb_user_id'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to store connection: ${dbError.message}`);
    }

    // Redirect to success page with connection info as query params
    const redirectUrl = `http://127.0.0.1:5501/oauth-success.html?connection_id=${connection.id}&fb_user_id=${fbUserId}`;
    
    return new Response(null, {
      status: 302,
      headers: { 
        ...corsHeaders,
        'Location': redirectUrl
      }
    });

  } catch (error) {
    console.error('OAuth error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
