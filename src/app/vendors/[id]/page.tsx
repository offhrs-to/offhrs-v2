'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Calendar, MapPin, ExternalLink, Star } from 'lucide-react'

interface Vendor {
  id: string
  name: string
}

interface Event {
  id: number
  title: string
  date: string | null
  location: string | null
  image_url: string | null
  external_link: string | null
  category: string | null
  recurrence?: string | null
}

interface Review {
  id: string
  rating: number
  comment: string | null
  author_name: string | null
  created_at: string
}

export default function VendorProfilePage() {
  const params = useParams()
  const { user } = useAuth()
  const vendorId = params.id as string
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [myReview, setMyReview] = useState<Review | null>(null)

  const loadData = () => {
    if (!vendorId) return
    const supabase = createClient()

    Promise.all([
      supabase.from('vendors').select('id, name').eq('id', vendorId).single(),
      supabase
        .from('events')
        .select('id, title, date, location, image_url, external_link, category, recurrence')
        .eq('vendor_id', vendorId)
        .order('date', { ascending: true }),
      supabase
        .from('vendor_reviews')
        .select('id, rating, comment, author_name, created_at')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false }),
    ]).then(([vendorRes, eventsRes, reviewsRes]) => {
      setVendor(vendorRes.data ?? null)
      setEvents(eventsRes.data ?? [])
      const revs: Review[] = (reviewsRes.data ?? [])
      setReviews(revs)
      if (revs.length > 0) {
        const avg = revs.reduce((s, r) => s + r.rating, 0) / revs.length
        setAvgRating(Math.round(avg * 10) / 10)
      } else {
        setAvgRating(null)
      }
    }).finally(() => setLoading(false))

    if (user?.id) {
      supabase
        .from('vendor_reviews')
        .select('id, rating, comment, author_name, created_at')
        .eq('vendor_id', vendorId)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            const mine = data as Review
            setMyReview(mine)
            setRating(mine.rating)
            setComment(mine.comment ?? '')
          } else {
            setMyReview(null)
          }
        })
    } else {
      setMyReview(null)
    }
  }

  useEffect(() => {
    loadData()
  }, [vendorId, user?.id])

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !vendorId || submitting) return

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('vendor_reviews')
      .upsert(
        { user_id: user.id, vendor_id: vendorId, rating, comment: comment.trim() || null },
        { onConflict: 'user_id,vendor_id' }
      )

    if (!error) {
      setComment('')
      loadData()
    }
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Vendor not found</p>
          <Link href="/">
            <Button variant="outline">Back to Workshops</Button>
          </Link>
        </div>
      </div>
    )
  }

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const isRecurring = (e: Event) => e.recurrence === 'daily' || e.recurrence === 'weekly'
  const upcomingEvents = events.filter((e) => {
    if (isRecurring(e)) return true
    if (!e.date) return false
    const eventDate = new Date(e.date)
    return eventDate >= startOfToday
  })

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{vendor.name}</h1>
          <p className="text-gray-600 mt-1 text-sm">Workshop host</p>
          {avgRating != null && (
            <div className="flex items-center gap-2 mt-3">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`w-4 h-4 ${s <= avgRating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                  />
                ))}
              </div>
              <span className="text-sm font-medium text-gray-600">{avgRating} ({reviews.length} reviews)</span>
            </div>
          )}
        </div>

        {user && (
          <form onSubmit={handleSubmitReview} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
            <h2 className="text-base font-bold text-gray-900 mb-3">
              {myReview ? 'Edit your review (one per vendor)' : 'Leave a review'}
            </h2>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  className={`p-0.5 rounded ${s <= rating ? 'text-amber-500' : 'text-gray-300'}`}
                >
                  <Star className={`w-6 h-6 ${s <= rating ? 'fill-current' : ''}`} />
                </button>
              ))}
            </div>
            <div className="mb-3">
              <Label htmlFor="comment">Comment (optional)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your experience..."
                className="mt-1"
                rows={3}
              />
            </div>
            <Button type="submit" disabled={submitting} className="bg-[#5D755D] hover:bg-[#4a5e4a]">
              {submitting ? 'Submitting...' : myReview ? 'Update review' : 'Submit review'}
            </Button>
          </form>
        )}

        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Reviews</h2>
          {reviews.length === 0 ? (
            <p className="text-gray-600 text-sm">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="bg-white rounded-lg border border-gray-100 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-gray-500">
                      {r.author_name || 'Anonymous'} • {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {r.comment && <p className="text-gray-700 text-xs">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <h2 className="text-lg font-bold text-gray-900 mb-3">Upcoming Workshops</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-gray-600 text-sm">No upcoming workshops from this vendor.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="relative h-32 bg-gray-100">
                  {event.image_url ? (
                    <Image
                      src={event.image_url}
                      alt={event.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">No image</div>
                  )}
                  {event.category && (
                    <div className="absolute top-2 left-2 bg-white/90 px-2 py-1 rounded text-xs font-medium">
                      {event.category}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-bold text-base text-gray-900 mb-1.5">{event.title}</h3>
                  {event.date && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      {new Date(event.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      {event.location}
                    </div>
                  )}
                  {event.external_link && (
                    <a
                      href={event.external_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-[#5D755D] hover:underline"
                    >
                      Book <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Link href="/">
            <Button variant="outline" size="sm">Back to Workshops</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
