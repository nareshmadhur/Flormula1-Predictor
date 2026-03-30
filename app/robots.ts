import type { MetadataRoute } from 'next'
import { getAbsoluteUrl, getSiteUrl } from '@/utils/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/me/', '/predictions', '/login', '/signup', '/race/*/predict'],
    },
    sitemap: getAbsoluteUrl('/sitemap.xml'),
    host: getSiteUrl(),
  }
}
