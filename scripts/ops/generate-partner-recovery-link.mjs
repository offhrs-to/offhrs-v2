/**
 * Generate a one-time partner password-recovery link (ops).
 *
 * Usage (from repo root, with production env):
 *   node --env-file=.env.local scripts/ops/generate-partner-recovery-link.mjs hello@offhrs.app
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Opens to /api/partners/auth/confirm → /partners/update-password.
 */
import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/ops/generate-partner-recovery-link.mjs <email>')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://offhrs.app').replace(/\/$/, '')

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

const redirectTo = `${appUrl}/api/partners/auth/confirm?next=${encodeURIComponent('/partners/update-password')}`

const { data, error } = await admin.auth.admin.generateLink({
  type: 'recovery',
  email,
  options: { redirectTo },
})

if (error) {
  console.error('generateLink failed:', error.message)
  process.exit(1)
}

const actionLink = data.properties?.action_link
const hashed = data.properties?.hashed_token

console.log('User id:', data.user?.id ?? '(none)')
console.log('Email:', data.user?.email ?? email)
console.log('Email confirmed:', data.user?.email_confirmed_at ?? '(not confirmed)')
console.log('')
if (actionLink) {
  console.log('Open this recovery link (same browser you will set the password in):')
  console.log(actionLink)
} else if (hashed) {
  console.log(
    `${appUrl}/api/partners/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=recovery&next=${encodeURIComponent('/partners/update-password')}`
  )
} else {
  console.error('No action_link or hashed_token returned')
  process.exit(1)
}
