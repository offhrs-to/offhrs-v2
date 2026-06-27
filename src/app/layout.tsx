import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import Footer from '@/components/footer'
import { SocialLinksBar } from '@/components/social-links-bar'
import { AuthProviderWrapper } from '@/components/auth-provider'
import { getSiteUrl } from '@/lib/site'

const META_PIXEL_ID = '1674304227024425'

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
        {/* Meta Pixel Code */}
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}
      </head>
      <body className={`${inter.variable} min-h-screen flex flex-col font-sans`}>
        <AuthProviderWrapper>
          <SocialLinksBar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </AuthProviderWrapper>
      </body>
    </html>
  )
}