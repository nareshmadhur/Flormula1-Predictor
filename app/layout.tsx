import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/ui/navbar'
import { getSiteUrl } from '@/utils/site'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'FLO-RMULA 1 Predictor',
    template: '%s | FLO-RMULA 1 Predictor',
  },
  description: 'Predict F1 podiums, follow official race results, and climb your season leaderboard.',
  openGraph: {
    title: 'FLO-RMULA 1 Predictor',
    description: 'Predict F1 podiums, follow official race results, and climb your season leaderboard.',
    siteName: 'FLO-RMULA 1 Predictor',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FLO-RMULA 1 Predictor',
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
        <Navbar />
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </body>
    </html>
  )
}
