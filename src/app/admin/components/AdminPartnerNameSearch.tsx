'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminFetch } from '@/lib/admin-fetch'
import { cn } from '@/lib/utils'
import { Loader2, Search } from 'lucide-react'
import type { AdminPartnerSearchRow } from '@/app/api/admin/partner-search/route'

type Props = {
  organizer: string
  vendorProfileId: string | null
  onOrganizerChange: (value: string) => void
  onVendorProfileIdChange: (id: string | null) => void
  /** Optional: pre-fill workshop location from partner's saved address. */
  onLocationHint?: (address: string) => void
  disabled?: boolean
}

export function AdminPartnerNameSearch({
  organizer,
  vendorProfileId,
  onOrganizerChange,
  onVendorProfileIdChange,
  onLocationHint,
  disabled = false,
}: Props) {
  const listId = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<AdminPartnerSearchRow[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  const runSearch = useCallback(async (term: string) => {
    const q = term.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await adminFetch(`/api/admin/partner-search?q=${encodeURIComponent(q)}`)
      if (!res.ok) {
        setResults([])
        return
      }
      const json = (await res.json()) as { results?: AdminPartnerSearchRow[] }
      setResults(json.results ?? [])
      setActiveIndex(-1)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      void runSearch(organizer)
    }, 280)
    return () => window.clearTimeout(t)
  }, [organizer, open, runSearch])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const selectRow = (row: AdminPartnerSearchRow) => {
    onOrganizerChange(row.label)
    onVendorProfileIdChange(row.vendorProfileId)
    if (row.locationAddress && onLocationHint) {
      onLocationHint(row.locationAddress)
    }
    setOpen(false)
    setResults([])
  }

  const handleInputChange = (value: string) => {
    onOrganizerChange(value)
    onVendorProfileIdChange(null)
    setOpen(true)
  }

  const showList = open && organizer.trim().length >= 2 && (loading || results.length > 0)

  return (
    <div className="space-y-2" ref={wrapRef}>
      <Label htmlFor="admin-partner-organizer">Organizer / Vendor</Label>
      <p className="text-xs text-slate-500">
        Search existing partners or legacy vendors by name. You can still type a new name manually.
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          id="admin-partner-organizer"
          name="organizer"
          value={organizer}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (!showList || results.length === 0) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && activeIndex >= 0) {
              e.preventDefault()
              const row = results[activeIndex]
              if (row) selectRow(row)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          placeholder="Search partner or vendor name…"
          disabled={disabled}
          className="pl-9"
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : null}
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          >
            {results.map((row, idx) => (
              <li key={row.key} role="option" aria-selected={idx === activeIndex}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-slate-50',
                    idx === activeIndex && 'bg-slate-50'
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectRow(row)}
                >
                  <span className="font-medium text-slate-900">{row.label}</span>
                  <span className="text-xs text-slate-500">
                    {row.source === 'partner'
                      ? `Partner${row.status ? ` · ${row.status}` : ''}`
                      : 'Legacy vendor'}
                    {row.locationAddress ? ` · ${row.locationAddress}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {vendorProfileId ? (
        <p className="text-xs text-moss">Linked to partner profile (ID saved on this workshop).</p>
      ) : null}
    </div>
  )
}
