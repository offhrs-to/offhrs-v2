const CAL_API_BASE = 'https://api.cal.com/v2'

function calEnv(name: 'CAL_OAUTH_CLIENT_ID' | 'CAL_API_KEY'): string {
  return (process.env[name] ?? '').trim()
}

/** Maps Cal API failures to operator-friendly copy (avoid dumping raw JSON to end users). */
function formatCalProvisioningFailure(status: number, body: string): string {
  const lower = body.toLowerCase()
  const oauthClientMissing =
    status === 401 && lower.includes('not found') && lower.includes('client')

  if (oauthClientMissing) {
    return (
      'Cal.com could not find your OAuth client. Use the same Cal.com organization for both values: set CAL_OAUTH_CLIENT_ID ' +
      '(and NEXT_PUBLIC_CAL_OAUTH_CLIENT_ID to the same id) to an OAuth client from Platform → OAuth clients, and set CAL_API_KEY ' +
      'to an API key from that same team. If the client was deleted, create a new OAuth client and update both env vars.'
    )
  }
  if (status === 401 || status === 403) {
    return 'Cal.com rejected the request (unauthorized). Confirm CAL_API_KEY is valid and has access to manage OAuth clients for your team.'
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
  const apiKey = calEnv('CAL_API_KEY')

  if (!clientId || !apiKey) throw new Error('Cal.com credentials not configured')

  const res = await fetch(`${CAL_API_BASE}/oauth-clients/${clientId}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cal-secret-key': apiKey,
    },
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
  const apiKey = calEnv('CAL_API_KEY')

  if (!clientId || !apiKey) throw new Error('Cal.com credentials not configured')

  const res = await fetch(`${CAL_API_BASE}/oauth-clients/${clientId}/users/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cal-secret-key': apiKey,
    },
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

