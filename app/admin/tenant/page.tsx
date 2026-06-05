import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import {
  ArrowRight,
  Building2,
  CalendarClock,
  ClipboardCheck,
} from 'lucide-react'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getCurrentSeason } from '@/utils/season'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { getProfileDisplayName } from '@/utils/profile-name'
import { sortCompetitionStandings } from '@/utils/competition'
import { TenantContextBanner } from '@/components/ui/tenant-context-banner'
import { PendingLink } from '@/components/ui/pending-link'
import { getInvitePath } from '@/utils/group-invites'
import { getAbsoluteUrl } from '@/utils/site'
import { PageBackLink } from '@/components/ui/page-back-link'
import { SectionHeader } from '@/components/ui/section-header'
import { GroupInvitePanel } from './group-invite-panel'
import { GroupRosterPanel } from './group-roster-panel'
import { TenantNotificationTimingPanel } from './notification-timing-panel'
import {
  TenantBonusPanel,
  type TenantBonusAnswer,
  type TenantBonusQuestion,
  type TenantBonusVenueOption,
} from './tenant-bonus-panel'
import {
  getPlatformNotificationTiming,
} from '@/utils/notification-settings'
import { formatAmsterdamDateTime } from '@/utils/amsterdam-time'

export const revalidate = 0

type TenantRecord = {
  id: string
  name: string
  slug: string
  is_test?: boolean | null
}

type TenantMember = {
  id: string
  display_name?: string | null
  email?: string | null
  role: 'user' | 'admin'
  admin_scope?: 'platform' | 'tenant' | null
  tenant_id?: string | null
  is_test?: boolean | null
}

type RaceRecord = {
  id: string
  round: number
  race_name: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  circuits?: {
    name?: string | null
    country?: string | null
    emoji?: string | null
  } | null
}

type LeaderboardEntry = {
  user_id: string
  total_points: number
  exact_hits: number
  races_scored: number
}

type PredictionEntry = {
  user_id: string
  race_id: string
}

type GroupInviteRecord = {
  id: string
  invite_url?: string | null
  share_token?: string | null
  expires_at: string
  max_uses: number
  accepted_count: number
  revoked_at?: string | null
  last_accepted_at?: string | null
  created_at: string
}

type TenantNotificationSettingRow = {
  race_reminder_lead_hours?: number | null
}

function getRaceStatusCopy(status: RaceStatus) {
  if (status === 'upcoming') return 'Prediction window is open.'
  if (status === 'locked') return 'Predictions are locked.'
  if (status === 'completed') return 'Race finished. Scoring still needs to be published.'
  if (status === 'scored') return 'Race scored and standings updated.'
  return 'Race cancelled.'
}

function getMemberRaceStatus(status: RaceStatus, hasPrediction: boolean) {
  if (hasPrediction && status === 'upcoming') return 'Entered'
  if (hasPrediction && status === 'locked') return 'Locked in'
  if (hasPrediction && status === 'completed') return 'Awaiting score'
  if (hasPrediction && status === 'scored') return 'Scored'
  if (!hasPrediction && status === 'upcoming') return 'Needs entry'
  if (!hasPrediction && status === 'locked') return 'Missed lock'
  if (!hasPrediction && status === 'completed') return 'Missed weekend'
  if (!hasPrediction && status === 'scored') return 'Missed weekend'
  return 'N/A'
}

function isActiveGroupInvite(invite: GroupInviteRecord) {
  if (invite.revoked_at) return false
  if (new Date(invite.expires_at).getTime() <= Date.now()) return false
  return invite.accepted_count < invite.max_uses
}

