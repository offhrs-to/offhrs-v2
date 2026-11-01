import Link from 'next/link'

/** Compact legal links for the partner app chrome (not the public marketing footer). */
export function PartnerDashboardFooter() {
  return (
    <footer className="mt-auto border-t border-partner-border bg-white px-6 py-4">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Offhrs. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <Link href="/disclaimer" prefetch={false} className="hover:text-foreground transition-colors">
            Disclaimer
          </Link>
          <span className="text-partner-border" aria-hidden>
            |
          </span>
          <Link href="/contact" prefetch={false} className="hover:text-foreground transition-colors">
            Contact us
          </Link>
          <span className="text-partner-border" aria-hidden>
            |
          </span>
          <Link href="/terms" prefetch={false} className="hover:text-foreground transition-colors">
            Terms &amp; policies
          </Link>
          <span className="text-partner-border" aria-hidden>
            |
          </span>
          <Link href="/partners/dashboard/faq" className="hover:text-foreground transition-colors">
            FAQ
          </Link>
        </nav>
      </div>
    </footer>
  )
}
