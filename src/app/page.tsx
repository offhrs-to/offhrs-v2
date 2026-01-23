'use client'

import Link from 'next/link'
import Navbar from '@/components/navbar'
import { Button } from '@/components/ui/button'
import { CheckCircle, MapPin, Shield } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      <main>
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-20 max-w-7xl text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-slate-900 mb-6">
            Ready to learn a new skill? Discover Workshops around you.
          </h1>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Find curated leisure workshops near you. From crafting to cooking, discover your next creative adventure.
          </p>
          <Link href="/workshops">
            <Button size="lg" className="bg-moss hover:bg-moss-dark text-white px-8 py-6 text-lg">
              Browse Workshops
            </Button>
          </Link>
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
