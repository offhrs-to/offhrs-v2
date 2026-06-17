'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, BellRing } from 'lucide-react'

const POLL_MS = 90_000
const SEEN_KEY = 'partner-notifications-seen-ids'

export type PartnerNotificationDto = {
  id: string
  type:
    | 'booking_new'
    | 'booking_refund'
    | 'workshop_published'
    | 'workshop_reminder'
    | 'onboarding_tax_settings'
  title: string
  message: string
  createdAt: string
  href: string | null
}

function loadSeen(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    const arr = raw ? (JSON.parse(raw) as string[]) : []
    return new Set(arr.slice(-120))
  } catch {
    return new Set()
  }
}

function saveSeen(ids: Set<string>) {
  const arr = [...ids].slice(-120)
  localStorage.setItem(SEEN_KEY, JSON.stringify(arr))
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = Date.now()
  const diffMs = now - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

export function PartnerNotificationsBell({
  gettingStartedOpen = false,
}: {
  /** When true, the bell stays under the getting-started overlay and the menu closes. */
  gettingStartedOpen?: boolean
}) {
  const [items, setItems] = useState<PartnerNotificationDto[]>([])
  const [open, setOpen] = useState(false)
  const [seen, setSeen] = useState<Set<string>>(() => (typeof window !== 'undefined' ? loadSeen() : new Set()))
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/partners/notifications')
      const data = (await res.json()) as { notifications?: PartnerNotificationDto[]; error?: string }
      if (!res.ok) return
      setItems(data.notifications ?? [])
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), POLL_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (gettingStartedOpen) setOpen(false)
  }, [gettingStartedOpen])

  useLayoutEffect(() => {
    if (!open) return
    setSeen((prev) => {
      const next = new Set(prev)
      for (const n of items) next.add(n.id)
      saveSeen(next)
      return next
    })
  }, [open, items])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const unread = items.filter((n) => !seen.has(n.id)).length

  return (
    <div
      className={gettingStartedOpen ? 'relative z-0' : 'relative z-[110]'}
      ref={wrapRef}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        title={open ? 'Close notifications' : 'Notifications'}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
          open
            ? 'border-[#5D755D] bg-[#EDF2ED] text-[#5D755D]'
            : 'border-[#E8E4DE] bg-white text-[#555] hover:border-[#C8BFB0] hover:text-[#1a1a1a]'
        }`}
      >
        {unread > 0 ? <BellRing className="w-4 h-4" aria-hidden /> : <Bell className="w-4 h-4" aria-hidden />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-[#8B4D4D] text-[10px] font-bold text-white leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[120] w-[min(calc(100vw-2rem),22rem)] rounded-xl border border-[#E8E4DE] bg-white shadow-xl overflow-hidden"
          role="menu"
        >
          <div className="border-b border-[#F0EDE8] px-4 py-3 bg-[#FAFAF8]">
            <p className="text-sm font-semibold text-[#1a1a1a]">Notifications</p>
            <p className="text-xs text-[#888] mt-0.5">
              Bookings, refunds, publishes, tax setup, and tomorrow&apos;s workshops
            </p>
          </div>
          <div className="max-h-[min(70vh,420px)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#888]">No recent activity.</p>
            ) : (
              <ul className="divide-y divide-[#F5F2EE]">
                {items.map((n) => {
                  const isNew = !seen.has(n.id)
                  const inner = (
                    <div className={`px-4 py-3 text-left transition-colors ${isNew ? 'bg-[#FAFAF8]' : 'hover:bg-[#FAFAF8]'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-[#1a1a1a] leading-snug">{n.title}</p>
                        <span className="text-[10px] text-[#aaa] whitespace-nowrap flex-shrink-0">{formatWhen(n.createdAt)}</span>
                      </div>
                      <p className="text-xs text-[#555] mt-1 leading-relaxed">{n.message}</p>
                    </div>
                  )
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link href={n.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5D755D]" onClick={() => setOpen(false)}>
                          {inner}
                        </Link>
                      ) : (
                        <div>{inner}</div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
