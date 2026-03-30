import { createClient } from '@/utils/supabase/server'

type LeaderboardClient = Awaited<ReturnType<typeof createClient>>

type RaceIdRow = {
  id: string
}

type ScoreRow = {
  user_id: string
  race_id: string
  total_points: number
  exact_hits: number
}

type LeaderboardInsert = {
  season: number
  user_id: string
  total_points: number
  exact_hits: number
  races_scored: number
}

export async function rebuildLeaderboardForSeason(supabase: LeaderboardClient, season: number) {
  const { data: races, error: racesError } = await supabase
    .from('races')
    .select('id')
    .eq('season', season)

  if (racesError) {
    throw new Error(`Failed to load races for season ${season}`)
  }

  const raceIds = ((races || []) as RaceIdRow[]).map((race) => race.id)

  const { error: clearError } = await supabase
    .from('leaderboard_cache')
    .delete()
    .eq('season', season)

  if (clearError) {
    throw new Error(`Failed to clear leaderboard cache for season ${season}`)
  }

  if (raceIds.length === 0) {
    return { season, entries: 0 }
  }

  const { data: scores, error: scoresError } = await supabase
    .from('user_race_scores')
    .select('user_id, race_id, total_points, exact_hits')
    .in('race_id', raceIds)

  if (scoresError) {
    throw new Error(`Failed to load scores for season ${season}`)
  }

  const leaderboardMap = new Map<string, LeaderboardInsert>()

  ;((scores || []) as ScoreRow[]).forEach((score) => {
    const existing = leaderboardMap.get(score.user_id)

    if (existing) {
      existing.total_points += score.total_points
      existing.exact_hits += score.exact_hits
      existing.races_scored += 1
      return
    }

    leaderboardMap.set(score.user_id, {
      season,
      user_id: score.user_id,
      total_points: score.total_points,
      exact_hits: score.exact_hits,
      races_scored: 1,
    })
  })

  if (leaderboardMap.size === 0) {
    return { season, entries: 0 }
  }

  const { error: insertError } = await supabase
    .from('leaderboard_cache')
    .insert(Array.from(leaderboardMap.values()))

  if (insertError) {
    throw new Error(`Failed to rebuild leaderboard cache for season ${season}`)
  }

  return { season, entries: leaderboardMap.size }
}
