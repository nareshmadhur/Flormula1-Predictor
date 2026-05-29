'use server'

import { redirect } from 'next/navigation'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

function getCleanToken(value: FormDataEntryValue | null) {
  return String(value || '').trim()
}

export async function updateEmailPreferencesByToken(formData: FormData) {
  const token = getCleanToken(formData.get('token'))

  if (!token || token.length < 20) {
    redirect('/unsubscribe/invalid?error=invalid')
  }

  const raceReminderEmailsEnabled = formData.get('race_reminder_emails_enabled') === 'on'
  const scoreRecapEmailsEnabled = formData.get('score_recap_emails_enabled') === 'on'
  const now = new Date().toISOString()
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('notification_preferences')
    .update({
      race_reminder_emails_enabled: raceReminderEmailsEnabled,
      score_recap_emails_enabled: scoreRecapEmailsEnabled,
      unsubscribed_at:
        raceReminderEmailsEnabled || scoreRecapEmailsEnabled
          ? null
          : now,
      updated_at: now,
    })
    .eq('unsubscribe_token', token)
    .select('user_id')
    .maybeSingle()

  if (error || !data) {
    redirect(`/unsubscribe/${encodeURIComponent(token)}?error=not-found`)
  }

  redirect(`/unsubscribe/${encodeURIComponent(token)}?saved=1`)
}
