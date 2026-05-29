'use server'

import { revalidatePath } from 'next/cache'
import { assertPlatformAdmin } from '@/utils/admin-access'
import {
  sendManualLifecycleEmailForUser,
  type ManualLifecycleEmailKind,
} from '@/utils/race-notifications'

export type AdminNotificationSendActionState = {
  status?: 'success' | 'error'
  message?: string
}

function isManualLifecycleEmailKind(value: string): value is ManualLifecycleEmailKind {
  return value === 'prediction' || value === 'results'
}

export async function sendAdminNotificationEmail(
  _prevState: AdminNotificationSendActionState,
  formData: FormData
): Promise<AdminNotificationSendActionState> {
  try {
    await assertPlatformAdmin()

    const userId = String(formData.get('user_id') || '').trim()
    const emailKind = String(formData.get('email_kind') || '').trim()
    const overrideRules = formData.get('override_rules') === 'on'

    if (!userId) {
      return { status: 'error', message: 'Choose a user before sending an email.' }
    }

    if (!isManualLifecycleEmailKind(emailKind)) {
      return { status: 'error', message: 'Choose which email to send.' }
    }

    const result = await sendManualLifecycleEmailForUser({
      userId,
      kind: emailKind,
      overrideRules,
    })

    revalidatePath('/admin/notifications')

    return {
      status: result.ok ? 'success' : 'error',
      message: result.message,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to send the selected email.',
    }
  }
}
