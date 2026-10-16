import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { headers } from 'next/headers'
import Footer from '@/components/footer'
import { CookieConsentBanner } from '@/components/cookie-consent-banner'
import { MetaPixel } from '@/components/meta-pixel'
import { SocialLinksBar } from '@/components/social-links-bar'
import { AuthProviderWrapper } from '@/components/auth-provider'
import { SupabaseConfigBanner } from '@/components/supabase-config-banner'
import { getSiteUrl } from '@/lib/site'
import { shopifyApiKey } from '@/lib/shopify/admin-client'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const siteUrl = getSiteUrl()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'offhrs — Discover Creative Workshops',
    template: '%s | offhrs',
  },
  description: 'Discover and book creative workshops across Toronto — pottery, floral design, culinary, and more.',
  applicationName: 'offhrs',
  alternates: siteUrl !== 'http://localhost:3000' ? { canonical: siteUrl } : undefined,
  openGraph: {
    type: 'website',
    locale: 'en_CA',
    url: siteUrl,
    siteName: 'offhrs',
    title: 'offhrs — Discover Creative Workshops',
    description:
      'Discover and book creative workshops across Toronto — pottery, floral design, culinary, and more.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'offhrs — Discover Creative Workshops',
    description:
      'Discover and book creative workshops across Toronto — pottery, floral design, culinary, and more.',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const headerList = await headers()
  const isShopifyAdmin = headerList.get('x-offhrs-shopify-admin') === '1'
  const shopifyKey = shopifyApiKey() ?? ''

  if (isShopifyAdmin) {
    const key = shopifyKey || '93ac1547c426534f421ce570acb3bc9d'
    return (
      <html lang="en">
        <head>
          {/* Meta MUST precede app-bridge.js or idToken() hangs forever. */}
          <meta name="shopify-api-key" content={key} />
          {/* Native blocking script — Next.js beforeInteractive can race the meta tag. */}
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
        </head>
        <body style={{ margin: 0, background: '#f6f6f7' }}>{children}</body>
      </html>
    )
  }

  return (
    <html lang="en">
      <head>{supabaseUrl && <link rel="preconnect" href={supabaseUrl} />}</head>
      <body className={`${inter.variable} min-h-screen flex flex-col font-sans`}>
        <AuthProviderWrapper>
          <SupabaseConfigBanner />
          <SocialLinksBar />
          <main className="flex-grow">{children}</main>
          <Footer />
          <CookieConsentBanner />
          <MetaPixel />
        </AuthProviderWrapper>
      </body>
    </html>
  )
}