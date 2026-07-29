import { createAdminClient } from '@/lib/supabase/admin'

export type DailyQuotaResult = {
  allowed: boolean
  count: number
}

/**
 * Persistent daily quota check backed by Supabase (survives serverless
 * instance restarts, unlike the in-memory per-minute rate limiter in
 * src/lib/rate-limit.ts). Fails open (allows the request) if the DB call
 * errors, so a transient DB issue never takes down a booking/quote flow —
 * the per-minute in-memory limiter still applies as a first line of defense.
 */
export async function consumeDailyQuota(bucketKey: string, limit: number): Promise<DailyQuotaResult> {
  const admin = createAdminClient()
  if (!admin) return { allowed: true, count: 0 }

  const day = new Date().toISOString().slice(0, 10)

  try {
    const { data, error } = await admin.rpc('increment_api_usage_counter', {
      p_bucket_key: bucketKey,
      p_day: day,
    })
    if (error || typeof data !== 'number') {
      console.error('consumeDailyQuota RPC failed:', error?.message)
      return { allowed: true, count: 0 }
    }
    return { allowed: data <= limit, count: data }
  } catch (err) {
    console.error('consumeDailyQuota error:', err)
    return { allowed: true, count: 0 }
  }
}
