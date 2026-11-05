import Link from 'next/link'
import { siInstagram } from 'simple-icons'

export const INSTAGRAM_URL = 'https://www.instagram.com/offhrs_to'

type FollowUsProps = {
  className?: string
  /** Icon + label color */
  tone?: 'onDark' | 'onLight'
  align?: 'center' | 'start'
}

function BrandPath({ path, className }: { path: string; className?: string }) {
  return (
    <svg role="img" viewBox="0 0 24 24" className={className} aria-hidden>
      <path d={path} fill="currentColor" />
    </svg>
  )
}

export function FollowUs({ className = '', tone = 'onDark', align = 'center' }: FollowUsProps) {
  const color = tone === 'onDark' ? 'text-white/90 hover:text-white' : 'text-neutral-700 hover:text-heading-dark'
  const alignClass = align === 'start' ? 'items-start' : 'items-center'

  return (
    <div className={`flex flex-col gap-3 ${alignClass} ${className}`}>
      <p
        className={`text-xs font-semibold uppercase tracking-[0.18em] ${
          tone === 'onDark' ? 'text-white/70' : 'text-neutral-500'
        }`}
      >
        Follow us
      </p>
      <div className="flex items-center gap-5">
        <Link
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-2 text-sm font-medium transition-colors ${color}`}
          aria-label="offhrs on Instagram"
        >
          <BrandPath path={siInstagram.path} className="h-5 w-5" />
          <span>Instagram</span>
        </Link>
      </div>
    </div>
  )
}
