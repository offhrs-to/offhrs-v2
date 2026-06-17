const ADMIN_BASIC_STORAGE_KEY = 'offhrs_admin_basic'

/** Persist Basic auth for admin API calls across /admin/* pages (same browser tab). */
export function storeAdminBasicAuth(username: string, password: string): void {
  if (typeof sessionStorage === 'undefined') return
  const encoded =
    typeof btoa !== 'undefined'
      ? btoa(`${username}:${password}`)
      : Buffer.from(`${username}:${password}`).toString('base64')
  sessionStorage.setItem(ADMIN_BASIC_STORAGE_KEY, encoded)
}

export function clearAdminBasicAuth(): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(ADMIN_BASIC_STORAGE_KEY)
}

export function getAdminFetchHeaders(json = true): HeadersInit {
  const headers: Record<string, string> = {}
  if (json) headers['Content-Type'] = 'application/json'
  if (typeof sessionStorage !== 'undefined') {
    const basic = sessionStorage.getItem(ADMIN_BASIC_STORAGE_KEY)
    if (basic) headers['Authorization'] = `Basic ${basic}`
  }
  return headers
}

export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers)
  const defaults = getAdminFetchHeaders(false) as Record<string, string>
  for (const [key, value] of Object.entries(defaults)) {
    if (!headers.has(key)) headers.set(key, value)
  }
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  })
}
