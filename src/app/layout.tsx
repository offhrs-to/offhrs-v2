import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Footer from '@/components/footer'
import { AuthProviderWrapper } from '@/components/auth-provider'
import RecordVisit from '@/components/record-visit'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Offhrs | Discover Creative Workshops',
  description: 'Find the best local workshops in Toronto.',
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