import Link from 'next/link'
import { OffhrsLogo } from '@/components/offhrs-logo'
import { StoreBadges } from '@/components/marketing/store-badges'
import { FollowUs } from '@/components/marketing/follow-us'

type MarketingSiteFooterProps = {
  /** Home shows store badges; Partners can omit them. */
  showStoreBadges?: boolean
}

export function MarketingSiteFooter({ showStoreBadges = true }: MarketingSiteFooterProps) {
  return (
    <section className="bg-heading-dark px-5 pb-10 pt-16 text-center text-white sm:px-6 sm:pt-20 md:pt-24">
      <div className="mx-auto flex max-w-3xl flex-col items-center">
        <OffhrsLogo
          className="h-12 w-auto max-w-[200px] object-contain brightness-0 invert sm:h-14 sm:max-w-[220px] md:h-16"
          width={280}
          height={72}
        />
        <p className="mt-5 text-lg font-semibold tracking-tight sm:mt-6 sm:text-xl md:text-2xl">
          Where local art finds its community
        </p>
        {showStoreBadges ? <StoreBadges variant="light" className="mt-8 sm:mt-10" /> : null}
        <FollowUs className={showStoreBadges ? 'mt-10 sm:mt-12' : 'mt-8 sm:mt-10'} tone="onDark" />
      </div>

      <footer className="mx-auto mt-12 max-w-5xl border-t border-white/15 pt-6 sm:mt-16 sm:pt-8">
        <div className="flex flex-col items-center justify-center gap-2.5 text-xs text-white/70 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2 sm:text-sm">
          <p>© {new Date().getFullYear()} offhrs. All rights reserved.</p>
          <Link href="/disclaimer" prefetch={false} className="transition-colors hover:text-white">
            Disclaimer
          </Link>
          <Link href="/contact" prefetch={false} className="transition-colors hover:text-white">
            Contact us
          </Link>
          <Link href="/terms/privacy-policy" prefetch={false} className="transition-colors hover:text-white">
            Privacy Policy
          </Link>
          <Link href="/terms/terms-of-use" prefetch={false} className="transition-colors hover:text-white">
            Terms of Use
          </Link>
          <Link href="/terms" prefetch={false} className="transition-colors hover:text-white">
            All policies
          </Link>
          <Link href="/admin" prefetch={false} className="transition-colors hover:text-white">
            Admin
          </Link>
          <Link href="/partners" prefetch={false} className="transition-colors hover:text-white">
            Partners
          </Link>
        </div>
      </footer>
    </section>
  )
}
