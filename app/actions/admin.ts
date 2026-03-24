'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createRace(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Verify Admin
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const season = parseInt(formData.get('season') as string)
  const round = parseInt(formData.get('round') as string)
  const raceName = formData.get('race_name') as string
  const circuitId = formData.get('circuit_id') as string
  const raceStartAt = new Date(formData.get('race_start_at') as string)
  
  // By default, lock predictions 5 minutes before the race starts
  const lockAt = new Date(raceStartAt.getTime() - 5 * 60000)

  const { error } = await supabase.from('races').insert({
    season,
    round,
    race_name: raceName,
    circuit_id: circuitId,
    race_start_at: raceStartAt.toISOString(),
    prediction_lock_at: lockAt.toISOString(),
    status: 'upcoming'
  })

  if (error) {
    console.error('Failed to create race', error)
    throw new Error('Failed to create race')
  }

  revalidatePath('/predictions')
}

export async function deleteRace(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const raceId = formData.get('race_id') as string
  if (!raceId) throw new Error('Missing race ID')

  const { error } = await supabase.from('races').delete().eq('id', raceId)
  if (error) throw new Error('Failed to delete race')

  await supabase.from('leaderboard_cache').delete().eq('season', 2024)

  revalidatePath('/admin')
  revalidatePath('/')
  revalidatePath('/predictions')
  revalidatePath('/leaderboard')
}

export async function updateRace(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const raceId = formData.get('race_id') as string
  const raceName = formData.get('race_name') as string
  const circuitId = formData.get('circuit_id') as string
  const raceStartAt = new Date(formData.get('race_start_at') as string)
  
  const lockAt = new Date(raceStartAt.getTime() - 5 * 60000)

  const { error } = await supabase.from('races').update({
    race_name: raceName,
    circuit_id: circuitId,
    race_start_at: raceStartAt.toISOString(),
    prediction_lock_at: lockAt.toISOString(),
  }).eq('id', raceId)

  if (error) throw new Error('Failed to update race')

  revalidatePath('/admin')
  revalidatePath(`/admin/races/${raceId}`)
  revalidatePath('/')
  revalidatePath('/predictions')
}

export async function deleteBonusQuestion(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const questionId = formData.get('question_id') as string
  const raceId = formData.get('race_id') as string
  
  if (!questionId) throw new Error('Missing question ID')

  const { error } = await supabase.from('bonus_questions').delete().eq('id', questionId)
  if (error) throw new Error('Failed to delete question')

  revalidatePath(`/admin/races/${raceId}`)
}

export async function updateBonusQuestion(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

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
