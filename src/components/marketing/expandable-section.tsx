'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

type ExpandableSectionProps = {
  label: string
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

export function ExpandableSection({
  label,
  children,
  defaultOpen = false,
  className = '',
}: ExpandableSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={className}>
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-neutral-300/90 bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-neutral-700 shadow-sm transition-colors hover:border-neutral-400 hover:bg-neutral-50"
        >
          {label}
          <ChevronDown
            className={`h-4 w-4 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {open ? <div className="mt-6 animate-in fade-in-0 slide-in-from-top-1 duration-200">{children}</div> : null}
    </div>
  )
}
