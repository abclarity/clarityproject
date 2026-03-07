# Supabase Edge Functions Configuration

This directory contains Deno-based Edge Functions for the Clarity app.

## Functions

### facebook-oauth
Handles OAuth 2.0 code exchange for Facebook connection.

**Environment Variables:**
- `FB_APP_ID` - Facebook App ID
- `FB_APP_SECRET` - Facebook App Secret  
- `FB_REDIRECT_URI` - OAuth redirect URI (e.g., https://your-project.supabase.co/functions/v1/facebook-oauth)

### facebook-sync-accounts
Syncs Facebook Ad Accounts for authenticated users.

**No additional env vars needed** (uses stored access token)

### facebook-sync-insights
Syncs campaign-level insights from Facebook Marketing API.

**Request Body:**
```json
{
  "days_back": 7,
  "ad_account_id": "act_123456" // optional, syncs all if omitted
}
```

## Deployment

```bash
# Deploy all functions
supabase functions deploy facebook-oauth
supabase functions deploy facebook-sync-accounts
supabase functions deploy facebook-sync-insights

# Set environment variables
supabase secrets set FB_APP_ID=your_app_id
supabase secrets set FB_APP_SECRET=your_app_secret
supabase secrets set FB_REDIRECT_URI=https://your-project.supabase.co/functions/v1/facebook-oauth
```

## Local Development

```bash
# Start all functions locally
supabase functions serve

# Test specific function
curl -X POST http://localhost:54321/functions/v1/facebook-sync-insights \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"days_back": 2}'
```

## Facebook App Setup

1. Create Facebook App at https://developers.facebook.com
2. Add "Marketing API" product
3. Configure OAuth redirect URL in app settings
4. Request permissions: `ads_read`, `ads_management`, `business_management`
5. Submit app for review (required for production)