export default async function TenantAdminPage() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')

  if (!access.isAdmin) {
    return <div className="p-20 text-center text-red-500 font-bold">Admin access required.</div>
  }

  if (!access.tenantId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-8 text-center shadow-2xl">
        <div className="space-y-2">
          <div className="text-sm font-bold uppercase tracking-[0.22em] text-amber-300">Group admin</div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Group assignment required</h1>
          <p className="text-slate-300">
            This admin account needs a group before it can manage invites, members, or entries.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {access.isPlatformAdmin && (
            <PendingLink
              href="/admin/tenants"
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
            >
              Open group setup
            </PendingLink>
          )}
          <PendingLink
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            View leaderboard
          </PendingLink>
        </div>
      </div>
    )
  }

  const currentSeason = await getCurrentSeason(supabase)

  const tenantWithTest = await supabase
    .from('tenants')
    .select('id, name, slug, is_test')
    .eq('id', access.tenantId)
    .maybeSingle()

  const tenantResult = tenantWithTest.error?.message?.includes('is_test')
    ? await supabase
        .from('tenants')
        .select('id, name, slug')
        .eq('id', access.tenantId)
        .maybeSingle()
    : tenantWithTest

  const membersWithTest = await supabase
    .from('profiles')
    .select('id, display_name, email, role, admin_scope, tenant_id, is_test')
    .eq('tenant_id', access.tenantId)
    .order('display_name')

  const membersResult = membersWithTest.error?.message?.includes('is_test')
    ? await supabase
        .from('profiles')
        .select('id, display_name, email, role, admin_scope, tenant_id')
        .eq('tenant_id', access.tenantId)
        .order('display_name')
    : membersWithTest

  const { data: races } = await supabase
    .from('races')
    .select('id, round, race_name, status, race_start_at, prediction_lock_at, circuits(name, country, emoji)')
    .eq('season', currentSeason)
    .neq('status', 'cancelled')
    .order('race_start_at', { ascending: true })

  const { data: venueOptions } = await supabase
    .from('circuits')
    .select('id, name, country, emoji')
    .order('name')

  const typedTenant = (tenantResult.data as TenantRecord | null) ?? null
  const typedMembers = ((membersResult.data || []) as TenantMember[]).map((member) => ({
    ...member,
    is_test: member.is_test ?? false,
  }))
  const operationalMembers = typedTenant?.is_test
    ? typedMembers
    : typedMembers.filter((member) => !member.is_test)
  const hiddenTestMemberCount = typedMembers.length - operationalMembers.length
  const platformTiming = await getPlatformNotificationTiming(supabase)
  const tenantTimingResult = await supabase
    .from('notification_tenant_settings')
    .select('race_reminder_lead_hours')
    .eq('tenant_id', access.tenantId)
    .maybeSingle()
  const tenantTimingSetting = tenantTimingResult.error?.message?.includes('notification_tenant_settings')
    ? null
    : (tenantTimingResult.data as TenantNotificationSettingRow | null)
  const tenantOverrideLeadHours = tenantTimingSetting?.race_reminder_lead_hours || null
  const defaultTenantLeadHours = tenantOverrideLeadHours || platformTiming.raceReminderLeadHours
  const timingHeading = `${defaultTenantLeadHours}h before prediction lock`
  const timingSummary = tenantOverrideLeadHours
    ? `This group has custom timing. The default is ${platformTiming.raceReminderLeadHours}h.`
    : `This group uses the default timing of ${platformTiming.raceReminderLeadHours}h.`
  const typedRaces = (races || []) as RaceRecord[]
  const memberIds = operationalMembers.map((member) => member.id)
  const seasonRaceIds = typedRaces.map((race) => race.id)

  const { data: tenantBonusQuestions } =
    seasonRaceIds.length > 0
      ? await supabase
          .from('bonus_questions')
          .select('id, race_id, question_text, points, display_order, bonus_options(id, label)')
          .in('race_id', seasonRaceIds)
          .eq('tenant_id', access.tenantId)
          .eq('is_active', true)
          .order('display_order', { ascending: true })
      : { data: [] as TenantBonusQuestion[] }

  const typedTenantBonusQuestions = (tenantBonusQuestions || []) as TenantBonusQuestion[]
  const tenantBonusQuestionIds = typedTenantBonusQuestions.map((question) => question.id)

  const { data: tenantBonusAnswers } =
    tenantBonusQuestionIds.length > 0
      ? await supabase
          .from('race_bonus_answers')
          .select('race_id, bonus_question_id, correct_bonus_option_id')
          .in('bonus_question_id', tenantBonusQuestionIds)
      : { data: [] as TenantBonusAnswer[] }
  const typedTenantBonusAnswers = (tenantBonusAnswers || []) as TenantBonusAnswer[]
  const tenantAnsweredQuestionIds = new Set(
    typedTenantBonusAnswers.map((answer) => answer.bonus_question_id)
  )
  const statusByRaceId = new Map(
    typedRaces.map((race) => [race.id, getEffectiveRaceStatus(race)])
  )
  const pendingTenantBonusAnswerCount = typedTenantBonusQuestions.filter((question) => {
    const status = statusByRaceId.get(question.race_id)
    return status && status !== 'upcoming' && !tenantAnsweredQuestionIds.has(question.id)
  }).length

  const openRaces = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'upcoming')
  const lockedOrCompletedRaces = typedRaces.filter((race) => {
    const status = getEffectiveRaceStatus(race)
    return status === 'locked' || status === 'completed'
  })
  const scoredRaces = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'scored')
  const featuredRace =
    openRaces[0] ||
    lockedOrCompletedRaces[0] ||
    [...scoredRaces].sort(
      (left, right) =>
        new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime()
    )[0] ||
    null
  const featuredRaceReminderAt =
    featuredRace && getEffectiveRaceStatus(featuredRace) === 'upcoming'
      ? new Date(
          new Date(featuredRace.prediction_lock_at).getTime() - defaultTenantLeadHours * 60 * 60 * 1000
        ).toISOString()
      : null

  const { data: nextRacePredictions } =
    featuredRace && memberIds.length > 0
      ? await supabase
          .from('predictions')
          .select('user_id, race_id')
          .eq('race_id', featuredRace.id)
          .in('user_id', memberIds)
      : { data: [] as PredictionEntry[] }

  const { data: leaderboardRows } =
    memberIds.length > 0
      ? await supabase
          .from('leaderboard_cache')
          .select('user_id, total_points, exact_hits, races_scored')
          .eq('season', currentSeason)
          .in('user_id', memberIds)
      : { data: [] as LeaderboardEntry[] }

  const inviteQueryWithToken = await supabase
    .from('group_invites')
    .select('id, share_token, expires_at, max_uses, accepted_count, revoked_at, last_accepted_at, created_at')
    .eq('tenant_id', access.tenantId)
    .order('created_at', { ascending: false })

  const inviteQuery =
    inviteQueryWithToken.error?.message?.includes('share_token')
      ? await supabase
          .from('group_invites')
          .select('id, expires_at, max_uses, accepted_count, revoked_at, last_accepted_at, created_at')
          .eq('tenant_id', access.tenantId)
          .order('created_at', { ascending: false })
      : inviteQueryWithToken

  const inviteSetupMessage = inviteQuery.error
    ? 'Invite links are not ready in this database yet. Run the latest invite update, then come back here.'
    : null
  const inviteMigrationNotice =
    !inviteQuery.error && inviteQueryWithToken.error?.message?.includes('share_token')
      ? 'Older invite links can still work, but this screen can only re-copy links after the latest invite update is applied.'
      : null
  const groupInvites = inviteQuery.error
    ? []
    : ((inviteQuery.data || []) as GroupInviteRecord[]).map((invite) => ({
        ...invite,
        invite_url: invite.share_token ? getAbsoluteUrl(getInvitePath(invite.share_token)) : null,
      }))
  const activeInviteCount = groupInvites.filter(isActiveGroupInvite).length
  const isMainGroup = typedTenant?.slug === 'main'

  const leaderboard = sortCompetitionStandings((leaderboardRows || []) as LeaderboardEntry[])
  const leaderboardByUserId = new Map(leaderboard.map((entry) => [entry.user_id, entry]))
  const nextRacePredictionUserIds = new Set(
    ((nextRacePredictions || []) as PredictionEntry[]).map((entry) => entry.user_id)
  )
  const tenantAdminCount = typedMembers.filter(
    (member) => member.role === 'admin' && member.admin_scope === 'tenant'
  ).length
  const nextRaceCoverage = featuredRace ? nextRacePredictionUserIds.size : 0
  const missingFeaturedRaceMembers = featuredRace
    ? operationalMembers.filter((member) => !nextRacePredictionUserIds.has(member.id))
    : []
  const coveragePercent =
    featuredRace && operationalMembers.length > 0
      ? Math.round((nextRaceCoverage / operationalMembers.length) * 100)
      : 0
  const openItemsCount =
    (featuredRace ? missingFeaturedRaceMembers.length : 0) +
    (activeInviteCount === 0 ? 1 : 0) +
    pendingTenantBonusAnswerCount

  const roster = typedMembers.map((member) => {
    const standing = leaderboardByUserId.get(member.id)
    const featuredRaceStatus = featuredRace ? getEffectiveRaceStatus(featuredRace) : null

    return {
      member,
      standing,
      featuredRaceStatus: featuredRaceStatus
        ? getMemberRaceStatus(featuredRaceStatus, nextRacePredictionUserIds.has(member.id))
        : 'Season complete',
    }
  })

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <PageBackLink
          href={access.isPlatformAdmin ? '/admin' : '/leaderboard?view=tenant'}
          label={access.isPlatformAdmin ? 'Back to Admin' : 'Back to Standings'}
        />
        <SectionHeader
          eyebrow="Group admin"
          title={typedTenant?.name || 'Group operations'}
          description={`Manage invites, members, race entries, bonus questions, and standings for ${typedTenant?.name || 'your group'}.`}
          aside={<Building2 className="h-8 w-8 text-red-500" />}
        />

        <div className="flex flex-wrap items-center gap-3">
          <TenantContextBanner tenantName={typedTenant?.name || null} label="Operating in" />
          {typedTenant?.is_test && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-bold uppercase tracking-wider text-amber-200">
              Test group
            </div>
          )}
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
            {access.isPlatformAdmin
              ? 'Viewing this group as a platform admin.'
              : 'Changes apply only to this group.'}
          </div>
          {hiddenTestMemberCount > 0 && !typedTenant?.is_test && (
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
              Excluding {hiddenTestMemberCount} test account{hiddenTestMemberCount === 1 ? '' : 's'} from health counts.
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="#race-week-ops"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-all hover:bg-red-500"
          >
            Check entries
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#group-invites"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            Invite people
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#group-bonus"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            Bonus questions
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href="#group-roster"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            Manage roster
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>

      <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xl sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          <span>{openItemsCount} open item{openItemsCount === 1 ? '' : 's'}</span>
          <span className="text-slate-700">/</span>
          <span>{operationalMembers.length} members</span>
          <span className="text-slate-700">/</span>
          <span>Season {currentSeason}</span>
        </div>

        <div className="mt-4">
          <PendingLink
            href={featuredRace ? `/race/${featuredRace.id}/predict` : '/season'}
            className="group block rounded-2xl border border-red-500/20 bg-red-500/10 p-5 transition-colors hover:bg-red-500/14"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-red-100">
              <ClipboardCheck className="h-4 w-4" />
              Race entries
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
              <div className="text-5xl font-bold leading-none text-white">
                {featuredRace ? `${nextRaceCoverage}/${operationalMembers.length}` : '0/0'}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {featuredRace ? featuredRace.race_name : 'No active race'}
                </h2>
                <p className="mt-1 text-sm text-red-100/80">
                  {featuredRace
                    ? `${coveragePercent}% submitted. ${getRaceStatusCopy(getEffectiveRaceStatus(featuredRace))}`
                    : 'There is no active race for this group.'}
                </p>
              </div>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors group-hover:bg-red-500">
              View race
              <ArrowRight className="h-4 w-4" />
            </span>
          </PendingLink>
        </div>
      </section>

      <section id="race-week-ops" className="space-y-4 scroll-mt-28">
        <SectionHeader
          eyebrow="Race entries"
          title="Entries and reminders"
          description="Check who has entered the next race and when reminder emails will be sent."
        />

        <div className="space-y-5">
          {featuredRace ? (
            <section className="rounded-3xl border border-red-500/20 bg-red-500/8 p-5 shadow-2xl md:p-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">Next race entries</div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">{nextRaceCoverage}/{operationalMembers.length} entered</h2>
                <p className="mt-2 text-sm text-red-100/80">
                  {featuredRace.race_name}: {coveragePercent}% of members have saved an entry.
                </p>
                {featuredRaceReminderAt && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-red-100/70">
                    <CalendarClock className="h-4 w-4 shrink-0" />
                    Reminder scheduled for {formatAmsterdamDateTime(featuredRaceReminderAt, { includeZone: true })}.
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-3">
                  <PendingLink
                    href={`/race/${featuredRace.id}/predict`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
                  >
                    View race
                    <ArrowRight className="h-4 w-4" />
                  </PendingLink>
                  <a
                    href="#group-invites"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-5 py-3 font-bold text-red-50 transition-colors hover:bg-white/10"
                  >
                    Invite members
                  </a>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-500">Still missing</div>
                {missingFeaturedRaceMembers.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
                    Everyone has submitted for this race.
                  </div>
                ) : (
                  <div className="mt-4 max-h-64 space-y-2 overflow-y-auto pr-1">
                    {missingFeaturedRaceMembers.slice(0, 8).map((member) => (
                      <div key={member.id} className="rounded-xl border border-white/5 bg-black/25 px-3 py-2">
                        <div className="font-semibold text-slate-100">{getProfileDisplayName(member.display_name, member.email)}</div>
                        <div className="text-xs text-slate-500">{member.email}</div>
                      </div>
                    ))}
                    {missingFeaturedRaceMembers.length > 8 && (
                      <div className="text-sm text-slate-400">
                        +{missingFeaturedRaceMembers.length - 8} more in the roster below.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Next race entries</div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">No active race</h2>
              <p className="mt-2 text-sm text-slate-400">
                When the next race opens, entries and missing members will appear here.
              </p>
            </section>
          )}

          <TenantNotificationTimingPanel
            groupName={typedTenant?.name || 'This group'}
            currentLeadHoursLabel={timingHeading}
            defaultLeadHours={defaultTenantLeadHours}
            overrideLeadHours={tenantOverrideLeadHours}
            timingSummary={timingSummary}
          />
        </div>
      </section>

      <GroupInvitePanel
        groupName={typedTenant?.name || 'your group'}
        invites={groupInvites}
        setupMessage={inviteSetupMessage}
        migrationNotice={inviteMigrationNotice}
      />

      <TenantBonusPanel
        groupName={typedTenant?.name || 'This group'}
        races={typedRaces.map((race) => ({
          id: race.id,
          round: race.round,
          race_name: race.race_name,
          effectiveStatus: getEffectiveRaceStatus(race),
        }))}
        questions={typedTenantBonusQuestions}
        answers={typedTenantBonusAnswers}
        venueOptions={(venueOptions || []) as TenantBonusVenueOption[]}
      />

      <GroupRosterPanel
        roster={roster}
        currentUserId={access.userId}
        isMainGroup={isMainGroup}
        tenantAdminCount={tenantAdminCount}
      />

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Group standings</h2>
            <p className="mt-1 text-sm text-slate-400">
              Open the full standings when you need the competitive view.
            </p>
          </div>
          <PendingLink
            href="/leaderboard?view=tenant"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            Open standings
            <ArrowRight className="h-4 w-4" />
          </PendingLink>
        </div>
      </section>
    </div>
  )
}
