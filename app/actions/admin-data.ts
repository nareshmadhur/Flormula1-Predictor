'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')
  return supabase
}

export async function addDriver(formData: FormData) {
  const supabase = await assertAdmin()
  const code = formData.get('code') as string
  const fullName = formData.get('full_name') as string
  const emoji = formData.get('emoji') as string
  const constructorId = formData.get('constructor_id') as string

  if (!code || !fullName || !constructorId) throw new Error('Missing required fields')

  const { error } = await supabase.from('drivers').insert({
    code, full_name: fullName, emoji: emoji || '', constructor_id: constructorId, active: true
  })

  if (error) throw new Error('Failed to add driver: ' + error.message)
  revalidatePath('/admin/data')
}

export async function toggleDriverActive(driverId: string, currentActive: boolean) {
  const supabase = await assertAdmin()
  const { error } = await supabase.from('drivers').update({ active: !currentActive }).eq('id', driverId)
  if (error) throw new Error('Failed to update driver')
  revalidatePath('/admin/data')
}

export async function deleteDriver(driverId: string) {
  const supabase = await assertAdmin()
  const { error } = await supabase.from('drivers').delete().eq('id', driverId)
  if (error) throw new Error('Failed to delete driver. Ensure no predictions depend on this driver first.')
  revalidatePath('/admin/data')
}
