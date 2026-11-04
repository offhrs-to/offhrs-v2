import Link from 'next/link'

const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || '#'
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'

type StoreBadgesProps = {
  className?: string
  /** Dark badges on light hero / light badges on green CTA */
  variant?: 'dark' | 'light'
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M3.18 23.71c-.12.05-.24.05-.36.02-.25-.07-.42-.3-.42-.56V.83c0-.26.17-.49.42-.56.12-.03.24-.03.36.02l18.12 10.74c.28.17.38.53.21.81-.05.08-.11.14-.19.19L3.18 23.71z" />
    </svg>
  )
}

export function StoreBadges({ className = '', variant = 'dark' }: StoreBadgesProps) {
  const badge =
    variant === 'light'
      ? 'bg-white text-neutral-900 hover:bg-neutral-100'
      : 'bg-neutral-900 text-white hover:bg-neutral-800'

  return (
    <div className={`flex flex-col items-stretch justify-center gap-2.5 min-[380px]:flex-row min-[380px]:items-center sm:gap-3 ${className}`}>
      <Link
        href={APP_STORE_URL}
        className={`inline-flex w-full max-w-[14rem] items-center gap-3 rounded-xl px-4 py-2.5 transition-colors sm:w-auto sm:min-w-[11.5rem] ${badge}`}
        aria-label="Download on the App Store"
      >
        <AppleIcon className="h-7 w-7 shrink-0" />
        <span className="flex flex-col leading-tight text-left">
          <span className="text-[10px] uppercase tracking-wide opacity-80">Download on the</span>
          <span className="text-sm font-semibold">App Store</span>
        </span>
      </Link>
      <Link
        href={PLAY_STORE_URL}
        className={`inline-flex w-full max-w-[14rem] items-center gap-3 rounded-xl px-4 py-2.5 transition-colors sm:w-auto sm:min-w-[11.5rem] ${badge}`}
        aria-label="Get it on Google Play"
      >
        <PlayIcon className="h-6 w-6 shrink-0" />
        <span className="flex flex-col leading-tight text-left">
          <span className="text-[10px] uppercase tracking-wide opacity-80">Get it on</span>
          <span className="text-sm font-semibold">Google Play</span>
        </span>
      </Link>
    </div>
  )
}
