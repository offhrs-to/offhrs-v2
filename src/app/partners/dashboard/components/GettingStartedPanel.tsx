'use client'

import { useCallback, useLayoutEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { GettingStartedChecklist, type ChecklistItemProps } from './GettingStartedChecklist'

const STORAGE_KEY = 'partner-dashboard-getting-started-collapsed'

/** Collapsible inline checklist (e.g. embedded pages). Overview home uses {@link GettingStartedRail} instead. */
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
    <div className="bg-white border border-partner-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-partner-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Getting started</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {doneCount}/{items.length} complete
            {allDone ? ' — you are all set.' : ''}
          </p>
        </div>
        <span className="text-xs font-medium text-primary flex items-center gap-1 flex-shrink-0">
          {collapsed ? 'Show' : 'Hide'}
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </span>
      </button>

      {!collapsed && (
        <div className="px-5 pb-5 pt-0 border-t border-partner-border/80">
          <div className="pt-4">
            <GettingStartedChecklist items={items} allDone={allDone} showSummary={false} />
          </div>
        </div>
      )}
    </div>
  )
}

export type { ChecklistItemProps } from './GettingStartedChecklist'
