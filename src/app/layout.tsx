import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Footer from '@/components/footer'
import { AuthProviderWrapper } from '@/components/auth-provider'
import RecordVisit from '@/components/record-visit'
import { getSiteUrl } from '@/lib/site'

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  return (
    <html lang="en">
      <head>
        {supabaseUrl && <link rel="preconnect" href={supabaseUrl} />}
      </head>
      <body className={`${inter.variable} min-h-screen flex flex-col font-sans`}>
        <AuthProviderWrapper>
          <RecordVisit />
          <main className="flex-grow">{children}</main>
          <Footer />
        </AuthProviderWrapper>
      </body>
    </html>
  )
}