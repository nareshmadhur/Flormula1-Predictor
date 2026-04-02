'use server'

import { revalidatePath } from 'next/cache'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { rebuildLeaderboardForSeason } from '@/utils/leaderboard'
import { assertPlatformAdmin } from '@/utils/admin-access'

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

function getPredictionLockAt(fp1At: string | null, raceStartAt: Date) {
  const lockSource = fp1At ? new Date(fp1At) : raceStartAt
  return new Date(lockSource.getTime() - 5 * 60000)
}

export async function createRace(formData: FormData) {
  const { supabase } = await assertPlatformAdmin()

  const season = parseInt(formData.get('season') as string)
  const round = parseInt(formData.get('round') as string)
  const raceName = formData.get('race_name') as string
  const circuitId = formData.get('circuit_id') as string
  const raceStartAt = new Date(formData.get('race_start_at') as string)
  const fp1At = formData.get('fp1_at') as string | null
  const fp2At = formData.get('fp2_at') as string | null
  const fp3At = formData.get('fp3_at') as string | null
  const qualiAt = formData.get('quali_at') as string | null
  const sprintAt = formData.get('sprint_at') as string | null
  const sprintQualiAt = formData.get('sprint_quali_at') as string | null

  // By default, lock predictions 5 minutes before FP1.
  // Legacy races without FP1 fall back to race start until FP1 is supplied.
  const lockAt = getPredictionLockAt(fp1At, raceStartAt)

  const newRace: NewRacePayload = {
    season,
    round,
    race_name: raceName,
    circuit_id: circuitId,
    race_start_at: raceStartAt.toISOString(),
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
      race_start_at: raceStartAt.toISOString(),
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
  const raceStartAt = new Date(formData.get('race_start_at') as string)
  const fp1At = formData.get('fp1_at') as string | null

  const lockAt = getPredictionLockAt(fp1At, raceStartAt)

  const { error } = await supabase.from('races').update({
    race_name: raceName,
    circuit_id: circuitId,
    race_start_at: raceStartAt.toISOString(),
    fp1_at: fp1At || null,
    prediction_lock_at: lockAt.toISOString(),
  }).eq('id', raceId)

  if (error) throw new Error('Failed to update race')

  revalidatePath('/admin')
  revalidatePath(`/admin/races/${raceId}`)
  revalidatePath('/')
  revalidatePath('/predictions')
  revalidatePath(`/race/${raceId}`)
  revalidatePath(`/race/${raceId}/predict`)
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
