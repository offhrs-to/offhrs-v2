/** Last-updated date shown on every policy page and reused for sitemaps/SEO. */
export const POLICY_LAST_UPDATED = 'September 3, 2026'

export type PolicyAudience = 'consumer' | 'vendor' | 'both'

export type PolicyPage = {
  /** URL slug under /terms */
  slug:
    | 'terms-of-use'
    | 'privacy-policy'
    | 'service-terms'
    | 'data-protection'
    | 'cookies'
    | 'content-policy'
    | 'marketplace-seller-addendum'
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
      'Please carefully read our Service Terms for workshops and Artist Marketplace purchases in the offhrs apps.',
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
  {
    slug: 'content-policy',
    title: 'Content Policy',
    summary:
      'Please carefully read our Content Policy for what is allowed in listings, reviews, messages, and other user-generated content on offhrs.',
    audience: 'both',
  },
  {
    slug: 'marketplace-seller-addendum',
    title: 'Marketplace Seller Addendum',
    summary:
      'Additional terms for Vendors selling physical goods on the offhrs Artist Marketplace (fees, postage hold, tax, shipping, claims, and clawbacks).',
    audience: 'vendor',
  },
]

export function policyHref(slug: PolicyPage['slug']): string {
  return `/terms/${slug}`
}
