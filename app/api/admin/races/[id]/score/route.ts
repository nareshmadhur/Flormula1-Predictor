import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rebuildLeaderboardForSeason } from '@/utils/leaderboard'
import { getAdminAccessContext } from '@/utils/admin-access'

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

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const raceId = params.id

  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!access.isPlatformAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: race } = await supabase
    .from('races')
    .select('season')
    .eq('id', raceId)
    .single()

  if (!race) {
    return NextResponse.json({ error: 'Race not found' }, { status: 404 })
  }

  const { data: actualResult } = await supabase.from('race_results').select('*').eq('race_id', raceId).single()
  if (!actualResult) {
    return NextResponse.json({ error: 'Save official results first' }, { status: 400 })
  }

  // Fetch official bonus answers and questions configuration (for points default)
  const { data: correctBonusAnswers } = await supabase
    .from('race_bonus_answers')
    .select('bonus_question_id, correct_bonus_option_id, bonus_questions(points)')
    .eq('race_id', raceId)

  // Fetch all predictions for this race
  const { data: predictions } = await supabase.from('predictions').select('*').eq('race_id', raceId)
  
  if (!predictions || predictions.length === 0) {
    // Just mark as scored
    await supabase.from('races').update({ status: 'scored' }).eq('id', raceId)
    await rebuildLeaderboardForSeason(supabase, race.season)
    return NextResponse.json({ status: 'No predictions to score' })
  }

  // Fetch all user bonus answers for these predictions
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

  return NextResponse.json({ success: true, count: predictions.length })
}
