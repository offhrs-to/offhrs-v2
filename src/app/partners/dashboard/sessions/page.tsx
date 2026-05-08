'use client'

import { Suspense } from 'react'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Eye, EyeOff, CalendarDays, Users, Clock, DollarSign } from 'lucide-react'
import { SessionForm } from './SessionForm'

interface Session {
  id: string
  title: string
  category: string
  price_cad: number | null
  max_attendees: number | null
  available_slots: number | null
  duration_minutes: number | null
  date: string | null
  location: string | null
  status: string
  cal_event_type_id: string | null
  created_at: string
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: { label: 'Published', className: 'bg-green-100 text-green-700' },
  draft: { label: 'Draft', className: 'bg-[#F0EDE8] text-[#888]' },
  fully_booked: { label: 'Fully Booked', className: 'bg-blue-100 text-blue-700' },
  archived: { label: 'Archived', className: 'bg-red-50 text-red-400' },
}

function SessionsPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1')
  const [editingSession, setEditingSession] = useState<Session | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    try {
      const url = statusFilter !== 'all' ? `/api/partners/sessions?status=${statusFilter}` : '/api/partners/sessions'
      const res = await fetch(url)
      const data = await res.json()
      setSessions(data.sessions ?? [])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  async function handleDelete(id: string) {
    if (!confirm('Archive this session? It will no longer be visible to consumers.')) return
    await fetch(`/api/partners/sessions/${id}`, { method: 'DELETE' })
    await fetchSessions()
  }

  async function handleToggleStatus(session: Session) {
    const newStatus = session.status === 'published' ? 'draft' : 'published'
    await fetch(`/api/partners/sessions/${session.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    await fetchSessions()
  }

  function handleEdit(session: Session) {
    setEditingSession(session)
    setShowForm(true)
  }

  function handleFormClose() {
    setShowForm(false)
    setEditingSession(null)
    router.replace('/partners/dashboard/sessions')
    fetchSessions()
  }

  if (showForm || editingSession) {
    return (
      <SessionForm
        session={editingSession}
        onClose={handleFormClose}
      />
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[#1a1a1a]">Sessions</h1>
          <p className="text-sm text-[#888] mt-1">Manage your workshop sessions.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-[#5D755D] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#4d644d] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New session
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {['all', 'published', 'draft', 'fully_booked', 'archived'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              statusFilter === s
                ? 'bg-[#1a1a1a] text-white'
                : 'bg-[#F0EDE8] text-[#555] hover:bg-[#E8E4DE]'
            }`}
          >
            {s === 'all' ? 'All' : STATUS_BADGE[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Session list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-[#F5F2EE] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 bg-white border border-[#E8E4DE] rounded-xl">
          <CalendarDays className="w-10 h-10 text-[#C8BFB0] mx-auto mb-3" />
          <p className="text-sm font-medium text-[#1a1a1a]">No sessions yet</p>
          <p className="text-xs text-[#888] mt-1 mb-4">Create your first workshop session to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 bg-[#5D755D] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#4d644d] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create session
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const badge = STATUS_BADGE[session.status] ?? { label: session.status, className: 'bg-[#F0EDE8] text-[#888]' }
            return (
              <div
                key={session.id}
                className="bg-white border border-[#E8E4DE] rounded-xl p-4 flex items-center gap-4 hover:border-[#C8BFB0] transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-[#1a1a1a] truncate">{session.title}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${badge.className}`}>
                      {badge.label}
                    </span>
                    {session.cal_event_type_id && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 flex-shrink-0">
                        Cal synced
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#888]">
                    {session.price_cad !== null && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {session.price_cad === 0 ? 'Free' : `$${session.price_cad} CAD`}
                      </span>
                    )}
                    {session.max_attendees !== null && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {session.available_slots ?? session.max_attendees}/{session.max_attendees} spots
                      </span>
                    )}
                    {session.duration_minutes !== null && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.duration_minutes} min
                      </span>
                    )}
                    {session.date && (
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(session.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleStatus(session)}
                    title={session.status === 'published' ? 'Unpublish' : 'Publish'}
                    className="p-2 rounded-lg text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a] transition-colors"
                    disabled={session.status === 'fully_booked' || session.status === 'archived'}
                  >
                    {session.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => handleEdit(session)}
                    title="Edit"
                    className="p-2 rounded-lg text-[#888] hover:bg-[#F0EDE8] hover:text-[#1a1a1a] transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(session.id)}
                    title="Archive"
                    className="p-2 rounded-lg text-[#888] hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SessionsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#888]">Loading sessions…</div>}>
      <SessionsPageInner />
    </Suspense>
  )
}
