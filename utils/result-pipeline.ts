import { createClient } from '@/utils/supabase/server'

type ResultPipelineClient = Pick<Awaited<ReturnType<typeof createClient>>, 'rpc'>

export type BonusAnswer = {
  questionId: string
  optionId?: string | null
  numericValue?: string | number | null
}

type ChoiceBonusAnswer = {
  questionId: string
  optionId: string
}

type Podium = {
  p1: string
  p2: string
  p3: string
}

function getBonusArrays(bonusAnswers: ChoiceBonusAnswer[]) {
  return {
    p_bonus_question_ids: bonusAnswers.map((answer) => answer.questionId),
    p_bonus_option_ids: bonusAnswers.map((answer) => answer.optionId),
  }
}

function getBonusJson(bonusAnswers: BonusAnswer[]) {
  return bonusAnswers.map((answer) => ({
    question_id: answer.questionId,
    ...(answer.optionId ? { option_id: answer.optionId } : {}),
    ...(answer.numericValue !== undefined && answer.numericValue !== null
      ? { numeric_value: String(answer.numericValue) }
      : {}),
  }))
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
    bonusAnswers: ChoiceBonusAnswer[]
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
  const { error } = await supabase.rpc('save_tenant_race_bonus_answers_v2', {
    p_race_id: input.raceId,
    p_bonus_answers: getBonusJson(input.bonusAnswers),
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
  const { data, error } = await supabase.rpc('save_historic_prediction_v2', {
    p_race_id: input.raceId,
    p_user_id: input.userId,
    p_p1_driver_id: input.podium.p1,
    p_p2_driver_id: input.podium.p2,
    p_p3_driver_id: input.podium.p3,
    p_bonus_answers: getBonusJson(input.bonusAnswers),
  })

  throwPipelineError(error, 'Could not save the historic prediction.')

  return {
    shouldRecalculate: Boolean(data),
  }
}
