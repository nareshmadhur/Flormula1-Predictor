'use server'

import { revalidatePath } from 'next/cache'
import { assertPlatformAdmin, getAdminAccessContext } from '@/utils/admin-access'
import { createClient } from '@/utils/supabase/server'
import {
  sendManualLifecycleEmailForUser,
  type ManualLifecycleEmailKind,
} from '@/utils/race-notifications'

export type AdminNotificationSendActionState = {
  status?: 'success' | 'error'
  message?: string
}

export type NotificationTimingActionState = {
  status?: 'success' | 'error'
  message?: string
}

function isManualLifecycleEmailKind(value: string): value is ManualLifecycleEmailKind {
  return value === 'prediction' || value === 'results'
}

function getSubmittedLeadHours(value: FormDataEntryValue | null) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 240 ? parsed : null
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

export async function savePlatformNotificationTiming(
  _prevState: NotificationTimingActionState,
  formData: FormData
): Promise<NotificationTimingActionState> {
  try {
    const { supabase, access } = await assertPlatformAdmin()
    const leadHours = getSubmittedLeadHours(formData.get('race_reminder_lead_hours'))

    if (!leadHours) {
      return { status: 'error', message: 'Reminder timing must be between 1 and 240 hours.' }
    }

    const { error } = await supabase.from('notification_platform_settings').upsert({
      id: 'global',
      race_reminder_lead_hours: leadHours,
      updated_at: new Date().toISOString(),
      updated_by: access.userId,
    })

    if (error) {
      return { status: 'error', message: `Could not save platform timing: ${error.message}` }
    }

    revalidatePath('/admin/notifications')
    revalidatePath('/admin/tenant')

    return { status: 'success', message: `Saved ${leadHours}h platform default.` }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not save platform timing.',
    }
  }
}

export async function saveTenantNotificationTiming(
  _prevState: NotificationTimingActionState,
  formData: FormData
): Promise<NotificationTimingActionState> {
  try {
    const supabase = await createClient()
    const access = await getAdminAccessContext(supabase)

    if (!access) {
      return { status: 'error', message: 'Sign in before changing notification timing.' }
    }

    if (!access.isAdmin || !access.tenantId) {
      return { status: 'error', message: 'Group admin access is required.' }
    }

    const leadHours = getSubmittedLeadHours(formData.get('race_reminder_lead_hours'))

    if (!leadHours) {
      return { status: 'error', message: 'Reminder timing must be between 1 and 240 hours.' }
    }

    const { error } = await supabase.from('notification_tenant_settings').upsert({
      tenant_id: access.tenantId,
      race_reminder_lead_hours: leadHours,
      updated_at: new Date().toISOString(),
      updated_by: access.userId,
    })

    if (error) {
      return { status: 'error', message: `Could not save group timing: ${error.message}` }
    }

    revalidatePath('/admin/tenant')
    revalidatePath('/admin/notifications')

    return { status: 'success', message: `Saved ${leadHours}h reminder timing for this group.` }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not save group timing.',
    }
  }
}

export async function clearTenantNotificationTiming(
  _prevState: NotificationTimingActionState,
  _formData: FormData
): Promise<NotificationTimingActionState> {
  void _prevState
  void _formData

  try {
    const supabase = await createClient()
    const access = await getAdminAccessContext(supabase)

    if (!access) {
      return { status: 'error', message: 'Sign in before changing notification timing.' }
    }

    if (!access.isAdmin || !access.tenantId) {
      return { status: 'error', message: 'Group admin access is required.' }
    }

    const { error } = await supabase
      .from('notification_tenant_settings')
      .delete()
      .eq('tenant_id', access.tenantId)

    if (error) {
      return { status: 'error', message: `Could not clear group override: ${error.message}` }
    }

    revalidatePath('/admin/tenant')
    revalidatePath('/admin/notifications')

    return { status: 'success', message: 'Group timing override cleared.' }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Could not clear group override.',
    }
  }
}
