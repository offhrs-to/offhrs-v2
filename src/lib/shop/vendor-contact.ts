import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = NonNullable<ReturnType<typeof createAdminClient>>

/** Resolve the seller's login email for buyer contact (pickup / order questions). */
export async function vendorContactEmailForUserId(
  admin: Admin,
  userId: string | null | undefined
): Promise<string | null> {
  if (!userId) return null
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    if (error || !data.user?.email) return null
    const email = data.user.email.trim()
    return email || null
  } catch {
    return null
  }
}
