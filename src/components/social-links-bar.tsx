'use client'

import { useId } from 'react'
import { usePathname } from 'next/navigation'
import { siInstagram, siTiktok, type SimpleIcon } from 'simple-icons'

const INSTAGRAM_URL = 'https://www.instagram.com/offhrs_to'
const TIKTOK_URL = 'https://www.tiktok.com/@offhrs_toronto'

/** Instagram brand gradient (Meta glyph guidelines). */
const INSTAGRAM_GRADIENT_STOPS = [
  { offset: '0%', color: '#FFDC80' },
  { offset: '25%', color: '#F77737' },
  { offset: '50%', color: '#E1306C' },
  { offset: '75%', color: '#C13584' },
  { offset: '100%', color: '#833AB4' },
] as const

function InstagramBrandIcon({ className, gradientId }: { className?: string; gradientId: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          {INSTAGRAM_GRADIENT_STOPS.map((stop) => (
            <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
          ))}
        </linearGradient>
      </defs>
      <path d={siInstagram.path} fill={`url(#${gradientId})`} />
    </svg>
  )
}

function BrandIcon({
  icon,
  className,
  color,
}: {
  icon: SimpleIcon
  className?: string
  color: string
}) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} aria-hidden>
      <path d={icon.path} fill={color} />
    </svg>
  )
}

function isConsumerAppPath(pathname: string): boolean {
  if (pathname.startsWith('/partners') || pathname.startsWith('/admin')) {
    return false
  }
  return true
}

const linkBaseClass =
  'flex h-8 w-8 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1'

export function SocialLinksBar() {
  const pathname = usePathname() ?? '/'
  const instagramGradientId = useId()

  if (!isConsumerAppPath(pathname)) {
    return null
  }

  return (
    <div
      className="fixed top-0 right-0 z-[100] flex flex-col items-center gap-0.5 p-2 pt-[max(env(safe-area-inset-top,0px),0.5rem)] pr-[max(env(safe-area-inset-right,0px),0.5rem)] pointer-events-auto"
      aria-label="Social media"
    >
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkBaseClass} hover:bg-pink-50 focus-visible:ring-pink-400/50`}
        aria-label={`offhrs on ${siInstagram.title}`}
      >
        <InstagramBrandIcon gradientId={instagramGradientId} className="h-[18px] w-[18px]" />
      </a>
      <a
        href={TIKTOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`${linkBaseClass} hover:bg-neutral-100 focus-visible:ring-neutral-400/50`}
        aria-label={`offhrs on ${siTiktok.title}`}
      >
        <BrandIcon
          icon={siTiktok}
          color={`#${siTiktok.hex}`}
          className="h-[18px] w-[18px]"
        />
      </a>
    </div>
  )
}
