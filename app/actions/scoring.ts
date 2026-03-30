'use server'
import { revalidatePath } from 'next/cache'
import { rebuildLeaderboardForSeason } from '@/utils/leaderboard'
import { assertPlatformAdmin } from '@/utils/admin-access'

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

export async function calculateRaceScoresAction(formData: FormData) {
  const raceId = formData.get('race_id') as string
  if (!raceId) throw new Error('Missing race ID')

  const { supabase } = await assertPlatformAdmin()

  const { data: race } = await supabase
    .from('races')
    .select('season')
    .eq('id', raceId)
    .single()

  if (!race) throw new Error('Race not found')

  const { data: actualResult } = await supabase.from('race_results').select('*').eq('race_id', raceId).single()
  if (!actualResult) throw new Error('Save official results first')

  const { data: correctBonusAnswers } = await supabase
    .from('race_bonus_answers')
    .select('bonus_question_id, correct_bonus_option_id, bonus_questions(points)')
    .eq('race_id', raceId)

  const { data: predictions } = await supabase.from('predictions').select('*').eq('race_id', raceId)
  
  if (!predictions || predictions.length === 0) {
    await supabase.from('races').update({ status: 'scored' }).eq('id', raceId)
    await rebuildLeaderboardForSeason(supabase, race.season)
    revalidatePath(`/admin/races/${raceId}`)
    revalidatePath(`/leaderboard`)
    return
  }

  const typedPredictions = (predictions || []) as PredictionRow[]
  const predictionIds = typedPredictions.map((prediction) => prediction.id)
  const { data: userBonusAnswers } = await supabase
    .from('prediction_bonus_answers')
    .select('*')
    .in('prediction_id', predictionIds)

  const actualPodium = [actualResult.p1_driver_id, actualResult.p2_driver_id, actualResult.p3_driver_id]
  const typedUserBonusAnswers = (userBonusAnswers || []) as UserBonusAnswerRow[]
  const typedCorrectBonusAnswers = (correctBonusAnswers || []) as CorrectBonusAnswerRow[]

  const scoresToUpsert = typedPredictions.map((pred) => {
    let podiumPoints = 0
    let bonusPoints = 0
    let exactHits = 0

    const predictedPodium = [pred.p1_driver_id, pred.p2_driver_id, pred.p3_driver_id]

    for (let i = 0; i < 3; i++) {
        const predictedDriver = predictedPodium[i]
        if (predictedDriver === actualPodium[i]) {
            podiumPoints += 3
            exactHits += 1
        } else if (actualPodium.includes(predictedDriver)) {
            podiumPoints += 1
        }
    }

    if (typedCorrectBonusAnswers.length > 0 && typedUserBonusAnswers.length > 0) {
        const thisUserAnswers = typedUserBonusAnswers.filter((answer) => answer.prediction_id === pred.id)
        
        for (const correctAns of typedCorrectBonusAnswers) {
            const userAns = thisUserAnswers.find((answer) => answer.bonus_question_id === correctAns.bonus_question_id)
            if (userAns && userAns.bonus_option_id === correctAns.correct_bonus_option_id) {
                bonusPoints += (correctAns.bonus_questions?.points || 1)
            }
        }
    }

    return {
        user_id: pred.user_id,
        race_id: raceId,
        podium_points: podiumPoints,
        bonus_points: bonusPoints,
        total_points: podiumPoints + bonusPoints,
        exact_hits: exactHits,
        calculated_at: new Date().toISOString()
    }
  })

  // Upsert user_race_scores
  await supabase.from('user_race_scores').upsert(scoresToUpsert, { onConflict: 'user_id, race_id' })
  await rebuildLeaderboardForSeason(supabase, race.season)

  // Update race status
  await supabase.from('races').update({ status: 'scored' }).eq('id', raceId)

  revalidatePath(`/admin/races/${raceId}`)
  revalidatePath(`/leaderboard`)
  revalidatePath('/me/history')
}
