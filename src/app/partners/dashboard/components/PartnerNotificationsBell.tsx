'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, BellRing } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PartnerEmptyState } from './PartnerEmptyState'
import { cn } from '@/lib/utils'

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
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        title={open ? 'Close notifications' : 'Notifications'}
        className={cn(
          'relative size-9 rounded-full',
          open
            ? 'border-primary bg-partner-tint text-primary'
            : 'border-partner-border bg-white text-muted-foreground'
        )}
      >
        {unread > 0 ? <BellRing className="size-4" aria-hidden /> : <Bell className="size-4" aria-hidden />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[120] w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-xl border border-partner-border bg-white shadow-xl"
          role="menu"
        >
          <div className="border-b border-partner-border bg-partner-canvas px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Bookings, refunds, publishes, tax setup, and tomorrow&apos;s workshops
            </p>
          </div>
          <div className="max-h-[min(70vh,420px)] overflow-y-auto">
            {items.length === 0 ? (
              <PartnerEmptyState compact title="No recent activity." />
            ) : (
              <ul className="divide-y divide-partner-border/80">
                {items.map((n) => {
                  const isNew = !seen.has(n.id)
                  const inner = (
                    <div className={`px-4 py-3 text-left transition-colors ${isNew ? 'bg-partner-canvas' : 'hover:bg-partner-canvas'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground leading-snug">{n.title}</p>
                        <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap flex-shrink-0">{formatWhen(n.createdAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{n.message}</p>
                    </div>
                  )
                  return (
                    <li key={n.id}>
                      {n.href ? (
                        <Link href={n.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => setOpen(false)}>
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
