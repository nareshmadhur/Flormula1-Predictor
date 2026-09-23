'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { recalculateRaceScoresIfResultExists } from '@/utils/race-scoring'
import { saveTenantRaceBonusAnswers, type BonusAnswer } from '@/utils/result-pipeline'
import { normalizeNumericBonusValue, type BonusAnswerType } from '@/utils/bonus-answers'
import {
  buildBonusOptionInsertRows,
  getCleanBonusOptionLabels,
  getSelectedConstructorOptionIds,
  getSelectedDriverOptionIds,
} from '@/utils/bonus-option-inputs'

type TenantBonusAccess = {
  supabase: Awaited<ReturnType<typeof createClient>>
  tenantId: string
  isPlatformOverride: boolean
}

type RaceEditWindowRow = {
  id: string
  status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
  race_start_at: string
  prediction_lock_at: string
}

const DRAFT_QUESTION_ID = '00000000-0000-0000-0000-000000000000'

type ExistingBonusOption = {
  id: string
  option_type?: 'custom_text' | 'driver' | 'constructor' | null
  driver_id?: string | null
  constructor_id?: string | null
  label?: string | null
}

type ExistingBonusQuestion = {
  id: string
  question_text: string
  points: number
  answer_type?: BonusAnswerType | null
  bonus_options?: ExistingBonusOption[] | null
}

function revalidateTenantBonusPaths(raceId: string) {
  revalidatePath('/admin/tenant')
  revalidatePath('/leaderboard')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
  revalidatePath(`/race/${raceId}`)
  revalidatePath(`/race/${raceId}/predict`)
  revalidatePath(`/admin/tenant/races/${raceId}`)
  revalidatePath(`/admin/races/${raceId}`)
}

async function assertTenantBonusAccess(formData: FormData): Promise<TenantBonusAccess> {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)
  const requestedTenantId = String(formData.get('tenant_id') || '').trim()

  if (!access || !access.isAdmin) {
    throw new Error('Group admin access is required.')
  }

  if (access.isPlatformAdmin) {
    const tenantId = requestedTenantId || access.tenantId

    if (!tenantId) {
      throw new Error('Choose a group before managing bonus questions.')
    }

    return { supabase, tenantId, isPlatformOverride: true }
  }

  if (!access.tenantId) {
    throw new Error('Group admin access is required.')
  }

  if (requestedTenantId && requestedTenantId !== access.tenantId) {
    throw new Error('You can only manage bonus questions for your group.')
  }

  return { supabase, tenantId: access.tenantId, isPlatformOverride: false }
}

