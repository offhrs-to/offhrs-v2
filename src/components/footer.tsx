import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-12 mt-auto">
      <div className="container mx-auto px-4 flex flex-col items-center justify-center gap-6">
        
        {/* Brand Name */}
        <h3 className="text-xl font-serif font-bold tracking-tight text-gray-900">offhrs</h3>
        
        {/* Navigation Links */}
        <div className="flex gap-8 text-sm text-gray-500">
          <Link href="/workshops" className="hover:text-black transition-colors">Workshops</Link>
          <Link href="/contact" className="hover:text-black transition-colors">Contact</Link>
        </div>

        {/* Copyright & Secret Admin Link */}
        <div className="text-xs text-gray-400 mt-4 flex items-center gap-4">
          <p>© {new Date().getFullYear()} Offhrs. All rights reserved.</p>
          <span className="text-gray-300">|</span>
          <Link href="/admin" className="hover:text-gray-600 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  )
}