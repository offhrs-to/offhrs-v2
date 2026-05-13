import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

type RawBooking = {
  id: string
  name: string | null
  email: string | null
  user_id: string | null
  created_at: string
  status: string | null
  event_id: string | number | null
  events: { title?: string | null } | null
}

type PartnerClientRow = {
  key: string
  display_name: string
  email: string
  phone: string | null
  workshops: { id: string; title: string }[]
  first_enrolled_at: string
  booking_count: number
  review: { rating: number; comment: string | null; created_at: string } | null
}

function normEmail(email: string | null | undefined): string | null {
  const e = (email ?? '').trim().toLowerCase()
  return e.length > 0 ? e : null
}

/** Aggregate bookings into one row per attendee email. */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    if (!admin) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })

    const { data: vendor } = await admin.from('vendor_profiles').select('id').eq('user_id', user.id).single()
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })

    const vendorId = vendor.id as string
    const { searchParams } = request.nextUrl
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()
    const sort = searchParams.get('sort') ?? 'first_enrolled_at'
    const dir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
    const workshopId = searchParams.get('workshop_id')?.trim()
    const hasReview = searchParams.get('has_review')
    const hasPhone = searchParams.get('has_phone')

    const { data: rawRows, error } = await admin
      .from('bookings')
      .select('id,name,email,user_id,created_at,status,event_id,events(title)')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false })
      .limit(2000)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const bookings = (rawRows ?? []) as unknown as RawBooking[]

    const byEmail = new Map<
      string,
      {
        display_name: string
        email: string
        user_ids: Set<string>
        workshops: Map<string, { id: string; title: string }>
        first_enrolled_at: string
        booking_count: number
      }
    >()

    for (const b of bookings) {
      const emailKey = normEmail(b.email)
      if (!emailKey) continue
      const title = (b.events as { title?: string | null } | null)?.title?.trim() || 'Workshop'
      const evId = b.event_id != null ? String(b.event_id) : ''
      const row =
        byEmail.get(emailKey) ??
        (() => {
          const fresh = {
            display_name: (b.name ?? '').trim() || emailKey,
            email: (b.email ?? '').trim(),
            user_ids: new Set<string>(),
            workshops: new Map<string, { id: string; title: string }>(),
            first_enrolled_at: b.created_at,
            booking_count: 0,
          }
          byEmail.set(emailKey, fresh)
          return fresh
        })()

      row.booking_count += 1
      if (new Date(b.created_at).getTime() < new Date(row.first_enrolled_at).getTime()) {
        row.first_enrolled_at = b.created_at
      }
      const nm = (b.name ?? '').trim()
      if (nm) row.display_name = nm
      if (b.user_id) row.user_ids.add(b.user_id)
      if (evId) row.workshops.set(evId, { id: evId, title: title || 'Workshop' })
    }

    const userIds = [...new Set([...byEmail.values()].flatMap((r) => [...r.user_ids]))]

    const phoneByUserId = new Map<string, string | null>()
    if (userIds.length > 0) {
      const { data: profiles } = await admin.from('profiles').select('id,phone').in('id', userIds)
      for (const p of profiles ?? []) {
        const id = p.id as string
        const ph = typeof p.phone === 'string' && p.phone.trim() ? p.phone.trim() : null
        phoneByUserId.set(id, ph)
      }
    }

    const reviewByUserId = new Map<string, { rating: number; comment: string | null; created_at: string }>()
    const { data: reviews, error: revErr } = await admin
      .from('vendor_reviews')
      .select('user_id,rating,comment,created_at')
      .eq('vendor_profile_id', vendorId)

    if (!revErr && reviews?.length) {
      for (const r of reviews as { user_id: string; rating: number; comment: string | null; created_at: string }[]) {
        reviewByUserId.set(r.user_id, {
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
        })
      }
    } else if (revErr) {
      console.warn('[partners/clients] vendor_reviews query:', revErr.message)
    }

    let clients: PartnerClientRow[] = [...byEmail.entries()].map(([key, row]) => {
      let phone: string | null = null
      for (const uid of row.user_ids) {
        const ph = phoneByUserId.get(uid)
        if (ph) {
          phone = ph
          break
        }
      }
      let review: PartnerClientRow['review'] = null
      for (const uid of row.user_ids) {
        const rv = reviewByUserId.get(uid)
        if (rv) {
          review = rv
          break
        }
      }
      const workshops = [...row.workshops.values()].sort((a, b) => a.title.localeCompare(b.title))
      return {
        key,
        display_name: row.display_name,
        email: row.email,
        phone,
        workshops,
        first_enrolled_at: row.first_enrolled_at,
        booking_count: row.booking_count,
        review,
      }
    })

    if (q) {
      clients = clients.filter((c) => {
        const hay = `${c.display_name} ${c.email} ${c.phone ?? ''}`.toLowerCase()
        return hay.includes(q)
      })
    }

    if (workshopId) {
      clients = clients.filter((c) => c.workshops.some((w) => w.id === workshopId))
    }

    if (hasReview === '1') clients = clients.filter((c) => c.review != null)
    if (hasReview === '0') clients = clients.filter((c) => c.review == null)

    if (hasPhone === '1') clients = clients.filter((c) => c.phone != null && c.phone.length > 0)
    if (hasPhone === '0') clients = clients.filter((c) => !c.phone)

    const sign = dir === 'asc' ? 1 : -1
    const wsTitle = (c: PartnerClientRow) => (c.workshops[0]?.title ?? '').toLowerCase()

    clients.sort((a, b) => {
      let cmp = 0
      switch (sort) {
        case 'display_name':
          cmp = a.display_name.localeCompare(b.display_name, 'en', { sensitivity: 'base' })
          break
        case 'email':
          cmp = a.email.localeCompare(b.email, 'en', { sensitivity: 'base' })
          break
        case 'phone':
          cmp = (a.phone ?? '').localeCompare(b.phone ?? '', 'en')
          break
        case 'workshop':
          cmp = wsTitle(a).localeCompare(wsTitle(b))
          break
        case 'review':
          cmp = (a.review?.rating ?? 0) - (b.review?.rating ?? 0)
          break
        case 'first_enrolled_at':
        default:
          cmp = new Date(a.first_enrolled_at).getTime() - new Date(b.first_enrolled_at).getTime()
          break
      }
      return cmp * sign
    })

    const workshopOptions = [...new Map(bookings.map((b) => [String(b.event_id), (b.events as { title?: string } | null)?.title ?? 'Workshop'])).entries()]
      .filter(([id]) => id && id !== 'null')
      .map(([id, title]) => ({ id, title: title || 'Workshop' }))
      .sort((a, b) => a.title.localeCompare(b.title))

    return NextResponse.json({
      clients,
      workshop_options: workshopOptions,
      meta: { total: clients.length },
    })
  } catch (err) {
    console.error('partners/clients GET', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
