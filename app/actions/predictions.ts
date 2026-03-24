'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { isPast } from 'date-fns'

export async function submitPrediction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to predict.' }
  }

  const raceId = formData.get('race_id') as string
  const p1 = formData.get('p1_driver_id') as string
  const p2 = formData.get('p2_driver_id') as string
  const p3 = formData.get('p3_driver_id') as string
  const bonusAnswersRaw = formData.get('bonus_answers') as string

  if (!raceId || !p1 || !p2 || !p3) {
    return { error: 'Please select all podium positions.' }
  }

  if (new Set([p1, p2, p3]).size !== 3) {
    return { error: 'Cannot select the same driver multiple times.' }
  }

  // Verify the lock time
  const { data: race } = await supabase
    .from('races')
    .select('prediction_lock_at, status')
    .eq('id', raceId)
    .single()

  if (!race) return { error: 'Race not found' }
  
  if (isPast(new Date(race.prediction_lock_at)) || race.status === 'locked') {
    return { error: 'Predictions for this race are locked.' }
  }

  // UPSERT the prediction
  const { data: prediction, error: predError } = await supabase
    .from('predictions')
    .upsert(
      { 
        user_id: user.id, 
        race_id: raceId, 
        p1_driver_id: p1, 
        p2_driver_id: p2, 
        p3_driver_id: p3,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'user_id, race_id' }
    )
    .select()
    .single()

  if (predError || !prediction) {
    console.error('Prediction save error', predError)
    return { error: 'Failed to save prediction. Please try again.' }
  }

  // Handle Bonus answers
  if (bonusAnswersRaw) {
    try {
      const parsedAnswers = JSON.parse(bonusAnswersRaw)
      if (parsedAnswers && parsedAnswers.length > 0) {
        // Delete old bonus answers for this prediction to avoid orphans or duplicates
        await supabase
          .from('prediction_bonus_answers')
          .delete()
          .eq('prediction_id', prediction.id)

        // Insert new answers
        const bulkInserts = parsedAnswers.map((a: any) => ({
          prediction_id: prediction.id,
          bonus_question_id: a.question_id,
          bonus_option_id: a.option_id
        }))

        const { error: bonusError } = await supabase
          .from('prediction_bonus_answers')
          .insert(bulkInserts)

        if (bonusError) {
          console.error('Bonus save error', bonusError)
          // We don't want to completely fail if only bonus answers failed, 
          // but we should probably tell the user
        }
      }
    } catch (e) {
      console.error('Failed to parse bonus answers', e)
    }
  }

  revalidatePath('/predictions')
  revalidatePath(`/race/${raceId}/predict`)
  
  return { success: true }
}
