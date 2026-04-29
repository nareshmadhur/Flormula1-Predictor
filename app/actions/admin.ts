'use server'

import { revalidatePath } from 'next/cache'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { rebuildLeaderboardForSeason } from '@/utils/leaderboard'
import { assertPlatformAdmin } from '@/utils/admin-access'
import { parseAmsterdamInputToIso } from '@/utils/amsterdam-time'
import {
  buildOpenF1ScheduleReview,
  fetchOpenF1SeasonSchedule,
  type ExistingRaceForImport,
  type OpenF1CircuitLookup,
} from '@/utils/openf1'
import type { ScheduleImportActionState } from '@/app/admin/schedule/action-state'
import type { ManualResultsActionState } from '@/app/admin/results-action-state'

type NewRacePayload = {
  season: number
  round: number
  race_name: string
  circuit_id: string
  race_start_at: string
  prediction_lock_at: string
  status: 'upcoming'
  fp1_at?: string
  fp2_at?: string
  fp3_at?: string
  quali_at?: string
  sprint_at?: string
  sprint_quali_at?: string
}

function stripSourceMetadata<T extends Record<string, unknown>>(payload: T) {
  const clone = { ...payload }
  delete clone.schedule_source
  delete clone.schedule_source_url
  delete clone.schedule_synced_at
  return clone
}

async function updateRaceWithSourceFallback(
  supabase: Awaited<ReturnType<typeof assertPlatformAdmin>>['supabase'],
  raceId: string,
  payload: Record<string, unknown>
) {
  const attempt = await supabase.from('races').update(payload).eq('id', raceId)
  if (!attempt.error) return attempt

  if (attempt.error.code === 'PGRST204' && attempt.error.message?.includes('schedule_source')) {
    return supabase.from('races').update(stripSourceMetadata(payload)).eq('id', raceId)
  }

  return attempt
}

function getPredictionLockAt(fp1AtIso: string | null, raceStartAtIso: string) {
  const lockSource = fp1AtIso ? new Date(fp1AtIso) : new Date(raceStartAtIso)
  return new Date(lockSource.getTime() - 5 * 60000)
}

export async function createRace(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()

  const season = parseInt(formData.get('season') as string)
  const round = parseInt(formData.get('round') as string)
  const raceName = formData.get('race_name') as string
  const circuitId = formData.get('circuit_id') as string
  const raceStartAt = parseAmsterdamInputToIso(formData.get('race_start_at') as string)
  const fp1At = parseAmsterdamInputToIso(formData.get('fp1_at') as string | null)
  const fp2At = parseAmsterdamInputToIso(formData.get('fp2_at') as string | null)
  const fp3At = parseAmsterdamInputToIso(formData.get('fp3_at') as string | null)
  const qualiAt = parseAmsterdamInputToIso(formData.get('quali_at') as string | null)
  const sprintAt = parseAmsterdamInputToIso(formData.get('sprint_at') as string | null)
  const sprintQualiAt = parseAmsterdamInputToIso(formData.get('sprint_quali_at') as string | null)

  if (!raceStartAt) throw new Error('Race start is required')

  // By default, lock predictions 5 minutes before FP1.
  // Legacy races without FP1 fall back to race start until FP1 is supplied.
  const lockAt = getPredictionLockAt(fp1At, raceStartAt)

  const newRace: NewRacePayload = {
    season,
    round,
    race_name: raceName,
    circuit_id: circuitId,
    race_start_at: raceStartAt,
    prediction_lock_at: lockAt.toISOString(),
    status: 'upcoming'
  }

  if (fp1At) newRace.fp1_at = fp1At
  if (fp2At) newRace.fp2_at = fp2At
  if (fp3At) newRace.fp3_at = fp3At
  if (qualiAt) newRace.quali_at = qualiAt
  if (sprintAt) newRace.sprint_at = sprintAt
  if (sprintQualiAt) newRace.sprint_quali_at = sprintQualiAt

  let { error } = await supabase.from('races').insert(newRace)

  // If optional columns don't exist yet, retry without them
  if (error && error.code === 'PGRST204' && error.message?.includes('fp1_at')) {
    console.warn('Optional session columns not yet in schema, retrying without them', error)
    const baseRace = {
      season,
      round,
      race_name: raceName,
      circuit_id: circuitId,
      race_start_at: raceStartAt,
      prediction_lock_at: lockAt.toISOString(),
      status: 'upcoming'
    }
    const retryResult = await supabase.from('races').insert(baseRace)
    if (retryResult.error) {
      console.error('Failed to create race', retryResult.error)
      throw new Error('Failed to create race')
    }
    error = null
  }

  if (error) {
    console.error('Failed to create race', error)
    throw new Error('Failed to create race')
  }

  revalidatePath('/predictions')
}

