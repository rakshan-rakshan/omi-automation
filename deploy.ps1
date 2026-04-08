# OMI Automation - Deploy Script for Windows PowerShell
# Run this ONCE from PowerShell (as Administrator)
# Everything else is automated

$ProjectPath = "C:\Users\Rakshan\Projects\omi-automation"

Write-Host "🚀 OMI Automation - Windows Deploy" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if project exists
if (-not (Test-Path $ProjectPath)) {
    Write-Host "❌ Project not found at: $ProjectPath" -ForegroundColor Red
    Write-Host "Please copy the project to this location first." -ForegroundColor Red
    exit 1
}

Set-Location $ProjectPath

# Configure Git
Write-Host "📝 Configuring Git..." -ForegroundColor Yellow
git config user.email "rakshan@omi.dev"
git config user.name "Rakshan"

# Add remote
Write-Host "🔗 Setting up GitHub remote..." -ForegroundColor Yellow
git remote add origin https://github.com/rakshan99/omi-automation.git 2>$null
git remote set-url origin https://github.com/rakshan99/omi-automation.git

# Rename branch
Write-Host "📋 Renaming branch to main..." -ForegroundColor Yellow
git branch -M main

# Push to GitHub
Write-Host ""
Write-Host "📤 Pushing code to GitHub..." -ForegroundColor Yellow
Write-Host "   (If prompted for credentials, use your GitHub personal access token)" -ForegroundColor Gray
Write-Host ""

try {
    git push -u origin main
    Write-Host ""
    Write-Host "✅ Successfully pushed to GitHub!" -ForegroundColor Green
    Write-Host ""
    Write-Host "NEXT STEPS:" -ForegroundColor Cyan
    Write-Host "1. Open https://vercel.com/new in your browser" -ForegroundColor White
    Write-Host "2. Click 'Import Git Repository'" -ForegroundColor White
    Write-Host "3. Connect GitHub and select 'omi-automation'" -ForegroundColor White
    Write-Host "4. Add these environment variables in Vercel:" -ForegroundColor White
    Write-Host "   • SARVAM_API_KEY = [your Sarvam key]" -ForegroundColor White
    Write-Host "   • SUPABASE_URL = [your Supabase URL]" -ForegroundColor White
    Write-Host "   • SUPABASE_ANON_KEY = [your Supabase key]" -ForegroundColor White
    Write-Host "5. Click 'Deploy'" -ForegroundColor White
    Write-Host ""
    Write-Host "Your app will be live in ~2 minutes! 🎉" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "❌ Push failed. You may need a GitHub token." -ForegroundColor Red
    Write-Host ""
    Write-Host "GET GitHub Token:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://github.com/settings/tokens" -ForegroundColor White
    Write-Host "2. Click 'Generate new token (classic)'" -ForegroundColor White
    Write-Host "3. Select 'repo' scope" -ForegroundColor White
    Write-Host "4. Copy the token" -ForegroundColor White
    Write-Host "5. Run this command and paste the token when prompted:" -ForegroundColor White
    Write-Host "   git push -u origin main" -ForegroundColor White
}
