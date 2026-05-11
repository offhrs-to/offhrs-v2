'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Coffee,
  Flower2,
  LayoutGrid,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import type { Category } from '@/constants/categories'
import { CATEGORIES } from '@/constants/categories'
import { GooglePlacesField } from './GooglePlacesField'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const CATEGORY_ICON: Record<Category, React.ElementType> = {
  'Beauty & Fragrance': Sparkles,
  Culinary: UtensilsCrossed,
  Coffee: Coffee,
  Floral: Flower2,
  Pottery: CircleDot,
  Other: LayoutGrid,
}

const STEPS = ['business', 'categories', 'location', 'account'] as const
type StepId = (typeof STEPS)[number]

export function PartnerSignupWizard() {
  const [step, setStep] = useState<StepId>('business')
  const stepIndex = STEPS.indexOf(step)

  const [businessName, setBusinessName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  /** Up to 4 categories in pick order — first is primary. */
  const [categoryOrder, setCategoryOrder] = useState<Category[]>([])
  const [otherDetail, setOtherDetail] = useState('')

  const [locationAddress, setLocationAddress] = useState('')
  const [locationLat, setLocationLat] = useState<number | null>(null)
  const [locationLng, setLocationLng] = useState<number | null>(null)

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [mapsAuthError, setMapsAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (step === 'location') setMapsAuthError(null)
  }, [step])

  const handleMapsAuthFailure = useCallback(() => {
    if (typeof window === 'undefined') return
    const origin = window.location.origin
    setMapsAuthError(
      `Google could not load Maps for ${origin}. In Google Cloud → APIs & Services → Credentials → your browser key: under Website restrictions add "${origin}/*" (exact scheme, host, and port). Enable Maps JavaScript API and Places API on the project, enable billing, then redeploy so NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is present. Check the browser console for codes like RefererNotAllowedMapError or ApiNotActivatedMapError.`
    )
  }, [])

  /** Stable refs — inline handlers made Autocomplete re-attach every render and dropped place_changed. */
  const handlePlaceResolved = useCallback(
    (payload: { lat: number; lng: number; formattedAddress: string }) => {
      setLocationAddress(payload.formattedAddress)
      setLocationLat(payload.lat)
      setLocationLng(payload.lng)
    },
    []
  )

  const handleClearGeocode = useCallback(() => {
    setLocationLat(null)
    setLocationLng(null)
  }, [])

  const primaryCategory = categoryOrder[0] ?? null
  const needsOtherDetail = categoryOrder.includes('Other')

  function toggleCategory(cat: Category) {
    setCategoryOrder((prev) => {
      const i = prev.indexOf(cat)
      if (i >= 0) return prev.filter((c) => c !== cat)
      if (prev.length >= 4) return prev
      return [...prev, cat]
    })
  }

  function moveCategoryToFront(cat: Category) {
    setCategoryOrder((prev) => {
      const rest = prev.filter((c) => c !== cat)
      return [cat, ...rest]
    })
  }

  function canContinue(): boolean {
    switch (step) {
      case 'business':
        return businessName.trim().length >= 2
      case 'categories':
        if (!primaryCategory || categoryOrder.length === 0) return false
        if (needsOtherDetail && !otherDetail.trim()) return false
        return true
      case 'location': {
        if (!locationAddress.trim()) return false
        if (MAPS_KEY) return locationLat != null && locationLng != null
        return locationAddress.trim().length >= 8
      }
      case 'account':
        return (
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
          password.length >= 8
        )
      default:
        return false
    }
  }

  function goNext() {
    if (!canContinue()) return
    const i = stepIndex
    if (i < STEPS.length - 1) setStep(STEPS[i + 1])
    else void submit()
  }

  function goBack() {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1])
  }

  async function submit() {
    if (!canContinue()) return
    setLoading(true)
    setError(null)
    try {
      const website = websiteUrl.trim()
      const res = await fetch('/api/partners/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName.trim(),
          website_url: website || undefined,
          categories: categoryOrder,
          category_other_detail: needsOtherDetail ? otherDetail.trim() : undefined,
          location_address: locationAddress.trim(),
          location_lat: locationLat ?? undefined,
          location_lng: locationLng ?? undefined,
          email: email.trim(),
          password,
          phone: phone.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Signup failed')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]'

  if (success) {
    return (
      <div className="min-h-screen bg-[#FAFAF8] flex flex-col items-center justify-center px-6 py-16 pt-24">
        <div
          className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-[#5D755D] shadow-md shadow-[#5D755D]/25"
          aria-hidden
        >
          <Check className="h-10 w-10 text-white" strokeWidth={2.5} />
        </div>
        <span className="font-playfair text-3xl font-bold tracking-tight text-[#1a1a1a] mb-2">offhrs</span>
        <h1 className="font-playfair text-2xl sm:text-3xl font-bold text-[#1a1a1a] text-center mt-2">
          Your business is set up!
        </h1>
        <p className="mt-4 text-center text-sm text-[#555] max-w-md leading-relaxed">
          Enjoy 7 days free of using offhrs for business. We sent a verification link to{' '}
          <span className="text-[#1a1a1a] font-medium">{email}</span> — confirm your email to continue to billing.
        </p>
        <Link
          href="/partners/login"
          className="mt-10 inline-flex items-center justify-center rounded-lg bg-[#5D755D] px-10 py-3 text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors"
        >
          Done
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1a1a1a] flex flex-col pt-20 pb-8">
      {/* Progress */}
      <div className="px-4 pb-3 max-w-lg mx-auto w-full">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= stepIndex ? 'bg-[#5D755D]' : 'bg-[#E8E4DE]'
              }`}
            />
          ))}
        </div>
      </div>

      <header className="flex items-center justify-between px-4 pb-4 max-w-lg mx-auto w-full">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E8E4DE] bg-white text-[#555] hover:border-[#5D755D] hover:text-[#1a1a1a] disabled:opacity-30 disabled:pointer-events-none transition-colors shadow-sm"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <Link href="/partners/login" className="text-sm text-[#5D755D] font-medium hover:underline">
            Close
          </Link>
          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue() || loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5D755D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {step === 'account' ? (loading ? 'Creating…' : 'Continue') : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 max-w-lg mx-auto w-full">
        <div className="bg-white rounded-2xl border border-[#E8E6E0] shadow-sm p-8">
          <p className="text-xs font-medium uppercase tracking-wide text-[#888] mb-6">Account setup</p>

          {error && (
            <div className="mb-6 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

        {step === 'business' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a] leading-tight">
              What&apos;s your business name?
            </h1>
            <p className="text-sm text-[#555] leading-relaxed">
              This is the brand name your clients will see. Your billing and legal name can be added later.
            </p>
            <div className="space-y-1">
              <label htmlFor="biz-name" className="block text-sm font-medium text-[#1a1a1a]">
                Business name
              </label>
              <input
                id="biz-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Your studio or brand"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="biz-web" className="block text-sm font-medium text-[#1a1a1a]">
                Website or social (optional)
              </label>
              <input
                id="biz-web"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="www.yoursite.com or @yourbrand"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {step === 'categories' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a] leading-tight">
              Select categories that best describe your business
            </h1>
            <p className="text-sm text-[#555] leading-relaxed">
              Tap up to four categories in order — the first you pick is your primary. Tap again to remove. Tap
              &quot;Make primary&quot; on a selected card to reorder.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {CATEGORIES.map((cat) => {
                const pos = categoryOrder.indexOf(cat)
                const isPrimary = pos === 0
                const selected = pos >= 0
                const Icon = CATEGORY_ICON[cat]
                return (
                  <div key={cat} className="relative">
                    <button
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`relative flex w-full flex-col items-center gap-2 rounded-xl border px-3 py-4 text-center transition-all ${
                        selected
                          ? 'border-[#5D755D] bg-[#EDF2ED] ring-1 ring-[#5D755D]/25 shadow-sm'
                          : 'border-[#E8E4DE] bg-[#FAFAF8] hover:border-[#C8BFB0]'
                      }`}
                    >
                      {isPrimary && (
                        <span className="absolute top-2 right-2 rounded-full bg-[#5D755D] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                          Primary
                        </span>
                      )}
                      <div
                        className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg ${
                          selected ? 'bg-white text-[#5D755D]' : 'bg-[#F0EDE8] text-[#555]'
                        }`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="text-xs font-medium text-[#1a1a1a] leading-snug">{cat}</span>
                      {selected && !isPrimary && (
                        <span className="text-[10px] text-[#5D755D] font-medium">#{pos + 1}</span>
                      )}
                    </button>
                    {selected && !isPrimary && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          moveCategoryToFront(cat)
                        }}
                        className="mt-1 w-full text-[10px] font-medium text-[#5D755D] hover:underline"
                      >
                        Make primary
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {needsOtherDetail && (
              <div className="space-y-1">
                <label htmlFor="other-detail" className="block text-sm font-medium text-[#1a1a1a]">
                  Other service type
                </label>
                <input
                  id="other-detail"
                  value={otherDetail}
                  onChange={(e) => setOtherDetail(e.target.value)}
                  placeholder="Describe your services"
                  className={inputClass}
                />
              </div>
            )}
          </div>
        )}

        {step === 'location' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a] leading-tight">Where is your venue?</h1>
            <p className="text-sm text-[#555] leading-relaxed">
              Search for your address so we can show your business accurately and power nearby discovery.
            </p>
            <GooglePlacesField
              key="location-field"
              initialValue={locationAddress}
              onAddressChange={setLocationAddress}
              onPlaceResolved={handlePlaceResolved}
              onClearGeocode={handleClearGeocode}
              onAuthFailure={handleMapsAuthFailure}
              apiKey={MAPS_KEY}
            />
            {mapsAuthError && (
              <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2 leading-relaxed whitespace-pre-wrap">
                {mapsAuthError}
              </p>
            )}
            {MAPS_KEY && locationAddress && (locationLat == null || locationLng == null) && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Choose a suggestion from the dropdown so we can save your map coordinates.
              </p>
            )}
            {locationLat != null && locationLng != null && (
              <p className="text-xs text-[#888]">
                Pin saved: {locationLat.toFixed(5)}, {locationLng.toFixed(5)}
              </p>
            )}
          </div>
        )}

        {step === 'account' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a] leading-tight">Create your login</h1>
            <p className="text-sm text-[#555] leading-relaxed">
              Use a work email you can access — we&apos;ll send a verification link before billing.
            </p>
            <div className="space-y-1">
              <label htmlFor="acct-email" className="block text-sm font-medium text-[#1a1a1a]">
                Work email
              </label>
              <input
                id="acct-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="acct-phone" className="block text-sm font-medium text-[#1a1a1a]">
                Phone (optional)
              </label>
              <input
                id="acct-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (416) 555-0100"
                className={inputClass}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="acct-pass" className="block text-sm font-medium text-[#1a1a1a]">
                Password
              </label>
              <input
                id="acct-pass"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className={inputClass}
              />
            </div>
          </div>
        )}
        </div>
      </main>

      <footer className="py-6 px-4 space-y-4 max-w-lg mx-auto w-full">
        <p className="text-center text-sm text-[#555]">
          Already have an account?{' '}
          <Link href="/partners/login" className="font-medium text-[#5D755D] underline hover:text-[#4d634d]">
            Sign in
          </Link>
        </p>
        <p className="text-center text-xs text-[#999]">
          <Link href="/terms" className="text-[#5D755D] underline hover:text-[#4d634d]">
            Terms
          </Link>
          {' · '}
          <Link href="/privacy" className="text-[#5D755D] underline hover:text-[#4d634d]">
            Privacy
          </Link>
        </p>
      </footer>
    </div>
  )
}
