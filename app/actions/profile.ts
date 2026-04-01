'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import type { ProfileActionState } from '@/app/me/profile/action-state'

export async function updateOwnProfile(
  _prevState: ProfileActionState,
  formData: FormData
): Promise<ProfileActionState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      status: 'error',
      message: 'You need to sign in again before updating your profile.',
    }
  }

  const displayName = (formData.get('display_name') as string | null)?.trim() || null

  if (!displayName || displayName.length < 2) {
    return {
      status: 'error',
      message: 'Display name must be at least 2 characters long.',
    }
  }

  if (displayName.length > 40) {
    return {
      status: 'error',
      message: 'Display name must be 40 characters or fewer.',
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', user.id)

  if (error) {
    console.error('Failed to update profile name', error)
    return {
      status: 'error',
      message: 'Could not update your display name. Please try again.',
    }
  }

  revalidatePath('/', 'layout')
  revalidatePath('/')
  revalidatePath('/leaderboard')
  revalidatePath('/predictions')
  revalidatePath('/me/history')
  revalidatePath('/me/profile')
  revalidatePath('/admin/tenant')
  revalidatePath('/admin/tenants')

  return {
    status: 'success',
    message: 'Display name updated.',
  }
}
