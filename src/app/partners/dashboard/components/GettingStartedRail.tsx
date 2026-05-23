'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, Clock, X } from 'lucide-react'
import { GettingStartedChecklist, type ChecklistItemProps } from './GettingStartedChecklist'

export function GettingStartedRail({
  items,
  allDone,
  trialDays,
  onOpenChange,
}: {
  items: ChecklistItemProps[]
  allDone: boolean
  trialDays: number | null
  /** Fires when the rail opens or closes so siblings (e.g. notifications) can adjust stacking. */
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [portalReady, setPortalReady] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    onOpenChange?.(open)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const overlay = portalReady ? (
    createPortal(
      <div
        className={`fixed inset-0 z-[100] ${open ? '' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <div
          className={`absolute inset-0 z-0 bg-black/25 transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={open ? close : undefined}
        />
        <aside
          id="partner-getting-started-rail"
          role="dialog"
          aria-modal={open}
          aria-labelledby="getting-started-rail-title"
          className={`absolute right-0 top-0 z-10 h-full w-full max-w-md border-l border-[#E8E4DE] bg-[#FAFAF8] shadow-[-12px_0_40px_rgba(0,0,0,0.1)] flex flex-col transition-transform duration-300 ease-out ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#E8E4DE] bg-white px-4 py-4">
            <div className="min-w-0">
              <h2 id="getting-started-rail-title" className="text-sm font-semibold text-[#1a1a1a]">
                Getting started
              </h2>
              <p className="text-xs text-[#888] mt-0.5">Your partner onboarding checklist</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a] transition-colors"
              aria-label="Close getting started"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="rounded-xl border border-[#E8E4DE] bg-white p-4">
              <GettingStartedChecklist items={items} allDone={allDone} />
            </div>
          </div>
        </aside>
      </div>,
      document.body
    )
  ) : null

  return (
    <>
      {overlay}
      <div className="relative flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="partner-getting-started-rail"
          title={open ? 'Hide getting started checklist' : 'Open getting started checklist'}
          className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            open
              ? 'border-[#5D755D] bg-[#EDF2ED] text-[#5D755D]'
              : 'border-[#E8E4DE] bg-white text-[#555] hover:border-[#C8BFB0] hover:text-[#1a1a1a]'
          }`}
        >
          <ClipboardList className="w-4 h-4" aria-hidden />
        </button>

        {trialDays !== null && (
          <div
            className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
              trialDays <= 3
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-[#EDF2ED] text-[#5D755D]'
            }`}
          >
            <Clock className="w-3.5 h-3 shrink-0" aria-hidden />
            {trialDays === 0 ? 'Trial ends today' : `${trialDays} days left in trial`}
          </div>
        )}
      </div>
    </>
  )
}
