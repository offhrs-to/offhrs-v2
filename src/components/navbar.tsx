'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export default function Navbar() {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/'
    }
    return pathname?.startsWith(path)
  }

  return (
    <nav className="w-full border-b border-gray-100 bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-20 py-2">
          {/* Logo (Left) */}
          <Link 
            href="/" 
            className="flex items-center hover:opacity-80 transition-opacity"
          >
            <Image
              src="/logo.png"
              alt="Offhrs Logo"
              height={200}
              width={300}
              className="h-[80px] w-auto object-contain"
            />
          </Link>

          {/* Navigation Links (Right) */}
          <div className="flex items-center gap-6">
            <Link
              href="/workshops"
              className={`px-4 py-2 rounded-md transition-colors ${
                isActive('/workshops')
                  ? 'text-moss bg-moss/10 font-bold'
                  : 'text-slate-700 hover:text-moss font-medium'
              }`}
            >
              Workshops
            </Link>
            <Link
              href="/contact"
              className={`px-4 py-2 rounded-md transition-colors ${
                isActive('/contact')
                  ? 'text-moss bg-moss/10 font-bold'
                  : 'text-slate-700 hover:text-moss font-medium'
              }`}
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
