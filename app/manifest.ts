import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FLORMULA1',
    short_name: 'FLORMULA1',
    description:
      'Free Formula 1 fan scoreboard for private groups. No betting, no wagers, just podium picks, results, and season standings.',
    start_url: '/',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#dc2626',
    categories: ['sports', 'entertainment', 'utilities'],
    lang: 'en',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  }
}
