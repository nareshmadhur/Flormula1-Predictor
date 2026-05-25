import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  ListChecks,
  MailCheck,
  Send,
  Trophy,
  XCircle,
} from 'lucide-react'
import { PageBackLink } from '@/components/ui/page-back-link'
import { SectionHeader } from '@/components/ui/section-header'
import { ADMIN_TIME_LABEL, formatAmsterdamDateTime } from '@/utils/amsterdam-time'
import { getAdminAccessContext } from '@/utils/admin-access'
import { isTransactionalEmailConfigured } from '@/utils/email'
import type { ManualLifecycleEmailKind } from '@/utils/race-notifications'
import { createClient } from '@/utils/supabase/server'
import { ManualEmailForm } from './manual-email-form'

export const revalidate = 0

type EventStatus = 'queued' | 'sent' | 'failed'
type EventType = 'pre_lock_reminder' | 'score_recap' | string

type TenantRef = {
  name?: string | null
  is_test?: boolean | null
}

type NotificationProfileRef = {
  display_name?: string | null
  email?: string | null
  tenant_id?: string | null
  is_test?: boolean | null
  tenants?: TenantRef | TenantRef[] | null
}

type NotificationPreferenceRow = {
  user_id: string
  race_reminder_emails_enabled: boolean
  score_recap_emails_enabled: boolean
  unsubscribed_at?: string | null
  created_at: string
  updated_at: string
  profiles?: NotificationProfileRef | NotificationProfileRef[] | null
}

type NotificationRaceRef = {
  id?: string | null
  race_name?: string | null
  round?: number | null
  season?: number | null
  prediction_lock_at?: string | null
  race_start_at?: string | null
}

type NotificationEventMetadata = {
  testRecipient?: string | null
  testUsersOnly?: boolean | null
  originalRecipientEmail?: string | null
}

type NotificationEventRow = {
  id: string
  user_id: string
  race_id: string
  event_key: string
  event_type: EventType
  status: EventStatus
  recipient_email?: string | null
  subject?: string | null
  scheduled_for?: string | null
  sent_at?: string | null
  error_message?: string | null
  metadata?: NotificationEventMetadata | null
  created_at: string
  updated_at: string
  profiles?: NotificationProfileRef | NotificationProfileRef[] | null
  races?: NotificationRaceRef | NotificationRaceRef[] | null
}

type SummaryRow = {
  event_type: EventType
  status: EventStatus
  created_at: string
}

type TestUserRow = {
  id: string
  display_name?: string | null
  email?: string | null
  confirmed_at?: string | null
  tenants?: TenantRef | TenantRef[] | null
}

type UserScoreRow = {
  race_id?: string | null
  total_points: number
}

type PredictionRow = {
  race_id: string
}

type SelectedEventRow = {
  status: EventStatus
  updated_at?: string | null
}

type SearchParams = {
  status?: string
  type?: string
  mode?: string
  user?: string
  kind?: string
}

type AdminNotificationsPageProps = {
  searchParams?: Promise<SearchParams>
}

function getRelatedOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null
}

function getProfile(row: { profiles?: NotificationProfileRef | NotificationProfileRef[] | null }) {
  return getRelatedOne(row.profiles)
}

function getTenant(profile: NotificationProfileRef | null | undefined) {
  return getRelatedOne(profile?.tenants)
}

function getRace(row: { races?: NotificationRaceRef | NotificationRaceRef[] | null }) {
  return getRelatedOne(row.races)
}

function getDisplayName(profile: NotificationProfileRef | null | undefined) {
  return profile?.display_name || profile?.email || 'Unknown user'
}

function getGroupName(profile: NotificationProfileRef | null | undefined) {
  return getTenant(profile)?.name || 'No group'
}

