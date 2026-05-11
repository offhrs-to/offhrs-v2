'use client'

import { useCallback, useLayoutEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react'
import { ConnectStripeButton } from './ConnectStripeButton'

const STORAGE_KEY = 'partner-dashboard-getting-started-collapsed'

export type ChecklistItemProps = {
  key: string
  label: string
  done: boolean
  showStripeCta: boolean
  href: string | null
}

export function GettingStartedPanel({
  items,
  allDone,
}: {
  items: ChecklistItemProps[]
  allDone: boolean
}) {
  const [collapsed, setCollapsed] = useState(allDone)

  useLayoutEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === '1') setCollapsed(true)
    else if (stored === '0') setCollapsed(false)
  }, [])

  const toggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const doneCount = items.filter((i) => i.done).length

  return (
    <div className="bg-white border border-[#E8E4DE] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[#FAF9F7] transition-colors"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[#1a1a1a]">Getting started</h2>
          <p className="text-xs text-[#888] mt-0.5">
            {doneCount}/{items.length} complete
            {allDone ? ' — you are all set.' : ''}
          </p>
        </div>
        <span className="text-xs font-medium text-[#5D755D] flex items-center gap-1 flex-shrink-0">
          {collapsed ? 'Show' : 'Hide'}
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 pt-0 border-t border-[#F5F2EE]">
          <div className="space-y-3 pt-4">
            {items.map((item) => (
              <div key={item.key} className="flex items-start gap-3">
                {item.done ? (
                  <CheckCircle2 className="w-5 h-5 text-[#5D755D] flex-shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-5 h-5 text-[#C8BFB0] flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${item.done ? 'text-[#888] line-through' : 'text-[#1a1a1a]'}`}>
                    {item.label}
                  </p>
                </div>
                {!item.done && item.showStripeCta && <ConnectStripeButton compact />}
                {!item.done && item.href && (
                  <Link
                    href={item.href}
                    className="text-xs font-medium text-[#5D755D] hover:underline flex-shrink-0"
                  >
                    Go →
                  </Link>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 h-1.5 bg-[#F0EDE8] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#5D755D] rounded-full transition-all"
              style={{ width: `${(doneCount / items.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
