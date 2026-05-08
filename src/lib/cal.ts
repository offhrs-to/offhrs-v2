const CAL_API_BASE = 'https://api.cal.com/v2'

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
  const clientId = process.env.CAL_OAUTH_CLIENT_ID
  const apiKey = process.env.CAL_API_KEY

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
    throw new Error(`Cal.com provisioning failed (${res.status}): ${body}`)
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
  const clientId = process.env.CAL_OAUTH_CLIENT_ID
  const apiKey = process.env.CAL_API_KEY

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

