'use server'

import { revalidatePath } from 'next/cache'
import { assertPlatformAdmin } from '@/utils/admin-access'
import { formatAmsterdamDateTime } from '@/utils/amsterdam-time'
import {
  escapeHtml,
  isTransactionalEmailConfigured,
  renderBrandedEmail,
  sendTransactionalEmail,
} from '@/utils/email'
import { getAbsoluteUrl } from '@/utils/site'
import { createServiceRoleClient } from '@/utils/supabase/service-role'

export type AdminNotificationTestActionState = {
  status?: 'success' | 'error'
  message?: string
}

type TestProfile = {
  id: string
  display_name?: string | null
  email?: string | null
  confirmed_at?: string | null
}

type TestPreference = {
  user_id: string
  race_reminder_emails_enabled: boolean
  score_recap_emails_enabled: boolean
  unsubscribed_at?: string | null
}

type TestRace = {
  id: string
  season: number
  round: number
  race_name: string
  race_start_at: string
  prediction_lock_at: string
}

type TestScore = {
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
}

type TestCondition = {
  label: string
  passed: boolean
  detail?: string
}

function formatDate(value: string | null | undefined) {
  return formatAmsterdamDateTime(value, { includeWeekday: false }) || 'not set'
}

function getProfileName(profile: TestProfile | null | undefined) {
  return profile?.display_name || profile?.email || 'there'
}

function getConditionsHtml(title: string, conditions: TestCondition[]) {
  return `
    <div style="margin:20px 0 0;border:1px solid rgba(148,163,184,0.16);border-radius:18px;overflow:hidden;">
      <div style="padding:14px 16px;background:rgba(15,23,42,0.72);color:#f8fafc;font-size:14px;font-weight:800;">
        ${escapeHtml(title)}
      </div>
      ${conditions
        .map(
          (condition) => `
            <div style="padding:12px 16px;border-top:1px solid rgba(148,163,184,0.12);">
              <div style="color:${condition.passed ? '#86efac' : '#fca5a5'};font-size:13px;font-weight:800;">
                ${condition.passed ? 'Ready' : 'Needs attention'} - ${escapeHtml(condition.label)}
              </div>
              ${
                condition.detail
                  ? `<div style="margin-top:4px;color:#94a3b8;font-size:13px;line-height:1.5;">${escapeHtml(condition.detail)}</div>`
                  : ''
              }
            </div>
          `
        )
        .join('')}
    </div>
  `.trim()
}

function allPassed(conditions: TestCondition[]) {
  return conditions.every((condition) => condition.passed)
}

async function logTestEmail({
  userId,
  raceId,
  eventType,
  status,
  recipientEmail,
  subject,
  errorMessage,
}: {
  userId: string
  raceId: string
  eventType: 'pre_lock_reminder' | 'score_recap'
  status: 'sent' | 'failed'
  recipientEmail: string
  subject: string
  errorMessage?: string
}) {
  const supabase = createServiceRoleClient()
  const now = new Date().toISOString()

  await supabase.from('notification_events').insert({
    user_id: userId,
    race_id: raceId,
    event_key: `test:admin:${eventType}:${Date.now()}`,
    event_type: eventType,
    status,
    recipient_email: recipientEmail,
    subject,
    scheduled_for: now,
    sent_at: status === 'sent' ? now : null,
    error_message: errorMessage || null,
    metadata: {
      adminTest: true,
    },
  })
}

