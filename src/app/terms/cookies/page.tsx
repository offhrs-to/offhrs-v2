import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal-page-layout'

export const metadata: Metadata = {
  title: 'Cookie Policy | offhrs',
  description:
    'How offhrs uses cookies, local storage, and the Meta Pixel across offhrs.app, partners.offhrs.app, and our mobile apps.',
  alternates: { canonical: 'https://offhrs.app/terms/cookies' },
}

type Row = { name: string; provider: string; setOn: string; purpose: string; duration: string }

const necessary: Row[] = [
  {
    name: 'sb-access-token',
    provider: 'Supabase',
    setOn: '*.offhrs.app',
    purpose: 'Stores the JWT used to maintain authenticated vendor and consumer sessions.',
    duration: 'Session',
  },
  {
    name: 'sb-refresh-token',
    provider: 'Supabase',
    setOn: '*.offhrs.app',
    purpose: 'Used to safely reissue short-lived access tokens so you do not have to log in repeatedly.',
    duration: '1 year',
  },
  {
    name: '__stripe_mid',
    provider: 'Stripe',
    setOn: '*.offhrs.app',
    purpose: 'Machine identifier used by Stripe to run background risk analysis and detect card fraud.',
    duration: '1 year',
  },
  {
    name: '__stripe_sid',
    provider: 'Stripe',
    setOn: '*.offhrs.app',
    purpose: 'Session token used by Stripe to preserve payment state across checkout redirects.',
    duration: '30 minutes',
  },
  {
    name: 'offhrs_channel_shop',
    provider: 'offhrs',
    setOn: 'offhrs.app',
    purpose:
      'Signed, HttpOnly cookie that keeps a Shopify merchant connected to their offhrs Sync app session inside the Shopify admin. Set only for merchants who open the offhrs Sync app.',
    duration: '7 days',
  },
]

const functionality: Row[] = [
  {
    name: 'offhrs_tz',
    provider: 'offhrs',
    setOn: '*.offhrs.app',
    purpose: 'Stores the local timezone so booking dates render correctly against UTC server records.',
    duration: '1 year',
  },
  {
    name: 'offhrs_theme',
    provider: 'offhrs',
    setOn: '*.offhrs.app',
    purpose: 'Caches user theme preferences (light / dark mode).',
    duration: 'Persisted',
  },
  {
    name: 'offhrs_ad_consent',
    provider: 'offhrs',
    setOn: 'offhrs.app (localStorage)',
    purpose:
      'Remembers whether you accepted or declined advertising cookies (Meta Pixel) so we do not ask on every visit.',
    duration: 'Persisted',
  },
]

const advertising: Row[] = [
  {
    name: '_fbp',
    provider: 'Meta',
    setOn: 'offhrs.app',
    purpose:
      'Set by the Meta Pixel when you accept advertising cookies. Helps Meta measure and optimize our Facebook and Instagram ads (via Meta Ads Manager) and may support retargeting.',
    duration: '3 months',
  },
  {
    name: '_fbc',
    provider: 'Meta',
    setOn: 'offhrs.app',
    purpose:
      'May be set when you arrive from a Facebook or Instagram ad click, so Meta can attribute that visit to a campaign.',
    duration: '3 months',
  },
]

function CookieTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto my-4 border border-gray-100 rounded-lg">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="text-left font-medium px-3 py-2">Cookie name</th>
            <th className="text-left font-medium px-3 py-2">Provider</th>
            <th className="text-left font-medium px-3 py-2">Set on</th>
            <th className="text-left font-medium px-3 py-2">Why we use it</th>
            <th className="text-left font-medium px-3 py-2">Duration</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => (
            <tr key={r.name} className="align-top">
              <td className="px-3 py-2 font-mono text-[13px] text-gray-900">{r.name}</td>
              <td className="px-3 py-2 text-gray-700">{r.provider}</td>
              <td className="px-3 py-2 text-gray-700">{r.setOn}</td>
              <td className="px-3 py-2 text-gray-700">{r.purpose}</td>
              <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{r.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CookiePolicyPage() {
  return (
    <LegalPageLayout slug="cookies">
      <section>
        <h2>Introduction</h2>
        <p>
          Our platform, including <strong>offhrs.app</strong> and <strong>partners.offhrs.app</strong>{' '}
          (collectively, the &ldquo;Site&rdquo;), uses cookies, device identifiers, and local web storage to
          distinguish you from other users. This allows us to keep you signed in, run secure payments, and
          (only if you accept) measure our Meta advertising with the browser Meta Pixel.
        </p>
        <p>
          We do <strong>not</strong> use Google Analytics, Google Ads tags, or Meta&rsquo;s server-side
          Conversions API on the Site. Advertising measurement is limited to the Meta Pixel for Facebook and
          Instagram campaigns managed in Meta Ads Manager.
        </p>
      </section>

      <section>
        <h2>1. Strictly necessary cookies</h2>
        <p>
          These tokens are vital to the platform&rsquo;s core infrastructure. Disabling them will cause
          authentication timeouts, cart dropouts, and dashboard connection failures.
        </p>
        <CookieTable rows={necessary} />
      </section>

      <section>
        <h2>2. Functionality cookies</h2>
        <p>These allow our views to remember local layout options, scheduling preferences, and your ad-cookie choice.</p>
        <CookieTable rows={functionality} />
      </section>

      <section>
        <h2>3. Targeting &amp; advertising cookies (Meta)</h2>
        <p>
          If you choose <strong>Accept</strong> on our cookie banner, we load the Meta Pixel. Meta may then
          set the cookies below to measure whether someone who saw or clicked a Facebook or Instagram ad
          visited our Site (for example, a vendor completing trial signup). We do not load Google advertising
          or analytics tags.
        </p>
        <CookieTable rows={advertising} />
        <p>
          If you choose <strong>Decline</strong>, we do not initialize the Meta Pixel and these advertising
          cookies are not set by us for that purpose. You can change your mind later by clearing site data for
          offhrs.app (which clears <code>offhrs_ad_consent</code>) and revisiting the Site.
        </p>
      </section>

      <section>
        <h2>4. Disabling and managing cookies</h2>
        <p>
          Use the on-site banner to accept or decline advertising cookies. You can also alter cookie
          visibility or wipe historical tracking in your browser:
        </p>
        <ul>
          <li>
            <strong>Google Chrome:</strong> Settings &rsaquo; Privacy and security &rsaquo; Third-party cookies
          </li>
          <li>
            <strong>Apple Safari:</strong> Settings &rsaquo; Safari &rsaquo; Advanced &rsaquo; Cookies and
            Website Data
          </li>
          <li>
            <strong>Mozilla Firefox:</strong> Settings &rsaquo; Privacy &amp; Security &rsaquo; Cookies and
            Site Data
          </li>
        </ul>
        <p>
          <strong>Note on platform interaction:</strong> if you configure your browser to drop or block all
          strictly necessary cookies, you will be unable to initialize vendor dashboards on
          partners.offhrs.app or securely register for workshops on offhrs.app. Declining advertising cookies
          alone does not block sign-in or checkout.
        </p>
      </section>
    </LegalPageLayout>
  )
}
