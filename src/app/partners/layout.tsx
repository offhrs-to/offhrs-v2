import type { Metadata } from 'next'
import { Playfair_Display } from 'next/font/google'

// Only one `<html>` and `<body>` may exist per Next.js App Router page (in
// `src/app/layout.tsx`). Nesting another `<html>`/`<body>` here under Next 16 +
// Turbopack silently strips this layout's children from the rendered output,
// which produced a blank dashboard with just the public footer collapsed at
// the top of the page. The fix is to render a plain wrapper that applies the
// Playfair font variable and the partners-only background.
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

export const metadata: Metadata = {
  title: 'offhrs Partners',
  description: 'Manage your workshop business with offhrs.',
}

export default function PartnersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${playfair.variable} bg-partner-canvas min-h-screen`}>
      {children}
    </div>
  )
}
