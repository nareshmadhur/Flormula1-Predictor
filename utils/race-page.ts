import { cache } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import { getRequestUserContext } from '@/utils/request-context'
import { RaceStatus } from '@/utils/race-status'
import { isTestModeProfile } from '@/utils/test-mode'
import { getBonusAnswerDisplay, type BonusAnswerType, type BonusAnswerValue } from '@/utils/bonus-answers'

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
  answer_type?: BonusAnswerType | null
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
  correct_bonus_option_id?: string | null
  numeric_value?: string | number | null
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

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  return Boolean(error?.message?.includes(column) && error.message.includes('does not exist'))
}

export const getPublicRacePageData = cache(async (raceId: string) => {
  const supabase = createPublicClient()
  const { supabase: requestSupabase, tenantContext } = await getRequestUserContext()

  const [raceResponse, driversResponse, raceResultResponse, raceScoresResponse] = await Promise.all([
    supabase
      .from('races')
      .select('id, season, round, race_name, status, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
      .eq('id', raceId)
      .maybeSingle(),
    supabase
      .from('drivers')
      .select('id, code, full_name, emoji')
      .order('full_name'),
    supabase
      .from('race_results')
      .select('p1_driver_id, p2_driver_id, p3_driver_id')
      .eq('race_id', raceId)
      .maybeSingle(),
    supabase
      .from('user_race_scores')
      .select('user_id, total_points, podium_points, bonus_points, exact_hits, profiles(display_name, email, is_test, tenants(is_test))')
      .eq('race_id', raceId),
  ])

  if (!raceResponse.data) {
    return null
  }

  let bonusQuestionsResponse = { data: [] as PublicRaceBonusQuestion[] }
  let raceBonusAnswersResponse = { data: [] as PublicRaceBonusAnswer[] }

  // Bonus questions are group-private. The public client intentionally cannot
  // see them, so use the request session only when it identifies a group.
  if (tenantContext.tenantId) {
    const scopedQuestions = await requestSupabase
      .from('bonus_questions')
      .select('id, question_text, points, answer_type, bonus_options(id, label)')
      .eq('race_id', raceId)
      .eq('tenant_id', tenantContext.tenantId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (isMissingColumnError(scopedQuestions.error, 'answer_type')) {
      const legacyQuestions = await requestSupabase
        .from('bonus_questions')
        .select('id, question_text, points, bonus_options(id, label)')
        .eq('race_id', raceId)
        .eq('tenant_id', tenantContext.tenantId)
        .eq('is_active', true)
        .order('display_order', { ascending: true })

      bonusQuestionsResponse = {
        data: ((legacyQuestions.data || []) as Array<Omit<PublicRaceBonusQuestion, 'answer_type'>>).map((question) => ({
          ...question,
          answer_type: 'choice',
        })),
      }
    } else {
      bonusQuestionsResponse = {
        data: (scopedQuestions.data || []) as PublicRaceBonusQuestion[],
      }
    }

    const questionIds = bonusQuestionsResponse.data.map((question) => question.id)
    if (questionIds.length > 0) {
      const scopedAnswers = await requestSupabase
        .from('race_bonus_answers')
        .select('bonus_question_id, correct_bonus_option_id, numeric_value')
        .eq('race_id', raceId)
        .in('bonus_question_id', questionIds)

      if (isMissingColumnError(scopedAnswers.error, 'numeric_value')) {
        const legacyAnswers = await requestSupabase
          .from('race_bonus_answers')
          .select('bonus_question_id, correct_bonus_option_id')
          .eq('race_id', raceId)
          .in('bonus_question_id', questionIds)

        raceBonusAnswersResponse = {
          data: (legacyAnswers.data || []) as PublicRaceBonusAnswer[],
        }
      } else {
        raceBonusAnswersResponse = {
          data: (scopedAnswers.data || []) as PublicRaceBonusAnswer[],
        }
      }
    }
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
  answer?: BonusAnswerValue
) {
  return getBonusAnswerDisplay(question, answer || {}, 'Official answer pending')
}
