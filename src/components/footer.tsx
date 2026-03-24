import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 py-6 mt-auto">
      <div className="container mx-auto px-4 flex flex-col items-center justify-center gap-4">
        
        {/* Brand Name */}
        <h3 className="text-base font-serif font-bold tracking-tight text-gray-900">offhrs</h3>
        
        {/* Copyright, Privacy, Contact, Terms & Admin */}
        <div className="text-xs text-gray-400 mt-2 flex items-center gap-3 flex-wrap justify-center">
          <p>© {new Date().getFullYear()} Offhrs. All rights reserved.</p>
          <span className="text-gray-300">|</span>
          <Link href="/privacy" prefetch={false} className="hover:text-gray-600 transition-colors">
            Privacy Policy
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/disclaimer" prefetch={false} className="hover:text-gray-600 transition-colors">
            Disclaimer
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/contact" prefetch={false} className="hover:text-gray-600 transition-colors">
            Contact us
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/terms" prefetch={false} className="hover:text-gray-600 transition-colors">
            Terms of Service
          </Link>
          <span className="text-gray-300">|</span>
          <Link href="/admin" prefetch={false} className="hover:text-gray-600 transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  )
}