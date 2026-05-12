const CAL_API_BASE = 'https://api.cal.com/v2'

function calEnv(name: 'CAL_OAUTH_CLIENT_ID' | 'CAL_OAUTH_CLIENT_SECRET'): string {
  return (process.env[name] ?? '').trim()
}

/** Headers for Platform managed-user endpoints (see Cal API v2 → Platform OAuth client credentials). */
function calPlatformAuthHeaders(): Record<string, string> {
  const clientId = calEnv('CAL_OAUTH_CLIENT_ID')
  const clientSecret = calEnv('CAL_OAUTH_CLIENT_SECRET')
  return {
    'Content-Type': 'application/json',
    'x-cal-client-id': clientId,
    'x-cal-secret-key': clientSecret,
  }
}

/** Maps Cal API failures to operator-friendly copy (avoid dumping raw JSON to end users). */
function formatCalProvisioningFailure(status: number, body: string): string {
  const lower = body.toLowerCase()
  const oauthClientMissing =
    status === 401 && lower.includes('not found') && lower.includes('client')

  if (oauthClientMissing) {
    return (
      'Cal.com could not authenticate your OAuth client. In Cal.com open your OAuth client (e.g. Settings → Platform / Developer → OAuth) ' +
      'and copy the Client ID into CAL_OAUTH_CLIENT_ID and NEXT_PUBLIC_CAL_OAUTH_CLIENT_ID (same value). ' +
      'Copy a Client secret into CAL_OAUTH_CLIENT_SECRET — this must be the secret from that OAuth client, not the Developer → API keys value. ' +
      'Redeploy after updating Vercel env vars.'
    )
  }
  if (status === 401 || status === 403) {
    return (
      'Cal.com rejected the request (unauthorized). Confirm CAL_OAUTH_CLIENT_ID and CAL_OAUTH_CLIENT_SECRET match your OAuth client ' +
      '(x-cal-client-id + x-cal-secret-key from the same client). CAL_API_KEY is only used elsewhere (e.g. booking cancel), not for provisioning.'
    )
  }
  if (status >= 500) {
    return 'Cal.com is temporarily unavailable. Try again in a few minutes.'
  }
  return `Cal.com provisioning failed (${status}). Check server logs or Cal.com status.`
}

interface CalTokens {
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
}

interface CalManagedUser {
  id: number
  username: string
  email: string
  accessToken: string
  refreshToken: string
  accessTokenExpiresAt: string
}

export async function provisionCalUser(email: string, name: string): Promise<CalManagedUser> {
  const clientId = calEnv('CAL_OAUTH_CLIENT_ID')
  const clientSecret = calEnv('CAL_OAUTH_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error(
      'Cal.com credentials not configured: set CAL_OAUTH_CLIENT_ID and CAL_OAUTH_CLIENT_SECRET (OAuth client secret from the same client, not Developer API key).'
    )
  }

  const res = await fetch(`${CAL_API_BASE}/oauth-clients/${clientId}/users`, {
    method: 'POST',
    headers: calPlatformAuthHeaders(),
    body: JSON.stringify({ email, name }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[cal] provisionCalUser failed', { status: res.status, clientIdLen: clientId.length })
    throw new Error(formatCalProvisioningFailure(res.status, body))
  }

  const json = await res.json()
  const data = json.data ?? json

  return {
    id: data.user?.id ?? data.id,
    username: data.user?.username ?? data.username,
    email: data.user?.email ?? data.email,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessTokenExpiresAt: data.accessTokenExpiresAt,
  }
}

export async function refreshCalToken(
  refreshToken: string
): Promise<CalTokens> {
  const clientId = calEnv('CAL_OAUTH_CLIENT_ID')
  const clientSecret = calEnv('CAL_OAUTH_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error(
      'Cal.com credentials not configured: set CAL_OAUTH_CLIENT_ID and CAL_OAUTH_CLIENT_SECRET (OAuth client secret).'
    )
  }

  const res = await fetch(`${CAL_API_BASE}/oauth-clients/${clientId}/users/token`, {
    method: 'POST',
    headers: calPlatformAuthHeaders(),
    body: JSON.stringify({ refreshToken }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Cal.com token refresh failed (${res.status}): ${body}`)
  }

  const json = await res.json()
  const data = json.data ?? json

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessTokenExpiresAt: data.accessTokenExpiresAt,
  }
}

export async function createCalEventType(
  accessToken: string,
  params: {
    title: string
    slug: string
    lengthInMinutes: number
    description?: string
    price?: number
    currency?: string
    seatsPerTimeSlot?: number
    locations?: { type: string; address?: string; link?: string }[]
  }
) {
  const res = await fetch(`${CAL_API_BASE}/event-types`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'cal-api-version': '2024-06-14',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Cal.com event type creation failed (${res.status}): ${body}`)
  }

  const json = await res.json()
  return json.data ?? json
}

export async function updateCalEventType(
  accessToken: string,
  eventTypeId: string,
  params: Partial<{
    title: string
    lengthInMinutes: number
    description: string
    price: number
    seatsPerTimeSlot: number
    locations: { type: string; address?: string; link?: string }[]
  }>
) {
  const res = await fetch(`${CAL_API_BASE}/event-types/${eventTypeId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'cal-api-version': '2024-06-14',
    },
    body: JSON.stringify(params),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Cal.com event type update failed (${res.status}): ${body}`)
  }

  const json = await res.json()
  return json.data ?? json
}

export async function deleteCalEventType(accessToken: string, eventTypeId: string) {
  const res = await fetch(`${CAL_API_BASE}/event-types/${eventTypeId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'cal-api-version': '2024-06-14',
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Cal.com event type deletion failed (${res.status}): ${body}`)
  }
}

