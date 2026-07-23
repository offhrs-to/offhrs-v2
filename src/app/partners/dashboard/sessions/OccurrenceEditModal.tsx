'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lock, LockOpen, X } from 'lucide-react'
import { formatWorkshopDateTimeLocalValue } from '@/lib/workshop-timezone'
import { spotsFilledLabel } from '@/lib/workshop-spots-label'
import type { SeriesOccurrence } from '@/lib/workshop-series'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type OccurrenceEditTarget = {
  sessionId: string
  sessionTitle: string
  occurrence: SeriesOccurrence
}

type OccurrenceEditModalProps = {
  target: OccurrenceEditTarget | null
  onClose: () => void
  onSaved: () => void
}

function occurrenceLabel(startIso: string): string {
  const d = new Date(startIso)
  if (Number.isNaN(d.getTime())) return 'Session'
  return d.toLocaleString('en-CA', {
    timeZone: 'America/Toronto',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function OccurrenceEditModal({ target, onClose, onSaved }: OccurrenceEditModalProps) {
  const [startLocal, setStartLocal] = useState('')
  const [maxAttendees, setMaxAttendees] = useState('')
  const [loading, setLoading] = useState(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const occ = target?.occurrence
  const filled = useMemo(() => {
    if (!occ) return 0
    const cap = occ.max_attendees ?? 0
    const remaining = occ.available_slots ?? cap
    return Math.max(0, Math.min(cap, cap - remaining))
  }, [occ])

  useEffect(() => {
    if (!target) {
      setStartLocal('')
      setMaxAttendees('')
      setError(null)
      return
    }
    setStartLocal(formatWorkshopDateTimeLocalValue(target.occurrence.start))
    setMaxAttendees(String(target.occurrence.max_attendees ?? 10))
    setError(null)
  }, [target?.sessionId, target?.occurrence.start])

  if (!target) return null

  async function handleSave() {
    if (!target) return
    setError(null)
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        occurrence_start: target.occurrence.start,
      }
      const nextStart = startLocal.trim()
      const origStart = formatWorkshopDateTimeLocalValue(target.occurrence.start)
      if (nextStart && nextStart !== origStart) {
        body.start = nextStart
      }
      const maxNum = parseInt(maxAttendees, 10)
      if (Number.isFinite(maxNum) && maxNum !== target.occurrence.max_attendees) {
        body.max_attendees = maxNum
      }
      if (!body.start && body.max_attendees === undefined) {
        onClose()
        return
      }

      const res = await fetch(`/api/partners/sessions/${target.sessionId}/occurrences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Could not save session.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleRegistration() {
    if (!target || !occ) return
    const closing = !occ.registration_closed
    if (closing) {
      if (
        !confirm(
          'Close registration for this session? It will be hidden from the app. Existing bookings are kept.'
        )
      ) {
        return
      }
    } else if (!confirm('Reopen registration for this session?')) {
      return
    }
    setError(null)
    setRegistrationLoading(true)
    try {
      const res = await fetch(`/api/partners/sessions/${target.sessionId}/occurrences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          occurrence_start: target.occurrence.start,
          registration_closed: closing,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Could not update registration.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setRegistrationLoading(false)
    }
  }

  async function handleCancelSession() {
    if (!target) return
    const label = occurrenceLabel(target.occurrence.start)
    if (
      !confirm(
        `Cancel this session?\n\n${label}\n\nIt will be removed from the workshop. This cannot be undone.`
      )
    ) {
      return
    }
    setError(null)
    setCancelLoading(true)
    try {
      const res = await fetch(`/api/partners/sessions/${target.sessionId}/occurrences`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occurrence_start: target.occurrence.start }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Could not cancel session.')
        return
      }
      onSaved()
      onClose()
    } finally {
      setCancelLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="occurrence-edit-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-partner-border bg-white shadow-none">
        <div className="flex items-center justify-between border-b border-partner-border px-5 py-4">
          <div>
            <h2 id="occurrence-edit-title" className="text-base font-semibold text-foreground">
              Edit session
            </h2>
            <p className="mt-0.5 max-w-[280px] truncate text-xs text-muted-foreground">{target.sessionTitle}</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <p className="text-xs text-muted-foreground">
            {spotsFilledLabel(occ?.max_attendees, occ?.available_slots)}
            {filled > 0 ? ' — refund bookings before canceling this session.' : ''}
          </p>

          <div>
            <Label htmlFor="occ-start" className="mb-1">
              Date &amp; time
            </Label>
            <Input
              id="occ-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="h-10 border-partner-border shadow-none"
            />
          </div>

          <div>
            <Label htmlFor="occ-max" className="mb-1">
              Max spots (this session only)
            </Label>
            <Input
              id="occ-max"
              type="number"
              min={1}
              max={500}
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              className="h-10 border-partner-border shadow-none"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="rounded-xl border border-partner-border bg-partner-canvas p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Registration</p>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              {occ?.registration_closed
                ? 'This session is hidden from the app. Existing bookings are kept.'
                : 'Close registration to hide this session from the app without refunding bookings.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleToggleRegistration()}
              disabled={loading || cancelLoading || registrationLoading}
              className={cn(
                occ?.registration_closed
                  ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                  : 'border-partner-border'
              )}
            >
              {registrationLoading ? (
                'Updating…'
              ) : occ?.registration_closed ? (
                <>
                  <LockOpen className="size-4" />
                  Reopen registration
                </>
              ) : (
                <>
                  <Lock className="size-4" />
                  Close registration
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-partner-border px-5 py-4">
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || cancelLoading || registrationLoading}
          >
            {loading ? 'Saving…' : 'Save session'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCancelSession()}
            disabled={loading || cancelLoading || registrationLoading || filled > 0}
            title={filled > 0 ? 'Refund active bookings before canceling this session' : 'Remove this session from the series'}
            className="border-red-200 text-red-600 hover:bg-red-50"
          >
            {cancelLoading ? 'Canceling…' : 'Cancel this session'}
          </Button>
        </div>
      </div>
    </div>
  )
}