export async function deleteRace(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()

  const raceId = formData.get('race_id') as string
  if (!raceId) throw new Error('Missing race ID')

  const { data: race } = await supabase
    .from('races')
    .select('season')
    .eq('id', raceId)
    .single()

  if (!race) throw new Error('Race not found')

  const { error } = await supabase.from('races').delete().eq('id', raceId)
  if (error) throw new Error('Failed to delete race')

  await rebuildLeaderboardForSeason(supabase, race.season)

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/predictions')
  revalidatePath('/leaderboard')
}

export async function updateRace(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()

  const raceId = formData.get('race_id') as string
  const raceName = formData.get('race_name') as string
  const circuitId = formData.get('circuit_id') as string
  const raceStartAt = parseAmsterdamInputToIso(formData.get('race_start_at') as string)
  const fp1At = parseAmsterdamInputToIso(formData.get('fp1_at') as string | null)
  const fp2At = parseAmsterdamInputToIso(formData.get('fp2_at') as string | null)
  const fp3At = parseAmsterdamInputToIso(formData.get('fp3_at') as string | null)
  const qualiAt = parseAmsterdamInputToIso(formData.get('quali_at') as string | null)
  const sprintAt = parseAmsterdamInputToIso(formData.get('sprint_at') as string | null)
  const sprintQualiAt = parseAmsterdamInputToIso(formData.get('sprint_quali_at') as string | null)

  if (!raceStartAt) throw new Error('Race start is required')

  const lockAt = getPredictionLockAt(fp1At, raceStartAt)

  const payload = {
    race_name: raceName,
    circuit_id: circuitId,
    race_start_at: raceStartAt,
    fp1_at: fp1At || null,
    fp2_at: fp2At || null,
    fp3_at: fp3At || null,
    quali_at: qualiAt || null,
    sprint_at: sprintAt || null,
    sprint_quali_at: sprintQualiAt || null,
    prediction_lock_at: lockAt.toISOString(),
    schedule_source: 'manual',
    schedule_source_url: null,
    schedule_synced_at: null,
  }

  const { error } = await updateRaceWithSourceFallback(supabase, raceId, payload)

  if (error) throw new Error('Failed to update race')

  revalidatePath('/admin')
  revalidatePath(`/admin/races/${raceId}`)
  revalidatePath('/')
  revalidatePath('/season')
  revalidatePath('/predictions')
  revalidatePath(`/race/${raceId}`)
  revalidatePath(`/race/${raceId}/predict`)
}

