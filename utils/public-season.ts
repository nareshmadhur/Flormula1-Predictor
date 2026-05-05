import { cache } from 'react'
import { sortCompetitionStandings } from '@/utils/competition'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { createPublicClient } from '@/utils/supabase/public'
import { isTestModeProfile } from '@/utils/test-mode'

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
        is_test?: boolean | null
        tenants?: { is_test?: boolean | null } | Array<{ is_test?: boolean | null }> | null
      }
    | Array<{
        display_name?: string | null
        email?: string | null
        is_test?: boolean | null
        tenants?: { is_test?: boolean | null } | Array<{ is_test?: boolean | null }> | null
      }>
    | null
}

function getLeaderboardProfile(entry: PublicSeasonLeaderboardEntry) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
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
      .select('user_id, total_points, exact_hits, races_scored, profiles(display_name, email, is_test, tenants(is_test))')
      .eq('season', currentSeason),
  ])

  const races = ((racesResponse.data || []) as PublicSeasonRace[]).map((race) => ({
    ...race,
    effectiveStatus: getEffectiveRaceStatus(race),
  }))

  const legacyLeaderboardResponse = leaderboardResponse.error?.message?.includes('is_test')
    ? await supabase
        .from('leaderboard_cache')
        .select('user_id, total_points, exact_hits, races_scored, profiles(display_name, email)')
        .eq('season', currentSeason)
    : null
  const testModeFilterAvailable = !leaderboardResponse.error
  const leaderboardRows = (legacyLeaderboardResponse?.data || leaderboardResponse.data || []) as PublicSeasonLeaderboardEntry[]
  const leaderboard = sortCompetitionStandings(
    leaderboardRows.filter((entry) =>
      testModeFilterAvailable ? !isTestModeProfile(getLeaderboardProfile(entry)) : true
    )
  )
  const nextRace = races.find((race) => race.effectiveStatus === 'upcoming') || null
  const pendingPublication = [...races]
    .filter((race) => race.effectiveStatus === 'locked' || race.effectiveStatus === 'completed')
    .sort((left, right) => new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime())
  const cancelledRaces = races.filter((race) => race.effectiveStatus === 'cancelled')
  const upcomingRaces = races.filter((race) => race.effectiveStatus === 'upcoming').slice(0, 6)
  const recentResults = [...races]
    .filter((race) => race.effectiveStatus === 'scored')
    .sort((left, right) => new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime())
    .slice(0, 6)
  const getBoardPriority = (race: PublicSeasonRaceSummary) => {
    if (race.effectiveStatus === 'locked' || race.effectiveStatus === 'completed') return 0
    if (race.effectiveStatus === 'upcoming') return 1
    if (race.effectiveStatus === 'scored') return 2
    return 3
  }
  const allRaces = [...races].sort((left, right) => {
    const priorityDelta = getBoardPriority(left) - getBoardPriority(right)
    if (priorityDelta !== 0) return priorityDelta

    if (left.effectiveStatus === 'upcoming') {
      return new Date(left.race_start_at).getTime() - new Date(right.race_start_at).getTime()
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
