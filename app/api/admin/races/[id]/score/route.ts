import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const raceId = params.id

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Calculate scores
  // Fetch official result
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
    return NextResponse.json({ status: 'No predictions to score' })
  }

  // Fetch all user bonus answers for these predictions
  const predictionIds = predictions.map((p: any) => p.id)
  const { data: userBonusAnswers } = await supabase
    .from('prediction_bonus_answers')
    .select('*')
    .in('prediction_id', predictionIds)

  const actualPodium = [actualResult.p1_driver_id, actualResult.p2_driver_id, actualResult.p3_driver_id]

  const scoresToUpsert = predictions.map((pred: any) => {
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

    if (correctBonusAnswers && userBonusAnswers) {
        const thisUserAnswers = userBonusAnswers.filter((a: any) => a.prediction_id === pred.id)
        
        for (const correctAns of correctBonusAnswers) {
            const userAns = thisUserAnswers.find((a: any) => a.bonus_question_id === correctAns.bonus_question_id)
            if (userAns && userAns.bonus_option_id === correctAns.correct_bonus_option_id) {
                // @ts-ignore
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

  // Re-calculate Leaderboard Cache (simple approach: delete and re-insert for this season)
  // To avoid complexity, since v1 only has one season (2024), we can just aggregate all scores for all users
  const { data: allScores } = await supabase.from('user_race_scores').select('*')
  
  const leaderboardMap = new Map()
  
  allScores?.forEach((score: any) => {
     if (!leaderboardMap.has(score.user_id)) {
         leaderboardMap.set(score.user_id, {
             season: 2024,
             user_id: score.user_id,
             total_points: 0,
             exact_hits: 0,
             races_scored: 0
         })
     }
     const lb = leaderboardMap.get(score.user_id)
     lb.total_points += score.total_points
     lb.exact_hits += score.exact_hits
     lb.races_scored += 1
  })

  // Clear and update leaderboard_cache for 2024
  await supabase.from('leaderboard_cache').delete().eq('season', 2024)
  if (leaderboardMap.size > 0) {
      const lbInserts = Array.from(leaderboardMap.values())
      await supabase.from('leaderboard_cache').insert(lbInserts)
  }

  // Update race status
  await supabase.from('races').update({ status: 'scored' }).eq('id', raceId)

  return NextResponse.json({ success: true, count: predictions.length })
}
