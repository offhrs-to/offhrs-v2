/** Last-updated date shown on every policy page and reused for sitemaps/SEO. */
export const POLICY_LAST_UPDATED = 'May 20, 2026'

export type PolicyAudience = 'consumer' | 'vendor' | 'both'

export type PolicyPage = {
  /** URL slug under /terms */
  slug: 'terms-of-use' | 'privacy-policy' | 'service-terms' | 'data-protection' | 'cookies'
  title: string
  summary: string
  audience: PolicyAudience
}

export const POLICY_PAGES: PolicyPage[] = [
  {
    slug: 'terms-of-use',
    title: 'Terms of Use',
    summary:
      'Please carefully read our Terms of Use before you use offhrs.app, partners.offhrs.app, or our mobile apps.',
    audience: 'both',
  },
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    summary:
      'Please carefully read our Privacy Policy that is intended to inform you how we gather, define, and use your information.',
    audience: 'both',
  },
  {
    slug: 'service-terms',
    title: 'Service Terms',
    summary:
      'Please carefully read our Service Terms and what that means for you when you book or host a workshop.',
    audience: 'consumer',
  },
  {
    slug: 'data-protection',
    title: 'Data Protection Addendum',
    summary:
      'Please carefully read our Data Protection Addendum which governs how we process customer data on behalf of vendors.',
    audience: 'vendor',
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    summary:
      'Please carefully read our Cookie Policy to see how we use cookies to enhance your experience.',
    audience: 'both',
  },
]

export function policyHref(slug: PolicyPage['slug']): string {
  return `/terms/${slug}`
}
