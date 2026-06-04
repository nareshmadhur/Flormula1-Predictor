import { createClient } from '@/utils/supabase/server'

type ResultPipelineClient = Pick<Awaited<ReturnType<typeof createClient>>, 'rpc'>

type BonusAnswer = {
  questionId: string
  optionId: string
}

type Podium = {
  p1: string
  p2: string
  p3: string
}

function getBonusArrays(bonusAnswers: BonusAnswer[]) {
  return {
    p_bonus_question_ids: bonusAnswers.map((answer) => answer.questionId),
    p_bonus_option_ids: bonusAnswers.map((answer) => answer.optionId),
  }
}

function throwPipelineError(error: { message: string } | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback)
  }
}

export async function saveOfficialRaceResult(
  supabase: ResultPipelineClient,
  input: {
    raceId: string
    podium: Podium
    bonusAnswers: BonusAnswer[]
  }
) {
  const { error } = await supabase.rpc('save_official_race_result', {
    p_race_id: input.raceId,
    p_p1_driver_id: input.podium.p1,
    p_p2_driver_id: input.podium.p2,
    p_p3_driver_id: input.podium.p3,
    ...getBonusArrays(input.bonusAnswers),
  })

  throwPipelineError(error, 'Could not save official results.')
}

export async function saveTenantRaceBonusAnswers(
  supabase: ResultPipelineClient,
  input: {
    raceId: string
    bonusAnswers: BonusAnswer[]
  }
) {
  const { error } = await supabase.rpc('save_tenant_race_bonus_answers', {
    p_race_id: input.raceId,
    ...getBonusArrays(input.bonusAnswers),
  })

  throwPipelineError(error, 'Could not save group bonus answers.')
}

export async function saveHistoricPrediction(
  supabase: ResultPipelineClient,
  input: {
    raceId: string
    userId: string
    podium: Podium
    bonusAnswers: BonusAnswer[]
  }
) {
  const { data, error } = await supabase.rpc('save_historic_prediction', {
    p_race_id: input.raceId,
    p_user_id: input.userId,
    p_p1_driver_id: input.podium.p1,
    p_p2_driver_id: input.podium.p2,
    p_p3_driver_id: input.podium.p3,
    ...getBonusArrays(input.bonusAnswers),
  })

  throwPipelineError(error, 'Could not save the historic prediction.')

  return {
    shouldRecalculate: Boolean(data),
  }
}
