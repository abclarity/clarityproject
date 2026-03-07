#!/bin/bash

# ============================================
# Facebook Ads Integration - Deployment Script
# ============================================

set -e  # Exit on error

echo "🚀 Facebook Ads Integration Deployment"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ============================================
# 1. Check Prerequisites
# ============================================

echo "📋 Checking prerequisites..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${RED}❌ Supabase CLI not found${NC}"
    echo ""
    echo "Please install Supabase CLI first:"
    echo "  - macOS: brew install supabase/tap/supabase"
    echo "  - Or: npm install -g supabase"
    echo "  - Or download: https://github.com/supabase/cli/releases"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"

# ============================================
# 2. Check if logged in
# ============================================

echo ""
echo "🔐 Checking Supabase login status..."

if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase${NC}"
    echo ""
    echo "Please login first:"
    supabase login
fi

echo -e "${GREEN}✅ Logged in to Supabase${NC}"

# ============================================
# 3. Link Project
# ============================================

echo ""
echo "🔗 Checking project link..."

if [ ! -f ".supabase/config.toml" ]; then
    echo -e "${YELLOW}⚠️  Project not linked${NC}"
    echo ""
    read -p "Enter your Supabase Project Reference ID: " PROJECT_REF
    
    supabase link --project-ref "$PROJECT_REF"
    echo -e "${GREEN}✅ Project linked${NC}"
else
    echo -e "${GREEN}✅ Project already linked${NC}"
fi

# ============================================
# 4. Get Facebook App Credentials
# ============================================

echo ""
echo "📘 Facebook App Configuration"
echo "========================================"
echo ""
echo "You need to create a Facebook App first:"
echo "  1. Go to https://developers.facebook.com/apps"
echo "  2. Create a Business app"
echo "  3. Add Marketing API product"
echo "  4. Get App ID and App Secret"
echo ""

read -p "Enter your Facebook App ID: " FB_APP_ID
read -sp "Enter your Facebook App Secret: " FB_APP_SECRET
echo ""

# Get project ref from config
PROJECT_REF=$(grep 'project_id' .supabase/config.toml | cut -d'"' -f2)
FB_REDIRECT_URI="https://${PROJECT_REF}.supabase.co/functions/v1/facebook-oauth"

echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Add this OAuth Redirect URI to your Facebook App:${NC}"
echo "   $FB_REDIRECT_URI"
echo ""
read -p "Press Enter when you've added the redirect URI to Facebook App Settings..."

# ============================================
# 5. Set Environment Variables
# ============================================

echo ""
echo "🔧 Setting environment variables..."

supabase secrets set FB_APP_ID="$FB_APP_ID"
supabase secrets set FB_APP_SECRET="$FB_APP_SECRET"
supabase secrets set FB_REDIRECT_URI="$FB_REDIRECT_URI"

echo -e "${GREEN}✅ Environment variables set${NC}"

# ============================================
# 6. Run Database Migration
# ============================================

echo ""
echo "🗄️  Running database migration..."

if supabase db push; then
    echo -e "${GREEN}✅ Database migration successful${NC}"
else
    echo -e "${RED}❌ Database migration failed${NC}"
    echo ""
    echo "Alternative: Run migration manually in Supabase Dashboard:"
    echo "  1. Go to SQL Editor"
    echo "  2. Open: supabase/migrations/20260118_meta_ads_integration.sql"
    echo "  3. Copy & paste the entire file"
    echo "  4. Click Run"
    echo ""
    read -p "Press Enter after running migration manually..."
fi

# ============================================
# 7. Deploy Edge Functions
# ============================================

echo ""
echo "⚡ Deploying Edge Functions..."

echo ""
echo "Deploying facebook-oauth..."
if supabase functions deploy facebook-oauth --no-verify-jwt; then
    echo -e "${GREEN}✅ facebook-oauth deployed${NC}"
else
    echo -e "${RED}❌ facebook-oauth deployment failed${NC}"
    exit 1
fi

echo ""
echo "Deploying facebook-sync-accounts..."
if supabase functions deploy facebook-sync-accounts; then
    echo -e "${GREEN}✅ facebook-sync-accounts deployed${NC}"
else
    echo -e "${RED}❌ facebook-sync-accounts deployment failed${NC}"
    exit 1
fi

echo ""
echo "Deploying facebook-sync-insights..."
if supabase functions deploy facebook-sync-insights; then
    echo -e "${GREEN}✅ facebook-sync-insights deployed${NC}"
else
    echo -e "${RED}❌ facebook-sync-insights deployment failed${NC}"
    exit 1
fi

# ============================================
# 8. Verify Deployment
# ============================================

echo ""
echo "🔍 Verifying deployment..."

supabase functions list

# ============================================
# 9. Success!
# ============================================

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Open your app: http://localhost:5000"
echo "2. Login to your account"
echo "3. Sidebar → API Settings"
echo "4. Click 'Mit Facebook verbinden'"
echo "5. Authorize the app"
echo "6. Sync your ad accounts"
echo "7. Go to Datenpool → Traffic Sources → Facebook Ads"
echo ""
echo "📖 Full documentation: FACEBOOK_ADS_DEPLOYMENT.md"
echo ""
echo -e "${GREEN}Happy tracking! 🚀${NC}"
echo ""
