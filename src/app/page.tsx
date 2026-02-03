'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { CheckCircle, MapPin, Shield } from 'lucide-react'
import { CATEGORIES } from '@/constants/categories'

export default function Home() {
  const router = useRouter()
  const { user } = useAuth()
  const [profile, setProfile] = useState<{ expertise_level: string | null; experience_points: number | null } | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!user?.id) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('expertise_level, experience_points')
      .eq('id', user.id)
      .single()
      .then(({ data }) => setProfile(data ?? null))
  }, [user?.id])

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || null
  const level = profile?.expertise_level || 'Novice'
  const points = profile?.experience_points ?? 0

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  const handleBrowse = () => {
    // Workshops page removed for redesign; stay on home
    router.push('/')
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleBrowse()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header with Welcome + Level for logged-in users */}
      {user && (
        <div className="border-b border-gray-100 bg-white/80">
          <div className="container mx-auto px-4 py-4 max-w-7xl flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-500">Welcome</p>
              <p className="text-lg font-semibold text-gray-900">{displayName}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[#5D755D]">{level}</p>
              <p className="text-xs text-gray-500">{points}/10 points</p>
            </div>
          </div>
        </div>
      )}

      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 max-w-7xl">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 text-center">
            Ready to learn a new skill? Discover Workshops around you.
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto text-center">
            Find curated leisure workshops near you. From crafting to cooking, discover your next creative adventure.
          </p>

          <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search classes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#5D755D]/50"
              />
              <Button type="submit" size="lg" className="rounded-md bg-[#5D755D] hover:bg-[#4a5e4a]">
                Search
              </Button>
            </div>
          </form>

          <p className="text-center text-gray-700 font-medium mb-4">What sparks your curiosity?</p>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {CATEGORIES.filter((cat) => cat !== 'Other').map((cat) => {
              const isActive = selectedCategories.includes(cat)
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    isActive ? 'bg-[#5D755D] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          <div className="text-center">
            <Button
              onClick={handleBrowse}
              size="lg"
              className="rounded-md bg-[#5D755D] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#4a5e4a]"
            >
              Browse Workshops
            </Button>
          </div>
        </section>

        {/* Value Prop Section */}
        <section className="container mx-auto px-4 py-16 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Curated */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-moss/10 mb-4">
                <CheckCircle className="h-8 w-8 text-moss" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-2">Curated</h3>
              <p className="text-slate-600">
                We compiled the best workshops in Toronto, so you don't have to search through individual listings.
              </p>
            </div>

            {/* Local */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-moss/10 mb-4">
                <MapPin className="h-8 w-8 text-moss" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-2">Local</h3>
              <p className="text-slate-600">
                Focused on Toronto's vibrant workshop scene. Discover hidden gems in your own backyard.
              </p>
            </div>

            {/* Verified */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-moss/10 mb-4">
                <Shield className="h-8 w-8 text-moss" />
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 mb-2">Verified</h3>
              <p className="text-slate-600">
                All workshops are verified to ensure quality and reliability for your peace of mind.
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 bg-slate-50 mt-20">
          <div className="container mx-auto px-4 py-8 max-w-7xl text-center">
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} Offhrs. All rights reserved.
            </p>
          </div>
        </footer>
      </main>
    </div>
  )
}