async function assertQuestionEditWindow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raceId: string,
  allowAfterLock: boolean
) {
  if (allowAfterLock) return

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

async function recalculateAndRevalidateRaceIfReady(
  supabase: Awaited<ReturnType<typeof createClient>>,
  raceId: string
) {
  await recalculateRaceScoresIfResultExists(supabase, raceId)
  revalidateTenantBonusPaths(raceId)
  revalidatePath('/admin')
  revalidatePath('/admin/results')
  revalidatePath('/season')
}

export async function addTenantBonusQuestion(formData: FormData) {
  const { supabase, tenantId, isPlatformOverride } = await assertTenantBonusAccess(formData)

  const raceId = String(formData.get('race_id') || '').trim()
  const questionText = String(formData.get('question_text') || '').trim()
  const points = Number.parseInt(String(formData.get('points') || '1'), 10)
  const answerType = String(formData.get('answer_type') || 'choice') as BonusAnswerType
  const optionCount =
    getCleanBonusOptionLabels(formData).length +
    getSelectedDriverOptionIds(formData).length +
    getSelectedConstructorOptionIds(formData).length

  if (!raceId || !questionText) {
    throw new Error('Race and question text are required.')
  }

  if (!Number.isFinite(points) || points < 1 || points > 25) {
    throw new Error('Bonus points must be between 1 and 25.')
  }

  if (answerType !== 'choice' && answerType !== 'numeric') {
    throw new Error('Choose whether the bonus question uses options or a number.')
  }

  if (answerType === 'choice' && optionCount < 2) {
    throw new Error('Add at least two options for a bonus question.')
  }

  if (answerType === 'numeric' && optionCount > 0) {
    throw new Error('Numeric bonus questions cannot include answer options.')
  }

  await assertQuestionEditWindow(supabase, raceId, isPlatformOverride)
  const optionDrafts = await buildBonusOptionInsertRows(supabase, DRAFT_QUESTION_ID, formData)

  const { data: question, error: questionError } = await supabase
    .from('bonus_questions')
    .insert({
      race_id: raceId,
      tenant_id: tenantId,
      question_text: questionText,
      points,
      answer_type: answerType,
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

  await recalculateAndRevalidateRaceIfReady(supabase, raceId)
}

export async function updateTenantBonusQuestion(formData: FormData) {
  const { supabase, tenantId, isPlatformOverride } = await assertTenantBonusAccess(formData)

  const questionId = String(formData.get('question_id') || '').trim()
  const raceId = String(formData.get('race_id') || '').trim()
  const questionText = String(formData.get('question_text') || '').trim()
  const points = Number.parseInt(String(formData.get('points') || '1'), 10)
  const optionLabels = Array.from(formData.getAll('options')).map((value) => String(value).trim())
  const optionIds = Array.from(formData.getAll('option_ids')).map((value) => String(value).trim())
  const selectedDriverIds = getSelectedDriverOptionIds(formData)
  const selectedConstructorIds = getSelectedConstructorOptionIds(formData)

  if (!questionId || !raceId || !questionText) {
    throw new Error('Question, race, and text are required.')
  }

  if (!Number.isFinite(points) || points < 1 || points > 25) {
    throw new Error('Bonus points must be between 1 and 25.')
  }

  if (optionLabels.length !== optionIds.length) {
    throw new Error('Bonus option inputs are out of sync. Reload the page and try again.')
  }

  await assertQuestionEditWindow(supabase, raceId, isPlatformOverride)

  const { data: existingQuestionResult, error: questionLookupError } = await supabase
    .from('bonus_questions')
    .select('id, question_text, points, answer_type, bonus_options(id, option_type, driver_id, constructor_id, label)')
    .eq('id', questionId)
    .eq('race_id', raceId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (questionLookupError) {
    throw new Error(questionLookupError.message || 'Could not load the group bonus question.')
  }

  if (!existingQuestionResult) {
    throw new Error('Group bonus question not found.')
  }

  const existingQuestion = existingQuestionResult as unknown as ExistingBonusQuestion
  const answerType = (existingQuestion.answer_type || 'choice') as BonusAnswerType
  const optionCount = optionLabels.filter(Boolean).length + selectedDriverIds.length + selectedConstructorIds.length

  if (answerType === 'choice' && optionCount < 2) {
    throw new Error('Keep at least two options on a bonus question.')
  }

  const hasQuestionMetadataChange =
    existingQuestion.question_text !== questionText || existingQuestion.points !== points

  if (hasQuestionMetadataChange) {
    const [predictionAnswerRefs, raceAnswerRefs, scoreRefs] = await Promise.all([
      supabase
        .from('prediction_bonus_answers')
        .select('id')
        .eq('bonus_question_id', questionId)
        .limit(1),
      supabase
        .from('race_bonus_answers')
        .select('id')
        .eq('bonus_question_id', questionId)
        .limit(1),
      supabase
        .from('user_race_scores')
        .select('user_id')
        .eq('race_id', raceId)
        .limit(1),
    ])

    const metadataLookupError = predictionAnswerRefs.error || raceAnswerRefs.error || scoreRefs.error

    if (metadataLookupError) {
      throw new Error(metadataLookupError.message || 'Could not verify whether this question can be changed.')
    }

    if (
      (predictionAnswerRefs.data || []).length > 0 ||
      (raceAnswerRefs.data || []).length > 0 ||
      (scoreRefs.data || []).length > 0
    ) {
      return {
        ok: false as const,
        error: 'This question already has saved answers or scores, so its title and points are locked.',
      }
    }
  }

  if (existingQuestion.question_text !== questionText || existingQuestion.points !== points) {
    const { error: questionError } = await supabase
      .from('bonus_questions')
      .update({ question_text: questionText, points })
      .eq('id', questionId)
      .eq('tenant_id', tenantId)

    if (questionError) {
      throw new Error(questionError.message || 'Failed to update group bonus question.')
    }
  }

  if (answerType === 'numeric') {
    await recalculateAndRevalidateRaceIfReady(supabase, raceId)
    return
  }

  const existingOptions = existingQuestion.bonus_options || []
  const existingOptionById = new Map(existingOptions.map((option) => [option.id, option]))
  const submittedCustomOptions = new Map<string, string>()
  const newCustomLabels: string[] = []

  for (let index = 0; index < optionLabels.length; index += 1) {
    const label = optionLabels[index]
    const optionId = optionIds[index]

    if (!optionId) {
      if (label) newCustomLabels.push(label)
      continue
    }

    const existingOption = existingOptionById.get(optionId)
    if (!existingOption) {
      throw new Error('One or more bonus options do not belong to this question.')
    }

    if (existingOption.option_type && existingOption.option_type !== 'custom_text') {
      throw new Error('Reference options must be changed through their selector.')
    }

    submittedCustomOptions.set(optionId, label)
  }

  const referenceOptionRows = (await buildBonusOptionInsertRows(supabase, questionId, formData)).filter(
    (option) => option.option_type !== 'custom_text'
  )
  const selectedReferenceKeys = new Set(
    referenceOptionRows.map((option) =>
      option.option_type === 'driver' ? `driver:${option.driver_id}` : `constructor:${option.constructor_id}`
    )
  )
  const optionIdsToDelete: string[] = []
  const customOptionsToUpdate: Array<{
    id: string
    bonus_question_id: string
    option_type: 'custom_text'
    label: string
  }> = []

  for (const option of existingOptions) {
    if (!option.option_type || option.option_type === 'custom_text') {
      if (!submittedCustomOptions.has(option.id)) continue

      const label = submittedCustomOptions.get(option.id) || ''
      if (!label) {
        optionIdsToDelete.push(option.id)
      } else if (label !== (option.label || '')) {
        customOptionsToUpdate.push({
          id: option.id,
          bonus_question_id: questionId,
          option_type: 'custom_text',
          label,
        })
      }

      continue
    }

    const referenceKey =
      option.option_type === 'driver'
        ? `driver:${option.driver_id}`
        : `constructor:${option.constructor_id}`

    if (!selectedReferenceKeys.has(referenceKey)) {
      optionIdsToDelete.push(option.id)
    }
  }

  const newReferenceOptionRows = referenceOptionRows.filter((option) => {
    const alreadyExists = existingOptions.some((existingOption) => {
      if (existingOption.option_type !== option.option_type) return false
      return option.option_type === 'driver'
        ? existingOption.driver_id === option.driver_id
        : existingOption.constructor_id === option.constructor_id
    })

    return !alreadyExists
  })

  if (newReferenceOptionRows.length > 0) {
    const { error } = await supabase.from('bonus_options').insert(newReferenceOptionRows)
    if (error) throw new Error(error.message || 'Failed to add group bonus option.')
  }

  if (customOptionsToUpdate.length > 0) {
    const { error } = await supabase
      .from('bonus_options')
      .upsert(customOptionsToUpdate, { onConflict: 'id' })

    if (error) throw new Error(error.message || 'Failed to update group bonus option.')
  }

  if (optionIdsToDelete.length > 0) {
    const [predictionAnswerRefs, raceAnswerRefs, scoreRefs] = await Promise.all([
      supabase
        .from('prediction_bonus_answers')
        .select('bonus_option_id')
        .in('bonus_option_id', optionIdsToDelete),
      supabase
        .from('race_bonus_answers')
        .select('correct_bonus_option_id')
        .in('correct_bonus_option_id', optionIdsToDelete),
      supabase
        .from('user_race_scores')
        .select('user_id')
        .eq('race_id', raceId)
        .limit(1),
    ])

    const referenceLookupError =
      predictionAnswerRefs.error || raceAnswerRefs.error || scoreRefs.error

    if (referenceLookupError) {
      throw new Error(referenceLookupError.message || 'Could not verify whether bonus options can be removed.')
    }

    if ((scoreRefs.data || []).length > 0) {
      return {
        ok: false as const,
        error: 'This race already has published scores, so its bonus options cannot be removed.',
      }
    }

    const protectedOptionIds = new Set([
      ...((predictionAnswerRefs.data || []) as Array<{ bonus_option_id?: string | null }>)
        .map((answer) => answer.bonus_option_id)
        .filter((optionId): optionId is string => Boolean(optionId)),
      ...((raceAnswerRefs.data || []) as Array<{ correct_bonus_option_id?: string | null }>)
        .map((answer) => answer.correct_bonus_option_id)
        .filter((optionId): optionId is string => Boolean(optionId)),
    ])

    if (protectedOptionIds.size > 0) {
      const protectedLabels = existingOptions
        .filter((option) => protectedOptionIds.has(option.id))
        .map((option) => option.label || 'an existing option')

      return {
        ok: false as const,
        error:
          `Cannot remove ${protectedLabels.length === 1 ? protectedLabels[0] : `${protectedLabels.length} selected options`} because existing answers still use them. Keep those options, or clear the related answers before changing this question.`,
      }
    }

    const { error } = await supabase
      .from('bonus_options')
      .delete()
      .in('id', optionIdsToDelete)
      .eq('bonus_question_id', questionId)

    if (error) throw new Error(error.message || 'Failed to delete group bonus option.')
  }

  if (newCustomLabels.length > 0) {
    const { error } = await supabase.from('bonus_options').insert(
      newCustomLabels.map((label) => ({
        bonus_question_id: questionId,
        option_type: 'custom_text' as const,
        label,
      }))
    )

    if (error) throw new Error(error.message || 'Failed to add group bonus option.')
  }

  await recalculateAndRevalidateRaceIfReady(supabase, raceId)
  return { ok: true as const }
}

export async function deleteTenantBonusQuestion(formData: FormData) {
  const { supabase, tenantId, isPlatformOverride } = await assertTenantBonusAccess(formData)

  const questionId = String(formData.get('question_id') || '').trim()
  const raceId = String(formData.get('race_id') || '').trim()

  if (!questionId || !raceId) {
    throw new Error('Question and race are required.')
  }

  await assertQuestionEditWindow(supabase, raceId, isPlatformOverride)

  const { data: deletedQuestion, error } = await supabase
    .from('bonus_questions')
    .delete()
    .eq('id', questionId)
    .eq('race_id', raceId)
    .eq('tenant_id', tenantId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to delete group bonus question.')
  }

  if (!deletedQuestion) {
    throw new Error('Group bonus question was not found or could not be deleted.')
  }

  await recalculateAndRevalidateRaceIfReady(supabase, raceId)
}

export async function saveTenantBonusAnswers(formData: FormData) {
  const { supabase, tenantId } = await assertTenantBonusAccess(formData)

  const raceId = String(formData.get('race_id') || '').trim()

  if (!raceId) {
    throw new Error('Race is required.')
  }

  const { data: questions, error: questionsError } = await supabase
    .from('bonus_questions')
    .select('id, answer_type')
    .eq('race_id', raceId)
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (questionsError) {
    throw new Error(questionsError.message || 'Could not load group bonus questions.')
  }

  const bonusAnswers: BonusAnswer[] = (questions || []).map((question) => {
    const rawValue = String(formData.get(`bonus_${question.id}`) || '').trim()

    if ((question.answer_type || 'choice') === 'numeric') {
      const numericValue = normalizeNumericBonusValue(rawValue)
      if (!numericValue) {
        throw new Error('Enter a valid number for every numeric bonus question before saving.')
      }

      return {
        questionId: question.id,
        numericValue,
      }
    }

    if (!rawValue) {
      throw new Error('Set every group bonus answer before saving.')
    }

    return {
      questionId: question.id,
      optionId: rawValue,
    }
  })

  await saveTenantRaceBonusAnswers(supabase, {
    raceId,
    bonusAnswers,
  })

  revalidateTenantBonusPaths(raceId)
  revalidatePath('/admin')
  revalidatePath('/admin/results')
  revalidatePath('/season')
}
