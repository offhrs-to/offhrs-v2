'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  DollarSign,
  Settings,
  HelpCircle,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/partners/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/partners/dashboard/sessions', label: 'Sessions', icon: BookOpen },
  { href: '/partners/dashboard/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/partners/dashboard/bookings', label: 'Bookings', icon: BookOpen },
  { href: '/partners/dashboard/payouts', label: 'Payouts', icon: DollarSign },
  { href: '/partners/dashboard/settings', label: 'Settings', icon: Settings },
]

function NavItem({ item, active }: { item: typeof navItems[0]; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-[#5D755D] text-white'
          : 'text-[#555] hover:bg-[#F0EDE8] hover:text-[#1a1a1a]'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      {item.label}
    </Link>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/partners/login')
  }

  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[#E8E4DE]">
        <Link href="/partners/dashboard" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-[#1a1a1a] tracking-tight">offhrs</span>
          <span className="text-xs font-medium text-[#5D755D] bg-[#EDF2ED] px-2 py-0.5 rounded-full">
            Partners
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return <NavItem key={item.href} item={item} active={active} />
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-1 border-t border-[#E8E4DE] pt-3">
        <Link
          href="/partners/dashboard/help"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#555] hover:bg-[#F0EDE8] hover:text-[#1a1a1a] transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
          Help
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#555] hover:bg-[#F0EDE8] hover:text-[#1a1a1a] transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-[#FAFAF8] overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-[#E8E4DE] bg-white flex-shrink-0">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-56 h-full bg-white shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#E8E4DE] bg-white">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1 text-[#555] hover:text-[#1a1a1a]"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="text-sm font-semibold text-[#1a1a1a]">offhrs Partners</span>
          <div className="w-7" />
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
