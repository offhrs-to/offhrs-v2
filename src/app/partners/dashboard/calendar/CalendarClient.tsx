import Link from 'next/link'
import { CalendarDays, Clock, MapPin } from 'lucide-react'

export function CalendarClient() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">Scheduling</h1>
        <p className="text-sm text-[#888]">
          offhrs uses first-party booking: each workshop session has its own date, time, duration, and capacity on the
          Sessions tab. Customers pick a time on the booking page (or use the session&apos;s scheduled start by default),
          pay through offhrs, and receive confirmation email with session details.
        </p>
      </div>

      <div className="bg-white border border-[#E8E4DE] rounded-xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <CalendarDays className="w-5 h-5 text-[#5D755D] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Set session date &amp; time</h2>
            <p className="text-xs text-[#888] mt-1">
              When you create or edit a session, set <strong>Date &amp; time</strong> so buyers see the correct slot. You
              can still leave it blank for flexible arrangements and coordinate by email.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Clock className="w-5 h-5 text-[#5D755D] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Duration &amp; capacity</h2>
            <p className="text-xs text-[#888] mt-1">
              Duration and max attendees control how long the event runs and how many bookings we accept before marking
              the session fully booked.
            </p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-[#5D755D] flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-[#1a1a1a]">Location</h2>
            <p className="text-xs text-[#888] mt-1">
              Add an address or virtual link on the session; it appears on the public workshop page and in confirmation
              emails.
            </p>
          </div>
        </div>
      </div>

      <Link
        href="/partners/dashboard/sessions"
        className="inline-flex items-center justify-center rounded-xl bg-[#5D755D] px-5 py-3 text-sm font-semibold text-white hover:bg-[#4d644d] transition-colors"
      >
        Go to Sessions
      </Link>
    </div>
  )
}
