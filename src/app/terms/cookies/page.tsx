import type { Metadata } from 'next'
import { LegalPageLayout } from '@/components/legal-page-layout'

export const metadata: Metadata = {
  title: 'Cookie Policy | offhrs',
  description:
    'How offhrs uses cookies, local storage, and pixel tracking across offhrs.app, partners.offhrs.app, and our mobile apps.',
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
]

const analytics: Row[] = [
  {
    name: '_ga',
    provider: 'Google',
    setOn: '*.offhrs.app',
    purpose: 'Assigns an anonymous client identifier to group pageviews and active dashboard traffic.',
    duration: '2 years',
  },
  {
    name: '_gid',
    provider: 'Google',
    setOn: '*.offhrs.app',
    purpose: 'Distinguishes unique users within a 24-hour cycle for reporting analytics.',
    duration: '24 hours',
  },
]

const advertising: Row[] = [
  {
    name: '_fbp',
    provider: 'Meta',
    setOn: 'offhrs.app',
    purpose: 'Used by Meta to identify browser traffic and deliver optimized retargeting on Facebook and Instagram.',
    duration: '3 months',
  },
  {
    name: '_gcl_au',
    provider: 'Google',
    setOn: 'offhrs.app',
    purpose: 'Collected by Google Ads to measure digital acquisition performance.',
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
          (collectively, the &ldquo;Site&rdquo;), uses cookies, device identifiers, local web storage, and
          server-side pixel tracking (such as the Meta Conversions API) to distinguish you from other users.
          This allows us to optimize booking workflows, verify active vendor dashboard sessions, and maintain
          a secure payment lifecycle.
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
        <p>These allow our views to remember local layout options and scheduling preferences.</p>
        <CookieTable rows={functionality} />
      </section>

      <section>
        <h2>3. Analytical &amp; performance cookies</h2>
        <p>
          These give us visibility into how users traverse the workshop discovery funnel so we can make
          finding classes in Toronto faster and more intuitive.
        </p>
        <CookieTable rows={analytics} />
      </section>

      <section>
        <h2>4. Targeting &amp; advertising cookies</h2>
        <p>
          These variables are connected to our Meta and Google advertising accounts. They track conversion
          metrics (for example, whether a vendor clicked a Meta Reel ad and completed a trial registration).
        </p>
        <CookieTable rows={advertising} />
      </section>

      <section>
        <h2>5. Disabling and managing cookies</h2>
        <p>
          Most modern web browsers accept tracking cookies by default. To revoke consent, alter cookie
          visibility, or wipe historical tracking, adjust your local device configurations:
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
          strictly necessary tracking flags, you will be unable to initialize vendor dashboards on
          partners.offhrs.app or securely register for workshops on offhrs.app.
        </p>
      </section>
    </LegalPageLayout>
  )
}
