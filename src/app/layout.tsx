import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer'
import { AuthProviderWrapper } from '@/components/auth-provider'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Offhrs | Discover Creative Workshops',
  description: 'Find the best local workshops in Toronto.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen flex flex-col font-sans`}>
        <AuthProviderWrapper>
          <Navbar />
          <main className="flex-grow">{children}</main>
          <Footer />
        </AuthProviderWrapper>
      </body>
    </html>
  )
}