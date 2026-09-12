import { NextResponse } from 'next/server'
import { getCurrentSeason } from '@/utils/season'
import { getRequestUserContext } from '@/utils/request-context'
import { buildUserLeaderboardBreakdowns } from '@/utils/leaderboard-breakdown'
import { isTestModeProfile } from '@/utils/test-mode'

type RouteProps = {
  params: Promise<{ userId: string }>
}

type LeaderboardProfile = {
  display_name?: string | null
  email?: string | null
  tenant_id?: string | null
  is_test?: boolean | null
  tenants?: { is_test?: boolean | null } | Array<{ is_test?: boolean | null }> | null
}

type LeaderboardRow = {
  user_id: string
  profiles?: LeaderboardProfile | LeaderboardProfile[] | null
}

type ScoredRace = {
  id: string
  round: number
  race_name: string
  race_start_at: string
}

type PredictionBreakdownRow = {
  id: string
  user_id: string
  race_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type RaceResultRow = {
  race_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type RaceScoreRow = {
  user_id: string
  race_id: string
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
}

type BonusQuestionRow = {
  id: string
  race_id: string
  tenant_id?: string | null
  question_text: string
  display_order?: number | null
  bonus_options?: Array<{
    id: string
    label?: string | null
  }> | null
}

type PredictionBonusAnswerRow = {
  prediction_id: string
  bonus_question_id: string
  bonus_option_id: string
}

type RaceBonusAnswerRow = {
  race_id: string
  bonus_question_id: string
  correct_bonus_option_id: string
}

type DriverRow = {
  id: string
  code?: string | null
  emoji?: string | null
}

function getProfile(row: LeaderboardRow | null) {
  if (!row?.profiles) return null
  return Array.isArray(row.profiles) ? row.profiles[0] || null : row.profiles
}

function isValidSeason(value: string | null) {
  if (!value) return false
  const season = Number(value)
  return Number.isInteger(season) && season >= 1950 && season <= 3000
}

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}

export async function GET(request: Request, { params }: RouteProps) {
  const { userId } = await params
  const url = new URL(request.url)
  const requestedView = url.searchParams.get('view')
  const view = requestedView === 'tenant' ? 'tenant' : 'global'
  const requestedSeason = url.searchParams.get('season')

  if (!isValidSeason(requestedSeason)) {
    return jsonResponse({ error: 'Invalid season.' }, 400)
  }

  const season = Number(requestedSeason)
  const { supabase, user, tenantContext } = await getRequestUserContext()
  const currentSeason = await getCurrentSeason(supabase)

  if (season !== currentSeason) {
    return jsonResponse({ error: 'Season not available.' }, 404)
  }

  if (view === 'tenant' && (!user || !tenantContext.tenantId)) {
    return jsonResponse({ error: 'Group standings require a signed-in player.' }, 403)
  }

  const leaderboardWithTestMode = await supabase
    .from('leaderboard_cache')
    .select('user_id, profiles(display_name, email, tenant_id, is_test, tenants(is_test))')
    .eq('season', season)
    .eq('user_id', userId)
    .maybeSingle()

  const leaderboardResult = leaderboardWithTestMode.error?.message?.includes('is_test')
    ? await supabase
        .from('leaderboard_cache')
        .select('user_id, profiles(display_name, email, tenant_id)')
        .eq('season', season)
        .eq('user_id', userId)
        .maybeSingle()
    : leaderboardWithTestMode
  const testModeFilterAvailable = !leaderboardWithTestMode.error
  const leaderboardRow = leaderboardResult.data as LeaderboardRow | null
  const profile = getProfile(leaderboardRow)

  if (leaderboardResult.error || !leaderboardRow || !profile) {
    return jsonResponse({ error: 'Leaderboard entry not found.' }, 404)
  }

  if (view === 'global') {
    if (testModeFilterAvailable && isTestModeProfile(profile)) {
      return jsonResponse({ error: 'Leaderboard entry not found.' }, 404)
    }
  } else if (profile.tenant_id !== tenantContext.tenantId) {
    return jsonResponse({ error: 'Leaderboard entry not found.' }, 404)
  }

  const { data: scoredRaces, error: racesError } = await supabase
    .from('races')
    .select('id, round, race_name, race_start_at')
    .eq('season', season)
    .eq('status', 'scored')
    .order('race_start_at', { ascending: false })

  if (racesError) {
    return jsonResponse({ error: 'Race detail is unavailable.' }, 500)
  }

  const typedScoredRaces = (scoredRaces || []) as ScoredRace[]
  const scoredRaceIds = typedScoredRaces.map((race) => race.id)
  if (scoredRaceIds.length === 0) {
    return jsonResponse({ breakdown: [] })
  }

  const [predictionsResult, raceResultsResult, scoresResult, questionsResult, correctBonusResult, driversResult] =
    await Promise.all([
      supabase
        .from('predictions')
        .select('id, user_id, race_id, p1_driver_id, p2_driver_id, p3_driver_id')
        .eq('user_id', userId)
        .in('race_id', scoredRaceIds),
      supabase
        .from('race_results')
        .select('race_id, p1_driver_id, p2_driver_id, p3_driver_id')
        .in('race_id', scoredRaceIds),
      supabase
        .from('user_race_scores')
        .select('user_id, race_id, total_points, podium_points, bonus_points, exact_hits')
        .eq('user_id', userId)
        .in('race_id', scoredRaceIds),
      supabase
        .from('bonus_questions')
        .select('id, race_id, tenant_id, question_text, display_order, bonus_options(id, label)')
        .in('race_id', scoredRaceIds)
        .eq('is_active', true)
        .order('display_order', { ascending: true }),
      supabase
        .from('race_bonus_answers')
        .select('race_id, bonus_question_id, correct_bonus_option_id')
        .in('race_id', scoredRaceIds),
      supabase.from('drivers').select('id, code, emoji'),
    ])

  const queryError =
    predictionsResult.error ||
    raceResultsResult.error ||
    scoresResult.error ||
    questionsResult.error ||
    correctBonusResult.error ||
    driversResult.error

  if (queryError) {
    return jsonResponse({ error: 'Race detail is unavailable.' }, 500)
  }

  const predictionRows = (predictionsResult.data || []) as PredictionBreakdownRow[]
  const predictionIds = predictionRows.map((prediction) => prediction.id)
  const predictionBonusResult =
    predictionIds.length > 0
      ? await supabase
          .from('prediction_bonus_answers')
          .select('prediction_id, bonus_question_id, bonus_option_id')
          .in('prediction_id', predictionIds)
      : { data: [], error: null }

  if (predictionBonusResult.error) {
    return jsonResponse({ error: 'Race detail is unavailable.' }, 500)
  }

  const breakdownByUserId = buildUserLeaderboardBreakdowns({
    races: typedScoredRaces,
    predictions: predictionRows,
    raceResults: (raceResultsResult.data || []) as RaceResultRow[],
    raceScores: (scoresResult.data || []) as RaceScoreRow[],
    bonusQuestions: (questionsResult.data || []) as BonusQuestionRow[],
    predictionBonusAnswers: (predictionBonusResult.data || []) as PredictionBonusAnswerRow[],
    raceBonusAnswers: (correctBonusResult.data || []) as RaceBonusAnswerRow[],
    driversById: new Map(
      ((driversResult.data || []) as DriverRow[]).map((driver) => [driver.id, { code: driver.code, emoji: driver.emoji }])
    ),
    userTenantById: new Map([[userId, profile.tenant_id || null]]),
  })

  return jsonResponse({ breakdown: breakdownByUserId.get(userId) || [] })
}
