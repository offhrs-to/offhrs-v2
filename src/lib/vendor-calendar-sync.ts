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

import { parseSeriesOccurrences, type SeriesOccurrence } from '@/lib/workshop-series'

const DEFAULT_TZ = process.env.VENDOR_CALENDAR_DEFAULT_TZ ?? 'America/Toronto'

type RichEvent = {
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
  workshop_series?: string | null
  series_occurrences?: unknown
  series_google_calendar_event_ids?: unknown
  series_microsoft_outlook_event_ids?: unknown
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

function buildDescriptionForOccurrence(row: RichEvent, series: SeriesOccurrence[], occIndex: number): string {
  const lines: string[] = []
  if (row.description) lines.push(row.description)
  if (row.location) lines.push(`Location: ${row.location}`)
  if (series.length > 1 && series[occIndex]) {
    lines.push(`Session ${occIndex + 1} of ${series.length}`)
    lines.push(
      `${series[occIndex].available_slots}/${series[occIndex].max_attendees} spots (this date)`
    )
  } else {
    const cap =
      row.max_attendees != null
        ? `${row.available_slots ?? row.max_attendees}/${row.max_attendees} spots`
        : ''
    if (cap) lines.push(cap)
  }
  if (row.price_cad != null) lines.push(`Price: $${row.price_cad} CAD`)
  lines.push(`Workshop: ${appBaseUrl()}/workshops/${row.id}`)
  lines.push('Managed by offhrs.')
  return lines.join('\n\n')
}

function parseIdArray(v: unknown): (string | null)[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => (typeof x === 'string' && x.length > 0 ? x : null))
}

function getStartIsoList(row: RichEvent): string[] {
  const series = parseSeriesOccurrences(row)
  if (series.length > 0) return series.map((o) => o.start)
  if (row.date) return [row.date]
  return []
}

