'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { normalizeNumericBonusValue, type BonusAnswerType } from '@/utils/bonus-answers'

type SubmittedBonusAnswer = {
  question_id: string
  option_id?: string | null
  numeric_value?: string | number | null
}

type ProfileTenantRow = {
  tenant_id?: string | null
}

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
    .select('*')
    .eq('id', raceId)
    .single()

  if (!race) return { error: 'Race not found' }

  const effectiveStatus = getEffectiveRaceStatus(race)
  if (effectiveStatus !== 'upcoming') {
    return { error: 'Predictions for this race are not available.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle()
  const tenantId = (profile as ProfileTenantRow | null)?.tenant_id || null

  if (!tenantId) {
    return { error: 'Join a group before submitting predictions.' }
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
      const parsedAnswers = JSON.parse(bonusAnswersRaw) as SubmittedBonusAnswer[]
      if (!Array.isArray(parsedAnswers)) {
        return { error: 'Bonus answers were not submitted correctly.' }
      }

      const { data: validQuestions, error: questionsError } = await supabase
        .from('bonus_questions')
        .select('id, answer_type, bonus_options(id)')
        .eq('race_id', raceId)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)

      if (questionsError) {
        return { error: 'Could not validate bonus answers. Please try again.' }
      }

      const questionsById = new Map(
        (validQuestions || []).map((question) => [
          question.id,
          {
            answerType: (question.answer_type || 'choice') as BonusAnswerType,
            optionIds: new Set((question.bonus_options || []).map((option) => option.id)),
          },
        ])
      )
      const submittedQuestionIds = new Set<string>()
      const normalizedAnswers: Array<{
        question_id: string
        option_id: string | null
        numeric_value: string | null
      }> = []

      for (const answer of parsedAnswers) {
        const question = answer?.question_id ? questionsById.get(answer.question_id) : null
        if (!answer?.question_id || !question || submittedQuestionIds.has(answer.question_id)) {
          return { error: 'One or more bonus answers are invalid. Please review your entry.' }
        }

        if (question.answerType === 'numeric') {
          const numericValue = normalizeNumericBonusValue(answer.numeric_value)
          if (answer.option_id || !numericValue) {
            return { error: 'One or more bonus answers are invalid. Please review your entry.' }
          }

          normalizedAnswers.push({
            question_id: answer.question_id,
            option_id: null,
            numeric_value: numericValue,
          })
        } else {
          if (
            !answer.option_id ||
            answer.numeric_value !== undefined && answer.numeric_value !== null ||
            !question.optionIds.has(answer.option_id)
          ) {
            return { error: 'One or more bonus answers are invalid. Please review your entry.' }
          }

          normalizedAnswers.push({
            question_id: answer.question_id,
            option_id: answer.option_id,
            numeric_value: null,
          })
        }

        submittedQuestionIds.add(answer.question_id)
      }

      const { error: clearBonusError } = await supabase
        .from('prediction_bonus_answers')
        .delete()
        .eq('prediction_id', prediction.id)

      if (clearBonusError) {
        return { error: 'Could not replace your bonus answers. Please try again.' }
      }

      if (normalizedAnswers.length > 0) {
        const bulkInserts = normalizedAnswers.map((a) => ({
          prediction_id: prediction.id,
          bonus_question_id: a.question_id,
          bonus_option_id: a.option_id,
          numeric_value: a.numeric_value,
        }))

        const { error: bonusError } = await supabase
          .from('prediction_bonus_answers')
          .insert(bulkInserts)

        if (bonusError) {
          console.error('Bonus save error', bonusError)
          return { error: 'Your podium was saved, but the bonus answers could not be saved. Please try again.' }
        }
      }
    } catch (e) {
      console.error('Failed to parse bonus answers', e)
      return { error: 'Bonus answers were not submitted correctly.' }
    }
  }

  revalidatePath('/predictions')
  revalidatePath(`/race/${raceId}/predict`)
  
  return { success: true }
}
