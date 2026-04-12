import type { MetadataRoute } from 'next'
import { createPublicClient } from '@/utils/supabase/public'
import { getAbsoluteUrl } from '@/utils/site'

type SitemapRace = {
  id: string
  race_start_at: string
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createPublicClient()
  const { data: races } = await supabase
    .from('races')
    .select('id, race_start_at')
    .neq('status', 'cancelled')
    .order('race_start_at', { ascending: true })

  return [
    {
      url: getAbsoluteUrl('/'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: getAbsoluteUrl('/leaderboard'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: getAbsoluteUrl('/season'),
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl('/about'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl('/privacy'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl('/terms'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl('/contact'),
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    ...((races || []) as SitemapRace[]).map((race) => ({
      url: getAbsoluteUrl(`/race/${race.id}`),
      lastModified: new Date(race.race_start_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}
