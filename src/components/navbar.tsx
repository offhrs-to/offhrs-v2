'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

export default function Navbar() {
  const { user, loading } = useAuth()
  const HOVER_COLOR = 'hover:text-[#5D755D]'

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-14 flex items-center justify-end">
        <div className="flex gap-4 text-sm font-medium text-gray-600 items-center">
          {!loading && user && (
            <Link href="/profile" className={`transition-colors ${HOVER_COLOR}`}>
              Profile
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}