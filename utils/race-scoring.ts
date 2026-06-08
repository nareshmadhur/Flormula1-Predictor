import { createClient } from '@/utils/supabase/server'

type ScoringClient = Pick<Awaited<ReturnType<typeof createClient>>, 'from' | 'rpc'>

type RecalculateRaceScoresRow = {
  season: number
  predictions_count: number
}

export async function invalidateRaceScores(supabase: ScoringClient, raceId: string) {
  const { error } = await supabase.rpc('invalidate_race_scores', {
    p_race_id: raceId,
  })

  if (error) {
    throw new Error(error.message || 'Failed to invalidate race scores')
  }
}

export async function recalculateRaceScores(supabase: ScoringClient, raceId: string) {
  const { data, error } = await supabase.rpc('recalculate_race_scores', {
    p_race_id: raceId,
  })

  if (error) {
    throw new Error(error.message || 'Failed to recalculate race scores')
  }

  const result = Array.isArray(data)
    ? (data[0] as RecalculateRaceScoresRow | undefined)
    : (data as RecalculateRaceScoresRow | null)

  if (!result) {
    throw new Error('Race scoring did not return a result')
  }

  return {
    season: result.season,
    predictionsCount: result.predictions_count,
  }
}

export async function recalculateRaceScoresIfResultExists(supabase: ScoringClient, raceId: string) {
  const { data, error } = await supabase
    .from('race_results')
    .select('race_id')
    .eq('race_id', raceId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to check race result before recalculating scores')
  }

  if (!data) return null

  return recalculateRaceScores(supabase, raceId)
}
