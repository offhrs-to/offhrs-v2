'use client'

import { useState } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface SessionFormProps {
  session?: {
    id: string
    title: string
    category: string
    price_cad: number | null
    max_attendees: number | null
    duration_minutes: number | null
    date: string | null
    location: string | null
    status: string
  } | null
  onClose: () => void
}

const CATEGORIES = [
  { value: 'pottery', label: 'Pottery' },
  { value: 'floral', label: 'Floral' },
  { value: 'culinary', label: 'Culinary' },
  { value: 'other', label: 'Other' },
]

export function SessionForm({ session, onClose }: SessionFormProps) {
  const isEdit = !!session?.id

  const [form, setForm] = useState({
    title: session?.title ?? '',
    category: session?.category ?? 'other',
    price_cad: session?.price_cad?.toString() ?? '0',
    max_attendees: session?.max_attendees?.toString() ?? '10',
    duration_minutes: session?.duration_minutes?.toString() ?? '90',
    date: session?.date ? new Date(session.date).toISOString().slice(0, 16) : '',
    location_type: 'in_person' as 'in_person' | 'virtual',
    location_address: session?.location ?? '',
    location_link: '',
    description: '',
    status: (session?.status ?? 'published') as 'published' | 'draft',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function set(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      title: form.title,
      category: form.category,
      price_cad: parseFloat(form.price_cad) || 0,
      max_attendees: parseInt(form.max_attendees) || 10,
      duration_minutes: parseInt(form.duration_minutes) || 90,
      date: form.date || undefined,
      location_type: form.location_type,
      location_address: form.location_type === 'in_person' ? form.location_address : undefined,
      location_link: form.location_type === 'virtual' ? form.location_link : undefined,
      description: form.description || undefined,
      status: form.status,
    }

    try {
      const res = await fetch(
        isEdit ? `/api/partners/sessions/${session.id}` : '/api/partners/sessions',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to save session.')
        setLoading(false)
        return
      }
      onClose()
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={onClose}
        className="flex items-center gap-2 text-sm text-[#888] hover:text-[#1a1a1a] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sessions
      </button>

      <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-6">
        {isEdit ? 'Edit session' : 'Create a new session'}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Title <span className="text-red-500">*</span></label>
          <input
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            required
            placeholder="e.g. Beginner Pottery Wheel Class"
            className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D] focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={3}
            placeholder="What will participants learn or experience?"
            className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D] focus:border-transparent resize-none"
          />
        </div>

        {/* Category + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Category <span className="text-red-500">*</span></label>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as 'published' | 'draft')}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            >
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Price + Max attendees + Duration */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Price (CAD) <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.price_cad}
                onChange={(e) => set('price_cad', e.target.value)}
                className="w-full pl-7 pr-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Max spots <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="1"
              value={form.max_attendees}
              onChange={(e) => set('max_attendees', e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Duration (min) <span className="text-red-500">*</span></label>
            <input
              type="number"
              min="15"
              step="15"
              value={form.duration_minutes}
              onChange={(e) => set('duration_minutes', e.target.value)}
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Date & time</label>
          <input
            type="datetime-local"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
          />
          <p className="text-xs text-[#888] mt-1">Leave blank for recurring sessions managed in your calendar.</p>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Location type <span className="text-red-500">*</span></label>
          <div className="flex gap-3 mb-3">
            {(['in_person', 'virtual'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set('location_type', type)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  form.location_type === type
                    ? 'border-[#5D755D] bg-[#EDF2ED] text-[#5D755D]'
                    : 'border-[#E8E4DE] bg-white text-[#555] hover:border-[#C8BFB0]'
                }`}
              >
                {type === 'in_person' ? 'In person' : 'Virtual'}
              </button>
            ))}
          </div>
          {form.location_type === 'in_person' ? (
            <input
              value={form.location_address}
              onChange={(e) => set('location_address', e.target.value)}
              placeholder="123 Main St, Toronto, ON"
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          ) : (
            <input
              type="url"
              value={form.location_link}
              onChange={(e) => set('location_link', e.target.value)}
              placeholder="https://zoom.us/j/..."
              className="w-full px-4 py-2.5 border border-[#E8E4DE] rounded-xl text-sm text-[#1a1a1a] bg-white focus:outline-none focus:ring-2 focus:ring-[#5D755D]"
            />
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-[#5D755D] text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-[#4d644d] disabled:opacity-60 transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create session'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-[#888] hover:text-[#1a1a1a] transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