export async function saveBatchOfficialResults(
  _previousState: ManualResultsActionState,
  formData: FormData
): Promise<ManualResultsActionState> {
  const selectedRaceIds = Array.from(
    new Set(
      formData
        .getAll('selected_race_ids')
        .map((value) => String(value).trim())
        .filter(Boolean)
    )
  )

  if (selectedRaceIds.length === 0) {
    return {
      status: 'error',
      message: 'Pick at least one race before saving.',
    }
  }

  try {
    const { supabase, access } = await assertPlatformAdmin()
    const [{ data: races }, { data: bonusQuestions }] = await Promise.all([
      supabase.from('races').select('id, race_name, season').in('id', selectedRaceIds),
      supabase.from('bonus_questions').select('id, race_id').in('race_id', selectedRaceIds),
    ])

    const raceById = new Map((races || []).map((race) => [race.id, race]))
    const bonusQuestionIdsByRace = new Map<string, string[]>()

    for (const question of bonusQuestions || []) {
      const current = bonusQuestionIdsByRace.get(question.race_id) || []
      current.push(question.id)
      bonusQuestionIdsByRace.set(question.race_id, current)
    }

    let savedCount = 0
    const skippedRaceLabels: string[] = []

    for (const raceId of selectedRaceIds) {
      const race = raceById.get(raceId)
      const raceLabel = race?.race_name || 'this race'

      const p1 = String(formData.get(`race:${raceId}:p1_driver_id`) || '').trim()
      const p2 = String(formData.get(`race:${raceId}:p2_driver_id`) || '').trim()
      const p3 = String(formData.get(`race:${raceId}:p3_driver_id`) || '').trim()

      if (!p1 || !p2 || !p3 || p1 === p2 || p1 === p3 || p2 === p3) {
        skippedRaceLabels.push(raceLabel)
        continue
      }

      const raceQuestionIds = bonusQuestionIdsByRace.get(raceId) || []
      const bonusInserts: Array<{
        race_id: string
        bonus_question_id: string
        correct_bonus_option_id: string
      }> = []

      let missingBonusAnswer = false
      for (const questionId of raceQuestionIds) {
        const optionId = String(formData.get(`race:${raceId}:bonus:${questionId}`) || '').trim()

        if (!optionId) {
          missingBonusAnswer = true
          break
        }

        bonusInserts.push({
          race_id: raceId,
          bonus_question_id: questionId,
          correct_bonus_option_id: optionId,
        })
      }

      if (missingBonusAnswer) {
        skippedRaceLabels.push(raceLabel)
        continue
      }

      const { error: resultsError } = await supabase.from('race_results').upsert(
        {
          race_id: raceId,
          p1_driver_id: p1,
          p2_driver_id: p2,
          p3_driver_id: p3,
          entered_by: access.userId,
        },
        { onConflict: 'race_id' }
      )

      if (resultsError) {
        return {
          status: 'error',
          message: `Could not save results for ${raceLabel}.`,
        }
      }

      const { error: deleteBonusError } = await supabase
        .from('race_bonus_answers')
        .delete()
        .eq('race_id', raceId)

      if (deleteBonusError) {
        return {
          status: 'error',
          message: `Could not clear bonus answers for ${raceLabel}.`,
        }
      }

      if (bonusInserts.length > 0) {
        const { error: bonusError } = await supabase.from('race_bonus_answers').insert(bonusInserts)

        if (bonusError) {
          return {
            status: 'error',
            message: `Could not save bonus answers for ${raceLabel}.`,
          }
        }
      }

      const { error: statusError } = await supabase
        .from('races')
        .update({ status: 'completed' })
        .eq('id', raceId)

      if (statusError) {
        return {
          status: 'error',
          message: `Could not update the status for ${raceLabel}.`,
        }
      }

      savedCount += 1
    }

    if (savedCount === 0) {
      return {
        status: 'error',
        message: 'Nothing was saved. Finish all podium fields and any bonus answers for the races you selected.',
      }
    }

    revalidatePath('/admin')
    revalidatePath('/season')
    revalidatePath('/leaderboard')
    revalidatePath('/predictions')

    for (const raceId of selectedRaceIds) {
      revalidatePath(`/admin/races/${raceId}`)
      revalidatePath(`/race/${raceId}`)
      revalidatePath(`/race/${raceId}/predict`)
    }

    return {
      status: 'success',
      message:
        skippedRaceLabels.length > 0
          ? `Saved ${savedCount} race result${savedCount === 1 ? '' : 's'}. Skipped ${skippedRaceLabels.length} incomplete card${skippedRaceLabels.length === 1 ? '' : 's'}.`
          : `Saved ${savedCount} race result${savedCount === 1 ? '' : 's'}.`,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not save the selected race results.',
    }
  }
}

export async function syncRaceFromOpenF1(
  _previousState: ScheduleImportActionState,
  formData: FormData
): Promise<ScheduleImportActionState> {
  const raceId = String(formData.get('race_id') || '').trim()

  if (!raceId) {
    return {
      status: 'error',
      message: 'Missing race ID.',
    }
  }

  try {
    const { supabase } = await assertPlatformAdmin()
    const [{ data: race }, { data: circuits }] = await Promise.all([
      supabase
        .from('races')
        .select(
          'id, season, round, race_name, circuit_id, status, race_start_at, prediction_lock_at, fp1_at, fp2_at, fp3_at, quali_at, sprint_at, sprint_quali_at, external_race_key'
        )
        .eq('id', raceId)
        .single(),
      supabase.from('circuits').select('id, name, city, country, emoji').order('name'),
    ])

    if (!race) {
      return {
        status: 'error',
        message: 'Race not found.',
      }
    }

    if (!race.external_race_key) {
      return {
        status: 'error',
        message: 'This race does not have an OpenF1 source key yet. Use season sync first.',
      }
    }

    const importedRaces = await fetchOpenF1SeasonSchedule(race.season)
    const importedRace = importedRaces.find(
      (entry) => String(entry.meetingKey) === String(race.external_race_key)
    )

    if (!importedRace) {
      return {
        status: 'error',
        message: 'OpenF1 did not return a matching weekend for this race.',
      }
    }

    const reviewRow = buildOpenF1ScheduleReview(
      [importedRace],
      [race as ExistingRaceForImport],
      (circuits || []) as OpenF1CircuitLookup[]
    )[0]

    const payload = {
      race_name: importedRace.raceName,
      circuit_id: reviewRow.circuitMatch?.id || race.circuit_id,
      race_start_at: importedRace.raceStartAt,
      prediction_lock_at: importedRace.predictionLockAt,
      fp1_at: importedRace.fp1At,
      fp2_at: importedRace.fp2At,
      fp3_at: importedRace.fp3At,
      quali_at: importedRace.qualiAt,
      sprint_at: importedRace.sprintAt,
      sprint_quali_at: importedRace.sprintQualiAt,
      external_race_key: String(importedRace.meetingKey),
      schedule_source: 'openf1',
      schedule_source_url: importedRace.sourceUrl,
      schedule_synced_at: new Date().toISOString(),
    }

    const { error } = await updateRaceWithSourceFallback(supabase, raceId, payload)
    if (error) {
      return {
        status: 'error',
        message: `Could not sync ${race.race_name} from OpenF1.`,
      }
    }

    revalidatePath('/admin')
    revalidatePath('/admin/schedule')
    revalidatePath(`/admin/races/${raceId}`)
    revalidatePath('/season')
    revalidatePath(`/race/${raceId}`)
    revalidatePath(`/race/${raceId}/predict`)

    return {
      status: 'success',
      message:
        reviewRow.fieldChanges.length > 0
          ? `Applied ${reviewRow.fieldChanges.length} OpenF1 change${reviewRow.fieldChanges.length === 1 ? '' : 's'} to ${race.race_name}.`
          : `${race.race_name} was already aligned with OpenF1.`,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not sync this race from OpenF1.',
    }
  }
}

