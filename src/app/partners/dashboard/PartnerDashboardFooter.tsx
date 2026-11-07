import Link from 'next/link'
import { OffhrsLogo } from '@/components/offhrs-logo'

/** Full-width legal footer pinned under the dashboard shell (sidebar + content). */
export function PartnerDashboardFooter() {
  return (
    <footer className="shrink-0 border-t border-partner-border bg-white px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-3">
        <Link href="/partners/dashboard" prefetch={false} className="inline-flex">
          <OffhrsLogo className="h-8 w-auto max-w-[140px] object-contain" width={180} height={44} />
        </Link>
        <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Offhrs. All rights reserved.</p>
          <span className="text-partner-border" aria-hidden>
            |
          </span>
          <Link href="/disclaimer" prefetch={false} className="transition-colors hover:text-foreground">
            Disclaimer
          </Link>
          <span className="text-partner-border" aria-hidden>
            |
          </span>
          <Link href="/contact" prefetch={false} className="transition-colors hover:text-foreground">
            Contact us
          </Link>
          <span className="text-partner-border" aria-hidden>
            |
          </span>
          <Link href="/terms" prefetch={false} className="transition-colors hover:text-foreground">
            Terms &amp; policies
          </Link>
          <span className="text-partner-border" aria-hidden>
            |
          </span>
          <Link href="/partners/dashboard/faq" className="transition-colors hover:text-foreground">
            FAQ
          </Link>
        </nav>
      </div>
    </footer>
  )
}