export async function sendAdminNotificationTestEmails(
  _prevState: AdminNotificationTestActionState,
  formData: FormData
): Promise<AdminNotificationTestActionState> {
  try {
    await assertPlatformAdmin()

    const userId = String(formData.get('user_id') || '').trim()
    if (!userId) {
      return { status: 'error', message: 'Choose a user before sending test emails.' }
    }

    const supabase = createServiceRoleClient()
    const nowIso = new Date().toISOString()

    const [{ data: profile }, { data: preference }, { data: nextRace }, { data: latestScoredRace }] =
      await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, email, confirmed_at')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('notification_preferences')
          .select('user_id, race_reminder_emails_enabled, score_recap_emails_enabled, unsubscribed_at')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('races')
          .select('id, season, round, race_name, race_start_at, prediction_lock_at')
          .neq('status', 'cancelled')
          .gt('prediction_lock_at', nowIso)
          .order('prediction_lock_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('races')
          .select('id, season, round, race_name, race_start_at, prediction_lock_at')
          .eq('status', 'scored')
          .order('race_start_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    const typedProfile = profile as TestProfile | null
    const typedPreference = preference as TestPreference | null
    const typedNextRace = nextRace as TestRace | null
    const typedLatestScoredRace = latestScoredRace as TestRace | null
    const email = typedProfile?.email?.trim() || ''

    if (!typedProfile || !email) {
      return { status: 'error', message: 'The selected user does not have an email address.' }
    }

    if (!isTransactionalEmailConfigured()) {
      return { status: 'error', message: 'Email sending is not ready yet.' }
    }

    const [{ data: prediction }, { data: score }] = await Promise.all([
      typedNextRace
        ? supabase
            .from('predictions')
            .select('user_id')
            .eq('race_id', typedNextRace.id)
            .eq('user_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      typedLatestScoredRace
        ? supabase
            .from('user_race_scores')
            .select('total_points, podium_points, bonus_points, exact_hits')
            .eq('race_id', typedLatestScoredRace.id)
            .eq('user_id', userId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const typedScore = score as TestScore | null
    const baseConditions: TestCondition[] = [
      {
        label: 'Confirmed account email',
        passed: Boolean(typedProfile.confirmed_at),
        detail: email,
      },
      {
        label: 'Not unsubscribed',
        passed: !typedPreference?.unsubscribed_at,
        detail: typedPreference?.unsubscribed_at
          ? `Unsubscribed ${formatDate(typedPreference.unsubscribed_at)}`
          : undefined,
      },
    ]

    const predictionConditions: TestCondition[] = [
      ...baseConditions,
      {
        label: 'Prediction emails enabled',
        passed: Boolean(typedPreference?.race_reminder_emails_enabled),
      },
      {
        label: 'Upcoming race available',
        passed: Boolean(typedNextRace),
        detail: typedNextRace
          ? `${typedNextRace.race_name}, locks ${formatDate(typedNextRace.prediction_lock_at)}`
          : undefined,
      },
      {
        label: 'Prediction still missing',
        passed: Boolean(typedNextRace && !prediction),
      },
    ]

    const resultConditions: TestCondition[] = [
      ...baseConditions,
      {
        label: 'Results emails enabled',
        passed: Boolean(typedPreference?.score_recap_emails_enabled),
      },
      {
        label: 'Scored race available',
        passed: Boolean(typedLatestScoredRace),
        detail: typedLatestScoredRace?.race_name || undefined,
      },
      {
        label: 'User has scored result',
        passed: Boolean(typedScore),
        detail: typedScore ? `${typedScore.total_points} points` : undefined,
      },
    ]

    const sentLabels: string[] = []
    const skippedLabels: string[] = []

    if (typedNextRace && allPassed(predictionConditions)) {
      const subject = `[TEST] Prediction email check: ${typedNextRace.race_name}`
      const htmlContent = renderBrandedEmail({
        eyebrow: 'Prediction email test',
        title: `${typedNextRace.race_name} reminder check`,
        intro: `Hi ${getProfileName(typedProfile)}, this is a test prediction reminder.`,
        actions: [{ label: 'Open race', url: getAbsoluteUrl(`/race/${typedNextRace.id}/predict`) }],
        bodyHtml: getConditionsHtml('Conditions checked for this email', predictionConditions),
      })

      try {
        await sendTransactionalEmail({
          to: { email, name: typedProfile.display_name },
          subject,
          htmlContent,
        })
        await logTestEmail({
          userId,
          raceId: typedNextRace.id,
          eventType: 'pre_lock_reminder',
          status: 'sent',
          recipientEmail: email,
          subject,
        })
        sentLabels.push('prediction')
      } catch (error) {
        await logTestEmail({
          userId,
          raceId: typedNextRace.id,
          eventType: 'pre_lock_reminder',
          status: 'failed',
          recipientEmail: email,
          subject,
          errorMessage: error instanceof Error ? error.message : 'Test email failed.',
        })
        skippedLabels.push('prediction failed')
      }
    } else {
      skippedLabels.push('prediction')
    }

    if (typedLatestScoredRace && typedScore && allPassed(resultConditions)) {
      const subject = `[TEST] Results email check: ${typedLatestScoredRace.race_name}`
      const htmlContent = renderBrandedEmail({
        eyebrow: 'Results email test',
        title: `${typedScore.total_points} pts at ${typedLatestScoredRace.race_name}`,
        intro: `Hi ${getProfileName(typedProfile)}, this is a test results email.`,
        actions: [
          { label: 'Open standings', url: getAbsoluteUrl('/leaderboard') },
          { label: 'Open race', url: getAbsoluteUrl(`/race/${typedLatestScoredRace.id}/predict`), tone: 'secondary' },
        ],
        bodyHtml: getConditionsHtml('Conditions checked for this email', resultConditions),
      })

      try {
        await sendTransactionalEmail({
          to: { email, name: typedProfile.display_name },
          subject,
          htmlContent,
        })
        await logTestEmail({
          userId,
          raceId: typedLatestScoredRace.id,
          eventType: 'score_recap',
          status: 'sent',
          recipientEmail: email,
          subject,
        })
        sentLabels.push('results')
      } catch (error) {
        await logTestEmail({
          userId,
          raceId: typedLatestScoredRace.id,
          eventType: 'score_recap',
          status: 'failed',
          recipientEmail: email,
          subject,
          errorMessage: error instanceof Error ? error.message : 'Test email failed.',
        })
        skippedLabels.push('results failed')
      }
    } else {
      skippedLabels.push('results')
    }

    revalidatePath('/admin/notifications')

    if (sentLabels.length === 0) {
      return {
        status: 'error',
        message: `No test emails were sent. Check the visible conditions for ${skippedLabels.join(' and ')}.`,
      }
    }

    return {
      status: 'success',
      message: `Sent ${sentLabels.join(' and ')} test email${sentLabels.length === 1 ? '' : 's'} to ${email}.`,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to send test emails.',
    }
  }
}
