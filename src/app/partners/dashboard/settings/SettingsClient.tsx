'use client'

import { useState } from 'react'
import { formatGstHstRegistrationNumberForDisplay } from '@/lib/vendor-gst-hst'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { Loader2, AlertTriangle, CalendarX } from 'lucide-react'

interface Vendor {
  id: string
  business_name: string
  bio: string | null
  website_url: string | null
  phone: string | null
  location_address: string | null
  refund_window_hours: number
  status: string
  subscription_current_period_end: string | null
  gst_hst_registered: boolean
  gst_hst_registration_number: string | null
}

interface SubscriptionState {
  /** True if Stripe has the subscription set to cancel at the end of the period. */
  cancelAtPeriodEnd: boolean
  /** Raw Stripe subscription status (e.g. 'active', 'trialing', 'canceled'). */
  status: string | null
  /** ISO timestamp the vendor retains access until. Prefer this over
   *  vendor_profiles.subscription_current_period_end so the date matches the
   *  most recent webhook update. */
  currentPeriodEnd: string | null
}

interface SettingsClientProps {
  vendor: Vendor
  email: string
  subscription: SubscriptionState
}

function formatLongDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function SettingsClient({ vendor, email, subscription }: SettingsClientProps) {
  const router = useRouter()

  // Profile form
  const [profile, setProfile] = useState({
    business_name: vendor.business_name,
    bio: vendor.bio ?? '',
    website_url: vendor.website_url ?? '',
    phone: vendor.phone ?? '',
    location_address: vendor.location_address ?? '',
    refund_window_hours: vendor.refund_window_hours.toString(),
  })
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [taxRegistered, setTaxRegistered] = useState(vendor.gst_hst_registered)
  const [taxNumber, setTaxNumber] = useState(
    formatGstHstRegistrationNumberForDisplay(vendor.gst_hst_registration_number)
  )
  const [taxLoading, setTaxLoading] = useState(false)
  const [taxMsg, setTaxMsg] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(
    null
  )

  // Password form
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Billing portal
  const [portalLoading, setPortalLoading] = useState(false)

  // Account deletion
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function setP(key: keyof typeof profile, val: string) {
    setProfile((f) => ({ ...f, [key]: val }))
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setProfileLoading(true)
    setProfileMsg(null)
    try {
      const res = await fetch(`/api/partners/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...profile,
          refund_window_hours: parseInt(profile.refund_window_hours) || 48,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setProfileMsg({ type: 'error', text: data.error ?? 'Failed to save.' })
      } else {
        setProfileMsg({ type: 'success', text: 'Profile saved successfully.' })
      }
    } catch {
      setProfileMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setProfileLoading(false)
    }
  }

  async function saveTaxSettings(e: React.FormEvent) {
    e.preventDefault()
    setTaxLoading(true)
    setTaxMsg(null)
    try {
      const res = await fetch('/api/partners/tax-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gst_hst_registered: taxRegistered,
          gst_hst_registration_number: taxRegistered ? taxNumber : '',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTaxMsg({ type: 'error', text: data.error ?? 'Failed to save tax settings.' })
        return
      }
      if (data.gst_hst_registration_number) {
        setTaxNumber(data.gst_hst_registration_number)
      }
      setTaxMsg({
        type: data.warning ? 'warning' : 'success',
        text:
          data.warning ??
          (taxRegistered
            ? 'GST/HST registration saved. Tax will be calculated at checkout.'
            : 'Saved. Workshop prices will not include GST/HST until you register with the CRA.'),
      })
    } catch {
      setTaxMsg({ type: 'error', text: 'Network error.' })
    } finally {
      setTaxLoading(false)
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (passwords.next !== passwords.confirm) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' })
      return
    }
    if (passwords.next.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 8 characters.' })
      return
    }
    setPasswordLoading(true)
    setPasswordMsg(null)
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { error } = await supabase.auth.updateUser({ password: passwords.next })
      if (error) {
        setPasswordMsg({ type: 'error', text: error.message })
      } else {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
        setPasswords({ current: '', next: '', confirm: '' })
      }
    } finally {
      setPasswordLoading(false)
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/partners/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error ?? 'Could not open billing portal.')
    } finally {
      setPortalLoading(false)
    }
  }

  async function deleteAccount() {
    const confirmed = confirm(
      'Delete your vendor account?\n\n' +
        'This is permanent and cannot be undone. We will:\n' +
        '  • Cancel your offhrs Partners subscription immediately\n' +
        '  • Delete your business profile, workshops, bookings, payouts, and calendar connections\n\n' +
        'If you also use the offhrs mobile app as a consumer with the same email, ' +
        'that consumer account is kept and you will still be able to log in there.'
    )
    if (!confirmed) return
    setDeleteLoading(true)
    setDeleteMsg(null)
    try {
      const res = await fetch('/api/partners/account/delete', {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to delete vendor account.')
      }

      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      // Only sign the browser out if the auth user is actually gone. When the
      // same login still has a consumer profile we keep auth.users intact and
      // the session is still valid, but the vendor dashboard data is gone.
      if (!data.preservedConsumerAccount) {
        await supabase.auth.signOut()
      }
      router.push('/partners/login')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete vendor account.'
      setDeleteMsg({ type: 'error', text: message })
    } finally {
      setDeleteLoading(false)
    }
  }

  const periodEnd = formatLongDate(
    subscription.currentPeriodEnd ?? vendor.subscription_current_period_end
  )

  // Derived subscription UI states:
  //   - `subscriptionEnded` covers the case where Stripe has fully ended the
  //     subscription (customer.subscription.deleted webhook flipped vendor
  //     status to 'canceled').
  //   - `cancellationScheduled` covers the in-between state: vendor clicked
  //     "Cancel" in Stripe billing portal so `cancel_at_period_end=true`, but
  //     they still have paid access until `currentPeriodEnd`.
  //   - `subscriptionActive` is the default healthy / trialing state.
  const subscriptionEnded =
    vendor.status === 'canceled' ||
    vendor.status === 'cancelled' ||
    subscription.status === 'canceled'
  const cancellationScheduled = !subscriptionEnded && subscription.cancelAtPeriodEnd
  const subscriptionActive = !subscriptionEnded && !cancellationScheduled

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#1a1a1a]">Settings</h1>
        <p className="text-sm text-[#888] mt-1">Manage your business profile and account preferences.</p>
      </div>

      {/* Business profile */}
      <section className="bg-white border border-[#E8E4DE] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4">Business profile</h2>
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#555] mb-1.5">Business name</label>
              <input
                value={profile.business_name}
                onChange={(e) => setP('business_name', e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#555] mb-1.5">Bio</label>
              <textarea
                value={profile.bio}
                onChange={(e) => setP('bio', e.target.value)}
                rows={3}
                placeholder="Tell consumers about your studio and teaching style..."
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D] resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Website URL</label>
              <input
                type="url"
                value={profile.website_url}
                onChange={(e) => setP('website_url', e.target.value)}
                placeholder="https://yourstudio.com"
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">Phone</label>
              <input
                type="tel"
                value={profile.phone}
                onChange={(e) => setP('phone', e.target.value)}
                placeholder="+1 (416) 555-0100"
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[#555] mb-1.5">Studio address</label>
              <input
                value={profile.location_address}
                onChange={(e) => setP('location_address', e.target.value)}
                placeholder="123 Main St, Toronto, ON M5V 1A1"
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">
                Refund window (hours before workshop)
              </label>
              <input
                type="number"
                min={24}
                value={profile.refund_window_hours}
                onChange={(e) => setP('refund_window_hours', e.target.value)}
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
              <p className="text-xs text-[#888] mt-1">Minimum 24 hours (platform policy).</p>
            </div>
          </div>

          {profileMsg && (
            <p className={`text-sm px-4 py-3 rounded-xl ${
              profileMsg.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {profileMsg.text}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={profileLoading}
              className="flex items-center gap-2 bg-[#5D755D] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4d644d] disabled:opacity-60 transition-colors"
            >
              {profileLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save profile
            </button>
          </div>
        </form>
      </section>

      {/* Workshop sales tax (GST/HST) */}
      <section className="bg-white border border-[#E8E4DE] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#1a1a1a] mb-1">Workshop sales tax (GST/HST)</h2>
        <p className="text-xs text-[#888] mb-4 leading-relaxed">
          You are the seller of record for workshop tickets. offhrs only adds GST/HST at checkout when
          you confirm you are registered with the CRA. If you are a small supplier (generally under
          $30,000 in taxable sales over four quarters), leave this off and do not charge tax on
          tickets.
        </p>
        <form onSubmit={saveTaxSettings} className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={taxRegistered}
              onChange={(e) => {
                setTaxRegistered(e.target.checked)
                setTaxMsg(null)
              }}
              className="mt-1 h-4 w-4 rounded border-[#E8E4DE] text-[#5D755D] focus:ring-[#5D755D]"
            />
            <span className="text-sm text-[#555] leading-relaxed">
              I am registered for GST/HST with the CRA and authorized to charge tax on my workshop
              sales.
            </span>
          </label>
          {taxRegistered && (
            <div>
              <label className="block text-xs font-medium text-[#555] mb-1.5">
                GST/HST registration number
              </label>
              <input
                value={taxNumber}
                onChange={(e) => {
                  setTaxNumber(e.target.value)
                  setTaxMsg(null)
                }}
                placeholder="123456789 RT 0001"
                className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
            </div>
          )}
          {taxMsg && (
            <p
              className={`text-sm px-4 py-3 rounded-xl ${
                taxMsg.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : taxMsg.type === 'warning'
                    ? 'bg-amber-50 border border-amber-200 text-amber-800'
                    : 'bg-red-50 border border-red-200 text-red-600'
              }`}
            >
              {taxMsg.text}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={taxLoading}
              className="flex items-center gap-2 bg-[#5D755D] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#4d644d] disabled:opacity-60 transition-colors"
            >
              {taxLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Save tax settings
            </button>
          </div>
        </form>
      </section>

      {/* Subscription */}
      <section className="bg-white border border-[#E8E4DE] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#1a1a1a] mb-1">Subscription</h2>
        <p className="text-xs text-[#888] mb-4">Manage your billing, invoices, and payment method.</p>
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-[#555]">
            {subscriptionEnded ? (
              <span className="font-medium text-red-700">Subscription ended</span>
            ) : cancellationScheduled ? (
              <>
                <span className="font-medium text-amber-700">Cancellation scheduled</span>
                {periodEnd && (
                  <span className="text-[#888]"> · access until {periodEnd}</span>
                )}
              </>
            ) : (
              <>
                <span className="capitalize font-medium text-[#1a1a1a]">{vendor.status}</span>
                {periodEnd && (
                  <span className="text-[#888]"> · renews {periodEnd}</span>
                )}
              </>
            )}
          </div>
          <button
            onClick={openBillingPortal}
            disabled={portalLoading}
            className="flex items-center gap-2 text-sm font-semibold text-[#5D755D] border border-[#5D755D] px-4 py-2 rounded-xl hover:bg-[#EDF2ED] disabled:opacity-50 transition-colors"
          >
            {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {portalLoading ? 'Opening…' : 'Manage billing'}
          </button>
        </div>
      </section>

      {/* Account */}
      <section className="bg-white border border-[#E8E4DE] rounded-xl p-5">
        <h2 className="text-sm font-semibold text-[#1a1a1a] mb-4">Account</h2>
        <div className="mb-4 text-sm text-[#555]">
          <span className="text-xs font-medium text-[#888]">Email</span>
          <p className="mt-0.5">{email}</p>
        </div>
        <form onSubmit={changePassword} className="space-y-3">
          <p className="text-xs font-semibold text-[#555]">Change password</p>
          <input
            type="password"
            placeholder="New password"
            value={passwords.next}
            onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
            className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={passwords.confirm}
            onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
            className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
          />
          {passwordMsg && (
            <p className={`text-sm px-4 py-3 rounded-xl ${
              passwordMsg.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-600'
            }`}>
              {passwordMsg.text}
            </p>
          )}
          <button
            type="submit"
            disabled={passwordLoading}
            className="flex items-center gap-2 text-sm font-semibold text-[#1a1a1a] border border-[#E8E4DE] px-4 py-2 rounded-xl hover:bg-[#F0EDE8] disabled:opacity-50 transition-colors"
          >
            {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </form>
      </section>

      {/* Danger zone */}
      <section className="bg-white border border-red-200 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        </div>

        {cancellationScheduled && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <CalendarX className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 leading-relaxed">
              <p className="font-semibold mb-0.5">Subscription cancellation scheduled</p>
              <p>
                Your offhrs Partners subscription is set to cancel
                {periodEnd ? <> at the end of your current billing period on <strong>{periodEnd}</strong>.</> : '.'}{' '}
                You&apos;ll keep full access until then. To resume billing, open <strong>Manage billing</strong> above
                and choose <em>Renew plan</em>.
              </p>
            </div>
          </div>
        )}

        {subscriptionEnded && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <CalendarX className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-red-800 leading-relaxed">
              <p className="font-semibold mb-0.5">Subscription ended</p>
              <p>
                Your offhrs Partners subscription has ended. Your data is retained for 30 days; reactivate any
                time from the partners signup page to restore your dashboard.
              </p>
            </div>
          </div>
        )}

        {subscriptionActive ? (
          <>
            <p className="text-xs text-[#888] mb-4">
              Canceling your subscription retains access until the end of your current billing period.
              Your data is kept for 30 days after cancellation.
            </p>
            <button
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="text-sm font-semibold text-red-600 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Cancel subscription
            </button>
          </>
        ) : (
          <button
            onClick={openBillingPortal}
            disabled={portalLoading}
            className="text-sm font-semibold text-[#5D755D] border border-[#5D755D] px-4 py-2 rounded-xl hover:bg-[#EDF2ED] disabled:opacity-50 transition-colors"
          >
            {portalLoading ? 'Opening…' : 'Manage subscription'}
          </button>
        )}

        <div className="mt-4 border-t border-red-100 pt-4">
          <p className="text-xs text-[#888] mb-3">
            Deleting your vendor account cancels your subscription right away and permanently removes
            your business profile, workshops, bookings, payouts, and calendar connections. If you also
            use the offhrs mobile app with the same email, your consumer account is kept.
          </p>
          <button
            onClick={deleteAccount}
            disabled={deleteLoading}
            className="w-full text-sm font-semibold text-red-700 border border-red-200 px-4 py-2 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleteLoading ? 'Deleting…' : 'Delete vendor account'}
          </button>
          {deleteMsg && (
            <p
              className={`mt-3 text-sm px-4 py-3 rounded-xl ${
                deleteMsg.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}
            >
              {deleteMsg.text}
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
