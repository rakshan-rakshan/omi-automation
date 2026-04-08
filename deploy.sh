#!/bin/bash

# OMI Automation - One-Command Deploy Script
# Run this in PowerShell or Terminal to push to GitHub and deploy to Vercel

set -e

echo "🚀 OMI Automation Deploy Script"
echo "================================"

# Step 1: Navigate to project directory
PROJECT_DIR="$HOME/Projects/omi-automation"
if [ ! -d "$PROJECT_DIR" ]; then
  echo "❌ Project directory not found at $PROJECT_DIR"
  echo "Please update PROJECT_DIR variable"
  exit 1
fi

cd "$PROJECT_DIR"

# Step 2: Configure git
echo "📝 Configuring Git..."
git config user.email "rakshan@omi.dev"
git config user.name "Rakshan"

# Step 3: Create GitHub repo (if not exists)
echo "🔗 Setting up GitHub remote..."
git remote add origin https://github.com/rakshan99/omi-automation.git 2>/dev/null || true

# Step 4: Push to GitHub
echo "📤 Pushing to GitHub..."
echo ""
echo "If this fails, you need a GitHub token:"
echo "  1. Go to https://github.com/settings/tokens"
echo "  2. Generate new token (classic) with 'repo' scope"
echo "  3. Copy the token and paste when prompted"
echo ""

git branch -M main
git push -u origin main

echo ""
echo "✅ Code pushed to GitHub!"
echo ""
echo "Next steps:"
echo "1. Go to https://vercel.com/new"
echo "2. Click 'Import Git Repository'"
echo "3. Connect GitHub and select 'omi-automation'"
echo "4. Add environment variables:"
echo "   - SARVAM_API_KEY"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo "5. Click Deploy"
echo ""
echo "Your app will be live in ~2 minutes!"
