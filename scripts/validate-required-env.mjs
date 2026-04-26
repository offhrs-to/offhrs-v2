#!/usr/bin/env node

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'ADMIN_API_SECRET',
  'ADMIN_PASSWORD',
]

const missing = required.filter((k) => !process.env[k] || String(process.env[k]).trim() === '')

if (missing.length > 0) {
  console.error('Missing required environment variables:')
  for (const key of missing) console.error(`- ${key}`)
  process.exit(1)
}

console.log('Required environment variables are set.')
