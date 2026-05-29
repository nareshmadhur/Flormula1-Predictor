import { AlertTriangle, CheckCircle2, MailCheck } from 'lucide-react'
import { updateEmailPreferencesByToken } from '@/app/actions/unsubscribe'
import { PendingLink } from '@/components/ui/pending-link'
import { createServiceRoleClient } from '@/utils/supabase/service-role'
import { getProfileDisplayName } from '@/utils/profile-name'

export const revalidate = 0

type UnsubscribePageProps = {
  params: Promise<{ token: string }>
  searchParams?: Promise<{ saved?: string; error?: string }>
}

type PreferenceRow = {
  race_reminder_emails_enabled: boolean
  score_recap_emails_enabled: boolean
  unsubscribed_at?: string | null
  profiles?: {
    display_name?: string | null
    email?: string | null
  } | Array<{
    display_name?: string | null
    email?: string | null
  }> | null
}

function getRelatedOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function InvalidLink({ token }: { token: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6 text-center shadow-2xl md:p-8">
      <AlertTriangle className="mx-auto h-10 w-10 text-amber-300" />
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200">Email preferences</div>
        <h1 className="mt-2 text-3xl font-black italic tracking-tight text-white">
          This link is no longer active
        </h1>
        <p className="mt-2 text-sm leading-6 text-amber-50/80">
          Your preferences may already have changed, or this link may be from an older email.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <PendingLink
          href="/me/profile"
          className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
        >
          Open Profile & Notifications
        </PendingLink>
        <PendingLink
          href={token ? '/' : '/'}
          className="rounded-xl border border-white/10 bg-black/25 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
        >
          Back to FLORMULA1
        </PendingLink>
      </div>
    </div>
  )
}

export default async function UnsubscribePage({ params, searchParams }: UnsubscribePageProps) {
  const { token } = await params
  const query = searchParams ? await searchParams : {}
  const cleanToken = String(token || '').trim()

  if (!cleanToken || cleanToken.length < 20 || query.error) {
    return <InvalidLink token={cleanToken} />
  }

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('race_reminder_emails_enabled, score_recap_emails_enabled, unsubscribed_at, profiles(display_name, email)')
    .eq('unsubscribe_token', cleanToken)
    .maybeSingle()

  if (error || !data) {
    return <InvalidLink token={cleanToken} />
  }

  const preference = data as PreferenceRow
  const profile = getRelatedOne(preference.profiles)
  const displayName = getProfileDisplayName(profile?.display_name, profile?.email, 'there')
  const saved = query.saved === '1'
  const allOff = !preference.race_reminder_emails_enabled && !preference.score_recap_emails_enabled

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-in fade-in duration-500">
      <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Email preferences</div>
            <h1 className="mt-2 text-3xl font-black italic tracking-tight text-white">
              Choose what you receive
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Hi {displayName}, update the race emails for this FLORMULA1 account. Changes apply immediately.
            </p>
          </div>
          <MailCheck className="h-8 w-8 shrink-0 text-red-500" />
        </div>

        {saved && (
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm leading-6 text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Preferences saved. {allOff ? 'You will not receive race reminder or results recap emails.' : 'You will only receive the selected email types.'}
            </span>
          </div>
        )}

        <form action={updateEmailPreferencesByToken} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={cleanToken} />

          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <input
              type="checkbox"
              name="race_reminder_emails_enabled"
              defaultChecked={preference.race_reminder_emails_enabled && !preference.unsubscribed_at}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-black/40 text-red-600 accent-red-600"
            />
            <span>
              <span className="block text-sm font-bold text-slate-100">Prediction reminders</span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                Keep receiving reminders before prediction lock when you have not submitted yet.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
            <input
              type="checkbox"
              name="score_recap_emails_enabled"
              defaultChecked={preference.score_recap_emails_enabled && !preference.unsubscribed_at}
              className="mt-1 h-5 w-5 rounded border-white/20 bg-black/40 text-red-600 accent-red-600"
            />
            <span>
              <span className="block text-sm font-bold text-slate-100">Results recaps</span>
              <span className="mt-1 block text-sm leading-5 text-slate-500">
                Keep receiving score recap emails when race points are published.
              </span>
            </span>
          </label>

          <div className="rounded-2xl border border-white/5 bg-black/20 px-4 py-3 text-sm leading-6 text-slate-500">
            Clear both boxes to unsubscribe from all race emails. You can turn them back on later from Profile & Notifications.
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              className="rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
            >
              Save Email Choices
            </button>
            <PendingLink
              href="/me/profile"
              className="rounded-xl border border-white/10 bg-black/25 px-5 py-3 text-center font-bold text-slate-100 transition-colors hover:bg-white/10"
            >
              Open Profile & Notifications
            </PendingLink>
          </div>
        </form>
      </section>
    </div>
  )
}
