'use client'

import Link from 'next/link'
import { CheckCircle2, Circle } from 'lucide-react'
import { ConnectStripeButton } from './ConnectStripeButton'

export type ChecklistItemProps = {
  key: string
  label: string
  done: boolean
  showStripeCta: boolean
  href: string | null
}

export function GettingStartedChecklist({
  items,
  allDone,
  showSummary = true,
}: {
  items: ChecklistItemProps[]
  allDone: boolean
  /** When false, omit the progress line (e.g. parent already shows counts). */
  showSummary?: boolean
}) {
  const doneCount = items.filter((i) => i.done).length

  return (
    <>
      {showSummary && (
        <p className="text-xs text-[#888] mb-4">
          {doneCount}/{items.length} complete
          {allDone ? ' — you are all set.' : ''}
        </p>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-start gap-3">
            {item.done ? (
              <CheckCircle2 className="w-5 h-5 text-[#5D755D] flex-shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-5 h-5 text-[#C8BFB0] flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${item.done ? 'text-[#888] line-through' : 'text-[#1a1a1a]'}`}>{item.label}</p>
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
      <div className="mt-6 h-1.5 bg-[#F0EDE8] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#5D755D] rounded-full transition-all"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>
    </>
  )
}
