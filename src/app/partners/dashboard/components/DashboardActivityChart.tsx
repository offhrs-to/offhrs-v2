'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { ActivityDayPoint } from '@/lib/partner-dashboard-activity'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type Range = 7 | 30

const CHART_INNER_PX = 168
const LINE_CHART_H = 180
const LINE_PAD_X = 8
const LINE_PAD_TOP = 12
const LINE_PAD_BOTTOM = 8

/** Short weekday + day (e.g. "Tue 12"), UTC date key yyyy-MM-dd */
function axisLabel(yyyyMmDd: string): string {
  try {
    return format(parseISO(`${yyyyMmDd}T12:00:00.000Z`), 'EEE d')
  } catch {
    return yyyyMmDd
  }
}

/** Month day (e.g. "May 6") for line-chart x-axis */
function lineAxisLabel(yyyyMmDd: string): string {
  try {
    return format(parseISO(`${yyyyMmDd}T12:00:00.000Z`), 'MMM d')
  } catch {
    return yyyyMmDd
  }
}

function showXAxisTick(i: number, len: number, range: Range): boolean {
  if (len === 0) return false
  if (range === 7) return true
  if (i === len - 1) return true
  return i % 3 === 0
}

function niceMax(m: number): number {
  if (m <= 1) return 1
  if (m <= 4) return 4
  if (m <= 8) return 8
  if (m <= 12) return 12
  if (m <= 16) return 16
  const step = Math.ceil(m / 4)
  return step * 4
}

export function DashboardActivityChart({
  series30,
  spotsRemaining,
  forcedRange,
  hideRangeToggle = false,
  showSpotsRemaining = true,
  variant = 'bars',
}: {
  series30: ActivityDayPoint[]
  spotsRemaining: number
  /** When set, locks the chart to this window (parent view owns the period). */
  forcedRange?: Range
  hideRangeToggle?: boolean
  showSpotsRemaining?: boolean
  /** Overview sample uses a bookings line; detailed toggle still uses grouped bars. */
  variant?: 'bars' | 'line'
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
      m = Math.max(m, d.bookings, variant === 'bars' ? d.churn : 0)
    }
    return niceMax(m)
  }, [data, variant])

  const gridCols = data.length > 0 ? `repeat(${data.length}, minmax(0, 1fr))` : undefined

  const lineGeometry = useMemo(() => {
    if (variant !== 'line' || data.length === 0) return null
    const w = 100
    const innerH = LINE_CHART_H - LINE_PAD_TOP - LINE_PAD_BOTTOM
    const pts = data.map((d, i) => {
      const x =
        data.length === 1
          ? w / 2
          : LINE_PAD_X + (i / (data.length - 1)) * (w - LINE_PAD_X * 2)
      const y = LINE_PAD_TOP + innerH * (1 - d.bookings / maxY)
      return { x, y, ...d }
    })
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const area = `${line} L ${pts[pts.length - 1].x} ${LINE_PAD_TOP + innerH} L ${pts[0].x} ${LINE_PAD_TOP + innerH} Z`
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(maxY * (1 - t)))
    return { pts, line, area, ticks, innerH }
  }, [data, maxY, variant])

  return (
    <Card className="gap-0 overflow-x-auto border-partner-border py-0 shadow-none">
      <CardHeader className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-sm font-semibold">
            Booking activity
            {forcedRange ? (
              <span className="font-normal text-muted-foreground"> · last {forcedRange} days</span>
            ) : null}
          </CardTitle>
          {variant === 'bars' ? (
            <CardDescription className="mt-1 max-w-xl text-xs">
              Grouped bars compare new bookings (green) with refunds and cancellations (rose) by day
              {forcedRange ? '.' : '. Toggle 7 or 30 days.'}
              {showSpotsRemaining
                ? ' Spots left is unsold capacity on published and fully booked workshops right now.'
                : ''}
            </CardDescription>
          ) : null}
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
        {variant === 'bars' ? (
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
        ) : null}

        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity data for this range yet.
          </p>
        ) : variant === 'line' && lineGeometry ? (
          <div className="min-w-0">
            <div className="flex gap-3">
              <div
                className="flex flex-col justify-between py-1 text-[10px] tabular-nums text-muted-foreground"
                style={{ height: LINE_CHART_H }}
                aria-hidden
              >
                {lineGeometry.ticks.map((t, i) => (
                  <span key={`${t}-${i}`}>{t}</span>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <svg
                  viewBox={`0 0 100 ${LINE_CHART_H}`}
                  className="h-[180px] w-full overflow-visible"
                  role="img"
                  aria-label={`Booking activity over the last ${range} days`}
                >
                  {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                    const y = LINE_PAD_TOP + lineGeometry.innerH * t
                    return (
                      <line
                        key={t}
                        x1={LINE_PAD_X}
                        x2={100 - LINE_PAD_X}
                        y1={y}
                        y2={y}
                        stroke="currentColor"
                        className="text-partner-border"
                        strokeWidth={0.35}
                      />
                    )
                  })}
                  <path d={lineGeometry.area} className="fill-primary/15" />
                  <path
                    d={lineGeometry.line}
                    fill="none"
                    className="stroke-primary"
                    strokeWidth={1.75}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  {lineGeometry.pts.map((p) => (
                    <circle
                      key={p.date}
                      cx={p.x}
                      cy={p.y}
                      r={1.6}
                      className="fill-white stroke-primary"
                      strokeWidth={1.25}
                      vectorEffect="non-scaling-stroke"
                    >
                      <title>
                        {lineAxisLabel(p.date)} · {p.bookings} booking{p.bookings === 1 ? '' : 's'}
                      </title>
                    </circle>
                  ))}
                </svg>
                <div className="mt-1 grid" style={{ gridTemplateColumns: gridCols }}>
                  {data.map((day) => (
                    <div key={`${day.date}-axis`} className="min-w-0 text-center">
                      <span className="text-[10px] text-muted-foreground sm:text-[11px]">
                        {lineAxisLabel(day.date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
