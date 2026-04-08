#!/usr/bin/env node

/**
 * OMI Automation - Git Push Utility
 * Usage: node push.js <github_token>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GITHUB_TOKEN = process.argv[2];
const REPO_URL = 'https://github.com/rakshan99/omi-automation.git';
const PROJECT_DIR = '/home/claude/omi-automation';

if (!GITHUB_TOKEN) {
  console.error('❌ GitHub token required');
  console.error('Usage: node push.js <token>');
  console.error('');
  console.error('Get token at: https://github.com/settings/tokens');
  process.exit(1);
}

console.log('🚀 OMI Automation - Git Push');
console.log('============================');

try {
  process.chdir(PROJECT_DIR);

  // Configure git with token
  console.log('🔐 Configuring authentication...');
  const authUrl = REPO_URL.replace(
    'https://',
    `https://${GITHUB_TOKEN}@`
  );

  // Push to GitHub
  console.log('📤 Pushing to GitHub...');
  execSync(`git push -u origin main`, {
    stdio: 'inherit',
    env: {
      ...process.env,
      GIT_CREDENTIAL_CACHE_DAEMON_PID: '',
    },
  });

  console.log('');
  console.log('✅ Successfully pushed to GitHub!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Go to: https://vercel.com/new');
  console.log('2. Click "Import Git Repository"');
  console.log('3. Select "omi-automation" repository');
  console.log('4. Add environment variables:');
  console.log('   - SARVAM_API_KEY');
  console.log('   - SUPABASE_URL');
  console.log('   - SUPABASE_ANON_KEY');
  console.log('5. Click "Deploy"');
  console.log('');
  console.log('Your app will be live in ~2 minutes! 🎉');
} catch (error) {
  console.error('❌ Push failed:', error.message);
  process.exit(1);
}
