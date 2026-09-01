'use client'

import { isSupabaseBrowserConfigured } from '@/lib/supabase/browser'

/** Shown on preview deploys when NEXT_PUBLIC_SUPABASE_* were not set at build time. */
export function SupabaseConfigBanner() {
  if (isSupabaseBrowserConfigured()) return null

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950">
      Preview misconfiguration: add <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
      <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to Vercel{' '}
      <strong>Preview</strong> env, then redeploy.
    </div>
  )
}
