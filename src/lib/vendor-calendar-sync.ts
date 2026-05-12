import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/token-encryption'
import {
  googleRefreshAccessToken,
  googleCalendarInsertEvent,
  googleCalendarPatchEvent,
  googleCalendarDeleteEvent,
} from '@/lib/google-calendar-api'
import {
  microsoftRefreshAccessToken,
  microsoftCalendarInsertEvent,
  microsoftCalendarPatchEvent,
  microsoftCalendarDeleteEvent,
} from '@/lib/microsoft-calendar-api'

const DEFAULT_TZ = process.env.VENDOR_CALENDAR_DEFAULT_TZ ?? 'America/Toronto'

type EventRow = {
  id: string | number
  title: string
  description: string | null
  date: string | null
  duration_minutes: number | null
  booking_status: string | null
  location: string | null
  max_attendees: number | null
  available_slots: number | null
  price_cad: number | null
  vendor_profile_id: string | null
  google_calendar_event_id: string | null
  microsoft_outlook_event_id: string | null
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ).replace(/\/$/, '')
}

function endIsoFromStart(start: Date, durationMinutes: number): string {
  const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60 * 1000)
  return end.toISOString()
}

function buildDescription(event: EventRow): string {
  const lines: string[] = []
  if (event.description) lines.push(event.description)
  if (event.location) lines.push(`Location: ${event.location}`)
  const cap =
    event.max_attendees != null
      ? `${event.available_slots ?? event.max_attendees}/${event.max_attendees} spots`
      : ''
  if (cap) lines.push(cap)
  if (event.price_cad != null) lines.push(`Price: $${event.price_cad} CAD`)
  lines.push(`Workshop: ${appBaseUrl()}/workshops/${event.id}`)
  lines.push('Managed by offhrs.')
  return lines.join('\n\n')
}

function shouldHaveExternalEvent(row: EventRow): boolean {
  if (!row.date) return false
  const s = row.booking_status
  return s === 'published' || s === 'fully_booked'
}

function googleCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Missing GOOGLE_CALENDAR_CLIENT_ID / GOOGLE_CALENDAR_CLIENT_SECRET')
  return { clientId, clientSecret }
}

function microsoftCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MICROSOFT_CALENDAR_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CALENDAR_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Missing MICROSOFT_CALENDAR_CLIENT_ID / MICROSOFT_CALENDAR_CLIENT_SECRET')
  return { clientId, clientSecret }
}

/**
 * After a session row changes, upsert or remove events on Google / Outlook when the vendor has connected accounts.
 * Safe to fire-and-forget: logs errors, does not throw to callers.
 */
export async function syncVendorSessionToExternalCalendars(
  admin: SupabaseClient,
  vendorId: string,
  eventId: string
): Promise<void> {
  try {
    const { data: row, error } = await admin
      .from('events')
      .select(
        'id, title, description, date, duration_minutes, booking_status, location, max_attendees, available_slots, price_cad, vendor_profile_id, google_calendar_event_id, microsoft_outlook_event_id'
      )
      .eq('id', eventId)
      .eq('vendor_profile_id', vendorId)
      .maybeSingle()

    if (error || !row) return

    const event = row as EventRow
    const { data: connections } = await admin
      .from('vendor_calendar_connections')
      .select('provider, refresh_token_encrypted, account_email')
      .eq('vendor_id', vendorId)

    const want = shouldHaveExternalEvent(event)
    const start = event.date ? new Date(event.date) : null
    const duration = (event.duration_minutes ?? 60) as number
    const summary = event.title
    const description = buildDescription(event)

    const updates: { google_calendar_event_id: string | null; microsoft_outlook_event_id: string | null } = {
      google_calendar_event_id: event.google_calendar_event_id,
      microsoft_outlook_event_id: event.microsoft_outlook_event_id,
    }

    for (const c of connections ?? []) {
      const provider = c.provider as 'google' | 'microsoft'
      let refreshToken: string
      try {
        refreshToken = decrypt(c.refresh_token_encrypted as string)
      } catch {
        console.error('[calendar-sync] decrypt refresh failed', { vendorId, provider })
        continue
      }

      if (provider === 'google') {
        try {
          const { clientId, clientSecret } = googleCreds()
          if (!want || !start) {
            if (event.google_calendar_event_id) {
              const { access_token } = await googleRefreshAccessToken({
                clientId,
                clientSecret,
                refreshToken,
              })
              await googleCalendarDeleteEvent({
                accessToken: access_token,
                eventId: event.google_calendar_event_id,
              })
            }
            updates.google_calendar_event_id = null
          } else {
            const startIso = start.toISOString()
            const endIso = endIsoFromStart(start, duration)
            const { access_token } = await googleRefreshAccessToken({
              clientId,
              clientSecret,
              refreshToken,
            })

            if (event.google_calendar_event_id) {
              await googleCalendarPatchEvent({
                accessToken: access_token,
                eventId: event.google_calendar_event_id,
                summary,
                description,
                startIso,
                endIso,
                timeZone: DEFAULT_TZ,
              })
            } else {
              const created = await googleCalendarInsertEvent({
                accessToken: access_token,
                summary,
                description,
                startIso,
                endIso,
                timeZone: DEFAULT_TZ,
              })
              updates.google_calendar_event_id = created.id
            }
          }
        } catch (e) {
          console.error('[calendar-sync] google', eventId, e)
        }
      } else if (provider === 'microsoft') {
        try {
          const { clientId, clientSecret } = microsoftCreds()
          if (!want || !start) {
            if (event.microsoft_outlook_event_id) {
              const { access_token } = await microsoftRefreshAccessToken({
                clientId,
                clientSecret,
                refreshToken,
              })
              await microsoftCalendarDeleteEvent({
                accessToken: access_token,
                eventId: event.microsoft_outlook_event_id,
              })
            }
            updates.microsoft_outlook_event_id = null
          } else {
            const startIso = start.toISOString()
            const endIso = endIsoFromStart(start, duration)
            const { access_token } = await microsoftRefreshAccessToken({
              clientId,
              clientSecret,
              refreshToken,
            })

            if (event.microsoft_outlook_event_id) {
              await microsoftCalendarPatchEvent({
                accessToken: access_token,
                eventId: event.microsoft_outlook_event_id,
                subject: summary,
                body: description,
                startIso,
                endIso,
                timeZone: DEFAULT_TZ,
              })
            } else {
              const created = await microsoftCalendarInsertEvent({
                accessToken: access_token,
                subject: summary,
                body: description,
                startIso,
                endIso,
                timeZone: DEFAULT_TZ,
              })
              updates.microsoft_outlook_event_id = created.id
            }
          }
        } catch (e) {
          console.error('[calendar-sync] microsoft', eventId, e)
        }
      }
    }

    if (
      updates.google_calendar_event_id !== event.google_calendar_event_id ||
      updates.microsoft_outlook_event_id !== event.microsoft_outlook_event_id
    ) {
      await admin
        .from('events')
        .update({
          google_calendar_event_id: updates.google_calendar_event_id,
          microsoft_outlook_event_id: updates.microsoft_outlook_event_id,
        })
        .eq('id', eventId)
    }
  } catch (e) {
    console.error('[calendar-sync] fatal', eventId, e)
  }
}

