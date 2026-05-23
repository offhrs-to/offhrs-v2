import Link from 'next/link'
import { cn } from '@/lib/utils'

/** Short notice for workshop listing surfaces; aligns with Terms §6–8. */
export function ListingDisclaimerBanner({ className }: { className?: string }) {
  return (
    <div
      role="note"
      className={cn(
        'rounded-xl border border-amber-200/90 bg-amber-50/95 px-3.5 py-2.5 text-xs text-gray-800 leading-relaxed',
        className
      )}
    >
      <p>
        Listings may be incomplete, outdated, or inaccurate.{' '}
        <strong>Confirm date, time, price, location, and requirements with the vendor</strong> using their official
        booking link or contact before you rely on them. Offhrs does not process bookings or payments.
      </p>
      <p className="mt-2 text-gray-600">
        <Link href="/disclaimer" className="font-medium text-[#5D755D] underline underline-offset-2 hover:text-[#4a634a]">
          Listing disclaimer
        </Link>
        <span className="mx-1.5 text-gray-400">·</span>
        <Link href="/terms" className="font-medium text-[#5D755D] underline underline-offset-2 hover:text-[#4a634a]">
          Terms &amp; policies
        </Link>
      </p>
    </div>
  )
}

/** Shown next to Book / outbound actions: user leaves Offhrs for the vendor. */
export function BookOutboundHint({ className }: { className?: string }) {
  return (
    <p className={cn('text-[10px] text-gray-500 text-center leading-snug', className)}>
      You&apos;ll open the vendor&apos;s site. Their price, availability, and terms apply.
    </p>
  )
}
