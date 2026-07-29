/**
 * Admin API calls rely solely on the httpOnly `admin_session` cookie set by
 * POST /api/admin/login. `credentials: 'include'` ensures the browser sends
 * that cookie automatically — no client-readable credential caching needed.
 */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  })
}
