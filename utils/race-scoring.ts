import { rebuildLeaderboardForSeason } from '@/utils/leaderboard'
import { createClient } from '@/utils/supabase/server'

type ScoringClient = Awaited<ReturnType<typeof createClient>>

type PredictionRow = {
  id: string
  user_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type UserBonusAnswerRow = {
  prediction_id: string
  bonus_question_id: string
  bonus_option_id: string
}

type CorrectBonusAnswerRow = {
  bonus_question_id: string
  correct_bonus_option_id: string
  bonus_questions?: {
    points?: number
  } | null
}

type RecalculateRaceScoresOptions = {
  rebuildLeaderboard?: boolean
  markRaceScored?: boolean
}

export async function recalculateRaceScores(
  supabase: ScoringClient,
  raceId: string,
  options: RecalculateRaceScoresOptions = {}
) {
  const rebuildLeaderboard = options.rebuildLeaderboard ?? true
  const markRaceScored = options.markRaceScored ?? true

  const { data: race } = await supabase
    .from('races')
    .select('season')
    .eq('id', raceId)
    .single()

  if (!race) {
    throw new Error('Race not found')
  }

  const { data: actualResult } = await supabase.from('race_results').select('*').eq('race_id', raceId).single()
  if (!actualResult) {
    throw new Error('Save official results first')
  }

  const [{ data: correctBonusAnswers }, { data: predictions }] = await Promise.all([
    supabase
      .from('race_bonus_answers')
      .select('bonus_question_id, correct_bonus_option_id, bonus_questions(points)')
      .eq('race_id', raceId),
    supabase.from('predictions').select('*').eq('race_id', raceId),
  ])

  const typedPredictions = (predictions || []) as PredictionRow[]
  const predictionIds = typedPredictions.map((prediction) => prediction.id)

  const { data: userBonusAnswers } =
    predictionIds.length > 0
      ? await supabase
          .from('prediction_bonus_answers')
          .select('*')
          .in('prediction_id', predictionIds)
      : { data: [] as UserBonusAnswerRow[] }

  const typedUserBonusAnswers = (userBonusAnswers || []) as UserBonusAnswerRow[]
  const typedCorrectBonusAnswers = (correctBonusAnswers || []) as CorrectBonusAnswerRow[]
  const actualPodium = [actualResult.p1_driver_id, actualResult.p2_driver_id, actualResult.p3_driver_id]

  const scoresToInsert = typedPredictions.map((prediction) => {
    let podiumPoints = 0
    let bonusPoints = 0
    let exactHits = 0

    const predictedPodium = [prediction.p1_driver_id, prediction.p2_driver_id, prediction.p3_driver_id]

    for (let index = 0; index < 3; index += 1) {
      const predictedDriver = predictedPodium[index]
      if (predictedDriver === actualPodium[index]) {
        podiumPoints += 3
        exactHits += 1
      } else if (actualPodium.includes(predictedDriver)) {
        podiumPoints += 1
      }
    }

    if (typedCorrectBonusAnswers.length > 0 && typedUserBonusAnswers.length > 0) {
      const thisPredictionAnswers = typedUserBonusAnswers.filter((answer) => answer.prediction_id === prediction.id)

      for (const correctAnswer of typedCorrectBonusAnswers) {
        const userAnswer = thisPredictionAnswers.find(
          (answer) => answer.bonus_question_id === correctAnswer.bonus_question_id
        )

        if (userAnswer && userAnswer.bonus_option_id === correctAnswer.correct_bonus_option_id) {
          bonusPoints += correctAnswer.bonus_questions?.points || 1
        }
      }
    }

    return {
      user_id: prediction.user_id,
      race_id: raceId,
      podium_points: podiumPoints,
      bonus_points: bonusPoints,
      total_points: podiumPoints + bonusPoints,
      exact_hits: exactHits,
      calculated_at: new Date().toISOString(),
    }
  })

  const { error: clearScoresError } = await supabase.from('user_race_scores').delete().eq('race_id', raceId)
  if (clearScoresError) {
    throw new Error('Failed to clear previous race scores')
  }

  if (scoresToInsert.length > 0) {
    const { error: insertScoresError } = await supabase.from('user_race_scores').insert(scoresToInsert)
    if (insertScoresError) {
      throw new Error('Failed to save recalculated race scores')
    }
  }

  if (markRaceScored) {
    await supabase.from('races').update({ status: 'scored' }).eq('id', raceId)
  }

  if (rebuildLeaderboard) {
    await rebuildLeaderboardForSeason(supabase, race.season)
  }

  return {
    season: race.season,
    predictionsCount: typedPredictions.length,
  }
}
