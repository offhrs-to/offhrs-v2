import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Navbar from '@/components/navbar'
import Footer from '@/components/footer' // <--- 1. Import this

const inter = Inter({ subsets: ['latin'] })

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
      <body className={`${inter.className} min-h-screen flex flex-col`}> {/* Added flex flex-col */}
        <Navbar />
        <main className="flex-grow">{children}</main> {/* Added flex-grow */}
        <Footer /> {/* <--- 2. Add this line at the bottom! */}
      </body>
    </html>
  )
}