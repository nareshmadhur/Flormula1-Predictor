import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'FLORMULA1',
    short_name: 'FLORMULA1',
    description:
      'A free Formula 1 fan scoreboard for private groups: make podium picks, follow race results, and compare season standings. No betting, wagers, or cash prizes.',
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
