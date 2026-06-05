import { cache } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import { RaceStatus } from '@/utils/race-status'
import { isTestModeProfile } from '@/utils/test-mode'

export type PublicRaceDriver = {
  id: string
  code: string
  full_name: string
  emoji?: string | null
}

export type PublicRaceBonusOption = {
  id: string
  label?: string | null
}

export type PublicRaceBonusQuestion = {
  id: string
  question_text: string
  points: number
  bonus_options?: PublicRaceBonusOption[]
}

export type PublicRaceRecord = {
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

type PublicRaceResult = {
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type PublicRaceBonusAnswer = {
  bonus_question_id: string
  correct_bonus_option_id: string
}

type PublicRaceTopScorerProfile = {
  display_name?: string | null
  email?: string | null
  is_test?: boolean | null
  tenants?: { is_test?: boolean | null } | Array<{ is_test?: boolean | null }> | null
}

export type PublicRaceTopScorer = {
  user_id: string
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
  profiles?: PublicRaceTopScorerProfile | PublicRaceTopScorerProfile[] | null
}

type PublicRaceNeighbor = {
  id: string
  round: number
  race_name: string
}

function getTopScorerProfile(scorer: PublicRaceTopScorer) {
  if (Array.isArray(scorer.profiles)) {
    return scorer.profiles[0] || null
  }

  return scorer.profiles || null
}

function sortRaceTopScorers(scores: PublicRaceTopScorer[]) {
  return [...scores].sort((left, right) => {
    if (right.total_points !== left.total_points) return right.total_points - left.total_points
    if (right.exact_hits !== left.exact_hits) return right.exact_hits - left.exact_hits
    if (right.podium_points !== left.podium_points) return right.podium_points - left.podium_points
    if (right.bonus_points !== left.bonus_points) return right.bonus_points - left.bonus_points
    return left.user_id.localeCompare(right.user_id)
  })
}

export const getPublicRacePageData = cache(async (raceId: string) => {
  const supabase = createPublicClient()

  const [raceResponse, driversResponse, bonusQuestionsResponse, raceResultResponse, raceBonusAnswersResponse, raceScoresResponse] =
    await Promise.all([
      supabase
        .from('races')
        .select('id, season, round, race_name, status, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
        .eq('id', raceId)
        .maybeSingle(),
      supabase
        .from('drivers')
        .select('id, code, full_name, emoji')
        .order('full_name'),
      Promise.resolve({ data: [] as PublicRaceBonusQuestion[] }),
      supabase
        .from('race_results')
        .select('p1_driver_id, p2_driver_id, p3_driver_id')
        .eq('race_id', raceId)
        .maybeSingle(),
      Promise.resolve({ data: [] as PublicRaceBonusAnswer[] }),
      supabase
        .from('user_race_scores')
        .select('user_id, total_points, podium_points, bonus_points, exact_hits, profiles(display_name, email, is_test, tenants(is_test))')
        .eq('race_id', raceId),
    ])

  if (!raceResponse.data) {
    return null
  }

  const legacyRaceScoresResponse = raceScoresResponse.error?.message?.includes('is_test')
    ? await supabase
        .from('user_race_scores')
        .select('user_id, total_points, podium_points, bonus_points, exact_hits, profiles(display_name, email)')
        .eq('race_id', raceId)
    : null
  const testModeFilterAvailable = !raceScoresResponse.error
  const raceScoreRows = (legacyRaceScoresResponse?.data || raceScoresResponse.data || []) as PublicRaceTopScorer[]
  const topScorers = sortRaceTopScorers(
    raceScoreRows.filter((score) =>
      testModeFilterAvailable ? !isTestModeProfile(getTopScorerProfile(score)) : true
    )
  ).slice(0, 5)

  const { data: seasonRaces } = await supabase
    .from('races')
    .select('id, round, race_name')
    .eq('season', raceResponse.data.season)
    .order('round', { ascending: true })

  const orderedSeasonRaces = (seasonRaces || []) as PublicRaceNeighbor[]
  const currentIndex = orderedSeasonRaces.findIndex((race) => race.id === raceId)
  const previousRace = currentIndex > 0 ? orderedSeasonRaces[currentIndex - 1] : null
  const nextRace =
    currentIndex >= 0 && currentIndex < orderedSeasonRaces.length - 1
      ? orderedSeasonRaces[currentIndex + 1]
      : null

  return {
    race: raceResponse.data as PublicRaceRecord,
    drivers: (driversResponse.data || []) as PublicRaceDriver[],
    bonusQuestions: (bonusQuestionsResponse.data || []) as PublicRaceBonusQuestion[],
    raceResult: (raceResultResponse.data || null) as PublicRaceResult | null,
    raceBonusAnswers: (raceBonusAnswersResponse.data || []) as PublicRaceBonusAnswer[],
    topScorers,
    previousRace,
    nextRace,
  }
})

export function getDriverLabel(drivers: PublicRaceDriver[], driverId?: string | null) {
  if (!driverId) return 'Not selected'

  const driver = drivers.find((entry) => entry.id === driverId)
  if (!driver) return 'Unknown driver'

  return `${driver.code} - ${driver.full_name}${driver.emoji ? ` ${driver.emoji}` : ''}`
}

export function getBonusAnswerLabel(
  question: PublicRaceBonusQuestion,
  optionId?: string | null
) {
  if (!optionId) return 'Official answer pending'

  const option = question.bonus_options?.find((entry) => entry.id === optionId)
  return option?.label || 'Unknown option'
}
