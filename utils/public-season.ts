import { cache } from 'react'
import { sortCompetitionStandings } from '@/utils/competition'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { createPublicClient } from '@/utils/supabase/public'

export type PublicSeasonRace = {
  id: string
  season: number
  round: number
  race_name: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  circuits?: {
    name?: string | null
    country?: string | null
    emoji?: string | null
  } | null
}

export type PublicSeasonLeaderboardEntry = {
  user_id: string
  total_points: number
  exact_hits: number
  races_scored: number
  profiles?:
    | {
        display_name?: string | null
        email?: string | null
      }
    | Array<{
        display_name?: string | null
        email?: string | null
      }>
    | null
}

export type PublicSeasonRaceSummary = PublicSeasonRace & {
  effectiveStatus: RaceStatus
}

export const getPublicSeasonData = cache(async () => {
  const supabase = createPublicClient()
  const { data: seasonProbe } = await supabase
    .from('races')
    .select('season')
    .order('season', { ascending: false })
    .limit(1)

  const currentSeason = seasonProbe?.[0]?.season ?? new Date().getFullYear()

  const [racesResponse, leaderboardResponse] = await Promise.all([
    supabase
      .from('races')
      .select('id, season, round, race_name, status, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
      .eq('season', currentSeason)
      .order('race_start_at', { ascending: true }),
    supabase
      .from('leaderboard_cache')
      .select('user_id, total_points, exact_hits, races_scored, profiles(display_name, email)')
      .eq('season', currentSeason),
  ])

  const races = ((racesResponse.data || []) as PublicSeasonRace[]).map((race) => ({
    ...race,
    effectiveStatus: getEffectiveRaceStatus(race),
  }))

  const leaderboard = sortCompetitionStandings((leaderboardResponse.data || []) as PublicSeasonLeaderboardEntry[])
  const nextRace = races.find((race) => race.effectiveStatus === 'upcoming') || null
  const pendingPublication = races.filter(
    (race) => race.effectiveStatus === 'locked' || race.effectiveStatus === 'completed'
  )
  const cancelledRaces = races.filter((race) => race.effectiveStatus === 'cancelled')
  const upcomingRaces = races.filter((race) => race.effectiveStatus === 'upcoming').slice(0, 6)
  const recentResults = [...races]
    .filter((race) => race.effectiveStatus === 'scored')
    .sort((left, right) => new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime())
    .slice(0, 6)
  const allRaces = [...races].sort((left, right) => {
    if (right.round !== left.round) {
      return right.round - left.round
    }

    return new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime()
  })

  return {
    currentSeason,
    allRaces,
    nextRace,
    pendingPublication,
    cancelledRaces,
    upcomingRaces,
    recentResults,
    leaderboard,
    totalRaces: races.length,
    totalCancelled: cancelledRaces.length,
    totalUpcoming: races.filter((race) => race.effectiveStatus === 'upcoming').length,
    totalScored: races.filter((race) => race.effectiveStatus === 'scored').length,
  }
})
