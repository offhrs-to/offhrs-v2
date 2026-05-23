'use client'

import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { formatWorkshopDateTimeLocalValue } from '@/lib/workshop-timezone'
import { spotsFilledLabel } from '@/lib/workshop-spots-label'
import type { SeriesOccurrence } from '@/lib/workshop-series'

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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="occurrence-edit-title"
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0EDE8]">
          <div>
            <h2 id="occurrence-edit-title" className="text-base font-semibold text-[#1a1a1a]">
              Edit session
            </h2>
            <p className="text-xs text-[#888] mt-0.5 truncate max-w-[280px]">{target.sessionTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#888] hover:bg-[#F0EDE8]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-[#555]">
            {spotsFilledLabel(occ?.max_attendees, occ?.available_slots)}
            {filled > 0 ? ' — refund bookings before canceling this session.' : ''}
          </p>

          <div>
            <label htmlFor="occ-start" className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Date &amp; time
            </label>
            <input
              id="occ-start"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          <div>
            <label htmlFor="occ-max" className="block text-sm font-medium text-[#1a1a1a] mb-1">
              Max spots (this session only)
            </label>
            <input
              id="occ-max"
              type="number"
              min={1}
              max={500}
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="px-5 py-4 border-t border-[#F0EDE8] flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={loading || cancelLoading}
            className="w-full py-2.5 rounded-xl bg-[#5D755D] text-white text-sm font-semibold hover:bg-[#4d644d] disabled:opacity-60"
          >
            {loading ? 'Saving…' : 'Save session'}
          </button>
          <button
            type="button"
            onClick={() => void handleCancelSession()}
            disabled={loading || cancelLoading || filled > 0}
            title={filled > 0 ? 'Refund active bookings before canceling this session' : 'Remove this session from the series'}
            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLoading ? 'Canceling…' : 'Cancel this session'}
          </button>
        </div>
      </div>
    </div>
  )
}
