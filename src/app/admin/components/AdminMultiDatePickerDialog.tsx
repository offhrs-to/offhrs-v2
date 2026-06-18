'use client'

import { useMemo, useState } from 'react'
import { TZDate } from '@date-fns/tz'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { workshopDateYmdInToronto } from '@/lib/recurring-event-instances'
import { WORKSHOP_TIMEZONE } from '@/lib/workshop-timezone'
import { cn } from '@/lib/utils'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function ymdToTorontoDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new TZDate(y, m - 1, d, 12, 0, 0, WORKSHOP_TIMEZONE)
}

function formatYmdLabel(ymd: string): string {
  return format(ymdToTorontoDate(ymd), 'EEE, MMM d, yyyy')
}

export function AdminMultiDatePickerDialog({
  open,
  onOpenChange,
  selectedDates,
  onSelectedDatesChange,
  initialAnchorYmd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedDates: Set<string>
  onSelectedDatesChange: (next: Set<string>) => void
  /** YYYY-MM-DD — month view opens here when the dialog opens. */
  initialAnchorYmd?: string | null
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (initialAnchorYmd) return ymdToTorontoDate(initialAnchorYmd)
    return new TZDate(Date.now(), WORKSHOP_TIMEZONE)
  })

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const monthEnd = endOfMonth(viewMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [viewMonth])

  const sortedSelected = useMemo(
    () => [...selectedDates].sort(),
    [selectedDates]
  )

  if (!open) return null

  const toggleDay = (day: Date) => {
    const key = workshopDateYmdInToronto(day)
    const next = new Set(selectedDates)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectedDatesChange(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close calendar"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-multi-date-picker-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 id="admin-multi-date-picker-title" className="text-base font-semibold text-slate-900">
              Select workshop dates
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Click days to toggle. Session time comes from the form — one listing per date.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold text-slate-900">{format(viewMonth, 'MMMM yyyy')}</p>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="text-center text-[10px] font-medium text-slate-400 py-1">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const key = workshopDateYmdInToronto(day)
              const selected = selectedDates.has(key)
              const inMonth = isSameMonth(day, viewMonth)
              return (
                <button
                  key={key + day.getTime()}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={cn(
                    'aspect-square rounded-lg text-sm font-medium transition-colors',
                    !inMonth && 'text-slate-300',
                    inMonth && !selected && 'text-slate-700 hover:bg-slate-100',
                    selected && 'bg-moss text-white shadow-sm hover:bg-moss-dark'
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          {sortedSelected.length > 0 ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <p className="text-xs font-medium text-slate-700 mb-2">
                {sortedSelected.length} date{sortedSelected.length === 1 ? '' : 's'} selected
              </p>
              <ul className="max-h-28 overflow-y-auto space-y-1">
                {sortedSelected.map((ymd) => (
                  <li key={ymd} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span>{formatYmdLabel(ymd)}</span>
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600 shrink-0"
                      onClick={() => {
                        const next = new Set(selectedDates)
                        next.delete(ymd)
                        onSelectedDatesChange(next)
                      }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-xs text-slate-500">Select at least two dates for a multi-date workshop.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <Button type="button" variant="outline" onClick={() => onSelectedDatesChange(new Set())}>
            Clear
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done ({sortedSelected.length})
          </Button>
        </div>
      </div>
    </div>
  )
}
