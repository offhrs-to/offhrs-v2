import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight } from 'lucide-react'
import { OffhrsLogo } from '@/components/offhrs-logo'
import { POLICY_LAST_UPDATED, POLICY_PAGES, policyHref } from '@/lib/policy-pages'

export const metadata: Metadata = {
  title: 'Terms & policies | offhrs',
  description:
    'Overview of offhrs Terms of Use, Privacy Policy, Service Terms, Data Protection Addendum, Cookie Policy, and Content Policy.',
  alternates: { canonical: 'https://offhrs.app/terms' },
}

export default function TermsOverviewPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="container mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link href="/" className="inline-flex">
            <OffhrsLogo className="h-8 w-auto" width={120} height={36} />
          </Link>
          <nav className="hidden md:flex items-center gap-5 text-sm text-gray-600">
            <Link href="/partners" className="hover:text-gray-900">For Partners</Link>
            <Link href="/contact" className="hover:text-gray-900">Contact us</Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-4 py-12">
        <div className="mb-10">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">Overview</p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
            Terms &amp; policies
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600 text-[15px] leading-relaxed">
            Everything that governs your use of offhrs as a workshop participant, Marketplace buyer, or vendor
            partner. Last updated {POLICY_LAST_UPDATED}.
          </p>
        </div>

        <nav className="mb-10 -mx-1 flex flex-wrap gap-1 border-b border-gray-100">
          <span className="px-3 py-2 text-sm font-medium text-gray-900 border-b-2 border-gray-900">
            Overview
          </span>
          {POLICY_PAGES.map((p) => (
            <Link
              key={p.slug}
              href={policyHref(p.slug)}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-900 border-b-2 border-transparent hover:border-gray-300 transition-colors"
            >
              {p.title}
            </Link>
          ))}
        </nav>

        <ul className="grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {POLICY_PAGES.map((p) => (
            <li key={p.slug}>
              <h2 className="text-base font-semibold text-gray-900">{p.title}</h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.summary}</p>
              <Link
                href={policyHref(p.slug)}
                className="mt-3 inline-flex items-center gap-1 text-sm text-[#5D755D] hover:text-[#4a634a] font-medium"
              >
                Read our {p.title}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-16 grid gap-10 md:grid-cols-3 border-t border-gray-100 pt-10">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <OffhrsLogo className="h-5 w-auto" width={80} height={22} />
            </h3>
            <p className="mt-3 text-xs text-gray-500">
              © {new Date().getFullYear()} offhrs. All rights reserved.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">For business</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#5D755D]">
              <li><Link href="/partners" className="hover:text-[#4a634a]">For Partners</Link></li>
              <li><Link href="/partners#pricing" className="hover:text-[#4a634a]">Pricing</Link></li>
              <li><Link href="/contact" className="hover:text-[#4a634a]">Support for partners</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-[#5D755D]">
              <li><Link href={policyHref('privacy-policy')} className="hover:text-[#4a634a]">Privacy Policy</Link></li>
              <li><Link href={policyHref('service-terms')} className="hover:text-[#4a634a]">Service Terms</Link></li>
              <li><Link href={policyHref('terms-of-use')} className="hover:text-[#4a634a]">Terms of Use</Link></li>
              <li><Link href={policyHref('content-policy')} className="hover:text-[#4a634a]">Content Policy</Link></li>
              <li><Link href="/disclaimer" className="hover:text-[#4a634a]">Listing disclaimer</Link></li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  )
}
