import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { MapPin, Clock, Users, DollarSign, ExternalLink, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { BookingSection } from './BookingSection'
import type { Metadata } from 'next'
import { formatSeriesDateRangeLabel, parseSeriesOccurrences, type EventSeriesFields } from '@/lib/workshop-series'

type Params = { params: Promise<{ id: string }> }

interface Event {
  id: number | string
  title: string
  description: string | null
  date: string | null
  location: string | null
  category: string | null
  price_cad: number | null
  price: string | null
  max_attendees: number | null
  available_slots: number | null
  duration_minutes: number | null
  booking_status: string | null
  vendor_profile_id: string | null
  external_link: string | null
  workshop_series?: string | null
  series_occurrences?: unknown
}

interface VendorProfile {
  business_name: string
  bio: string | null
  website_url: string | null
  slug: string
}

function formatDatetimeLocalFromIso(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params
  const admin = createAdminClient()
  if (!admin) return {}
  const { data: event } = await admin.from('events').select('title, description').eq('id', id).single()
  return {
    title: event ? `${event.title} — offhrs` : 'Workshop — offhrs',
    description: event?.description ?? 'Book a creative workshop on offhrs.',
  }
}

export default async function WorkshopDetailPage({ params }: Params) {
  const { id } = await params
  const admin = createAdminClient()
  if (!admin) return notFound()

  const { data: event } = await admin
    .from('events')
    .select(
      'id, title, description, date, location, category, price_cad, price, max_attendees, available_slots, duration_minutes, booking_status, vendor_profile_id, external_link, workshop_series, series_occurrences'
    )
    .eq('id', id)
    .single() as { data: Event | null }

  if (!event) return notFound()

  const series = parseSeriesOccurrences(event as EventSeriesFields)
  const nowMs = Date.now()
  const bookableOcc = series.filter(
    (o) => new Date(o.start).getTime() >= nowMs - 60_000 && o.available_slots > 0
  )
  const occurrenceOptions = bookableOcc.map((o) => ({
    value: o.start,
    label: new Date(o.start).toLocaleString('en-CA', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  }))
  const isMultiSeries = series.length > 1

  let vendor: VendorProfile | null = null

  if (event.vendor_profile_id) {
    const { data: vp } = await admin
      .from('vendor_profiles')
      .select('business_name, bio, website_url, slug')
      .eq('id', event.vendor_profile_id)
      .single()
    vendor = vp
  }

  const canBookVendor =
    Boolean(event.vendor_profile_id) &&
    event.booking_status === 'published' &&
    (!isMultiSeries || occurrenceOptions.length > 0)
  const isFullyBooked =
    event.booking_status === 'fully_booked' ||
    (event.available_slots ?? 1) <= 0 ||
    (isMultiSeries && occurrenceOptions.length === 0)
  const priceCad = event.price_cad ?? 0
  const stripePk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ''

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-CA', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })

  return (
    <div className="min-h-screen bg-[#FAFAF8]">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back */}
        <Link
          href="/workshops"
          className="inline-flex items-center gap-2 text-sm text-[#888] hover:text-[#1a1a1a] mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          All workshops
        </Link>

        {/* Header */}
        <div className="bg-white border border-[#E8E4DE] rounded-2xl p-6 mb-5">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              {event.category && (
                <span className="inline-block text-xs font-medium px-2.5 py-1 bg-[#EDF2ED] text-[#5D755D] rounded-full mb-2 capitalize">
                  {event.category}
                </span>
              )}
              <h1 className="text-2xl font-bold text-[#1a1a1a] leading-tight">{event.title}</h1>
              {vendor && (
                <p className="text-sm text-[#888] mt-1">
                  by{' '}
                  <Link href={`/vendors/${vendor.slug}`} className="text-[#5D755D] hover:underline font-medium">
                    {vendor.business_name}
                  </Link>
                </p>
              )}
            </div>

            {isFullyBooked && (
              <span className="flex-shrink-0 bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                Fully Booked
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-sm text-[#555] mt-4">
            {priceCad > 0 && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#5D755D]" />
                <strong className="text-[#1a1a1a]">${priceCad} CAD</strong>
              </span>
            )}
            {priceCad === 0 && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-[#5D755D]" />
                <strong className="text-[#1a1a1a]">Free</strong>
              </span>
            )}
            {event.duration_minutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {event.duration_minutes} min
              </span>
            )}
            {event.max_attendees && (
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                {event.available_slots ?? event.max_attendees}/{event.max_attendees} spots left
              </span>
            )}
            {event.date && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {isMultiSeries && series.length > 0
                  ? formatSeriesDateRangeLabel(series)
                  : formatDate(event.date)}
              </span>
            )}
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {event.location}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="bg-white border border-[#E8E4DE] rounded-2xl p-6 mb-5">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-2">About this workshop</h2>
            <p className="text-sm text-[#555] leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Vendor bio */}
        {vendor?.bio && (
          <div className="bg-white border border-[#E8E4DE] rounded-2xl p-6 mb-5">
            <h2 className="text-sm font-semibold text-[#1a1a1a] mb-2">About {vendor.business_name}</h2>
            <p className="text-sm text-[#555] leading-relaxed">{vendor.bio}</p>
            {vendor.website_url && (
              <a
                href={vendor.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-[#5D755D] font-medium hover:underline"
              >
                Visit website <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        )}

        {/* Booking section */}
        {canBookVendor ? (
          <BookingSection
            eventId={String(event.id)}
            defaultStartLocal={formatDatetimeLocalFromIso(
              occurrenceOptions[0]?.value ?? event.date
            )}
            occurrenceOptions={occurrenceOptions.length > 0 ? occurrenceOptions : undefined}
            priceCad={priceCad}
            stripePk={stripePk}
            isFullyBooked={isFullyBooked}
          />
        ) : event.external_link ? (
          <div className="bg-white border border-[#E8E4DE] rounded-2xl p-6">
            <a
              href={event.external_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#5D755D] text-white font-semibold py-3.5 rounded-xl hover:bg-[#4d644d] transition-colors"
            >
              Book on external site <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : null}
      </div>
    </div>
  )
}
