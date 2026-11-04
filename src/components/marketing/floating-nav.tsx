'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/partners', label: 'Partners' },
  { href: '/contact', label: 'Contact Us' },
] as const

/** Shared pill sizing so trailing CTAs match Home / Partners / Contact Us. */
export const navPillBase =
  'inline-flex items-center justify-center rounded-full px-[1.125rem] py-2.5 text-[15px] font-medium leading-none tracking-normal sm:px-5 sm:py-2.5 md:px-7'
export const navPillIdle = `${navPillBase} text-neutral-800/90 transition-colors hover:text-neutral-950`
export const navPillActive = `${navPillBase} font-semibold text-neutral-900 bg-white/40 shadow-[0_1px_2px_rgba(0,0,0,0.04)]`
export const navPillCta = `${navPillBase} font-semibold text-white bg-heading-dark hover:bg-heading-dark/90 transition-colors`
/** Sign in — same type as idle links, with extra horizontal padding so it isn’t cramped. */
export const navPillSignIn = `${navPillIdle} px-5 sm:px-9 md:px-11`

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

type FloatingNavProps = {
  /** Extra actions shown on the right (e.g. Partners sign-in). */
  trailing?: React.ReactNode
}

export function FloatingNav({ trailing }: FloatingNavProps) {
  const pathname = usePathname() ?? '/'

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[90] flex justify-center px-3 pt-[max(env(safe-area-inset-top,0px),0.85rem)] sm:px-4 sm:pt-[max(env(safe-area-inset-top,0px),1rem)]">
      <nav
        aria-label="Primary"
        className="pointer-events-auto relative flex w-full max-w-[22rem] items-center justify-center overflow-x-auto rounded-full border border-white/55 px-2.5 py-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.10)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden sm:max-w-none sm:w-auto sm:px-2 sm:py-1.5"
        style={{
          WebkitBackdropFilter: 'blur(32px) saturate(1.75)',
          backdropFilter: 'blur(32px) saturate(1.75)',
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 55%, rgba(255,255,255,0.18) 100%)',
        }}
      >
        <div className="flex shrink-0 items-center">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={active ? navPillActive : navPillIdle}
              >
                {link.label}
              </Link>
            )
          })}
        </div>
        {trailing ? (
          <div className="ml-0.5 flex shrink-0 items-center gap-1 border-l border-black/10 py-0.5 pl-1.5 pr-1.5 sm:ml-2 sm:pl-3 sm:pr-3">
            {trailing}
          </div>
        ) : null}
      </nav>
    </div>
  )
}
