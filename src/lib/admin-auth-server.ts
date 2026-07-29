import { verifyAdminCookie, getAdminCookieName } from '@/lib/admin-auth'
import { cookies } from 'next/headers'

/** Require a valid admin session cookie (server actions / RSC). */
export async function requireAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  const session = cookieStore.get(getAdminCookieName())?.value
  const cookieHeader = session ? `${getAdminCookieName()}=${session}` : null

  if (!verifyAdminCookie(cookieHeader)) {
    throw new Error('Unauthorized')
  }
}
