'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { LogOut, Trash2 } from 'lucide-react'
import OnboardingModal from '@/components/onboarding-modal'

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#'
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'

export default function ProfilePage() {
  const { user, loading: authLoading, signOut } = useAuth()
  const [profile, setProfile] = useState<{
    display_name: string | null
    avatar_url: string | null
    phone: string | null
    expertise_level: string | null
    experience_points: number | null
    onboarding_completed: boolean | null
  } | null>(null)
  const [savedVendors, setSavedVendors] = useState<{ id: string; name: string }[]>([])
  const [workshopsAttended, setWorkshopsAttended] = useState(0)
  const [reviewsCount, setReviewsCount] = useState(0)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!user?.id) return

    const supabase = createClient()
    supabase
      .from('profiles')
      .select('display_name, avatar_url, phone, expertise_level, experience_points, onboarding_completed')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setProfile(data ?? null)
        setProfileLoaded(true)
      })

    supabase
      .from('user_vendor_saves')
      .select('vendor_id')
      .eq('user_id', user.id)
      .then(async ({ data: saves }) => {
        if (!saves?.length) return setSavedVendors([])
        const ids = saves.map((s) => s.vendor_id).filter(Boolean)
        const { data: vendorList } = await supabase
          .from('vendors')
          .select('id, name')
          .in('id', ids)
        setSavedVendors(vendorList ?? [])
      })

    void fetch('/api/attendance/credit-due', { method: 'POST' })
      .then(() =>
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'attended')
          .then(({ count }) => setWorkshopsAttended(count ?? 0))
      )
      .catch(() => {})

    supabase
      .from('vendor_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setReviewsCount(count ?? 0))
  }, [user?.id])

  const showOnboarding =
    user && profileLoaded && profile?.onboarding_completed === false

  const deleteAccount = async () => {
    if (!confirm('Permanently delete your account and all data? This cannot be undone.')) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
        credentials: 'include',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(body.error ?? 'Failed to delete account')
        return
      }
      await signOut()
      window.location.href = '/'
    } catch {
      alert('Something went wrong')
    } finally {
      setDeleting(false)
    }
  }

  const refreshProfile = () => {
    if (!user?.id) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('display_name, avatar_url, phone, expertise_level, experience_points, onboarding_completed')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data ?? null))
    supabase
      .from('user_vendor_saves')
      .select('vendor_id')
      .eq('user_id', user.id)
      .then(async ({ data: saves }) => {
        if (!saves?.length) return setSavedVendors([])
        const ids = saves.map((s) => s.vendor_id).filter(Boolean)
        const { data: vendorList } = await supabase.from('vendors').select('id, name').in('id', ids)
        setSavedVendors(vendorList ?? [])
      })
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'attended')
      .then(({ count }) => setWorkshopsAttended(count ?? 0))
    supabase
      .from('vendor_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setReviewsCount(count ?? 0))
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Please sign in to view your profile</p>
          <Link href="/signup">
            <Button className="bg-[#5D755D] hover:bg-[#4a5e4a]">Sign in with Google or Apple</Button>
          </Link>
        </div>
      </div>
    )
  }

  const displayName =
    profile?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split('@')[0] ||
    '—'
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url
  const email = user.email || '—'
  const phone = profile?.phone || '—'
  const level = profile?.expertise_level || 'Novice'
  const points = profile?.experience_points ?? 0

  return (
    <div className="min-h-screen bg-gray-50/50">
      {showOnboarding && (
        <OnboardingModal userId={user.id} onComplete={refreshProfile} />
      )}
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-[#5D755D] mb-3 flex items-center justify-center">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-white">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900">{displayName}</h1>
            {level && (
              <p className="text-xs text-[#5D755D] mt-0.5">
                {level} {typeof points === 'number' ? `• ${points}/8 points` : ''}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>

          <div className="border-t border-gray-100 pt-4 flex gap-6 mb-4">
            <div>
              <p className="text-xl font-bold text-gray-900">{workshopsAttended}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Workshops attended</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{savedVendors.length}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Saved vendors</p>
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{reviewsCount}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Reviews</p>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
              <p className="text-gray-900">{email}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Phone</p>
              <p className="text-gray-900">{phone}</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <h2 className="text-base font-bold text-gray-900 mb-3">Saved Vendors ({savedVendors.length})</h2>
            {savedVendors.length === 0 ? (
              <p className="text-gray-600 text-sm">No saved vendors yet. Save vendors from workshop cards to see them here.</p>
            ) : (
              <div className="space-y-2">
                {savedVendors.map((v) => (
                  <Link
                    key={v.id}
                    href={`/vendors/${v.id}`}
                    className="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{v.name}</p>
                    <p className="text-sm text-[#5D755D]">View workshops</p>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-3">
            <Link href="/privacy" className="text-xs text-gray-500 hover:text-gray-700">
              Privacy Policy
            </Link>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" className="w-full sm:flex-1" asChild>
                <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
                  App Store
                </a>
              </Button>
              <Button variant="outline" className="w-full sm:flex-1" asChild>
                <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
                  Google Play
                </a>
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={deleteAccount}
              disabled={deleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {deleting ? 'Deleting…' : 'Delete my account'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
