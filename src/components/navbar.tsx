'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/auth-context'

export default function Navbar() {
  const { user, loading } = useAuth()
  const THEME_COLOR = 'text-[#5D755D]'
  const HOVER_COLOR = 'hover:text-[#5D755D]'

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-25 flex items-center justify-between">
        <Link href="/" className="relative h-30 w-45 flex items-center">
          <Image
            src="/logo.png"
            alt="Offhrs Logo"
            fill
            className="object-contain object-left"
            priority
          />
        </Link>

        <div className="flex gap-6 text-base font-medium text-gray-600 items-center">
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