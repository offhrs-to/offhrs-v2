'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { X, ExternalLink, Heart } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/browser'
import { openWorkshopBooking } from '@/lib/workshop-outbound'
import { BookOutboundHint } from '@/components/listing-disclaimer'

export type WorkshopQuickViewEvent = {
  id: number
  title: string
  description: string | null
  date: string | null
  location: string | null
  image_url: string | null
  category: string
  is_multiple_dates?: boolean | null
  price?: number | string | null
  vendor_id?: string | null
  external_link?: string | null
}

type Props = {
  event: WorkshopQuickViewEvent | null
  onClose: () => void
}

export default function WorkshopQuickViewModal({ event, onClose }: Props) {
  const { user } = useAuth()
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const open = event != null

  useEffect(() => {
    if (!open || !user?.id || !event?.vendor_id) {
      setSaved(false)
      return
    }
    const supabase = createClient()
    supabase
      .from('user_vendor_saves')
      .select('id')
      .eq('user_id', user.id)
      .eq('vendor_id', event.vendor_id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [open, user?.id, event?.vendor_id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const handleSave = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!user || !event?.vendor_id || saving) return
      setSaving(true)
      const supabase = createClient()
      if (saved) {
        await supabase
          .from('user_vendor_saves')
          .delete()
          .eq('user_id', user.id)
          .eq('vendor_id', event.vendor_id)
        setSaved(false)
      } else {
        await supabase.from('user_vendor_saves').insert({ user_id: user.id, vendor_id: event.vendor_id })
        setSaved(true)
      }
      setSaving(false)
    },
    [user, event?.vendor_id, saving, saved]
  )

  const handleBook = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!event) return
    openWorkshopBooking({
      id: event.id,
      title: event.title,
      category: event.category,
      price: event.price,
      external_link: event.external_link,
    })
    onClose()
  }

  if (!event) return null

  const formattedDate = event.date
    ? new Date(event.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null
  const displayDate = event.is_multiple_dates
    ? formattedDate
      ? `${formattedDate} • Multiple dates`
      : 'Multiple dates'
    : formattedDate ?? 'Date TBD'

  const priceLabel =
    event.price != null && String(event.price).trim() !== ''
      ? typeof event.price === 'string' && event.price.startsWith('$')
        ? event.price
        : `$${event.price}`
      : null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workshop-quick-view-title"
        className="relative z-[101] w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative h-48 w-full bg-gray-100">
          {event.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote workshop URLs from Supabase/vendors
            <img src={event.image_url} alt="" className="h-48 w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">No image</div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 left-3 rounded-full bg-white/95 p-2 shadow-sm text-gray-700 hover:bg-white border border-gray-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          {user && event.vendor_id && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`absolute top-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-sm font-semibold shadow-sm border border-gray-200 flex items-center gap-1.5 ${
                saved ? 'text-red-600' : 'text-gray-800'
              }`}
            >
              <Heart className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
              {saved ? 'Saved' : 'Save'}
            </button>
          )}
        </div>

        <div className="p-5 pb-6">
          <p className="text-xs font-medium text-[#5D755D] mb-1">{event.category}</p>
          <h2 id="workshop-quick-view-title" className="text-xl font-bold text-gray-900 leading-snug">
            {event.title}
          </h2>
          <p className="mt-2 text-sm text-gray-600">{displayDate}</p>
          {event.location ? <p className="mt-1 text-sm text-gray-600">{event.location}</p> : null}
          <div className="mt-3 flex flex-wrap items-center gap-2 justify-between">
            {priceLabel ? <p className="text-base font-semibold text-gray-900">{priceLabel}</p> : <span />}
          </div>
          {event.description?.trim() ? (
            <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-5">{event.description.trim()}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {event.vendor_id ? (
              <Link
                href={`/vendors/${event.vendor_id}`}
                onClick={onClose}
                className="inline-flex items-center justify-center rounded-full border border-[#5D755D] px-4 py-2 text-sm font-semibold text-[#5D755D] hover:bg-[#5D755D]/5"
              >
                View vendor
              </Link>
            ) : null}
          </div>

          <BookOutboundHint className="mt-4 text-center" />
          <button
            type="button"
            onClick={handleBook}
            className="mt-2 w-full bg-black hover:bg-gray-800 text-white font-medium py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2"
          >
            Book
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
