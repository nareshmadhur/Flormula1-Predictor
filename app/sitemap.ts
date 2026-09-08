import type { MetadataRoute } from 'next'
import { createPublicClient } from '@/utils/supabase/public'
import { getAbsoluteUrl } from '@/utils/site'

type SitemapRace = {
  id: string
  race_start_at: string
}

export const dynamic = 'force-dynamic'

function getStaticEntries(): MetadataRoute.Sitemap {
  const lastModified = new Date()

  return [
    {
      url: getAbsoluteUrl('/'),
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: getAbsoluteUrl('/leaderboard'),
      lastModified,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: getAbsoluteUrl('/season'),
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: getAbsoluteUrl('/about'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: getAbsoluteUrl('/privacy'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl('/terms'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: getAbsoluteUrl('/contact'),
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries = getStaticEntries()

  if (process.env.SUPABASE_TRAFFIC_PAUSED === 'true') {
    return staticEntries
  }

  try {
    const supabase = createPublicClient()
    const { data: races } = await supabase
      .from('races')
      .select('id, race_start_at')
      .neq('status', 'cancelled')
      .order('race_start_at', { ascending: true })
      .abortSignal(AbortSignal.timeout(4000))

    return [
      ...staticEntries,
      ...((races || []) as SitemapRace[]).map((race) => ({
        url: getAbsoluteUrl(`/race/${race.id}`),
        lastModified: new Date(race.race_start_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })),
    ]
  } catch {
    return staticEntries
  }
}
