import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { POLICY_LAST_UPDATED, POLICY_PAGES, policyHref, type PolicyPage } from '@/lib/policy-pages'

type Props = {
  slug: PolicyPage['slug']
  children: React.ReactNode
}

/** Shared chrome for /terms/* pages: breadcrumb back to overview, title, last-updated, sibling links. */
export function LegalPageLayout({ slug, children }: Props) {
  const current = POLICY_PAGES.find((p) => p.slug === slug)
  if (!current) return null
  const others = POLICY_PAGES.filter((p) => p.slug !== slug)

  return (
    <div className="min-h-screen bg-white">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Link
          href="/terms"
          className="inline-flex items-center gap-1 text-sm text-[#5D755D] hover:text-[#4a634a] mb-6"
        >
          <ChevronLeft className="w-4 h-4" />
          Terms overview
        </Link>

        <header className="mb-8 border-b border-gray-100 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">{current.title}</h1>
          <p className="mt-2 text-sm text-gray-500">Last updated: {POLICY_LAST_UPDATED}</p>
        </header>

        <article className="prose prose-gray max-w-none text-[15px] leading-relaxed">{children}</article>

        <nav className="mt-12 pt-6 border-t border-gray-100">
          <p className="text-xs uppercase tracking-wide text-gray-500 mb-3">Related policies</p>
          <ul className="grid sm:grid-cols-2 gap-2">
            {others.map((p) => (
              <li key={p.slug}>
                <Link
                  href={policyHref(p.slug)}
                  className="block px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  )
}
