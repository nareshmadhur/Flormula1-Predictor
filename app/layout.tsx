import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Suspense } from 'react'
import './globals.css'
import Navbar from '@/components/ui/navbar'
import { SiteFooter } from '@/components/ui/site-footer'
import { getSiteUrl } from '@/utils/site'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'FLORMULA1 Predictor',
    template: '%s | FLORMULA1 Predictor',
  },
  description: 'Predict F1 podiums, follow official race results, and climb your season leaderboard.',
  openGraph: {
    title: 'FLORMULA1 Predictor',
    description: 'Predict F1 podiums, follow official race results, and climb your season leaderboard.',
    siteName: 'FLORMULA1 Predictor',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FLORMULA1 Predictor',
    description: 'Predict F1 podiums, follow official race results, and climb your season leaderboard.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-50 min-h-screen flex flex-col`}>
        <Suspense fallback={<NavbarFallback />}>
          <Navbar />
        </Suspense>
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}

function NavbarFallback() {
  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/50 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 py-3">
          <div className="inline-flex items-baseline whitespace-nowrap pr-1">
            <span className="text-[1.35rem] font-black italic tracking-[-0.09em] sm:text-[1.6rem]">
              <span className="text-red-500">FLO</span>
              <span className="text-slate-100">RMULA1</span>
            </span>
          </div>
          <div className="h-8 w-40 animate-pulse rounded-full bg-white/10" />
        </div>
        <div className="flex gap-2 overflow-hidden pb-3">
          <div className="h-8 w-28 animate-pulse rounded-full bg-white/10" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-white/10" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-white/10" />
        </div>
      </div>
    </nav>
  )
}
