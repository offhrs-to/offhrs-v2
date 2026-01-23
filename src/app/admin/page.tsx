'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, Edit, Plus, LogOut, Wand2, Loader2 } from 'lucide-react' // Added Wand2 & Loader2

export default function AdminPage() {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  // --- APP STATE ---
  const [activeTab, setActiveTab] = useState<'add' | 'manage'>('manage')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false) // State for Magic Link loading
  const [message, setMessage] = useState('')
  const [events, setEvents] = useState<any[]>([])
  
  // --- FORM STATE ---
  const [editingId, setEditingId] = useState<number | null>(null)
  
  // Magic Link State
  const [magicLink, setMagicLink] = useState('')

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    category: 'Beauty & Fragrance',
    image_url: '',
    external_link: '',
    price: '',
    is_multiple_dates: false
  })

  const categories = [
    'Beauty & Fragrance', 'Culinary', 'Coffee', 'Floral', 
    'Pottery', 'Textiles', 'Music', 'Wellness', 'Other'
  ]

  // --- 1. LOGIN LOGIC ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (username === 'admin' && password === 'Am19em26!') {
      setIsAuthenticated(true)
      fetchEvents()
    } else {
      alert('Invalid credentials')
    }
  }

  // --- 2. DATA FETCHING ---
  async function fetchEvents() {
    setLoading(true)
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('id', { ascending: false })

    if (error) console.error('Error loading events:', error)
    else setEvents(data || [])
    setLoading(false)
  }

  // --- 3. MAGIC LINK FETCHER (The New Feature) ---
  const handleMagicFetch = async () => {
    if (!magicLink) return
    setFetching(true)
    setMessage('')

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: magicLink })
      })
      const data = await res.json()

      if (data.error) throw new Error(data.error)

      // Auto-fill form
      setFormData(prev => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
        image_url: data.image_url || prev.image_url,
        external_link: data.external_link || magicLink, // Use fetched link or input
        location: data.location || prev.location,
        price: data.price ? String(data.price) : prev.price,
        // Try to format date if it exists, otherwise leave blank
        date: data.date ? data.date.slice(0, 16) : prev.date
      }))

      setMessage('✨ Magic Fetch Successful! Review details below.')
    } catch (err) {
      console.error(err)
      setMessage('❌ Could not fetch details. Please enter manually.')
    } finally {
      setFetching(false)
    }
  }

  // --- 4. FORM HANDLERS ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, is_multiple_dates: e.target.checked }))
  }

  const handleEdit = (event: any) => {
    setEditingId(event.id)
    setFormData({
      title: event.title,
      description: event.description || '',
      date: event.date ? event.date.slice(0, 16) : '',
      location: event.location || '',
      category: event.category || 'Other',
      image_url: event.image_url || '',
      external_link: event.external_link || '',
      price: event.price ? String(event.price) : '',
      is_multiple_dates: event.is_multiple_dates || false
    })
    setActiveTab('add')
    setMessage('✏️ Editing Mode: Update details below')
    // Clear magic link when editing existing
    setMagicLink('') 
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) alert('Error deleting')
    else setEvents(events.filter(e => e.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        date: formData.date || null,
        location: formData.location,
        category: formData.category,
        image_url: formData.image_url,
        external_link: formData.external_link,
        price: formData.price ? Number(formData.price) : null,
        is_multiple_dates: formData.is_multiple_dates
      }

      let error
      if (editingId) {
        const res = await supabase.from('events').update(payload).eq('id', editingId)
        error = res.error
        setMessage('✅ Event updated successfully!')
      } else {
        const res = await supabase.from('events').insert([payload])
        error = res.error
        setMessage('✅ Event added successfully!')
      }

      if (error) throw error

      setFormData({
        title: '', description: '', date: '', location: '',
        category: 'Beauty & Fragrance', image_url: '', external_link: '',
        price: '', is_multiple_dates: false
      })
      setEditingId(null)
      setMagicLink('')
      fetchEvents()

    } catch (error: any) {
      setMessage(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  // --- VIEW: LOGIN SCREEN ---
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-md w-96 space-y-4">
          <h2 className="text-xl font-bold text-center">Admin Login</h2>
          <input 
            type="text" placeholder="Username" className="w-full p-2 border rounded"
            value={username} onChange={e => setUsername(e.target.value)} 
          />
          <input 
            type="password" placeholder="Password" className="w-full p-2 border rounded"
            value={password} onChange={e => setPassword(e.target.value)} 
          />
          <button type="submit" className="w-full bg-black text-white py-2 rounded font-medium">Enter</button>
        </form>
      </div>
    )
  }

  // --- VIEW: DASHBOARD ---
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Event Dashboard</h1>
          <button onClick={() => setIsAuthenticated(false)} className="flex items-center text-sm text-red-600 hover:text-red-800">
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </button>
        </div>

        <div className="flex gap-4 mb-6 border-b border-gray-200 pb-1">
          <button onClick={() => { setActiveTab('manage'); setEditingId(null); }}
            className={`pb-2 px-1 font-medium ${activeTab === 'manage' ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}>
            Manage Events
          </button>
          <button onClick={() => setActiveTab('add')}
            className={`pb-2 px-1 font-medium ${activeTab === 'add' ? 'text-black border-b-2 border-black' : 'text-gray-500'}`}>
            {editingId ? 'Edit Event' : 'Add New Event'}
          </button>
        </div>

        {message && (
          <div className={`p-4 rounded-md mb-6 ${message.includes('Error') ? 'bg-red-100 text-red-800' : (message.includes('Magic') ? 'bg-blue-50 text-blue-800' : 'bg-green-100 text-green-800')}`}>
            {message}
          </div>
        )}

        {/* --- TAB 1: MANAGE EVENTS --- */}
        {activeTab === 'manage' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{event.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{event.date ? new Date(event.date).toLocaleDateString() : 'TBD'}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{event.category}</td>
                    <td className="px-6 py-4 text-right text-sm font-medium flex justify-end gap-3">
                      <button onClick={() => handleEdit(event)} className="text-blue-600 hover:text-blue-900"><Edit className="w-5 h-5" /></button>
                      <button onClick={() => handleDelete(event.id)} className="text-red-600 hover:text-red-900"><Trash2 className="w-5 h-5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* --- TAB 2: ADD / EDIT FORM --- */}
        {activeTab === 'add' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
            
            {/* ✨ MAGIC LINK FETCHER SECTION */}
            <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <label className="block text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
                <Wand2 className="w-4 h-4" /> Auto-Fill from URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="Paste workshop website link here..."
                  className="flex-1 rounded-md border-blue-200 focus:border-blue-500 focus:ring-blue-500 text-sm"
                  value={magicLink}
                  onChange={(e) => setMagicLink(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleMagicFetch}
                  disabled={fetching || !magicLink}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch Info'}
                </button>
              </div>
              <p className="text-xs text-blue-600 mt-2">
                Note: Works best with structured sites (Eventbrite, Shopify, etc). Always verify fetched data.
              </p>
            </div>

            <h2 className="text-xl font-bold mb-6 border-t pt-6">{editingId ? 'Edit Event Details' : 'Event Details'}</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700">Workshop Title</label>
                <input type="text" name="title" required value={formData.title} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select name="category" value={formData.category} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2">
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Price ($)</label>
                  <input type="number" name="price" placeholder="85" value={formData.price} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date & Time</label>
                  <input type="datetime-local" name="date" value={formData.date} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div className="flex items-center pt-6">
                  <input type="checkbox" id="is_multiple_dates" checked={formData.is_multiple_dates} onChange={handleCheckbox} className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black" />
                  <label htmlFor="is_multiple_dates" className="ml-2 block text-sm text-gray-900">Multiple dates?</label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <input type="text" name="location" value={formData.location} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Image URL</label>
                <div className="flex gap-2">
                   <input type="url" name="image_url" value={formData.image_url} onChange={handleChange} className="mt-1 flex-1 rounded-md border border-gray-300 px-3 py-2" />
                   {formData.image_url && <img src={formData.image_url} alt="Preview" className="h-10 w-10 object-cover rounded border mt-1" />}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Booking Link</label>
                <input type="url" name="external_link" value={formData.external_link} onChange={handleChange} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => { setActiveTab('manage'); setEditingId(null); }} className="flex-1 py-3 px-4 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800">
                  {loading ? 'Saving...' : (editingId ? 'Update Event' : 'Add Event')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}