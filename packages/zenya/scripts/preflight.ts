#!/usr/bin/env tsx
// Preflight check — run before deploying Zenya on the VPS
// Validates env vars and external service connectivity
// Usage: npx tsx scripts/preflight.ts

import 'dotenv/config';

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
}

const results: CheckResult[] = [];

function check(name: string, ok: boolean, message: string): void {
  results.push({ name, ok, message });
  const icon = ok ? '✅' : '❌';
  console.log(`${icon} ${name}: ${message}`);
}

// ---------------------------------------------------------------------------
// 1. Required env vars
// ---------------------------------------------------------------------------
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'ZENYA_MASTER_KEY',
  'OPENAI_API_KEY',
  'CHATWOOT_API_TOKEN',
  'CHATWOOT_BASE_URL',
];

for (const key of required) {
  const val = process.env[key];
  check(`env:${key}`, Boolean(val), val ? 'set' : 'MISSING — required');
}

const optional = ['ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'GOOGLE_CLIENT_ID'];
for (const key of optional) {
  const val = process.env[key];
  const icon = val ? '✅' : '⚠️';
  console.log(`${icon} env:${key} (optional): ${val ? 'set' : 'not set'}`);
}

// ---------------------------------------------------------------------------
// 2. Supabase connectivity
// ---------------------------------------------------------------------------
console.log('\n--- Connectivity ---');

try {
  const url = `${process.env['SUPABASE_URL']}/rest/v1/zenya_tenants?select=id&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: process.env['SUPABASE_SERVICE_KEY'] ?? '',
      Authorization: `Bearer ${process.env['SUPABASE_SERVICE_KEY'] ?? ''}`,
    },
    signal: AbortSignal.timeout(5000),
  });
  check('supabase', res.ok, res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} — check URL/key`);
} catch (err) {
  check('supabase', false, `Connection failed: ${String(err)}`);
}

// ---------------------------------------------------------------------------
// 3. OpenAI connectivity
// ---------------------------------------------------------------------------
try {
  const res = await fetch('https://api.openai.com/v1/models?limit=1', {
    headers: { Authorization: `Bearer ${process.env['OPENAI_API_KEY'] ?? ''}` },
    signal: AbortSignal.timeout(5000),
  });
  check('openai', res.ok, res.ok ? 'API key valid' : `HTTP ${res.status} — check API key`);
} catch (err) {
  check('openai', false, `Connection failed: ${String(err)}`);
}

// ---------------------------------------------------------------------------
// 4. Chatwoot connectivity
// ---------------------------------------------------------------------------
try {
  const baseUrl = process.env['CHATWOOT_BASE_URL'] ?? '';
  const res = await fetch(`${baseUrl}/auth/sign_in`, {
    method: 'HEAD',
    signal: AbortSignal.timeout(5000),
  });
  // HEAD on sign_in returns 405 (method not allowed) if reachable
  const reachable = res.status < 500;
  check('chatwoot', reachable, reachable ? `Reachable (${res.status})` : `HTTP ${res.status}`);
} catch (err) {
  check('chatwoot', false, `Connection failed: ${String(err)}`);
}

// ---------------------------------------------------------------------------
// 5. ElevenLabs (optional)
// ---------------------------------------------------------------------------
if (process.env['ELEVENLABS_API_KEY']) {
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': process.env['ELEVENLABS_API_KEY'] },
      signal: AbortSignal.timeout(5000),
    });
    check('elevenlabs', res.ok, res.ok ? 'API key valid' : `HTTP ${res.status}`);
  } catch (err) {
    check('elevenlabs', false, `Connection failed: ${String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\n--- Summary: ${results.length - failed.length}/${results.length} checks passed ---`);

if (failed.length > 0) {
  console.error('\nFailing checks:');
  for (const f of failed) {
    console.error(`  ❌ ${f.name}: ${f.message}`);
  }
  process.exit(1);
} else {
  console.log('\n✅ All checks passed — Zenya is ready to deploy.');
}