function isTestProfile(profile: NotificationProfileRef | null | undefined) {
  return Boolean(profile?.is_test || getTenant(profile)?.is_test)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatDate(value: string | null | undefined) {
  return formatAmsterdamDateTime(value, { includeWeekday: false }) || 'Not set'
}

function getPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getManualEmailKind(value: string | undefined): ManualLifecycleEmailKind {
  return value === 'results' ? 'results' : 'prediction'
}

function getEventTypeLabel(type: EventType) {
  const labels: Record<string, string> = {
    pre_lock_reminder: 'Prediction reminder',
    score_recap: 'Score recap',
    result_published: 'Results published',
    match_top_scorer: 'Top scorer',
    leaderboard_highest: 'Leaderboard leader',
  }

  return labels[type] || type.replaceAll('_', ' ')
}

function getStatusClasses(status: EventStatus) {
  if (status === 'sent') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
  if (status === 'failed') return 'border-red-500/20 bg-red-500/10 text-red-200'
  return 'border-amber-500/20 bg-amber-500/10 text-amber-200'
}

function getBooleanClasses(active: boolean) {
  return active
    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
    : 'border-white/10 bg-white/5 text-slate-400'
}

function isTestEvent(event: NotificationEventRow) {
  return event.event_key.startsWith('test:') || Boolean(event.metadata?.testRecipient || event.metadata?.testUsersOnly)
}

function getFilterValue(value: string | undefined, allowedValues: string[]) {
  return value && allowedValues.includes(value) ? value : 'all'
}

function eventMatchesType(event: NotificationEventRow, typeFilter: string) {
  if (typeFilter === 'all') return true
  if (typeFilter === 'prediction') return event.event_type === 'pre_lock_reminder'
  if (typeFilter === 'results') return ['score_recap', 'result_published'].includes(event.event_type)
  if (typeFilter === 'highlights') return ['match_top_scorer', 'leaderboard_highest'].includes(event.event_type)
  return true
}

function eventMatchesMode(event: NotificationEventRow, modeFilter: string) {
  if (modeFilter === 'all') return true
  if (modeFilter === 'test') return isTestEvent(event)
  if (modeFilter === 'live') return !isTestEvent(event)
  return true
}

function getUserLabel(user: TestUserRow) {
  return user.display_name || user.email || 'Unnamed user'
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  tone = 'neutral',
}: {
  label: string
  value: string | number
  detail: string
  icon: ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'bad'
}) {
  const toneClasses = {
    neutral: 'border-white/5 bg-card text-slate-300',
    good: 'border-emerald-500/15 bg-emerald-500/8 text-emerald-200',
    warn: 'border-amber-500/15 bg-amber-500/8 text-amber-200',
    bad: 'border-red-500/15 bg-red-500/8 text-red-200',
  }

  return (
    <div className={`rounded-2xl border p-4 shadow-xl ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">{label}</div>
        <div className="shrink-0 text-current">{icon}</div>
      </div>
      <div className="mt-4 text-3xl font-black italic leading-none text-white">{value}</div>
      <div className="mt-2 text-sm leading-5 text-slate-400">{detail}</div>
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/5 bg-card p-8 text-center text-sm text-slate-400">
      {label}
    </div>
  )
}

export default async function AdminNotificationsPage({ searchParams }: AdminNotificationsPageProps) {
  const params = (await searchParams) || {}
  const statusFilter = getFilterValue(params.status, ['all', 'sent', 'failed', 'queued'])
  const typeFilter = getFilterValue(params.type, ['all', 'prediction', 'results', 'highlights'])
  const modeFilter = getFilterValue(params.mode, ['all', 'live', 'test'])
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')

  if (!access.isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h1 className="mb-4 text-3xl font-bold text-red-500">Platform Admin Only</h1>
        <p className="text-slate-400">Email delivery monitoring includes global recipient data.</p>
      </div>
    )
  }

  const now = new Date()
  const summaryWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60_000).toISOString()

  const [preferencesResult, recentEventsResult, summaryEventsResult, testUsersResult] = await Promise.all([
    supabase
      .from('notification_preferences')
      .select(
        'user_id, race_reminder_emails_enabled, score_recap_emails_enabled, unsubscribed_at, created_at, updated_at, profiles(display_name, email, tenant_id, is_test, tenants(name, is_test))'
      )
      .order('updated_at', { ascending: false }),
    supabase
      .from('notification_events')
      .select(
        'id, user_id, race_id, event_key, event_type, status, recipient_email, subject, scheduled_for, sent_at, error_message, metadata, created_at, updated_at, profiles(display_name, email, tenant_id, is_test, tenants(name, is_test)), races(race_name, round, season)'
      )
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('notification_events')
      .select('event_type, status, created_at')
      .gte('created_at', summaryWindowStart),
    supabase
      .from('profiles')
      .select('id, display_name, email, confirmed_at, tenants(name, is_test)')
      .order('display_name', { ascending: true }),
  ])

  const loadError = preferencesResult.error || recentEventsResult.error || summaryEventsResult.error || testUsersResult.error

  if (loadError) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <PageBackLink href="/admin" label="Back to Admin" />
        <SectionHeader
          eyebrow="Notifications"
          title="Email monitor"
          description="Email status is unavailable right now."
          aside={<AlertTriangle className="h-8 w-8 text-amber-400" />}
        />
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-100">
          Refresh in a moment. If this continues, check the app health from the admin console.
        </section>
      </div>
    )
  }

  const preferences = (preferencesResult.data || []) as NotificationPreferenceRow[]
  const recentEvents = (recentEventsResult.data || []) as NotificationEventRow[]
  const summaryEvents = (summaryEventsResult.data || []) as SummaryRow[]
  const testUsers = (testUsersResult.data || []) as TestUserRow[]
  const selectedUserId =
    (params.user && testUsers.some((user) => user.id === params.user) && params.user) ||
    (testUsers.some((user) => user.id === access.userId) ? access.userId : testUsers[0]?.id || '')
  const selectedKind = getManualEmailKind(params.kind)
  const selectedUser = testUsers.find((user) => user.id === selectedUserId) || null
  const selectedPreference = preferences.find((preference) => preference.user_id === selectedUserId) || null
  const leadHours = getPositiveNumber(process.env.RACE_REMINDER_LEAD_HOURS, 24)
  const scoreLookbackDays = getPositiveNumber(process.env.SCORE_RECAP_LOOKBACK_DAYS, 14)
  const nowIso = now.toISOString()
  const reminderWindowEnd = new Date(now.getTime() + leadHours * 60 * 60_000).toISOString()
  const scoreLookbackStart = new Date(now.getTime() - scoreLookbackDays * 24 * 60 * 60_000).toISOString()
  const transactionalEmailConfigured = isTransactionalEmailConfigured()
  const predictionEventKey = `pre_lock:${leadHours}h`
  const resultEventKey = 'score_recap:published'

  const [{ data: reminderRaceRows }, { data: scoredRaceRows }] = await Promise.all([
    selectedUserId
      ? supabase
          .from('races')
          .select('id, season, round, race_name, race_start_at, prediction_lock_at')
          .neq('status', 'cancelled')
          .gt('prediction_lock_at', nowIso)
          .lte('prediction_lock_at', reminderWindowEnd)
          .order('prediction_lock_at', { ascending: true })
          .limit(8)
      : Promise.resolve({ data: [] }),
    selectedUserId
      ? supabase
          .from('races')
          .select('id, season, round, race_name, race_start_at, prediction_lock_at')
          .eq('status', 'scored')
          .gte('race_start_at', scoreLookbackStart)
          .order('race_start_at', { ascending: false })
          .limit(8)
      : Promise.resolve({ data: [] }),
  ])

  const reminderRaces = (reminderRaceRows || []) as NotificationRaceRef[]
  const scoredRaces = (scoredRaceRows || []) as NotificationRaceRef[]
  const reminderRaceIds = reminderRaces.flatMap((race) => (race.id ? [race.id] : []))
  const scoredRaceIds = scoredRaces.flatMap((race) => (race.id ? [race.id] : []))

  const [{ data: selectedPredictions }, { data: selectedScores }] = await Promise.all([
    selectedUserId && reminderRaceIds.length > 0
      ? supabase
          .from('predictions')
          .select('race_id')
          .eq('user_id', selectedUserId)
          .in('race_id', reminderRaceIds)
      : Promise.resolve({ data: [] }),
    selectedUserId && scoredRaceIds.length > 0
      ? supabase
          .from('user_race_scores')
          .select('race_id, total_points')
          .eq('user_id', selectedUserId)
          .in('race_id', scoredRaceIds)
      : Promise.resolve({ data: [] }),
  ])

  const predictedRaceIds = new Set(
    ((selectedPredictions || []) as PredictionRow[]).map((prediction) => prediction.race_id)
  )
  const typedNextRace =
    reminderRaces.find((race) => race.id && !predictedRaceIds.has(race.id)) ||
    reminderRaces[0] ||
    null
  const selectedPrediction = Boolean(typedNextRace?.id && predictedRaceIds.has(typedNextRace.id))
  const scoreByRaceId = new Map(
    ((selectedScores || []) as UserScoreRow[])
      .filter((score) => score.race_id)
      .map((score) => [score.race_id as string, score])
  )
  const typedLatestScoredRace =
    scoredRaces.find((race) => race.id && scoreByRaceId.has(race.id)) ||
    scoredRaces[0] ||
    null
  const typedSelectedScore = typedLatestScoredRace?.id
    ? scoreByRaceId.get(typedLatestScoredRace.id) || null
    : null

  const [{ data: selectedPredictionEvent }, { data: selectedResultEvent }] = await Promise.all([
    selectedUserId && typedNextRace?.id
      ? supabase
          .from('notification_events')
          .select('status, updated_at')
          .eq('user_id', selectedUserId)
          .eq('race_id', typedNextRace.id)
          .eq('event_key', predictionEventKey)
          .in('status', ['queued', 'sent'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    selectedUserId && typedLatestScoredRace?.id
      ? supabase
          .from('notification_events')
          .select('status, updated_at')
          .eq('user_id', selectedUserId)
          .eq('race_id', typedLatestScoredRace.id)
          .eq('event_key', resultEventKey)
          .in('status', ['queued', 'sent'])
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const typedSelectedPredictionEvent = selectedPredictionEvent as SelectedEventRow | null
  const typedSelectedResultEvent = selectedResultEvent as SelectedEventRow | null
  const manualEmailUsers = testUsers.map((user) => ({
    id: user.id,
    label: user.email ? `${getUserLabel(user)} <${user.email}>` : getUserLabel(user),
  }))
  const selectedUserLabel = selectedUser?.email
    ? `${getUserLabel(selectedUser)} <${selectedUser.email}>`
    : selectedUser
      ? getUserLabel(selectedUser)
      : 'No user selected'
  const baseManualConditions = [
    {
      label: 'Confirmed account email',
      passed: Boolean(selectedUser?.confirmed_at && selectedUser?.email),
      detail: selectedUser?.email || 'No email found',
    },
    {
      label: 'Email sending ready',
      passed: transactionalEmailConfigured,
    },
    {
      label: 'Preferences active',
      passed: Boolean(selectedPreference && !selectedPreference.unsubscribed_at),
      detail: selectedPreference?.unsubscribed_at
        ? `Unsubscribed ${formatDate(selectedPreference.unsubscribed_at)}`
        : selectedPreference
          ? undefined
          : 'No preferences saved yet',
    },
  ]
  const predictionConditionGroup = {
    title: 'Prediction reminder',
    conditions: [
      ...baseManualConditions,
      {
        label: 'Prediction emails enabled',
        passed: Boolean(selectedPreference?.race_reminder_emails_enabled),
      },
      {
        label: 'Race inside reminder window',
        passed: Boolean(typedNextRace),
        detail: typedNextRace?.race_name
          ? `${typedNextRace.race_name}, locks ${formatDate(typedNextRace.prediction_lock_at)}`
          : `No race locks in the next ${leadHours} hours`,
      },
      {
        label: 'Prediction still missing',
        passed: Boolean(typedNextRace && !selectedPrediction),
      },
      {
        label: 'Not already sent for this race',
        passed: Boolean(typedNextRace && !typedSelectedPredictionEvent),
        detail: typedSelectedPredictionEvent
          ? `Already ${typedSelectedPredictionEvent.status} ${formatDate(typedSelectedPredictionEvent.updated_at)}`
          : undefined,
      },
    ],
  }
  const resultConditionGroup = {
    title: 'Results recap',
    conditions: [
      ...baseManualConditions,
      {
        label: 'Results emails enabled',
        passed: Boolean(selectedPreference?.score_recap_emails_enabled),
      },
      {
        label: 'Recent scored race available',
        passed: Boolean(typedLatestScoredRace),
        detail: typedLatestScoredRace?.race_name
          ? `${typedLatestScoredRace.race_name}, within the last ${scoreLookbackDays} days`
          : undefined,
      },
      {
        label: 'User has scored result',
        passed: Boolean(typedSelectedScore),
        detail: typedSelectedScore ? `${typedSelectedScore.total_points} points` : undefined,
      },
      {
        label: 'Not already sent for this race',
        passed: Boolean(typedLatestScoredRace && !typedSelectedResultEvent),
        detail: typedSelectedResultEvent
          ? `Already ${typedSelectedResultEvent.status} ${formatDate(typedSelectedResultEvent.updated_at)}`
          : undefined,
      },
    ],
  }
  const selectedConditionGroup = selectedKind === 'results' ? resultConditionGroup : predictionConditionGroup

  const activePredictionEmailCount = preferences.filter(
    (preference) => preference.race_reminder_emails_enabled && !preference.unsubscribed_at
  ).length
  const activeResultEmailCount = preferences.filter(
    (preference) => preference.score_recap_emails_enabled && !preference.unsubscribed_at
  ).length
  const unsubscribedCount = preferences.filter((preference) => Boolean(preference.unsubscribed_at)).length
  const testPreferenceCount = preferences.filter((preference) => isTestProfile(getProfile(preference))).length
  const sentLast30 = summaryEvents.filter((event) => event.status === 'sent').length
  const failedLast30 = summaryEvents.filter((event) => event.status === 'failed').length
  const queuedLast30 = summaryEvents.filter((event) => event.status === 'queued').length
  const reminderEventsLast30 = summaryEvents.filter((event) => event.event_type === 'pre_lock_reminder').length
  const recapEventsLast30 = summaryEvents.filter((event) => event.event_type === 'score_recap').length
  const liveEvents = recentEvents.filter((event) => !isTestEvent(event))
  const testEvents = recentEvents.filter(isTestEvent)
  const filteredEvents = recentEvents
    .filter((event) => (statusFilter === 'all' ? true : event.status === statusFilter))
    .filter((event) => eventMatchesType(event, typeFilter))
    .filter((event) => eventMatchesMode(event, modeFilter))
  const lastSentEvent = recentEvents.find((event) => event.status === 'sent')
  const cronSecretConfigured = Boolean(process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET)
  const automationReady = cronSecretConfigured && transactionalEmailConfigured
  const scheduledSendingLabel = cronSecretConfigured ? 'Automatic sending active' : 'Automatic sending needs setup'
  const senderLabel = transactionalEmailConfigured ? 'Email sending ready' : 'Email sending needs setup'
  const lastSentLabel = lastSentEvent ? formatDate(lastSentEvent.sent_at || lastSentEvent.updated_at) : 'None'
  const healthMessage = automationReady
    ? 'Automatic race emails can run without manual action.'
    : 'Automatic sending is not fully ready yet; delivery logs and preferences are still available.'

  return (
    <div className="space-y-7 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageBackLink href="/admin" label="Back to Admin" />
          <div className="mt-4">
            <SectionHeader
              eyebrow="Notifications"
              title="Email status"
              description="Delivery health, active audiences, and recent emails across reminders, results, and future player highlights."
              aside={<MailCheck className="h-8 w-8 text-red-500" />}
            />
          </div>
        </div>
      </div>

      <section
        className={`rounded-2xl border p-5 shadow-xl ${
          automationReady
            ? 'border-emerald-500/15 bg-emerald-500/8'
            : 'border-amber-500/20 bg-amber-500/10'
        }`}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Sending health</div>
            <h2 className="mt-2 text-2xl font-black italic tracking-tight text-white">
              {automationReady ? 'Ready for automatic emails' : 'Setup attention needed'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{healthMessage}</p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${getBooleanClasses(cronSecretConfigured)}`}>
              {scheduledSendingLabel}
            </span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${getBooleanClasses(transactionalEmailConfigured)}`}>
              {senderLabel}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Prediction emails"
          value={formatNumber(activePredictionEmailCount)}
          detail={`${formatNumber(preferences.length)} tracked accounts`}
          icon={<ListChecks className="h-5 w-5" />}
          tone="good"
        />
        <MetricCard
          label="Results emails"
          value={formatNumber(activeResultEmailCount)}
          detail={`${formatNumber(unsubscribedCount)} unsubscribed accounts`}
          icon={<Trophy className="h-5 w-5" />}
          tone="good"
        />
        <MetricCard
          label="Failed sends"
          value={formatNumber(failedLast30)}
          detail={`${formatNumber(queuedLast30)} queued in the last 30 days`}
          icon={<XCircle className="h-5 w-5" />}
          tone={failedLast30 > 0 ? 'bad' : 'neutral'}
        />
        <MetricCard
          label="Last sent"
          value={lastSentLabel}
          detail={`${formatNumber(sentLast30)} sent in the last 30 days`}
          icon={<Send className="h-5 w-5" />}
          tone="neutral"
        />
      </section>

      <ManualEmailForm
        users={manualEmailUsers}
        selectedUserId={selectedUserId}
        selectedUserLabel={selectedUserLabel}
        selectedKind={selectedKind}
        conditionGroup={selectedConditionGroup}
      />

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Delivery log"
          title="Recent emails"
          description={`Newest 80 email records, shown in ${ADMIN_TIME_LABEL}.`}
        />

        <form action="/admin/notifications" className="rounded-2xl border border-white/5 bg-card p-4 shadow-xl">
          <input type="hidden" name="user" value={selectedUserId} />
          <input type="hidden" name="kind" value={selectedKind} />
          <div className="grid gap-3 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end">
            <div>
              <label htmlFor="status-filter" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Status
              </label>
              <select
                id="status-filter"
                name="status"
                defaultValue={statusFilter}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
              >
                <option value="all">All statuses</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="queued">Queued</option>
              </select>
            </div>
            <div>
              <label htmlFor="type-filter" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Email type
              </label>
              <select
                id="type-filter"
                name="type"
                defaultValue={typeFilter}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
              >
                <option value="all">All types</option>
                <option value="prediction">Prediction</option>
                <option value="results">Results</option>
                <option value="highlights">Highlights</option>
              </select>
            </div>
            <div>
              <label htmlFor="mode-filter" className="mb-1.5 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Send mode
              </label>
              <select
                id="mode-filter"
                name="mode"
                defaultValue={modeFilter}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-red-500"
              >
                <option value="all">All sends</option>
                <option value="live">Live only</option>
                <option value="test">Test only</option>
              </select>
            </div>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-500"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
        </form>

        {filteredEvents.length === 0 ? (
          <EmptyState label="No email records have been logged yet." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
            {filteredEvents.map((event) => {
              const profile = getProfile(event)
              const race = getRace(event)

              return (
                <div
                  key={event.id}
                  className="grid gap-3 border-b border-white/5 p-4 last:border-b-0 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${getStatusClasses(event.status)}`}>
                        {event.status}
                      </span>
                      <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                        {getEventTypeLabel(event.event_type)}
                      </span>
                      {isTestEvent(event) && (
                        <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
                          Test
                        </span>
                      )}
                    </div>
                    <div className="mt-3 break-words text-sm font-semibold text-white">
                      {event.subject || 'No subject logged'}
                    </div>
                  </div>

                  <div className="min-w-0 text-sm">
                    <div className="break-words font-semibold text-slate-200">{getDisplayName(profile)}</div>
                    <div className="mt-1 break-words text-slate-500">{event.recipient_email || profile?.email || 'No recipient'}</div>
                    <div className="mt-1 break-words text-slate-500">{getGroupName(profile)}</div>
                  </div>

                  <div className="min-w-0 text-sm lg:text-right">
                    <div className="break-words font-semibold text-slate-200">
                      {race?.race_name || 'Race not found'}
                    </div>
                    {race?.round && race?.season && (
                      <div className="mt-1 text-slate-500">
                        Round {race.round} / {race.season}
                      </div>
                    )}
                    <div className="mt-1 text-slate-500">{formatDate(event.sent_at || event.updated_at)}</div>
                    {event.error_message && (
                      <div className="mt-2 break-words rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-left text-xs text-red-100">
                        {event.error_message}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="rounded-2xl border border-white/5 bg-card p-4 shadow-xl">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Automatic sends</div>
          <div className="mt-4 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
              <span className="font-semibold text-white">Morning check</span>
              <span className="ml-2 text-slate-500">Daily around 08:00 Amsterdam during summer time.</span>
            </div>
            <div className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
              <span className="font-semibold text-white">Results check</span>
              <span className="ml-2 text-slate-500">Daily around 09:00 Amsterdam during summer time.</span>
            </div>
          </div>
          <div className="mt-3 text-sm text-slate-500">
            Status covers prediction, results, and player-highlight emails.
            Recent log: {formatNumber(liveEvents.length)} live, {formatNumber(testEvents.length)} test.
            Last 30 days: {formatNumber(reminderEventsLast30)} prediction, {formatNumber(recapEventsLast30)} results.
            {formatNumber(testPreferenceCount)} test account{testPreferenceCount === 1 ? '' : 's'} in preferences.
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow="Preferences"
          title="Email preferences"
          description={`Newest updated preferences, shown in ${ADMIN_TIME_LABEL}.`}
        />

        {preferences.length === 0 ? (
          <EmptyState label="No notification preferences have been created yet." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
            {preferences.slice(0, 80).map((preference) => {
              const profile = getProfile(preference)
              const unsubscribed = Boolean(preference.unsubscribed_at)

              return (
                <div
                  key={preference.user_id}
                  className="grid gap-3 border-b border-white/5 p-4 last:border-b-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="break-words font-semibold text-white">{getDisplayName(profile)}</div>
                    <div className="mt-1 break-words text-sm text-slate-500">{profile?.email || 'No email'}</div>
                    <div className="mt-1 break-words text-sm text-slate-500">{getGroupName(profile)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${getBooleanClasses(preference.race_reminder_emails_enabled && !unsubscribed)}`}>
                      Predictions
                    </span>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${getBooleanClasses(preference.score_recap_emails_enabled && !unsubscribed)}`}>
                      Results
                    </span>
                    {unsubscribed && (
                      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-200">
                        Unsubscribed
                      </span>
                    )}
                    {isTestProfile(profile) && (
                      <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-200">
                        Test
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-slate-500 lg:justify-end">
                    {preference.race_reminder_emails_enabled || preference.score_recap_emails_enabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <XCircle className="h-4 w-4 text-slate-600" />
                    )}
                    <span>{formatDate(preference.updated_at)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
