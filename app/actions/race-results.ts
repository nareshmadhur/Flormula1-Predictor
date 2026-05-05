'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { fetchOpenF1PodiumSuggestion, getOpenF1ErrorMessage } from '@/utils/openf1'
import { recalculateRaceScores } from '@/utils/race-scoring'

export type RaceResultRefreshState = {
  status: 'idle' | 'success' | 'error'
  message?: string
}

type RaceForRefresh = {
  id: string
  season: number
  race_name: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  external_race_key?: string | null
}

type DriverForRefresh = {
  id: string
  code: string
  full_name: string
}

function revalidateRaceResultPaths(raceId: string) {
  revalidatePath('/')
  revalidatePath('/season')
  revalidatePath('/predictions')
  revalidatePath('/leaderboard')
  revalidatePath('/me/history')
  revalidatePath(`/race/${raceId}`)
  revalidatePath(`/race/${raceId}/predict`)
}

export async function refreshRaceResultFromSource(
  _previousState: RaceResultRefreshState,
  formData: FormData
): Promise<RaceResultRefreshState> {
  const raceId = String(formData.get('race_id') || '').trim()

  if (!raceId) {
    return {
      status: 'error',
      message: 'Missing race ID.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      status: 'error',
      message: 'Sign in before checking the official source.',
    }
  }

  const [{ data: race }, { data: drivers }] = await Promise.all([
    supabase
      .from('races')
      .select('id, season, race_name, status, race_start_at, prediction_lock_at, external_race_key')
      .eq('id', raceId)
      .single(),
    supabase.from('drivers').select('id, code, full_name').order('full_name'),
  ])

  if (!race) {
    return {
      status: 'error',
      message: 'Race not found.',
    }
  }

  const typedRace = race as RaceForRefresh
  const effectiveStatus = getEffectiveRaceStatus(typedRace)

  if (effectiveStatus !== 'completed' && effectiveStatus !== 'scored') {
    return {
      status: 'error',
      message: 'The official result can only be checked after race start.',
    }
  }

  if (!typedRace.external_race_key) {
    return {
      status: 'error',
      message: 'This race is not linked to the official source yet.',
    }
  }

  let podium
  try {
    podium = await fetchOpenF1PodiumSuggestion(typedRace.external_race_key, (drivers || []) as DriverForRefresh[])
  } catch (error) {
    return {
      status: 'error',
      message: getOpenF1ErrorMessage(error),
    }
  }

  const podiumDriverIds = [
    podium?.p1?.localDriverId || null,
    podium?.p2?.localDriverId || null,
    podium?.p3?.localDriverId || null,
  ]

  if (!podium || podiumDriverIds.some((driverId) => !driverId)) {
    return {
      status: 'error',
      message: 'The official source does not have a clean local podium match yet. Admin review is needed.',
    }
  }

  if (new Set(podiumDriverIds).size !== 3) {
    return {
      status: 'error',
      message: 'The official source returned a duplicate podium driver. Admin review is needed.',
    }
  }

  let serviceSupabase: ReturnType<typeof createServiceRoleClient>
  try {
    serviceSupabase = createServiceRoleClient()
  } catch {
    return {
      status: 'error',
      message: 'Result refresh is not configured for this environment yet.',
    }
  }
  const { data: bonusQuestions } = await serviceSupabase
    .from('bonus_questions')
    .select('id')
    .eq('race_id', raceId)
    .eq('is_active', true)
  const activeBonusQuestionIds = (bonusQuestions || []).map((question) => question.id as string)
  const { data: bonusAnswers } =
    activeBonusQuestionIds.length > 0
      ? await serviceSupabase
          .from('race_bonus_answers')
          .select('bonus_question_id')
          .eq('race_id', raceId)
          .in('bonus_question_id', activeBonusQuestionIds)
      : { data: [] }
  const answeredBonusQuestionIds = new Set((bonusAnswers || []).map((answer) => answer.bonus_question_id as string))
  const hasAllBonusAnswers = activeBonusQuestionIds.every((questionId) => answeredBonusQuestionIds.has(questionId))

  if (effectiveStatus === 'scored' && !hasAllBonusAnswers) {
    return {
      status: 'error',
      message: 'This race is already scored, but bonus answers are incomplete. Admin review is needed before refreshing it.',
    }
  }

  const { error: resultsError } = await serviceSupabase.from('race_results').upsert(
    {
      race_id: raceId,
      p1_driver_id: podiumDriverIds[0],
      p2_driver_id: podiumDriverIds[1],
      p3_driver_id: podiumDriverIds[2],
      source: 'openf1_user_refresh',
      entered_by: user.id,
    },
    { onConflict: 'race_id' }
  )

  if (resultsError) {
    return {
      status: 'error',
      message: 'Could not save the official podium from the source.',
    }
  }

  if (hasAllBonusAnswers) {
    await recalculateRaceScores(serviceSupabase, raceId)
    revalidateRaceResultPaths(raceId)

    return {
      status: 'success',
      message: `${typedRace.race_name} was refreshed from OpenF1 and the standings were recalculated.`,
    }
  }

  await serviceSupabase.from('races').update({ status: 'completed' }).eq('id', raceId)
  revalidateRaceResultPaths(raceId)

  return {
    status: 'success',
    message: `${typedRace.race_name} podium was refreshed. Bonus answers still need admin review before scoring.`,
  }
}
