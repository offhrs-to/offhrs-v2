'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { ActivityDayPoint } from '@/lib/partner-dashboard-activity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Range = 7 | 30

const CHART_INNER_PX = 168

/** Short weekday + day (e.g. "Tue 12"), UTC date key yyyy-MM-dd */
function axisLabel(yyyyMmDd: string): string {
  try {
    return format(parseISO(`${yyyyMmDd}T12:00:00.000Z`), 'EEE d')
  } catch {
    return yyyyMmDd
  }
}

function showXAxisTick(i: number, len: number, range: Range): boolean {
  if (len === 0) return false
  if (range === 7) return true
  // 30 days: every 3rd day from the start, and always the last column (today on the right)
  if (i === len - 1) return true
  return i % 3 === 0
}

export function DashboardActivityChart({
  series30,
  spotsRemaining,
  forcedRange,
  hideRangeToggle = false,
  showSpotsRemaining = true,
}: {
  series30: ActivityDayPoint[]
  spotsRemaining: number
  /** When set, locks the chart to this window (parent view owns the period). */
  forcedRange?: Range
  hideRangeToggle?: boolean
  showSpotsRemaining?: boolean
}) {
  const [rangeState, setRange] = useState<Range>(forcedRange ?? 7)
  const range = forcedRange ?? rangeState

  const data = useMemo(() => {
    if (!series30.length) return []
    if (series30.length >= 30) {
      return range === 7 ? series30.slice(-7) : series30
    }
    return range === 7 ? series30.slice(-Math.min(7, series30.length)) : series30
  }, [series30, range])

  const maxY = useMemo(() => {
    let m = 1
    for (const d of data) {
      m = Math.max(m, d.bookings, d.churn)
    }
    return m
  }, [data])

  const gridCols = data.length > 0 ? `repeat(${data.length}, minmax(0, 1fr))` : undefined

  return (
    <Card className="gap-0 overflow-x-auto border-partner-border py-0 shadow-none">
      <CardHeader className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-sm">
            Booking activity
            {forcedRange ? (
              <span className="font-normal text-muted-foreground"> · last {forcedRange} days</span>
            ) : null}
          </CardTitle>
          <CardDescription className="mt-1 max-w-xl text-xs">
            Grouped bars compare new bookings (green) with refunds and cancellations (rose) by day
            {forcedRange ? '.' : '. Toggle 7 or 30 days.'}
            {showSpotsRemaining
              ? ' Spots left is unsold capacity on published and fully booked workshops right now.'
              : ''}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
          {!hideRangeToggle && !forcedRange ? (
            <div className="flex rounded-lg border border-partner-border bg-partner-canvas p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRange(7)}
                className={cn(
                  'h-8 px-3 text-xs',
                  range === 7 && 'bg-white text-foreground hover:bg-white'
                )}
              >
                7 days
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setRange(30)}
                className={cn(
                  'h-8 px-3 text-xs',
                  range === 30 && 'bg-white text-foreground hover:bg-white'
                )}
              >
                30 days
              </Button>
            </div>
          ) : null}
          {showSpotsRemaining ? (
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Spots left to fill
              </p>
              <p className="text-2xl font-semibold tabular-nums text-primary">{spotsRemaining}</p>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5">
        <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" aria-hidden />
            Bookings
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-partner-chart-churn" aria-hidden />
            Refunds &amp; cancellations
          </span>
        </div>

        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity data for this range yet.
          </p>
        ) : (
          <div className="min-w-0 pb-6">
            <div
              className="grid gap-px border-b border-partner-border pb-px"
              style={{ gridTemplateColumns: gridCols }}
            >
              {data.map((day) => {
                const hBook =
                  maxY > 0
                    ? Math.max(Math.round((day.bookings / maxY) * CHART_INNER_PX), day.bookings > 0 ? 3 : 0)
                    : 0
                const hChurn =
                  maxY > 0
                    ? Math.max(Math.round((day.churn / maxY) * CHART_INNER_PX), day.churn > 0 ? 3 : 0)
                    : 0
                return (
                  <div
                    key={day.date}
                    className="flex min-h-0 min-w-0 flex-col items-center justify-end"
                    style={{ height: CHART_INNER_PX }}
                    title={`${axisLabel(day.date)} · ${day.bookings} booking(s), ${day.churn} refund(s) / cancelled`}
                  >
                    <div className="flex w-full max-w-full items-end justify-center gap-[2px] px-px sm:gap-0.5">
                      <div
                        className="w-[42%] max-w-[14px] shrink-0 rounded-t bg-primary transition-[height] duration-300 sm:max-w-[18px]"
                        style={{ height: hBook }}
                      />
                      <div
                        className="w-[42%] max-w-[14px] shrink-0 rounded-t bg-partner-chart-churn/90 transition-[height] duration-300 sm:max-w-[18px]"
                        style={{ height: hChurn }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-2 grid" style={{ gridTemplateColumns: gridCols }}>
              {data.map((day, i) => {
                const tick = showXAxisTick(i, data.length, range)
                return (
                  <div
                    key={`${day.date}-axis`}
                    className="flex h-12 min-w-0 items-start justify-center pt-0.5 sm:h-14"
                  >
                    {tick ? (
                      <span
                        className="origin-top translate-y-1 -rotate-45 whitespace-nowrap text-[10px] leading-none text-muted-foreground sm:text-[11px]"
                        title={`${day.date}`}
                      >
                        {axisLabel(day.date)}
                      </span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
