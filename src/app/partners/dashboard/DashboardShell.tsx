'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  ClipboardList,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  UserCircle2,
  FileText,
  HelpCircle,
  Store,
} from 'lucide-react'
import { useState } from 'react'
import { OffhrsLogo } from '@/components/offhrs-logo'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

type NavVisibility = 'always' | 'native' | 'marketplace'

const allNavItems: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  visibility: NavVisibility
}[] = [
  { href: '/partners/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true, visibility: 'always' },
  { href: '/partners/dashboard/sessions', label: 'Workshops', icon: BookOpen, visibility: 'native' },
  { href: '/partners/dashboard/calendar', label: 'Calendar', icon: CalendarDays, visibility: 'native' },
  { href: '/partners/dashboard/bookings', label: 'Bookings', icon: ClipboardList, visibility: 'native' },
  { href: '/partners/dashboard/clients', label: 'Clients', icon: UserCircle2, visibility: 'native' },
  { href: '/partners/dashboard/marketplace', label: 'Marketplace', icon: Store, visibility: 'marketplace' },
  { href: '/partners/dashboard/payouts', label: 'Payouts', icon: DollarSign, visibility: 'native' },
  { href: '/partners/dashboard/settings', label: 'Settings', icon: Settings, visibility: 'always' },
]

function NavItem({
  item,
  active,
  onNavigate,
}: {
  item: (typeof allNavItems)[number]
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-partner-tint text-primary'
          : 'text-muted-foreground hover:bg-partner-muted hover:text-foreground'
      )}
    >
      {active ? (
        <span
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
          aria-hidden
        />
      ) : null}
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  )
}

function BrandMark({ className }: { className?: string }) {
  return (
    <Link href="/partners/dashboard" className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <OffhrsLogo
        className="h-8 w-auto max-w-[118px] shrink-0 object-contain object-left"
        width={140}
        height={36}
      />
      <span className="shrink-0 text-xs font-medium tracking-wide text-primary">Partners</span>
    </Link>
  )
}

function visibleNavItems(hasNativePlan: boolean, hasMarketplaceAccess: boolean) {
  return allNavItems.filter((item) => {
    if (item.visibility === 'always') return true
    if (item.visibility === 'native') return hasNativePlan
    if (item.visibility === 'marketplace') return hasMarketplaceAccess
    return false
  })
}

function SidebarNav({
  pathname,
  hasNativePlan,
  hasMarketplaceAccess,
  onNavigate,
}: {
  pathname: string
  hasNativePlan: boolean
  hasMarketplaceAccess: boolean
  onNavigate?: () => void
}) {
  const navItems = visibleNavItems(hasNativePlan, hasMarketplaceAccess)

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-partner-border px-4 py-5">
        <BrandMark />
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <NavItem key={item.href} item={item} active={active} onNavigate={onNavigate} />
          )
        })}
      </nav>

      <div className="space-y-1 border-t border-partner-border px-3 pb-4 pt-3">
        <Link
          href="/partners/dashboard/faq"
          onClick={onNavigate}
          className={cn(
            'relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
            pathname.startsWith('/partners/dashboard/faq')
              ? 'bg-partner-tint text-primary'
              : 'text-muted-foreground hover:bg-partner-muted hover:text-foreground'
          )}
        >
          {pathname.startsWith('/partners/dashboard/faq') ? (
            <span
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
              aria-hidden
            />
          ) : null}
          <HelpCircle className="size-4" />
          FAQ
        </Link>
        <Link
          href="/terms"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-partner-muted hover:text-foreground"
        >
          <FileText className="size-4" />
          Terms &amp; policies
        </Link>
        <SignOutButton />
      </div>
    </div>
  )
}

function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/partners/login')
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={handleSignOut}
      className="h-auto w-full justify-start gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-partner-muted hover:text-foreground"
    >
      <LogOut className="size-4" />
      Sign out
    </Button>
  )
}

export function DashboardShell({
  children,
  hasNativePlan,
  hasMarketplaceAccess,
}: {
  children: React.ReactNode
  hasNativePlan: boolean
  hasMarketplaceAccess: boolean
}) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-partner-canvas">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-partner-border bg-white md:flex">
        <SidebarNav
          pathname={pathname}
          hasNativePlan={hasNativePlan}
          hasMarketplaceAccess={hasMarketplaceAccess}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-partner-border bg-white px-4 py-3 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-56 gap-0 p-0 sm:max-w-[14rem]" showCloseButton>
              <SheetHeader className="sr-only">
                <SheetTitle>Partner navigation</SheetTitle>
              </SheetHeader>
              <SidebarNav
                pathname={pathname}
                hasNativePlan={hasNativePlan}
                hasMarketplaceAccess={hasMarketplaceAccess}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <BrandMark className="min-w-0 flex-1 justify-center" />
          <div className="w-8" />
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