export async function upsertVendorCalendarConnection(
  admin: SupabaseClient,
  params: {
    vendorId: string
    provider: 'google' | 'microsoft'
    refreshToken: string
    accountEmail: string | null
  }
): Promise<void> {
  const enc = encrypt(params.refreshToken)
  await admin.from('vendor_calendar_connections').upsert(
    {
      vendor_id: params.vendorId,
      provider: params.provider,
      refresh_token_encrypted: enc,
      account_email: params.accountEmail,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'vendor_id,provider' }
  )
}

export async function deleteVendorCalendarConnection(
  admin: SupabaseClient,
  vendorId: string,
  provider: 'google' | 'microsoft'
): Promise<void> {
  await admin.from('vendor_calendar_connections').delete().eq('vendor_id', vendorId).eq('provider', provider)
}

/** Remove remote events and clear ids, then delete the connection row. */
export async function disconnectVendorCalendarProvider(
  admin: SupabaseClient,
  vendorId: string,
  provider: 'google' | 'microsoft'
): Promise<void> {
  const { data: conn } = await admin
    .from('vendor_calendar_connections')
    .select('refresh_token_encrypted')
    .eq('vendor_id', vendorId)
    .eq('provider', provider)
    .maybeSingle()
  if (!conn) return

  let refreshToken: string
  try {
    refreshToken = decrypt(conn.refresh_token_encrypted as string)
  } catch {
    await deleteVendorCalendarConnection(admin, vendorId, provider)
    const col = provider === 'google' ? 'google_calendar_event_id' : 'microsoft_outlook_event_id'
    await admin.from('events').update({ [col]: null }).eq('vendor_profile_id', vendorId)
    return
  }

  const idColumn = provider === 'google' ? 'google_calendar_event_id' : 'microsoft_outlook_event_id'
  const { data: events } = await admin
    .from('events')
    .select(`id, ${idColumn}`)
    .eq('vendor_profile_id', vendorId)
    .not(idColumn, 'is', null)

  if (provider === 'google') {
    try {
      const { clientId, clientSecret } = googleCreds()
      const { access_token } = await googleRefreshAccessToken({
        clientId,
        clientSecret,
        refreshToken,
      })
      for (const ev of events ?? []) {
        const gid = (ev as { google_calendar_event_id?: string }).google_calendar_event_id
        if (gid) await googleCalendarDeleteEvent({ accessToken: access_token, eventId: gid }).catch(() => {})
      }
    } catch (e) {
      console.error('[calendar-disconnect] google cleanup', e)
    }
    await admin.from('events').update({ google_calendar_event_id: null }).eq('vendor_profile_id', vendorId)
  } else {
    try {
      const { clientId, clientSecret } = microsoftCreds()
      const { access_token } = await microsoftRefreshAccessToken({
        clientId,
        clientSecret,
        refreshToken,
      })
      for (const ev of events ?? []) {
        const mid = (ev as { microsoft_outlook_event_id?: string }).microsoft_outlook_event_id
        if (mid) await microsoftCalendarDeleteEvent({ accessToken: access_token, eventId: mid }).catch(() => {})
      }
    } catch (e) {
      console.error('[calendar-disconnect] microsoft cleanup', e)
    }
    await admin.from('events').update({ microsoft_outlook_event_id: null }).eq('vendor_profile_id', vendorId)
  }

  await deleteVendorCalendarConnection(admin, vendorId, provider)
}

export async function resyncAllPublishedSessionsForVendor(
  admin: SupabaseClient,
  vendorId: string
): Promise<void> {
  const { data: rows } = await admin
    .from('events')
    .select('id')
    .eq('vendor_profile_id', vendorId)
    .in('booking_status', ['published', 'fully_booked'])
    .not('date', 'is', null)
  for (const r of rows ?? []) {
    await syncVendorSessionToExternalCalendars(admin, vendorId, String(r.id))
  }
}