function shouldHaveExternalEvent(row: RichEvent): boolean {
  const s = row.booking_status
  return (s === 'published' || s === 'fully_booked') && getStartIsoList(row).length > 0
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
        'id, title, description, date, duration_minutes, booking_status, location, max_attendees, available_slots, price_cad, vendor_profile_id, google_calendar_event_id, microsoft_outlook_event_id, workshop_series, series_occurrences, series_google_calendar_event_ids, series_microsoft_outlook_event_ids'
      )
      .eq('id', eventId)
      .eq('vendor_profile_id', vendorId)
      .maybeSingle()

    if (error || !row) return

    const event = row as RichEvent
    const series = parseSeriesOccurrences(event)
    const starts = getStartIsoList(event)
    const want = shouldHaveExternalEvent(event)
    const duration = (event.duration_minutes ?? 60) as number
    const summary = event.title

    const prevGoogleSeries = parseIdArray(event.series_google_calendar_event_ids)
    const prevMsSeries = parseIdArray(event.series_microsoft_outlook_event_ids)

    let googleCalResult: { legacy: string | null; series: string[] | null } | null = null
    let msCalResult: { legacy: string | null; series: string[] | null } | null = null

    const { data: connections } = await admin
      .from('vendor_calendar_connections')
      .select('provider, refresh_token_encrypted, account_email')
      .eq('vendor_id', vendorId)

    const isMulti = series.length > 1

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
          const { access_token } = await googleRefreshAccessToken({ clientId, clientSecret, refreshToken })

          const collectDeleteTargets = (): string[] => {
            const ids = new Set<string>()
            if (event.google_calendar_event_id) ids.add(event.google_calendar_event_id)
            for (const x of prevGoogleSeries) {
              if (x) ids.add(x)
            }
            return [...ids]
          }

          if (!want || starts.length === 0) {
            for (const gid of collectDeleteTargets()) {
              await googleCalendarDeleteEvent({ accessToken: access_token, eventId: gid }).catch(() => {})
            }
            googleCalResult = { legacy: null, series: null }
          } else {
            const prevByIndex: (string | null)[] = []
            for (let i = 0; i < starts.length; i++) {
              prevByIndex.push(prevGoogleSeries[i] ?? (starts.length === 1 ? event.google_calendar_event_id : null))
            }
            const outIds: string[] = []
            for (let i = 0; i < starts.length; i++) {
              const start = new Date(starts[i])
              const startIso = start.toISOString()
              const endIso = endIsoFromStart(start, duration)
              const description = buildDescriptionForOccurrence(event, series, series.length > 1 ? i : 0)
              const prevId = prevByIndex[i] ?? null
              let newId: string
              if (prevId) {
                await googleCalendarPatchEvent({
                  accessToken: access_token,
                  eventId: prevId,
                  summary,
                  description,
                  startIso,
                  endIso,
                  timeZone: DEFAULT_TZ,
                })
                newId = prevId
              } else {
                const created = await googleCalendarInsertEvent({
                  accessToken: access_token,
                  summary,
                  description,
                  startIso,
                  endIso,
                  timeZone: DEFAULT_TZ,
                })
                newId = created.id
              }
              outIds.push(newId)
            }
            for (let i = starts.length; i < prevGoogleSeries.length; i++) {
              const gid = prevGoogleSeries[i]
              if (gid) await googleCalendarDeleteEvent({ accessToken: access_token, eventId: gid }).catch(() => {})
            }
            if (isMulti) {
              googleCalResult = { legacy: null, series: outIds }
            } else {
              googleCalResult = { legacy: outIds[0] ?? null, series: null }
            }
          }
        } catch (e) {
          console.error('[calendar-sync] google', eventId, e)
        }
      } else if (provider === 'microsoft') {
        try {
          const { clientId, clientSecret } = microsoftCreds()
          const { access_token } = await microsoftRefreshAccessToken({ clientId, clientSecret, refreshToken })

          const collectDeleteTargets = (): string[] => {
            const ids = new Set<string>()
            if (event.microsoft_outlook_event_id) ids.add(event.microsoft_outlook_event_id)
            for (const x of prevMsSeries) {
              if (x) ids.add(x)
            }
            return [...ids]
          }

          if (!want || starts.length === 0) {
            for (const mid of collectDeleteTargets()) {
              await microsoftCalendarDeleteEvent({ accessToken: access_token, eventId: mid }).catch(() => {})
            }
            msCalResult = { legacy: null, series: null }
          } else {
            const prevByIndex: (string | null)[] = []
            for (let i = 0; i < starts.length; i++) {
              prevByIndex.push(prevMsSeries[i] ?? (starts.length === 1 ? event.microsoft_outlook_event_id : null))
            }
            const outIds: string[] = []
            for (let i = 0; i < starts.length; i++) {
              const start = new Date(starts[i])
              const startIso = start.toISOString()
              const endIso = endIsoFromStart(start, duration)
              const body = buildDescriptionForOccurrence(event, series, series.length > 1 ? i : 0)
              const prevId = prevByIndex[i] ?? null
              let newId: string
              if (prevId) {
                await microsoftCalendarPatchEvent({
                  accessToken: access_token,
                  eventId: prevId,
                  subject: summary,
                  body,
                  startIso,
                  endIso,
                  timeZone: DEFAULT_TZ,
                })
                newId = prevId
              } else {
                const created = await microsoftCalendarInsertEvent({
                  accessToken: access_token,
                  subject: summary,
                  body,
                  startIso,
                  endIso,
                  timeZone: DEFAULT_TZ,
                })
                newId = created.id
              }
              outIds.push(newId)
            }
            for (let i = starts.length; i < prevMsSeries.length; i++) {
              const mid = prevMsSeries[i]
              if (mid) await microsoftCalendarDeleteEvent({ accessToken: access_token, eventId: mid }).catch(() => {})
            }
            if (isMulti) {
              msCalResult = { legacy: null, series: outIds }
            } else {
              msCalResult = { legacy: outIds[0] ?? null, series: null }
            }
          }
        } catch (e) {
          console.error('[calendar-sync] microsoft', eventId, e)
        }
      }
    }

    const patch: Record<string, unknown> = {}
    if (googleCalResult) {
      patch.google_calendar_event_id = googleCalResult.legacy
      patch.series_google_calendar_event_ids = googleCalResult.series
    }
    if (msCalResult) {
      patch.microsoft_outlook_event_id = msCalResult.legacy
      patch.series_microsoft_outlook_event_ids = msCalResult.series
    }

    const changedGoogle =
      googleCalResult &&
      (googleCalResult.legacy !== event.google_calendar_event_id ||
        JSON.stringify(googleCalResult.series ?? null) !== JSON.stringify(event.series_google_calendar_event_ids ?? null))
    const changedMs =
      msCalResult &&
      (msCalResult.legacy !== event.microsoft_outlook_event_id ||
        JSON.stringify(msCalResult.series ?? null) !== JSON.stringify(event.series_microsoft_outlook_event_ids ?? null))

    if (changedGoogle || changedMs) {
      await admin.from('events').update(patch).eq('id', eventId)
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
    await admin
      .from('events')
      .update({
        google_calendar_event_id: null,
        series_google_calendar_event_ids: null,
        microsoft_outlook_event_id: null,
        series_microsoft_outlook_event_ids: null,
      })
      .eq('vendor_profile_id', vendorId)
    return
  }

  const { data: events } = await admin
    .from('events')
    .select(
      'id, google_calendar_event_id, microsoft_outlook_event_id, series_google_calendar_event_ids, series_microsoft_outlook_event_ids'
    )
    .eq('vendor_profile_id', vendorId)

  if (provider === 'google') {
    try {
      const { clientId, clientSecret } = googleCreds()
      const { access_token } = await googleRefreshAccessToken({
        clientId,
        clientSecret,
        refreshToken,
      })
      for (const ev of events ?? []) {
        const row = ev as {
          google_calendar_event_id?: string | null
          series_google_calendar_event_ids?: unknown
        }
        const ids = new Set<string>()
        if (row.google_calendar_event_id) ids.add(row.google_calendar_event_id)
        if (Array.isArray(row.series_google_calendar_event_ids)) {
          for (const x of row.series_google_calendar_event_ids) {
            if (typeof x === 'string' && x) ids.add(x)
          }
        }
        for (const gid of ids) {
          await googleCalendarDeleteEvent({ accessToken: access_token, eventId: gid }).catch(() => {})
        }
      }
    } catch (e) {
      console.error('[calendar-disconnect] google cleanup', e)
    }
    await admin
      .from('events')
      .update({ google_calendar_event_id: null, series_google_calendar_event_ids: null })
      .eq('vendor_profile_id', vendorId)
  } else {
    try {
      const { clientId, clientSecret } = microsoftCreds()
      const { access_token } = await microsoftRefreshAccessToken({
        clientId,
        clientSecret,
        refreshToken,
      })
      for (const ev of events ?? []) {
        const row = ev as {
          microsoft_outlook_event_id?: string | null
          series_microsoft_outlook_event_ids?: unknown
        }
        const ids = new Set<string>()
        if (row.microsoft_outlook_event_id) ids.add(row.microsoft_outlook_event_id)
        if (Array.isArray(row.series_microsoft_outlook_event_ids)) {
          for (const x of row.series_microsoft_outlook_event_ids) {
            if (typeof x === 'string' && x) ids.add(x)
          }
        }
        for (const mid of ids) {
          await microsoftCalendarDeleteEvent({ accessToken: access_token, eventId: mid }).catch(() => {})
        }
      }
    } catch (e) {
      console.error('[calendar-disconnect] microsoft cleanup', e)
    }
    await admin
      .from('events')
      .update({ microsoft_outlook_event_id: null, series_microsoft_outlook_event_ids: null })
      .eq('vendor_profile_id', vendorId)
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
