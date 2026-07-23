'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ClipboardList, Clock, X } from 'lucide-react'
import { GettingStartedChecklist, type ChecklistItemProps } from './GettingStartedChecklist'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function GettingStartedRail({
  items,
  allDone,
  trialDays,
  initialOpen = false,
  onOpenChange,
}: {
  items: ChecklistItemProps[]
  allDone: boolean
  trialDays: number | null
  /** Open the rail on first paint (e.g. after signup redirect with ?onboarding=1). */
  initialOpen?: boolean
  /** Fires when the rail opens or closes so siblings (e.g. notifications) can adjust stacking. */
  onOpenChange?: (open: boolean) => void
}) {
  const [open, setOpen] = useState(initialOpen)
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
          className={`absolute right-0 top-0 z-10 h-full w-full max-w-md border-l border-partner-border bg-partner-canvas shadow-[-12px_0_40px_rgba(0,0,0,0.1)] flex flex-col transition-transform duration-300 ease-out ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-partner-border bg-white px-4 py-4">
            <div className="min-w-0">
              <h2 id="getting-started-rail-title" className="text-sm font-semibold text-foreground">
                Getting started
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">Your partner onboarding checklist</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={close}
              className="shrink-0 text-muted-foreground"
              aria-label="Close getting started"
            >
              <X className="size-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <div className="rounded-xl border border-partner-border bg-white p-4">
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
      <div className="relative flex flex-shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="partner-getting-started-rail"
          title={open ? 'Hide getting started checklist' : 'Open getting started checklist'}
          className={cn(
            'size-9 rounded-full',
            open
              ? 'border-primary bg-partner-tint text-primary'
              : 'border-partner-border bg-white text-muted-foreground'
          )}
        >
          <ClipboardList className="size-4" aria-hidden />
        </Button>

        {trialDays !== null && (
          <div
            className={`text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 ${
              trialDays <= 3
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-partner-tint text-primary'
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
