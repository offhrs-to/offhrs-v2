'use client'

import { useState } from 'react'
import Link from 'next/link'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface BookingSectionProps {
  eventId: string
  /** Initial value for `datetime-local` from session `date` (local components). */
  defaultStartLocal: string
  /** When set, user picks a session from discrete ISO starts (multi-week). */
  occurrenceOptions?: { value: string; label: string }[]
  priceCad: number
  stripePk: string
  isFullyBooked: boolean
}

interface AttendeeForm {
  name: string
  email: string
  startTime: string
}

function PaymentForm({
  attendee,
  priceCad,
  onSuccess,
}: {
  attendee: AttendeeForm
  priceCad: number
  onSuccess: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePay() {
    if (!stripe || !elements) return
    setLoading(true)
    setError('')

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      })

      if (stripeError) {
        setError(stripeError.message ?? 'Payment failed.')
        setLoading(false)
        return
      }

      if (paymentIntent?.status === 'succeeded') {
        const conf = await fetch('/api/book/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id,
            startTime: attendee.startTime || undefined,
          }),
        })
        const confData = await conf.json().catch(() => ({}))
        if (!conf.ok) {
          setError((confData as { error?: string }).error ?? 'Could not finalize booking. Contact support with your payment receipt.')
          setLoading(false)
          return
        }

        onSuccess()
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
      <button
        onClick={handlePay}
        disabled={loading || !stripe}
        className="w-full flex items-center justify-center gap-2 bg-[#5D755D] text-white font-semibold py-3.5 rounded-xl hover:bg-[#4d644d] disabled:opacity-60 transition-colors"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {loading ? 'Processing…' : `Pay $${priceCad.toFixed(2)} CAD`}
      </button>
    </div>
  )
}

type Step = 'details' | 'payment' | 'success'

export function BookingSection({
  eventId,
  defaultStartLocal,
  occurrenceOptions,
  priceCad,
  stripePk,
  isFullyBooked,
}: BookingSectionProps) {
  const [step, setStep] = useState<Step>('details')
  const [attendee, setAttendee] = useState<AttendeeForm>({ name: '', email: '', startTime: '' })
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loadingIntent, setLoadingIntent] = useState(false)
  const [intentError, setIntentError] = useState('')
  const [stripePromise] = useState(() => (stripePk ? loadStripe(stripePk) : null))

  const [selectedDateTime, setSelectedDateTime] = useState(defaultStartLocal)
  const [selectedOccurrenceIso, setSelectedOccurrenceIso] = useState(
    occurrenceOptions?.[0]?.value ?? ''
  )

  const effectiveStartForApi = occurrenceOptions?.length
    ? selectedOccurrenceIso || occurrenceOptions[0]?.value || ''
    : selectedDateTime

  function setField(key: keyof AttendeeForm, val: string) {
    setAttendee((f) => ({ ...f, [key]: val }))
  }

  async function handleProceedToPayment() {
    if (!attendee.name.trim() || !attendee.email.trim()) return
    if (priceCad === 0) {
      handleFreeBooking()
      return
    }

    setLoadingIntent(true)
    setIntentError('')

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          attendee_name: attendee.name,
          attendee_email: attendee.email,
          start_time: effectiveStartForApi || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.clientSecret) {
        setIntentError(data.error ?? 'Failed to initialize payment.')
        return
      }

      setClientSecret(data.clientSecret)
      setAttendee((f) => ({ ...f, startTime: effectiveStartForApi }))
      setStep('payment')
    } catch {
      setIntentError('Network error. Please try again.')
    } finally {
      setLoadingIntent(false)
    }
  }

  async function handleFreeBooking() {
    setIntentError('')
    try {
      const res = await fetch('/api/book/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          free: true as const,
          event_id: eventId,
          attendee_name: attendee.name,
          attendee_email: attendee.email,
          startTime: effectiveStartForApi || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setIntentError((data as { error?: string }).error ?? 'Could not complete booking.')
        return
      }
      setIntentError('')
    } catch {
      setIntentError('Network error. Please try again.')
      return
    }
    setStep('success')
  }

  if (isFullyBooked) {
    return (
      <div className="bg-white border border-[#E8E4DE] rounded-2xl p-6 text-center">
        <p className="text-sm font-medium text-[#888]">This session is fully booked.</p>
        <p className="text-xs text-[#aaa] mt-1">Check back later or explore other workshops.</p>
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="bg-white border border-[#E8E4DE] rounded-2xl p-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-[#5D755D] mx-auto mb-4" />
        <h3 className="text-lg font-bold text-[#1a1a1a] mb-2">You&apos;re booked!</h3>
        <p className="text-sm text-[#888] mb-4">
          A confirmation email with session details has been sent to <strong>{attendee.email}</strong>.
        </p>
        <Link
          href="/workshops"
          className="inline-block text-sm font-medium text-[#5D755D] hover:underline"
        >
          Browse more workshops →
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E8E4DE] rounded-2xl p-6">
      <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4">
        {step === 'details' ? 'Book this session' : 'Payment'}
      </h2>

      {step === 'details' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#555] mb-1.5">Your name <span className="text-red-500">*</span></label>
            <input
              value={attendee.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#555] mb-1.5">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={attendee.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="jane@example.com"
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#555] mb-1.5">
              {occurrenceOptions?.length ? 'Session date' : 'Session start'}
            </label>
            {occurrenceOptions && occurrenceOptions.length > 0 ? (
              <select
                value={selectedOccurrenceIso}
                onChange={(e) => setSelectedOccurrenceIso(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              >
                {occurrenceOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="datetime-local"
                value={selectedDateTime}
                onChange={(e) => setSelectedDateTime(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
            )}
            <p className="text-xs text-[#888] mt-1">
              {occurrenceOptions?.length
                ? 'Choose which week you are booking.'
                : 'Defaults to the time set on your session. Adjust only if the host allows a different slot.'}
            </p>
          </div>

          {intentError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {intentError}
            </div>
          )}

          <button
            onClick={handleProceedToPayment}
            disabled={loadingIntent || !attendee.name.trim() || !attendee.email.trim()}
            className="w-full flex items-center justify-center gap-2 bg-[#5D755D] text-white font-semibold py-3.5 rounded-xl hover:bg-[#4d644d] disabled:opacity-60 transition-colors"
          >
            {loadingIntent && <Loader2 className="w-4 h-4 animate-spin" />}
            {loadingIntent
              ? 'Preparing payment…'
              : priceCad === 0
                ? 'Reserve my spot (free)'
                : `Continue to payment — $${priceCad.toFixed(2)} CAD`}
          </button>
        </div>
      )}

      {step === 'payment' && clientSecret && stripePromise && (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: 'stripe',
              variables: { colorPrimary: '#5D755D', fontFamily: 'sans-serif', borderRadius: '12px' },
            },
          }}
        >
          <div className="mb-4 text-xs text-[#888]">
            Booking for <strong className="text-[#1a1a1a]">{attendee.name}</strong> · {attendee.email}
            <button
              type="button"
              onClick={() => { setStep('details'); setClientSecret(null) }}
              className="ml-2 text-[#5D755D] hover:underline"
            >
              Edit
            </button>
          </div>
          <PaymentForm
            attendee={attendee}
            priceCad={priceCad}
            onSuccess={() => setStep('success')}
          />
        </Elements>
      )}
    </div>
  )
}
