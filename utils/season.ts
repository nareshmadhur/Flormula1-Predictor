import { createClient } from '@/utils/supabase/server'

type SeasonClient = Awaited<ReturnType<typeof createClient>>

export async function getCurrentSeason(supabase: SeasonClient) {
  const { data: races } = await supabase
    .from('races')
    .select('season')
    .order('season', { ascending: false })
    .limit(1)

  return races?.[0]?.season ?? new Date().getFullYear()
}
