'use client'

import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_TOTAL_SESSIONS = 12
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function ymdOfCell(day: Date): string {
  return format(day, 'yyyy-MM-dd')
}

type MultiSpecificDatesCalendarProps = {
  /** Session 1 calendar day (yyyy-MM-dd) from the main datetime field. */
  session1Ymd: string | null
  /** Extra session datetime-local values (Workshop 2+). */
  extraDatetimes: string[]
  onChangeExtraDatetimes: (next: string[]) => void
  /** Default HH:mm when adding a newly clicked day. */
  defaultTimeHhMm: string
}

export function MultiSpecificDatesCalendar({
  session1Ymd,
  extraDatetimes,
  onChangeExtraDatetimes,
  defaultTimeHhMm,
}: MultiSpecificDatesCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))

  const selectedExtraYmds = useMemo(() => {
    const set = new Set<string>()
    for (const v of extraDatetimes) {
      const ymd = v.trim().slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) set.add(ymd)
    }
    return set
  }, [extraDatetimes])

  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const totalSelected = (session1Ymd ? 1 : 0) + selectedExtraYmds.size
  const atMax = totalSelected >= MAX_TOTAL_SESSIONS

  function toggleDay(ymd: string) {
    if (session1Ymd && ymd === session1Ymd) return

    if (selectedExtraYmds.has(ymd)) {
      onChangeExtraDatetimes(
        extraDatetimes.filter((v) => v.trim().slice(0, 10) !== ymd)
      )
      return
    }

    if (atMax) return

    const time = /^\d{2}:\d{2}$/.test(defaultTimeHhMm) ? defaultTimeHhMm : '18:00'
    const next = [...extraDatetimes, `${ymd}T${time}`].sort((a, b) => a.localeCompare(b))
    onChangeExtraDatetimes(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Pick session dates</p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 border-partner-border"
            aria-label="Previous month"
            onClick={() => setMonth((m) => addMonths(m, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[8.5rem] text-center text-sm font-medium text-foreground">
            {format(month, 'MMMM yyyy')}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 border-partner-border"
            aria-label="Next month"
            onClick={() => setMonth((m) => addMonths(m, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-partner-border bg-white">
        <div className="grid grid-cols-7 border-b border-partner-border bg-partner-canvas/60">
          {WEEKDAY_LABELS.map((label) => (
            <div
              key={label}
              className="px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map((day) => {
            const ymd = ymdOfCell(day)
            const inMonth = isSameMonth(day, month)
            const isSession1 = Boolean(session1Ymd && ymd === session1Ymd)
            const isExtra = selectedExtraYmds.has(ymd)
            const selected = isSession1 || isExtra
            const disabledAdd = !selected && atMax

            return (
              <button
                key={ymd}
                type="button"
                disabled={isSession1 || (!inMonth && !selected) || disabledAdd}
                title={
                  isSession1
                    ? 'Session 1 — set above'
                    : disabledAdd
                      ? `Maximum ${MAX_TOTAL_SESSIONS} sessions`
                      : undefined
                }
                onClick={() => toggleDay(ymd)}
                className={cn(
                  'relative flex min-h-11 flex-col items-center justify-center border-b border-r border-partner-border/70 px-1 py-1.5 text-sm transition-colors',
                  !inMonth && 'bg-partner-canvas/40 text-muted-foreground/50',
                  inMonth && !selected && 'text-foreground hover:bg-partner-muted/70',
                  selected && 'bg-primary/15 font-semibold text-primary',
                  isSession1 && 'cursor-default ring-1 ring-inset ring-primary/30',
                  disabledAdd && !selected && 'cursor-not-allowed opacity-40'
                )}
              >
                <span>{format(day, 'd')}</span>
                {isSession1 ? (
                  <span className="text-[9px] font-medium uppercase tracking-wide text-primary">1</span>
                ) : isExtra ? (
                  <span className="size-1 rounded-full bg-primary" aria-hidden />
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Session 1 is the date &amp; time at the top of this form
        {session1Ymd ? ` (${session1Ymd})` : ''}. Click more days to add Workshop 2+
        (same details — only the schedule changes). Up to {MAX_TOTAL_SESSIONS} sessions total.
        {totalSelected > 0 ? ` Selected: ${totalSelected}.` : ''}
      </p>
    </div>
  )
}
