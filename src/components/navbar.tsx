import Link from 'next/link'
import Image from 'next/image'

export default function Navbar() {
  // 🎨 YOUR THEME CONFIG
  const THEME_COLOR = 'text-[#5D755D]' 
  const HOVER_COLOR = 'hover:text-[#5D755D]'

  return (
    <nav className="border-b border-gray-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-25 flex items-center justify-between">
        
        {/* LOGO SECTION - UPDATED DIMENSIONS */}
        {/* Changed h-8 to h-12 (taller) and w-32 to w-40 (wider) */}
        <Link href="/" className="relative h-30 w-45 flex items-center">
          <Image 
            src="/logo.png" 
            alt="Offhrs Logo" 
            fill
            className="object-contain object-left" // Ensures it fits without stretching
            priority
          />
        </Link>

        {/* LINKS SECTION */}
        <div className="flex gap-8 text-lg font-medium text-gray-600">
          <Link href="/workshops" className={`transition-colors ${HOVER_COLOR}`}>
            Workshops
          </Link>
          <Link href="/contact" className={`transition-colors ${HOVER_COLOR}`}>
            Contact
          </Link>
        </div>
      </div>
    </nav>
  )
}