'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CircleDot,
  Coffee,
  CreditCard,
  Flower2,
  ImagePlus,
  LayoutGrid,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react'
import type { Category } from '@/constants/categories'
import { CATEGORIES } from '@/constants/categories'
import { GooglePlacesField } from './GooglePlacesField'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/browser'
import {
  formatPartnerMonthlyAmount,
  PARTNER_TRIAL_LABEL,
} from '@/lib/partner-pricing'

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

const CATEGORY_ICON: Record<Category, React.ElementType> = {
  'Beauty & Fragrance': Sparkles,
  Culinary: UtensilsCrossed,
  Coffee: Coffee,
  Floral: Flower2,
  Pottery: CircleDot,
  Other: LayoutGrid,
}

const STEPS = ['business', 'categories', 'logo', 'location', 'account', 'billing'] as const
type StepId = (typeof STEPS)[number]

type BillingStatusResponse = {
  authenticated?: boolean
  email_verified?: boolean
  vendor_status?: string | null
  stripe_checkout_completed?: boolean
}

const LOGO_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const

async function workshopLogoPayloadFromFile(
  file: File
): Promise<{ base64: string; mime_type: (typeof LOGO_MIME)[number] }> {
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Logo must be 2 MB or smaller.')
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const m = result.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
      if (!m) {
        reject(new Error('Use a JPEG, PNG, or WebP image.'))
        return
      }
      resolve({ base64: m[2], mime_type: m[1] as (typeof LOGO_MIME)[number] })
    }
    reader.onerror = () => reject(new Error('Could not read the image file.'))
    reader.readAsDataURL(file)
  })
}

