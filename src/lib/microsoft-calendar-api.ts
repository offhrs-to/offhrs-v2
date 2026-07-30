/**
 * Microsoft identity + Graph Calendar (primary user calendar).
 */

const MS_AUTHORIZE = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_TOKEN = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_ME = 'https://graph.microsoft.com/v1.0/me'

// `User.Read` is required for Graph /me; OIDC scopes alone do not authorize Graph endpoints.
export const MICROSOFT_SCOPES = [
  'offline_access',
  'Calendars.ReadWrite',
  'User.Read',
  'openid',
  'email',
  'profile',
].join(' ')

export function microsoftAuthorizeUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const u = new URL(MS_AUTHORIZE)
  u.searchParams.set('client_id', params.clientId)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('redirect_uri', params.redirectUri)
  u.searchParams.set('scope', MICROSOFT_SCOPES)
  u.searchParams.set('state', params.state)
  u.searchParams.set('response_mode', 'query')
  // Force the account chooser so vendors connect the inbox they intend (not whichever
  // Microsoft account happens to be cached in the browser session).
  u.searchParams.set('prompt', 'select_account')
  return u.toString()
}

export async function microsoftExchangeCode(params: {
  clientId: string
  clientSecret: string
  code: string
  redirectUri: string
}): Promise<{ refresh_token?: string; access_token: string; expires_in: number; id_token?: string }> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch(MS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const desc = typeof json.error_description === 'string' ? json.error_description : JSON.stringify(json)
    throw new Error(desc)
  }
  return json as {
    refresh_token?: string
    access_token: string
    expires_in: number
    id_token?: string
  }
}

export async function microsoftRefreshAccessToken(params: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: 'refresh_token',
    scope: MICROSOFT_SCOPES,
  })
  const res = await fetch(MS_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const desc = typeof json.error_description === 'string' ? json.error_description : JSON.stringify(json)
    throw new Error(desc)
  }
  return json as { access_token: string; expires_in: number }
}

export async function microsoftFetchEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH_ME}?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.warn('microsoftFetchEmail: Graph /me failed', res.status, detail.slice(0, 300))
    return null
  }
  const j = (await res.json()) as { mail?: string | null; userPrincipalName?: string }
  return j.mail || j.userPrincipalName || null
}

/**
 * Decode the email claim from a Microsoft `id_token`.
 *
 * Microsoft always returns an `id_token` when the `openid` scope is requested,
 * regardless of whether the access token is permitted to call Graph /me.
 * Used as a fallback so we can persist the account email even when the
 * Graph call is unavailable or denied.
 */
export function microsoftEmailFromIdToken(idToken: string | null | undefined): string | null {
  if (!idToken) return null
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4)
    const json = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      email?: string
      preferred_username?: string
      upn?: string
    }
    return json.email || json.preferred_username || json.upn || null
  } catch (err) {
    console.warn('microsoftEmailFromIdToken: decode failed', err)
    return null
  }
}

export async function microsoftCalendarInsertEvent(params: {
  accessToken: string
  subject: string
  body: string
  location?: string | null
  startIso: string
  endIso: string
  timeZone: string
}): Promise<{ id: string }> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: params.subject,
      body: { contentType: 'text', content: params.body },
      ...(params.location?.trim()
        ? { location: { displayName: params.location.trim() } }
        : {}),
      start: { dateTime: params.startIso, timeZone: params.timeZone },
      end: { dateTime: params.endIso, timeZone: params.timeZone },
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined
    throw new Error(err?.message ?? 'Microsoft Calendar insert failed')
  }
  return { id: String(json.id) }
}

export async function microsoftCalendarPatchEvent(params: {
  accessToken: string
  eventId: string
  subject: string
  body: string
  location?: string | null
  startIso: string
  endIso: string
  timeZone: string
}): Promise<void> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(params.eventId)}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      subject: params.subject,
      body: { contentType: 'text', content: params.body },
      location: params.location?.trim()
        ? { displayName: params.location.trim() }
        : { displayName: '' },
      start: { dateTime: params.startIso, timeZone: params.timeZone },
      end: { dateTime: params.endIso, timeZone: params.timeZone },
    }),
  })
  if (!res.ok && res.status !== 404) {
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(json.error?.message ?? 'Microsoft Calendar update failed')
  }
}

export async function microsoftCalendarDeleteEvent(params: { accessToken: string; eventId: string }): Promise<void> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(params.eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${params.accessToken}` },
  })
  if (!res.ok && res.status !== 404) {
    const text = await res.text()
    throw new Error(text.slice(0, 200) || 'Microsoft Calendar delete failed')
  }
}
