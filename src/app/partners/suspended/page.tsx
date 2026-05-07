import Link from 'next/link'

export default function PartnerSuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="text-5xl">🔒</div>
        <h1 className="font-playfair text-3xl font-bold text-[#1a1a1a]">Account suspended</h1>
        <p className="text-[#555] text-sm leading-relaxed">
          Your subscription payment failed and your account has been suspended. Update your payment
          method to restore full access. Your data is retained for 30 days.
        </p>
        <Link
          href="/partners/dashboard/settings"
          className="inline-block rounded-lg bg-[#5D755D] px-6 py-3 text-sm font-semibold text-white hover:bg-[#4d634d] transition-colors"
        >
          Update payment method
        </Link>
        <p className="text-xs text-[#999]">
          Need help?{' '}
          <a href="mailto:support@offhrs.app" className="text-[#5D755D] underline">
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}
