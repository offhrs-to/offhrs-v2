import { verifyAdminBasicAuth, verifyAdminCookie, getAdminCookieName } from '@/app/api/admin/login/route'
import { cookies, headers } from 'next/headers'

/** Require a valid admin session cookie or Basic auth (server actions / RSC). */
export async function requireAdminSession(): Promise<void> {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const session = cookieStore.get(getAdminCookieName())?.value
  const cookieHeader = session ? `${getAdminCookieName()}=${session}` : null
  const authHeader = headerStore.get('authorization')

  if (!verifyAdminCookie(cookieHeader) && !verifyAdminBasicAuth(authHeader)) {
    throw new Error('Unauthorized')
  }
}