export async function deleteBonusQuestion(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()

  const questionId = formData.get('question_id') as string
  const raceId = formData.get('race_id') as string
  
  if (!questionId) throw new Error('Missing question ID')

  const { error } = await supabase.from('bonus_questions').delete().eq('id', questionId)
  if (error) throw new Error('Failed to delete question')

  revalidatePath(`/admin/races/${raceId}`)
}

export async function updateBonusQuestion(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()

  const questionId = formData.get('question_id') as string
  const raceId = formData.get('race_id') as string
  const questionText = formData.get('question_text') as string
  const points = parseInt(formData.get('points') as string)
  
  const optionLabels = Array.from(formData.getAll('options')) as string[]
  const optionIds = Array.from(formData.getAll('option_ids')) as string[]

  if (!questionId) throw new Error('Missing question ID')

  const { error } = await supabase.from('bonus_questions').update({
    question_text: questionText,
    points
  }).eq('id', questionId)

  if (error) throw new Error('Failed to update question')

  for (let i = 0; i < optionLabels.length; i++) {
     const label = optionLabels[i]
     const optId = optionIds[i]
     if (label.trim()) {
         if (optId) {
             await supabase.from('bonus_options').update({ label }).eq('id', optId)
         } else {
             await supabase.from('bonus_options').insert({ bonus_question_id: questionId, label, option_type: 'custom_text' })
         }
     } else if (optId) {
         await supabase.from('bonus_options').delete().eq('id', optId)
     }
  }

  revalidatePath(`/admin/races/${raceId}`)
}

/**
 * Updates race statuses based on time logic
 * This should be called periodically to ensure race statuses are accurate
 */
export async function updateRaceStatuses() {
  const { supabase } = await assertPlatformAdmin()

  // Get all races
  const { data: races, error } = await supabase
    .from('races')
    .select('*')

  if (error) {
    console.error('Error fetching races for status update:', error)
    return { error: 'Failed to fetch races' }
  }

  if (!races) {
    return { success: true, message: 'No races found' }
  }

  const updates = []

  for (const race of races) {
    const effectiveStatus = getEffectiveRaceStatus(race)

    // Only update if the effective status differs from stored status
    // and we're not overriding a manually set 'scored' status
    if (effectiveStatus !== race.status && race.status !== 'scored') {
      updates.push({
        id: race.id,
        status: effectiveStatus
      })
    }
  }

  if (updates.length === 0) {
    return { success: true, message: 'All race statuses are up to date' }
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('races')
      .update({ status: update.status })
      .eq('id', update.id)

    if (updateError) {
      console.error('Error updating race status:', update, updateError)
      return { error: 'Failed to update race statuses' }
    }
  }

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/predictions')
  revalidatePath('/leaderboard')

  return {
    success: true,
    message: `Updated ${updates.length} race statuses`,
    updates
  }
}

/**
 * Cancels a race (sets status to cancelled)
 */
export async function cancelRace(raceId: string) {
  const { supabase } = await assertPlatformAdmin()

  const { error } = await supabase
    .from('races')
    .update({ status: 'cancelled' })
    .eq('id', raceId)

  if (error) {
    console.error('Failed to cancel race', error)
    throw new Error('Failed to cancel race')
  }

  revalidatePath('/admin')
  revalidatePath('/predictions')
  revalidatePath('/')
}
