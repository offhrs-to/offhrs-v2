'use client'

import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import type { ActivityDayPoint } from '@/lib/partner-dashboard-activity'

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
    <div className="bg-white border border-[#E8E4DE] rounded-xl p-5 overflow-x-auto">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Booking activity</h2>
          <p className="text-xs text-[#888] mt-1 max-w-xl">
            Grouped bars compare new bookings (green) with refunds and cancellations (rose) by day
            {forcedRange
              ? ` over the last ${forcedRange} days.`
              : '. Toggle 7 or 30 days.'}
            {showSpotsRemaining
              ? ' Spots left is unsold capacity on published and fully booked workshops right now.'
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
          {!hideRangeToggle && !forcedRange ? (
            <div className="flex rounded-lg border border-[#E8E4DE] p-0.5 bg-[#FAFAF8]">
              <button
                type="button"
                onClick={() => setRange(7)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === 7 ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-[#888] hover:text-[#555]'
                }`}
              >
                7 days
              </button>
              <button
                type="button"
                onClick={() => setRange(30)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === 30 ? 'bg-white text-[#1a1a1a] shadow-sm' : 'text-[#888] hover:text-[#555]'
                }`}
              >
                30 days
              </button>
            </div>
          ) : null}
          {showSpotsRemaining ? (
            <div className="text-left sm:text-right">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[#888]">Spots left to fill</p>
              <p className="text-2xl font-semibold text-[#5D755D] tabular-nums">{spotsRemaining}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-4 mb-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-[#555]">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#5D755D]" aria-hidden />
          Bookings
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#555]">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#B85C5C]" aria-hidden />
          Refunds &amp; cancellations
        </span>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-[#888] py-8 text-center">No activity data for this range yet.</p>
      ) : (
        <div className="min-w-0 pb-6">
          {/* Bars: grid columns align 1:1 with x-axis labels below */}
          <div
            className="grid gap-px border-b border-[#E8E4DE] pb-px"
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
                  className="flex flex-col justify-end items-center min-w-0 min-h-0"
                  style={{ height: CHART_INNER_PX }}
                  title={`${axisLabel(day.date)} · ${day.bookings} booking(s), ${day.churn} refund(s) / cancelled`}
                >
                  <div className="w-full flex items-end justify-center gap-[2px] sm:gap-0.5 px-px max-w-full">
                    <div
                      className="w-[42%] max-w-[14px] sm:max-w-[18px] rounded-t bg-[#5D755D] transition-[height] duration-300 shrink-0"
                      style={{ height: hBook }}
                    />
                    <div
                      className="w-[42%] max-w-[14px] sm:max-w-[18px] rounded-t bg-[#B85C5C]/90 transition-[height] duration-300 shrink-0"
                      style={{ height: hChurn }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* X-axis: same column template; cadence for 30d; no truncate (was causing "Ap…" ellipses) */}
          <div className="grid mt-2" style={{ gridTemplateColumns: gridCols }}>
            {data.map((day, i) => {
              const tick = showXAxisTick(i, data.length, range)
              return (
                <div
                  key={`${day.date}-axis`}
                  className="flex justify-center items-start min-w-0 pt-0.5 h-12 sm:h-14"
                >
                  {tick ? (
                    <span
                      className="text-[10px] sm:text-[11px] text-[#888] whitespace-nowrap leading-none -rotate-45 origin-top translate-y-1"
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
    </div>
  )
}
