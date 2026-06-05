'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { saveTenantRaceBonusAnswers } from '@/utils/result-pipeline'
import {
  buildBonusOptionInsertRows,
  getCleanBonusOptionLabels,
  getSelectedCircuitOptionIds,
} from '@/utils/bonus-option-inputs'

type TenantBonusAccess = {
  supabase: Awaited<ReturnType<typeof createClient>>
  tenantId: string
}

type RaceEditWindowRow = {
  id: string
  status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
  race_start_at: string
  prediction_lock_at: string
}

const DRAFT_QUESTION_ID = '00000000-0000-0000-0000-000000000000'

function revalidateTenantBonusPaths(raceId: string) {
  revalidatePath('/admin/tenant')
  revalidatePath('/leaderboard')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
  revalidatePath(`/race/${raceId}/predict`)
}

async function assertTenantBonusAccess(): Promise<TenantBonusAccess> {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access || !access.isAdmin || !access.tenantId) {
    throw new Error('Group admin access is required.')
  }

  return { supabase, tenantId: access.tenantId }
}

async function assertQuestionEditWindow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raceId: string
) {
  const { data: race } = await supabase
    .from('races')
    .select('id, status, race_start_at, prediction_lock_at')
    .eq('id', raceId)
    .maybeSingle()

  if (!race) {
    throw new Error('Race not found.')
  }

  if (getEffectiveRaceStatus(race as RaceEditWindowRow) !== 'upcoming') {
    throw new Error('Group bonus questions can only be changed while predictions are open.')
  }
}

export async function addTenantBonusQuestion(formData: FormData) {
  const { supabase, tenantId } = await assertTenantBonusAccess()

  const raceId = String(formData.get('race_id') || '').trim()
  const questionText = String(formData.get('question_text') || '').trim()
  const points = Number.parseInt(String(formData.get('points') || '1'), 10)
  const optionCount = getCleanBonusOptionLabels(formData).length + getSelectedCircuitOptionIds(formData).length

  if (!raceId || !questionText) {
    throw new Error('Race and question text are required.')
  }

  if (!Number.isFinite(points) || points < 1 || points > 25) {
    throw new Error('Bonus points must be between 1 and 25.')
  }

  if (optionCount < 2) {
    throw new Error('Add at least two options for a bonus question.')
  }

  await assertQuestionEditWindow(supabase, raceId)
  const optionDrafts = await buildBonusOptionInsertRows(supabase, DRAFT_QUESTION_ID, formData)

  const { data: question, error: questionError } = await supabase
    .from('bonus_questions')
    .insert({
      race_id: raceId,
      tenant_id: tenantId,
      question_text: questionText,
      points,
    })
    .select('id')
    .single()

  if (questionError || !question) {
    throw new Error(questionError?.message || 'Failed to add group bonus question.')
  }

  const options = optionDrafts.map((option) => ({
    ...option,
    bonus_question_id: question.id,
  }))

  const { error: optionsError } = await supabase.from('bonus_options').insert(options)

  if (optionsError) {
    throw new Error(optionsError.message || 'Failed to add group bonus options.')
  }

  revalidateTenantBonusPaths(raceId)
}

export async function updateTenantBonusQuestion(formData: FormData) {
  const { supabase, tenantId } = await assertTenantBonusAccess()

  const questionId = String(formData.get('question_id') || '').trim()
  const raceId = String(formData.get('race_id') || '').trim()
  const questionText = String(formData.get('question_text') || '').trim()
  const points = Number.parseInt(String(formData.get('points') || '1'), 10)
  const optionLabels = Array.from(formData.getAll('options')).map((value) => String(value).trim())
  const optionIds = Array.from(formData.getAll('option_ids')).map((value) => String(value).trim())

  if (!questionId || !raceId || !questionText) {
    throw new Error('Question, race, and text are required.')
  }

  if (!Number.isFinite(points) || points < 1 || points > 25) {
    throw new Error('Bonus points must be between 1 and 25.')
  }

  await assertQuestionEditWindow(supabase, raceId)

  const { data: existingQuestion } = await supabase
    .from('bonus_questions')
    .select('id')
    .eq('id', questionId)
    .eq('race_id', raceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!existingQuestion) {
    throw new Error('Group bonus question not found.')
  }

  const nonEmptyOptionCount = optionLabels.filter(Boolean).length
  if (nonEmptyOptionCount < 2) {
    throw new Error('Keep at least two options on a bonus question.')
  }

  const { error: questionError } = await supabase
    .from('bonus_questions')
    .update({ question_text: questionText, points })
    .eq('id', questionId)
    .eq('tenant_id', tenantId)

  if (questionError) {
    throw new Error(questionError.message || 'Failed to update group bonus question.')
  }

  for (let index = 0; index < optionLabels.length; index += 1) {
    const label = optionLabels[index]
    const optionId = optionIds[index]

    if (label && optionId) {
      const { error } = await supabase
        .from('bonus_options')
        .update({ label })
        .eq('id', optionId)

      if (error) throw new Error(error.message || 'Failed to update group bonus option.')
    } else if (label && !optionId) {
      const { error } = await supabase.from('bonus_options').insert({
        bonus_question_id: questionId,
        option_type: 'custom_text',
        label,
      })

      if (error) throw new Error(error.message || 'Failed to add group bonus option.')
    } else if (!label && optionId) {
      const { error } = await supabase
        .from('bonus_options')
        .delete()
        .eq('id', optionId)

      if (error) throw new Error(error.message || 'Failed to delete group bonus option.')
    }
  }

  revalidateTenantBonusPaths(raceId)
}

export async function deleteTenantBonusQuestion(formData: FormData) {
  const { supabase, tenantId } = await assertTenantBonusAccess()

  const questionId = String(formData.get('question_id') || '').trim()
  const raceId = String(formData.get('race_id') || '').trim()

  if (!questionId || !raceId) {
    throw new Error('Question and race are required.')
  }

  await assertQuestionEditWindow(supabase, raceId)

  const { error } = await supabase
    .from('bonus_questions')
    .delete()
    .eq('id', questionId)
    .eq('race_id', raceId)
    .eq('tenant_id', tenantId)

  if (error) {
    throw new Error(error.message || 'Failed to delete group bonus question.')
  }

  revalidateTenantBonusPaths(raceId)
}

export async function saveTenantBonusAnswers(formData: FormData) {
  const { supabase, tenantId } = await assertTenantBonusAccess()

  const raceId = String(formData.get('race_id') || '').trim()

  if (!raceId) {
    throw new Error('Race is required.')
  }

  const { data: questions, error: questionsError } = await supabase
    .from('bonus_questions')
    .select('id')
    .eq('race_id', raceId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (questionsError) {
    throw new Error(questionsError.message || 'Could not load group bonus questions.')
  }

  const bonusAnswers = (questions || []).map((question) => {
    const optionId = String(formData.get(`bonus_${question.id}`) || '').trim()

    if (!optionId) {
      throw new Error('Set every group bonus answer before saving.')
    }

    return {
      questionId: question.id,
      optionId,
    }
  })

  await saveTenantRaceBonusAnswers(supabase, {
    raceId,
    bonusAnswers,
  })

  revalidateTenantBonusPaths(raceId)
  revalidatePath('/admin')
  revalidatePath('/admin/results')
  revalidatePath(`/admin/races/${raceId}`)
}
