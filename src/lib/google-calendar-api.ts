/**
 * Google OAuth token exchange + Calendar API (primary calendar).
 */

const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export function googleCalendarScopes(): string {
  return [GOOGLE_CALENDAR_SCOPE, 'openid', 'email'].join(' ')
}

export function googleAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  u.searchParams.set('client_id', params.clientId)
  u.searchParams.set('redirect_uri', params.redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', googleCalendarScopes())
  u.searchParams.set('state', params.state)
  u.searchParams.set('access_type', 'offline')
  u.searchParams.set('prompt', 'consent')
  return u.toString()
}

export async function googleExchangeCode(params: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<{ refresh_token?: string; access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    code: params.code,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(typeof json.error_description === 'string' ? json.error_description : 'Google token exchange failed')
  }
  return json as { refresh_token?: string; access_token: string; expires_in: number }
}

export async function googleRefreshAccessToken(params: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    refresh_token: params.refreshToken,
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: 'refresh_token',
  })
  const res = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(typeof json.error_description === 'string' ? json.error_description : 'Google token refresh failed')
  }
  return json as { access_token: string; expires_in: number }
}

export async function googleFetchEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const j = (await res.json()) as { email?: string }
  return j.email ?? null
}

export async function googleCalendarInsertEvent(params: {
  accessToken: string
  summary: string
  description: string
  location?: string | null
  startIso: string
  endIso: string
  timeZone: string
}): Promise<{ id: string }> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary: params.summary,
      description: params.description,
      ...(params.location?.trim() ? { location: params.location.trim() } : {}),
      start: { dateTime: params.startIso, timeZone: params.timeZone },
      end: { dateTime: params.endIso, timeZone: params.timeZone },
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const msg = (json.error as { message?: string } | undefined)?.message
    throw new Error(msg ?? 'Google Calendar insert failed')
  }
  return { id: String(json.id) }
}

export async function googleCalendarPatchEvent(params: {
  accessToken: string
  eventId: string
  summary: string
  description: string
  location?: string | null
  startIso: string
  endIso: string
  timeZone: string
}): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(params.eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        location: params.location?.trim() || '',
        start: { dateTime: params.startIso, timeZone: params.timeZone },
        end: { dateTime: params.endIso, timeZone: params.timeZone },
      }),
    }
  )
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(json.error?.message ?? 'Google Calendar update failed')
  }
}

export async function googleCalendarDeleteEvent(params: { accessToken: string; eventId: string }): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(params.eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${params.accessToken}` },
    }
  )
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(text.slice(0, 200) || 'Google Calendar delete failed')
  }
}