export function PartnerSignupWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [step, setStep] = useState<StepId>('business')
  const stepIndex = STEPS.indexOf(step)

  const [accountCreated, setAccountCreated] = useState(false)
  const [emailVerifiedForBilling, setEmailVerifiedForBilling] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [billingCanceled, setBillingCanceled] = useState(false)
  const [billingPlan, setBillingPlan] = useState<'lite' | 'pro'>('pro')

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

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mapsAuthError, setMapsAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (step === 'location') setMapsAuthError(null)
  }, [step])

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

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

  const refreshBillingStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/partners/onboarding-billing-status')
      const data = (await res.json()) as BillingStatusResponse
      if (data.authenticated && data.email_verified) {
        setEmailVerifiedForBilling(true)
      }
      if (
        data.authenticated &&
        data.email_verified &&
        (data.stripe_checkout_completed || (data.vendor_status && data.vendor_status !== 'pending'))
      ) {
        router.replace('/partners/dashboard?onboarding=1')
      }
      return data
    } catch {
      /* ignore */
      return null
    }
  }, [router])

  useEffect(() => {
    setBillingCanceled(searchParams.get('canceled') === '1')
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('billing') !== '1') return
    void (async () => {
      const data = await refreshBillingStatus()
      if (
        data?.authenticated &&
        data.email_verified &&
        data.vendor_status === 'pending' &&
        !data.stripe_checkout_completed
      ) {
        setEmailVerifiedForBilling(true)
        setStep('billing')
      }
    })()
  }, [searchParams, refreshBillingStatus])

  useEffect(() => {
    if (step !== 'billing') return
    void refreshBillingStatus()
    const t = setInterval(() => void refreshBillingStatus(), 4000)
    return () => clearInterval(t)
  }, [step, refreshBillingStatus])

  function canContinue(): boolean {
    switch (step) {
      case 'business':
        return businessName.trim().length >= 2
      case 'categories':
        if (!primaryCategory || categoryOrder.length === 0) return false
        if (needsOtherDetail && !otherDetail.trim()) return false
        return true
      case 'logo':
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
      case 'billing':
        return emailVerifiedForBilling
      default:
        return false
    }
  }

  function goNext() {
    if (!canContinue()) return
    if (step === 'account') {
      void submitAccountAndGoToBilling()
      return
    }
    const i = stepIndex
    if (i < STEPS.length - 1) setStep(STEPS[i + 1])
  }

  function goBack() {
    if (step === 'billing' && accountCreated) return
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1])
  }

  async function submitAccountAndGoToBilling() {
    if (!canContinue() || step !== 'account') return
    setLoading(true)
    setError(null)
    try {
      const website = websiteUrl.trim()
      let workshop_logo: { base64: string; mime_type: (typeof LOGO_MIME)[number] } | undefined
      try {
        if (logoFile) {
          workshop_logo = await workshopLogoPayloadFromFile(logoFile)
        }
      } catch (le) {
        setError(le instanceof Error ? le.message : 'Could not read the image.')
        setLoading(false)
        return
      }
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
          workshop_logo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Signup failed')

      setAccountCreated(true)
      setStep('billing')

      const supabase = createBrowserSupabaseClient()
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (!signErr) {
        await refreshBillingStatus()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function startCheckout() {
    if (!emailVerifiedForBilling) return
    setCheckoutLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/partners/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: billingPlan }),
      })
      const payload = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !payload.url) {
        throw new Error(payload.error ?? 'Failed to start checkout')
      }
      window.location.href = payload.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed')
      setCheckoutLoading(false)
    }
  }

  function primaryAction() {
    if (step === 'account') void submitAccountAndGoToBilling()
    else if (step === 'billing') void startCheckout()
    else goNext()
  }

  const primaryDisabled =
    step === 'billing' ? !emailVerifiedForBilling || checkoutLoading : !canContinue() || loading

  let primaryLabel = 'Continue'
  if (step === 'account') primaryLabel = loading ? 'Creating…' : 'Continue'
  if (step === 'billing') primaryLabel = checkoutLoading ? 'Redirecting…' : 'Add payment & start trial'

  const inputClass =
    'w-full rounded-lg border border-[#D9D7CF] bg-[#FAFAF8] px-4 py-2.5 text-sm text-[#1a1a1a] placeholder:text-[#AAA] focus:outline-none focus:ring-2 focus:ring-[#5D755D]'

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
          disabled={stepIndex === 0 || (step === 'billing' && accountCreated)}
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
            onClick={() => primaryAction()}
            disabled={primaryDisabled}
            className="inline-flex items-center gap-2 rounded-lg bg-[#5D755D] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4d634d] disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {primaryLabel}
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

        {step === 'logo' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a] leading-tight">
              Default workshop image
            </h1>
            <p className="text-sm text-[#555] leading-relaxed">
              Add a logo or photo we&apos;ll use as the default picture for your workshops on offhrs. You can skip this
              and add one later, or set a different image per session when you create listings.
            </p>
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[#D9D7CF] bg-[#FAFAF8] px-6 py-10">
              {logoPreview ? (
                <div className="relative w-full max-w-[220px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreview}
                    alt="Workshop logo preview"
                    className="mx-auto max-h-40 w-auto max-w-full rounded-lg object-contain shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoFile(null)}
                    className="mt-3 w-full text-center text-xs font-medium text-[#5D755D] hover:underline"
                  >
                    Remove image
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#5D755D] shadow-sm ring-1 ring-[#E8E4DE]">
                    <ImagePlus className="h-7 w-7" />
                  </span>
                  <span className="text-sm font-medium text-[#1a1a1a]">Upload image</span>
                  <span className="text-xs text-[#888]">JPEG, PNG, or WebP · max 2 MB</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      if (f.size > 2 * 1024 * 1024) {
                        setError('Image must be 2 MB or smaller.')
                        return
                      }
                      setError(null)
                      setLogoFile(f)
                    }}
                  />
                </label>
              )}
            </div>
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
              Use a work email you can access. We&apos;ll send a verification link — you&apos;ll need to confirm it
              before you can add a card for your {PARTNER_TRIAL_LABEL} and monthly subscription.
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

        {step === 'billing' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EDF2ED] text-[#5D755D] ring-1 ring-[#5D755D]/20">
                <CreditCard className="h-7 w-7" />
              </span>
            </div>
            <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a] leading-tight text-center">
              Payment & subscription
            </h1>
            <p className="text-sm text-[#555] leading-relaxed text-center">
              Choose a plan, then add a payment method to start your{' '}
              <strong className="font-semibold text-[#1a1a1a]">{PARTNER_TRIAL_LABEL}</strong>. After the trial, your
              subscription renews monthly unless you cancel before the trial ends (see our Terms for details).
            </p>
            {emailVerifiedForBilling && (
              <div className="grid grid-cols-1 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBillingPlan('lite')}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    billingPlan === 'lite'
                      ? 'border-[#5D755D] bg-[#EDF2ED]'
                      : 'border-[#E8E4DE] bg-[#FAFAF8] hover:border-[#D9D7CF]'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5D755D]">Lite</p>
                  <p className="mt-1 font-playfair text-2xl font-bold text-[#1a1a1a]">
                    {formatPartnerMonthlyAmount('lite')}{' '}
                    <span className="text-sm font-normal text-[#555]">CAD / month</span>
                  </p>
                  <p className="mt-2 text-xs text-[#555] leading-relaxed">
                    Up to 4 new workshop sessions per billing period. Same booking, payouts, and calendar sync as Pro.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPlan('pro')}
                  className={`rounded-xl border-2 p-4 text-left transition-colors ${
                    billingPlan === 'pro'
                      ? 'border-[#5D755D] bg-[#EDF2ED]'
                      : 'border-[#E8E4DE] bg-[#FAFAF8] hover:border-[#D9D7CF]'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5D755D]">Pro</p>
                  <p className="mt-1 font-playfair text-2xl font-bold text-[#1a1a1a]">
                    {formatPartnerMonthlyAmount('pro')}{' '}
                    <span className="text-sm font-normal text-[#555]">CAD / month</span>
                  </p>
                  <p className="mt-2 text-xs text-[#555] leading-relaxed">
                    Unlimited workshop sessions. Full platform access.
                  </p>
                </button>
              </div>
            )}
            {billingCanceled && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 text-center">
                Checkout was canceled. When you&apos;re ready, use the button below to try again.
              </p>
            )}
            {!emailVerifiedForBilling && (
              <div className="rounded-xl border border-[#E8E4DE] bg-[#FAFAF8] px-4 py-4 text-center space-y-2">
                <p className="text-sm font-medium text-[#1a1a1a]">Verify your email first</p>
                <p className="text-xs text-[#555] leading-relaxed">
                  We sent a link to <span className="font-medium text-[#1a1a1a]">{email.trim()}</span>. Open it in this
                  browser (or any tab in the same browser) so we can confirm your address — this page updates
                  automatically every few seconds.
                </p>
              </div>
            )}
            {emailVerifiedForBilling && (
              <p className="text-center text-xs text-[#5D755D] font-medium">
                Email confirmed — you can continue to secure Stripe checkout.
              </p>
            )}
            <p className="text-center text-xs text-[#999]">
              Payments are processed by Stripe. You won&apos;t be charged the subscription amount until after your trial
              period.
            </p>
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
