#!/usr/bin/env node
/**
 * Generate Apple Sign In client_secret JWT for Supabase.
 * Supabase expects this JWT in the "Secret Key" field, NOT the raw .p8 file.
 *
 * Usage:
 *   node scripts/generate-apple-client-secret.js
 *
 * Requires env vars (or .env):
 *   APPLE_TEAM_ID      - 10-char Team ID from Apple Developer
 *   APPLE_KEY_ID       - Key ID of the Sign in with Apple key
 *   APPLE_SERVICES_ID  - Services ID (e.g. com.offhrs.app.web)
 *   APPLE_PRIVATE_KEY  - Full contents of the .p8 file (including BEGIN/END lines)
 *
 * Or pass .p8 file path:
 *   APPLE_PRIVATE_KEY_PATH=./AuthKey_XXXXX.p8 node scripts/generate-apple-client-secret.js
 *
 * Output: JWT string to paste into Supabase Dashboard → Auth → Providers → Apple → Secret Key.
 * Note: Apple requires rotating this secret every 6 months (generate a new JWT).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    });
  }
}

loadEnv();

const TEAM_ID = process.env.APPLE_TEAM_ID;
const KEY_ID = process.env.APPLE_KEY_ID;
const SERVICES_ID = process.env.APPLE_SERVICES_ID;
let privateKeyPem = process.env.APPLE_PRIVATE_KEY;

if (process.env.APPLE_PRIVATE_KEY_PATH) {
  const keyPath = path.resolve(process.cwd(), process.env.APPLE_PRIVATE_KEY_PATH);
  if (fs.existsSync(keyPath)) {
    privateKeyPem = fs.readFileSync(keyPath, 'utf8');
  }
}

/** Normalize PEM from env: literal \n, \r\n, and ensure correct line endings */
function normalizePem(pem) {
  if (!pem || typeof pem !== 'string') return pem;
  return pem
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/** Rebuild PEM with proper 64-char line wrapping (OpenSSL can be strict) */
function rebuildPem(pem) {
  const begin = '-----BEGIN PRIVATE KEY-----';
  const end = '-----END PRIVATE KEY-----';
  const match = pem.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
  if (!match) return pem;
  const inner = match[0]
    .replace(begin, '')
    .replace(end, '')
    .replace(/\s/g, '');
  if (!inner) return pem;
  const lines = [];
  for (let i = 0; i < inner.length; i += 64) {
    lines.push(inner.slice(i, i + 64));
  }
  return begin + '\n' + lines.join('\n') + '\n' + end;
}

if (privateKeyPem) privateKeyPem = rebuildPem(normalizePem(privateKeyPem));

if (!TEAM_ID || !KEY_ID || !SERVICES_ID || !privateKeyPem) {
  console.error(`
Apple client secret generator

Supabase expects a JWT in the "Secret Key" field, not the raw .p8 file.
This script generates that JWT.

Set these (in .env.local or environment):

  APPLE_TEAM_ID       = your 10-character Team ID
  APPLE_KEY_ID        = Key ID of your Sign in with Apple key
  APPLE_SERVICES_ID   = e.g. com.offhrs.app.web
  APPLE_PRIVATE_KEY   = full contents of your .p8 file (paste as one string)

  Or: APPLE_PRIVATE_KEY_PATH = path/to/AuthKey_XXXXX.p8

Then run:

  node scripts/generate-apple-client-secret.js

Copy the printed JWT into Supabase: Auth → Providers → Apple → Secret Key.
`);
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const exp = now + 15777000; // ~6 months (Apple max)

const header = { alg: 'ES256', kid: KEY_ID };
const payload = {
  iss: TEAM_ID,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: SERVICES_ID,
};

const headerB64 = base64url(Buffer.from(JSON.stringify(header)));
const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)));
const signingInput = `${headerB64}.${payloadB64}`;

let key;
try {
  key = crypto.createPrivateKey({
    key: privateKeyPem,
    format: 'pem',
    type: 'pkcs8',
  });
} catch (err) {
  console.error('Failed to parse Apple private key. Check that:');
  console.error('  - APPLE_PRIVATE_KEY is the full .p8 contents with -----BEGIN/END PRIVATE KEY-----');
  console.error('  - Newlines are written as \\n in .env (e.g. "-----BEGIN PRIVATE KEY-----\\nMIGT...\\n-----END PRIVATE KEY-----")');
  console.error('  - Or use APPLE_PRIVATE_KEY_PATH=path/to/AuthKey_XXXXX.p8 and point to the actual .p8 file');
  console.error('');
  throw err;
}
// ES256 = ECDSA with SHA-256; JWT expects IEEE P1363 encoding (r||s)
const sig = crypto.sign('sha256', Buffer.from(signingInput), {
  key,
  dsaEncoding: 'ieee-p1363',
});
const sigB64 = base64url(sig);

const jwt = `${signingInput}.${sigB64}`;
console.log(jwt);
