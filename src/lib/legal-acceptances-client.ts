import { POLICY_LAST_UPDATED, policyHref } from '@/lib/policy-pages'

/** Docs vendors must accept at signup / re-accept (runbook Part 1.2). */
export const PARTNER_CLICKWRAP_DOCS = [
  'terms-of-use',
  'privacy-policy',
  'data-protection',
  'marketplace-seller-addendum',
] as const

export type PartnerClickwrapDoc = (typeof PARTNER_CLICKWRAP_DOCS)[number]

export const CURRENT_POLICY_VERSION = POLICY_LAST_UPDATED

export const PARTNER_CLICKWRAP_LINKS: {
  key: PartnerClickwrapDoc
  title: string
  href: string
}[] = [
  { key: 'terms-of-use', title: 'Terms of Use', href: policyHref('terms-of-use') },
  { key: 'privacy-policy', title: 'Privacy Policy', href: policyHref('privacy-policy') },
  { key: 'data-protection', title: 'Data Protection Addendum', href: policyHref('data-protection') },
  {
    key: 'marketplace-seller-addendum',
    title: 'Marketplace Seller Addendum',
    href: policyHref('marketplace-seller-addendum'),
  },
]
