'use client'

import { useEffect, useState } from 'react'
import { CalendarDays, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface CalendarClientProps {
  calUserId: string | null
  accessToken: string | null
  calConnected: boolean
  vendorId: string
}

// Dynamically import Cal.com Atoms to avoid SSR issues
let CalProvider: React.ComponentType<{ clientId: string; accessToken: string; children: React.ReactNode }> | null = null
let Connect: React.ComponentType<{ onSuccess?: () => void | Promise<void> }> | null = null
let AvailabilitySettings: React.ComponentType<{ id?: number }> | null = null

export function CalendarClient({ calUserId, accessToken, calConnected, vendorId }: CalendarClientProps) {
  const [atomsLoaded, setAtomsLoaded] = useState(false)
  const [atomsError, setAtomsError] = useState(false)
  const [connected, setConnected] = useState(calConnected)
  const router = useRouter()
  const [provisionLoading, setProvisionLoading] = useState(false)
  const [provisionMsg, setProvisionMsg] = useState<string | null>(null)

  useEffect(() => {
    async function loadAtoms() {
      try {
        const atoms = await import('@calcom/atoms')
        CalProvider = atoms.CalProvider as unknown as typeof CalProvider
        Connect = atoms.Connect as unknown as typeof Connect
        AvailabilitySettings = atoms.AvailabilitySettings as unknown as typeof AvailabilitySettings
        setAtomsLoaded(true)
      } catch (err) {
        console.error('Failed to load Cal.com Atoms:', err)
        setAtomsError(true)
      }
    }
    loadAtoms()
  }, [])

  // Cal.com not provisioned yet
  if (!calUserId || !accessToken) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">Calendar</h1>
        <p className="text-sm text-[#888] mb-6">Manage your availability and connected calendars.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex gap-4">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 mb-1">Calendar setup pending</p>
            <p className="text-sm text-amber-700">
              Your calendar account is being provisioned. This usually takes a few minutes after your trial starts.
              If this persists, please contact support.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={provisionLoading}
            onClick={async () => {
              setProvisionLoading(true)
              setProvisionMsg(null)
              try {
                const res = await fetch('/api/partners/cal/provision', { method: 'POST', credentials: 'include' })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data.error ?? 'Failed to provision calendar access.')
                router.refresh()
                // If the server props change, refresh should be enough; reload as a fallback.
                window.location.reload()
              } catch (e) {
                const msg = e instanceof Error ? e.message : 'Failed to provision calendar access.'
                setProvisionMsg(msg)
              } finally {
                setProvisionLoading(false)
              }
            }}
            className="w-full text-sm font-semibold text-[#1a1a1a] border border-[#E8E4DE] px-4 py-2.5 rounded-xl hover:bg-[#F0EDE8] disabled:opacity-60 transition-colors"
          >
            {provisionLoading ? 'Provisioning…' : 'Provision calendar access'}
          </button>
          {provisionMsg && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {provisionMsg}
            </p>
          )}
        </div>
      </div>
    )
  }

  if (atomsError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-6">Calendar</h1>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <p className="text-sm text-red-700">
            Failed to load calendar components. Please refresh the page or contact support.
          </p>
        </div>
      </div>
    )
  }

  if (!atomsLoaded || !CalProvider || !Connect || !AvailabilitySettings) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-6">Calendar</h1>
        <div className="space-y-4">
          <div className="h-32 bg-[#F5F2EE] rounded-xl animate-pulse" />
          <div className="h-64 bg-[#F5F2EE] rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  const clientId = process.env.NEXT_PUBLIC_CAL_OAUTH_CLIENT_ID ?? ''

  return (
    <CalProvider clientId={clientId} accessToken={accessToken}>
      <div className="p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">Calendar</h1>
        <p className="text-sm text-[#888] mb-6">Connect your calendar and set your availability.</p>

        {/* Connect Google / Outlook */}
        <div className="bg-white border border-[#E8E4DE] rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays className="w-5 h-5 text-[#5D755D]" />
            <div>
              <h2 className="text-sm font-semibold text-[#1a1a1a]">Connected calendars</h2>
              <p className="text-xs text-[#888]">
                Connect Google or Outlook to block busy times and sync bookings automatically.
              </p>
            </div>
          </div>
          <Connect
            onSuccess={async () => {
              setConnected(true)
              // Mark cal_connected on the vendor profile
              await fetch('/api/partners/cal/mark-connected', { method: 'POST' })
            }}
          />
          {connected && (
            <p className="mt-3 text-xs text-[#5D755D] font-medium">Calendar connected ✓</p>
          )}
        </div>

        {/* Availability */}
        <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[#1a1a1a] mb-1">Availability</h2>
          <p className="text-xs text-[#888] mb-4">Set your working hours and blackout dates.</p>
          <AvailabilitySettings />
        </div>
      </div>
    </CalProvider>
  )
}
