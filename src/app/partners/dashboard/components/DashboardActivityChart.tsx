'use client'

import { useMemo, useState } from 'react'
import type { ActivityDayPoint } from '@/lib/partner-dashboard-activity'

type Range = 7 | 30

const CHART_INNER_PX = 168

export function DashboardActivityChart({
  series30,
  spotsRemaining,
}: {
  series30: ActivityDayPoint[]
  spotsRemaining: number
}) {
  const [range, setRange] = useState<Range>(7)

  const data = useMemo(() => {
    if (series30.length < 30) return series30
    return range === 7 ? series30.slice(-7) : series30
  }, [series30, range])

  const maxY = useMemo(() => {
    let m = 1
    for (const d of data) {
      m = Math.max(m, d.bookings, d.churn)
    }
    return m
  }, [data])

  return (
    <div className="bg-white border border-[#E8E4DE] rounded-xl p-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Booking activity</h2>
          <p className="text-xs text-[#888] mt-1 max-w-xl">
            Grouped bars compare new bookings (green) with refunds and cancellations (rose) by day. Toggle 7 or 30
            days. Spots left is unsold capacity on published and fully booked workshops right now.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
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
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#888]">Spots left to fill</p>
            <p className="text-2xl font-semibold text-[#5D755D] tabular-nums">{spotsRemaining}</p>
          </div>
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

      <div className="relative min-h-[200px] pt-2">
        <div className="flex items-end justify-between gap-px sm:gap-0.5 border-b border-[#E8E4DE]">
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
                className="flex-1 flex flex-col justify-end items-center min-w-0 group"
                style={{ height: CHART_INNER_PX }}
                title={`${day.label}: ${day.bookings} booking(s), ${day.churn} refund(s) / cancelled`}
              >
                <div className="w-full flex items-end justify-center gap-[2px] sm:gap-0.5 px-px">
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
        <div className="flex justify-between gap-px sm:gap-0.5 mt-1.5 text-[9px] sm:text-[10px] leading-tight">
          {data.map((day, i) => {
            const showTick = range === 7 || i === 0 || i === data.length - 1 || i % 7 === 0
            return (
              <div key={`${day.date}-lbl`} className="flex-1 text-center min-w-0 truncate px-0.5">
                {showTick ? <span className="text-[#888]">{day.label}</span> : <span className="text-transparent select-none">·</span>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
