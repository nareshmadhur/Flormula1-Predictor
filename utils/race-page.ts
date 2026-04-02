import { cache } from 'react'
import { createPublicClient } from '@/utils/supabase/public'
import { RaceStatus } from '@/utils/race-status'

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

type PublicRaceNeighbor = {
  id: string
  round: number
  race_name: string
}

export const getPublicRacePageData = cache(async (raceId: string) => {
  const supabase = createPublicClient()

  const [raceResponse, driversResponse, bonusQuestionsResponse, raceResultResponse, raceBonusAnswersResponse] =
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
      supabase
        .from('bonus_questions')
        .select('id, question_text, points, bonus_options(id, label)')
        .eq('race_id', raceId)
        .eq('is_active', true)
        .order('display_order'),
      supabase
        .from('race_results')
        .select('p1_driver_id, p2_driver_id, p3_driver_id')
        .eq('race_id', raceId)
        .maybeSingle(),
      supabase
        .from('race_bonus_answers')
        .select('bonus_question_id, correct_bonus_option_id')
        .eq('race_id', raceId),
    ])

  if (!raceResponse.data) {
    return null
  }

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
