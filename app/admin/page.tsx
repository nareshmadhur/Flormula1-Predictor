import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { ChevronRight, ClipboardCheck, Database, MailCheck, PlusCircle, Search, Settings, Users } from 'lucide-react'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { getAdminUserLifecycle } from '@/utils/admin-user-lifecycle'
import { MaintenanceSection } from '@/components/ui/maintenance-section'
import { getAdminAccessContext } from '@/utils/admin-access'
import { PendingLink } from '@/components/ui/pending-link'
import { SectionHeader } from '@/components/ui/section-header'
import { getRaceFocus } from '@/utils/race-focus'
import { getProfileDisplayName } from '@/utils/profile-name'
import {
  getPlatformRaceActionBadgeClasses,
  getPlatformRaceActionLabel,
  getPlatformRaceActionPriority,
  getPlatformRaceActionState,
  type PlatformRaceActionState,
} from '@/utils/admin-race-actions'

export const revalidate = 0

type AdminRace = {
  id: string
  round: number
  season: number
  race_name: string
  status: 'upcoming' | 'locked' | 'completed' | 'scored' | 'cancelled'
  race_start_at: string
  prediction_lock_at: string
  circuits?: {
    name?: string | null
    emoji?: string | null
  } | null
}

type AdminTenant = {
  id: string
  name: string
  slug?: string | null
}

type TenantAdminProfile = {
  tenant_id?: string | null
}

type PlatformBonusQuestion = {
  id: string
  race_id: string
  tenant_id?: string | null
}

type PlatformBonusAnswer = {
  bonus_question_id: string
}

type AdminUserSummary = {
  id: string
  display_name?: string | null
  email?: string | null
  role?: 'user' | 'admin' | null
  tenant_id?: string | null
}

type PlatformRaceActionRow = {
  race: AdminRace
  effectiveStatus: ReturnType<typeof getEffectiveRaceStatus>
  actionState: PlatformRaceActionState
  pendingBonusQuestionCount: number
  pendingBonusGroupCount: number
}

function formatLifecycleDate(value?: string | null) {
  if (!value) return 'None'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getPlatformActionDescription(row: PlatformRaceActionRow | null, nextSetupRace: AdminRace | null) {
  if (!row) {
    return nextSetupRace
      ? 'Review schedule timing and OpenF1 linkage before the next lock.'
      : 'Use schedule sync when a new race needs setup.'
  }

  if (row.actionState === 'needs_results') {
    if (row.pendingBonusQuestionCount > 0) {
      return `Publish the official podium first. ${row.pendingBonusQuestionCount} tenant bonus answer${row.pendingBonusQuestionCount === 1 ? '' : 's'} still need follow-up after that.`
    }

    return 'Enter official podium results, then publish scoring.'
  }

  if (row.actionState === 'bonus_follow_up') {
    return `${row.pendingBonusQuestionCount} tenant bonus answer${row.pendingBonusQuestionCount === 1 ? '' : 's'} still need attention across ${row.pendingBonusGroupCount} group${row.pendingBonusGroupCount === 1 ? '' : 's'}.`
  }

  if (row.actionState === 'weekend_live') {
    return 'Prediction window is closed. Monitor the weekend until official results are ready.'
  }

  if (row.actionState === 'needs_setup') {
    return 'Review schedule timing and OpenF1 linkage before the next lock.'
  }

  return 'Published results and tenant bonus work are complete.'
}

function getPlatformActionButtonLabel(state: PlatformRaceActionState | null) {
  if (state === 'needs_results') return 'Enter results'
  if (state === 'bonus_follow_up') return 'Open bonus follow-up'
  if (state === 'weekend_live') return 'Open live race'
  if (state === 'needs_setup') return 'Open setup'
  return 'Open race'
}

function getPlatformReviewNote(row: PlatformRaceActionRow) {
  if (row.actionState === 'needs_results') {
    return row.pendingBonusQuestionCount > 0
      ? `${row.pendingBonusQuestionCount} tenant bonus answer${row.pendingBonusQuestionCount === 1 ? '' : 's'} queued after results`
      : 'Official podium still missing'
  }

  if (row.actionState === 'bonus_follow_up') {
    return `${row.pendingBonusGroupCount} group${row.pendingBonusGroupCount === 1 ? '' : 's'} still need bonus answers`
  }

  if (row.actionState === 'weekend_live') {
    return 'Race is live and locked for predictions'
  }

  if (row.actionState === 'needs_setup') {
    return 'Upcoming weekend waiting on setup review'
  }

  return 'Ready for recap only'
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const access = await getAdminAccessContext(supabase)

  if (!access) redirect('/login')

  if (access.isTenantAdmin) {
    redirect('/admin/tenant')
  }

  if (!access.isPlatformAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <h1 className="mb-4 text-3xl font-bold text-red-500">Platform Admin Only</h1>
        <p className="text-slate-400">Race operations are limited to platform admins.</p>
        <PendingLink href="/" className="mt-6 text-slate-300 underline">Return home</PendingLink>
      </div>
    )
  }

  const { data: races } = await supabase
    .from('races')
    .select('*, circuits(name, emoji)')
    .order('round', { ascending: true })

  const { data: tenants } = await supabase.from('tenants').select('id, name, slug').order('name')
  const { data: userProfiles } = await supabase
    .from('profiles')
    .select('id, display_name, email, role, tenant_id')
    .order('display_name')
  const { count: userCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'user')
  const { data: tenantAdmins } = await supabase
    .from('profiles')
    .select('tenant_id')
    .eq('role', 'admin')
    .eq('admin_scope', 'tenant')
  const unassignedUsersWithTest = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'user')
    .is('tenant_id', null)
    .eq('is_test', false)
  const unassignedUsersResult = unassignedUsersWithTest.error?.message?.includes('is_test')
    ? await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'user')
        .is('tenant_id', null)
    : unassignedUsersWithTest
  const typedRaces = (races || []) as AdminRace[]
  const typedTenants = (tenants || []) as AdminTenant[]
  const typedUserProfiles = (userProfiles || []) as AdminUserSummary[]
  const typedTenantAdmins = (tenantAdmins || []) as TenantAdminProfile[]
  const userLifecycleById = await getAdminUserLifecycle(typedUserProfiles.map((profile) => profile.id))
  const raceFocus = getRaceFocus(typedRaces)
  const nextSetupRace = raceFocus.nextOpenRace
  const liveRaces = raceFocus.lockedRaces
  const resultRaces = raceFocus.completedRaces
  const liveCount = liveRaces.length
  const resultsCount = resultRaces.length
  const unassignedCount = unassignedUsersResult.count || 0
  const tenantIdsWithAdmins = new Set(typedTenantAdmins.map((admin) => admin.tenant_id).filter(Boolean))
  const groupsWithoutAdmins = typedTenants.filter((tenant) => !tenantIdsWithAdmins.has(tenant.id))
  const actionRaceIds = [...resultRaces, ...raceFocus.scoredRaces].map((race) => race.id)
  const { data: actionBonusQuestions } =
    actionRaceIds.length > 0
      ? await supabase
          .from('bonus_questions')
          .select('id, race_id')
          .in('race_id', actionRaceIds)
          .not('tenant_id', 'is', null)
          .eq('is_active', true)
      : { data: [] as PlatformBonusQuestion[] }
  const typedActionBonusQuestions = (actionBonusQuestions || []) as PlatformBonusQuestion[]
  const actionBonusQuestionIds = typedActionBonusQuestions.map((question) => question.id)
  const { data: actionBonusAnswers } =
    actionBonusQuestionIds.length > 0
      ? await supabase
          .from('race_bonus_answers')
          .select('bonus_question_id')
          .in('bonus_question_id', actionBonusQuestionIds)
      : { data: [] as PlatformBonusAnswer[] }
  const answeredActionBonusQuestionIds = new Set(
    ((actionBonusAnswers || []) as PlatformBonusAnswer[]).map((answer) => answer.bonus_question_id)
  )
  const pendingBonusQuestionCountByRaceId = new Map<string, number>()
  const pendingBonusGroupIdsByRaceId = new Map<string, Set<string>>()
  typedActionBonusQuestions.forEach((question) => {
    if (answeredActionBonusQuestionIds.has(question.id)) return

    pendingBonusQuestionCountByRaceId.set(
      question.race_id,
      (pendingBonusQuestionCountByRaceId.get(question.race_id) || 0) + 1
    )

    if (question.tenant_id) {
      const currentGroupIds = pendingBonusGroupIdsByRaceId.get(question.race_id) || new Set<string>()
      currentGroupIds.add(question.tenant_id)
      pendingBonusGroupIdsByRaceId.set(question.race_id, currentGroupIds)
    }
  })
  const pendingGroupBonusAnswerCount = typedActionBonusQuestions.filter(
    (question) => !answeredActionBonusQuestionIds.has(question.id)
  ).length
  const platformRaceActionRows = typedRaces
    .filter((race) => getEffectiveRaceStatus(race) !== 'cancelled')
    .map((race) => {
      const effectiveStatus = getEffectiveRaceStatus(race)
      const pendingBonusQuestionCount = pendingBonusQuestionCountByRaceId.get(race.id) || 0
      const pendingBonusGroupCount = pendingBonusGroupIdsByRaceId.get(race.id)?.size || 0

      return {
        race,
        effectiveStatus,
        actionState: getPlatformRaceActionState(race, pendingBonusQuestionCount),
        pendingBonusQuestionCount,
        pendingBonusGroupCount,
      } satisfies PlatformRaceActionRow
    })
    .sort((left, right) => {
      const priorityDelta =
        getPlatformRaceActionPriority(left.actionState) - getPlatformRaceActionPriority(right.actionState)
      if (priorityDelta !== 0) return priorityDelta

      if (left.actionState === 'needs_setup' || left.actionState === 'weekend_live') {
        return new Date(left.race.race_start_at).getTime() - new Date(right.race.race_start_at).getTime()
      }

      return new Date(right.race.race_start_at).getTime() - new Date(left.race.race_start_at).getTime()
    })
  const platformRaceActionByRaceId = new Map(
    platformRaceActionRows.map((row) => [row.race.id, row])
  )
  const currentActionRaceRow = platformRaceActionRows[0] || null
  const currentActionRace = currentActionRaceRow?.race || null
  const currentActionState = currentActionRaceRow?.actionState || null
  const bonusFollowUpRows = platformRaceActionRows.filter((row) => row.pendingBonusQuestionCount > 0)
  const bonusFollowUpRaceCount = bonusFollowUpRows.length
  const needsAttentionCount =
    resultsCount + liveCount + unassignedCount + groupsWithoutAdmins.length + pendingGroupBonusAnswerCount
  const firstLiveRace = liveRaces[0] || null
  const reviewRaceRows = platformRaceActionRows.filter(
    (row) => row.actionState !== 'done' && row.actionState !== 'needs_setup'
  )
  const raceSetupHref = nextSetupRace ? `/admin/races/${nextSetupRace.id}#openf1-sync` : '/admin/schedule'
  const bonusFollowUpHref = bonusFollowUpRows[0] ? `/admin/races/${bonusFollowUpRows[0].race.id}#group-bonus` : '/admin/tenants'
  const raceWeekendHref = currentActionRaceRow
    ? `/admin/races/${currentActionRace.id}${
        currentActionState === 'needs_results'
          ? '#official-results'
          : currentActionState === 'bonus_follow_up'
            ? '#group-bonus'
            : currentActionState === 'needs_setup'
              ? '#openf1-sync'
              : ''
      }`
    : raceSetupHref
  const raceWeekendLabel = currentActionState ? getPlatformRaceActionLabel(currentActionState) : 'NO RACE'
  const recentUserRows = [...typedUserProfiles]
    .sort((left, right) => {
      const leftActivity = userLifecycleById.get(left.id)?.lastActivityAt
      const rightActivity = userLifecycleById.get(right.id)?.lastActivityAt
      return new Date(rightActivity || 0).getTime() - new Date(leftActivity || 0).getTime()
    })
    .slice(0, 6)

  return (
    <div className="space-y-7 animate-in fade-in duration-500">
      <SectionHeader
        eyebrow="Admin"
        title="Admin"
        description="Handle race setup, results, groups, and emails from one place."
        aside={<Settings className="h-8 w-8 text-red-500" />}
      />

      <section className="rounded-3xl border border-white/10 bg-card p-4 shadow-xl sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          <span>{needsAttentionCount} open item{needsAttentionCount === 1 ? '' : 's'}</span>
          <span className="text-slate-700">/</span>
          <span>{typedTenants.length} groups</span>
        </div>

        <div className="mt-4 space-y-3">
          <PendingLink
            href={raceWeekendHref}
            className="group block min-w-0 rounded-2xl border border-red-500/20 bg-red-500/10 p-5 transition-colors hover:bg-red-500/14"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold uppercase leading-5 tracking-[0.18em] text-red-100 sm:tracking-[0.22em]">
              <ClipboardCheck className="h-4 w-4 shrink-0" />
              Race weekend
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
                  <div className="text-4xl font-bold leading-none text-white">{raceWeekendLabel}</div>
                  <div className="min-w-0">
                    <h2 className="break-words text-xl font-bold tracking-tight text-white">
                      {currentActionRace?.race_name || nextSetupRace?.race_name || 'No race weekend active'}
                    </h2>
                    <p className="mt-1 break-words text-sm text-red-100/80">
                      {getPlatformActionDescription(currentActionRaceRow, nextSetupRace)}
                    </p>
                  </div>
                </div>
                <span className="mt-5 inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors group-hover:bg-red-500">
              {getPlatformActionButtonLabel(currentActionState)}
              <ChevronRight className="h-4 w-4" />
            </span>
          </PendingLink>

          <div className="grid gap-3 md:grid-cols-2">
            <PendingLink
              href={firstLiveRace ? `/admin/races/${firstLiveRace.id}` : '/admin/schedule'}
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/8 p-4 transition-colors hover:bg-amber-500/12"
            >
              <div className="min-w-0">
                <div className="break-words text-xs font-bold uppercase leading-5 tracking-[0.16em] text-amber-100 sm:tracking-[0.2em]">Locked races</div>
                <div className="mt-1 text-2xl font-bold text-white">{liveCount}</div>
                <p className="mt-1 break-words text-sm text-amber-100/75">Prediction windows are closed.</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-amber-100/70 transition-colors group-hover:text-white" />
            </PendingLink>

            <PendingLink
              href="/admin/tenants"
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-sky-500/15 bg-sky-500/8 p-4 transition-colors hover:bg-sky-500/12"
            >
              <div className="min-w-0">
                <div className="break-words text-xs font-bold uppercase leading-5 tracking-[0.16em] text-sky-100 sm:tracking-[0.2em]">Unassigned users</div>
                <div className="mt-1 text-2xl font-bold text-white">{unassignedCount}</div>
                <p className="mt-1 break-words text-sm text-sky-100/75">
                  People who are not in a group yet.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-sky-100/70 transition-colors group-hover:text-white" />
            </PendingLink>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-red-500/20 bg-red-500/8 p-5 shadow-xl md:p-6">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">Race lifecycle</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
              Operations queue
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-red-100/80">
              Keep setup, live weekends, and results publishing in one compact flow without repeating the headline race above.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <PendingLink
              href={raceSetupHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
            >
              {nextSetupRace ? 'Open setup' : 'Open schedule sync'}
              <ChevronRight className="h-4 w-4" />
            </PendingLink>
            {resultsCount > 0 && (
              <PendingLink
                href={`/admin/races/${resultRaces[0].id}#official-results`}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/25 px-5 py-3 font-bold text-red-50 transition-colors hover:bg-white/10"
              >
                Enter results
              </PendingLink>
            )}
          </div>
        </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-100">Upcoming setup</div>
              <div className="mt-2 text-3xl font-bold text-white">{nextSetupRace ? 1 : 0}</div>
              <p className="mt-1 text-sm text-red-100/75">
                {nextSetupRace ? 'One race ready for timing/source review.' : 'No upcoming setup queue.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-100">Live weekends</div>
            <div className="mt-2 text-3xl font-bold text-white">{liveCount}</div>
            <p className="mt-1 text-sm text-red-100/75">Windows closed and races still in progress.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-100">Official results</div>
            <div className="mt-2 text-3xl font-bold text-white">{resultsCount}</div>
            <p className="mt-1 text-sm text-red-100/75">Completed races waiting on official publication.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-100">Tenant bonus follow-up</div>
              <div className="mt-2 text-3xl font-bold text-white">{bonusFollowUpRaceCount}</div>
              <p className="mt-1 text-sm text-red-100/75">
                Scored or completed races with unanswered tenant bonus work.
              </p>
            </div>
          </div>
        </section>

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Groups & competition</div>
            <h2 className="mt-1 text-xl font-bold text-white">Tenant health</h2>
          </div>
          <PendingLink
            href="/admin/tenants"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 font-bold text-white transition-colors hover:bg-red-500"
          >
            Open groups
            <ChevronRight className="h-4 w-4" />
          </PendingLink>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PendingLink
            href="/admin/tenants"
            className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-sky-500/15 bg-sky-500/8 p-4 transition-colors hover:bg-sky-500/12"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-sky-100">Groups</div>
              <div className="mt-2 text-3xl font-bold text-white">{typedTenants.length}</div>
              <p className="mt-1 text-sm text-sky-100/75">Active competition containers.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-sky-100/70 transition-colors group-hover:text-white" />
          </PendingLink>

          <PendingLink
            href="/admin/tenants"
            className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/8 p-4 transition-colors hover:bg-amber-500/12"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100">No tenant admin</div>
              <div className="mt-2 text-3xl font-bold text-white">{groupsWithoutAdmins.length}</div>
              <p className="mt-1 text-sm text-amber-100/75">Groups missing local ownership.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-amber-100/70 transition-colors group-hover:text-white" />
          </PendingLink>

          <PendingLink
            href={bonusFollowUpHref}
            className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-red-500/15 bg-red-500/8 p-4 transition-colors hover:bg-red-500/12"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-red-100">Bonus answers</div>
              <div className="mt-2 text-3xl font-bold text-white">{pendingGroupBonusAnswerCount}</div>
              <p className="mt-1 text-sm text-red-100/75">Tenant questions still unresolved.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-red-100/70 transition-colors group-hover:text-white" />
          </PendingLink>

          <PendingLink
            href="/admin/tenants"
            className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-white/[0.04]"
          >
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Unassigned users</div>
              <div className="mt-2 text-3xl font-bold text-white">{unassignedCount}</div>
              <p className="mt-1 text-sm text-slate-400">People outside a group.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
          </PendingLink>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl md:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">User lifecycle</div>
            <h2 className="mt-1 text-xl font-bold text-white">Support and cleanup</h2>
          </div>
          <PendingLink
            href="/admin/tenants"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            Find users
            <Search className="h-4 w-4" />
          </PendingLink>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            <PendingLink
              href="/admin/tenants"
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-white/[0.04]"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  <Users className="h-4 w-4 text-red-400" />
                  Users
                </div>
                <div className="mt-2 text-3xl font-bold text-white">{userCount || 0}</div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>

            <PendingLink
              href="/admin/tenants"
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-amber-500/15 bg-amber-500/8 p-4 transition-colors hover:bg-amber-500/12"
            >
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-100">Needs group</div>
                <div className="mt-2 text-3xl font-bold text-white">{unassignedCount}</div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-amber-100/70 transition-colors group-hover:text-white" />
            </PendingLink>

            <PendingLink
              href="/admin/notifications"
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors hover:bg-white/[0.04]"
            >
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  <MailCheck className="h-4 w-4 text-red-400" />
                  Email support
                </div>
                <div className="mt-2 text-base font-bold text-white">Notifications</div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Recent activity</div>
                <div className="mt-1 font-bold text-white">Last login and last active</div>
              </div>
              <PendingLink
                href="/admin/tenants"
                className="text-sm font-bold text-red-400 transition-colors hover:text-red-300"
              >
                Manage users
              </PendingLink>
            </div>

            <div className="mt-4 space-y-2">
              {recentUserRows.length === 0 ? (
                <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-slate-500">
                  No user activity is available yet.
                </div>
              ) : (
                recentUserRows.map((profile) => {
                  const lifecycle = userLifecycleById.get(profile.id)

                  return (
                    <div
                      key={profile.id}
                      className="grid gap-2 rounded-xl border border-white/5 bg-black/25 px-3 py-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-white">
                          {getProfileDisplayName(profile.display_name, profile.email)}
                        </div>
                        <div className="break-all text-xs text-slate-500">{profile.email || 'No email'}</div>
                      </div>
                      <div className="text-xs text-slate-400">
                        Login {formatLifecycleDate(lifecycle?.lastLoginAt)}
                      </div>
                      <div className="text-xs text-slate-400">
                        Active {formatLifecycleDate(lifecycle?.lastActivityAt)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </section>

      {reviewRaceRows.length > 0 && (
        <section className="space-y-4">
          <SectionHeader
            eyebrow="Current races"
            title="Races to review"
            description="Live races, official results, and tenant bonus follow-up stay visible until the work is actually done."
          />

          <div className="overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
            {reviewRaceRows.map((row) => (
              <PendingLink
                href={`/admin/races/${row.race.id}${row.actionState === 'bonus_follow_up' ? '#group-bonus' : row.actionState === 'needs_results' ? '#official-results' : ''}`}
                key={row.race.id}
                className="group grid min-w-0 gap-3 border-b border-white/5 p-4 transition-colors last:border-b-0 hover:bg-white/[0.02] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                    Round {row.race.round} • {row.race.season}
                  </div>
                  <div className="break-words text-base font-bold leading-tight text-white">{row.race.race_name}</div>
                  <div className="break-words text-sm text-slate-400">
                    {row.race.circuits?.name} {row.race.circuits?.emoji}
                  </div>
                </div>

                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 lg:justify-end">
                  <div className="flex min-w-0 flex-col gap-2 lg:items-end">
                    <div className={`max-w-full rounded-full border px-3 py-1.5 text-left text-[11px] font-bold uppercase leading-4 tracking-[0.14em] sm:tracking-[0.18em] lg:text-right ${getPlatformRaceActionBadgeClasses(row.actionState)}`}>
                      {getPlatformRaceActionLabel(row.actionState)}
                    </div>
                    <div className="max-w-full break-words text-sm text-slate-400 lg:text-right">
                      {getPlatformReviewNote(row)}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
                </div>
              </PendingLink>
            ))}
          </div>
        </section>
      )}

      <details className="group border-t border-white/10 pt-5">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-amber-100 sm:tracking-[0.18em]">
              <PlusCircle className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              Advanced
            </div>
            <h2 className="text-lg font-bold leading-tight text-white">System & data health</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Source sync issues, reference data, historic corrections, and manual fallbacks.
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
        </summary>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <MaintenanceSection />

          <div className="space-y-4">
            <PendingLink
              href="/admin/data#manual-race"
              className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0">
                <div className="mb-2 inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold uppercase leading-5 tracking-[0.14em] text-slate-300 sm:tracking-[0.18em]">
                  <Database className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  Reference
                </div>
                <h2 className="break-words text-base font-bold leading-tight text-white">Source mapping</h2>
                <p className="mt-1 break-words text-sm text-slate-400">
                  Fix driver, constructor, or circuit matches, or use the manual race fallback.
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
            </PendingLink>
          </div>
        </div>
      </details>

      <details className="group border-t border-white/10 pt-5">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0">
            <div className="break-words text-xs font-bold uppercase leading-5 tracking-[0.16em] text-slate-500 sm:tracking-[0.22em]">Calendar reference</div>
            <h2 className="mt-1 text-lg font-bold leading-tight text-white">All race detail pages</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Open the full calendar only for inspection, exceptions, corrections, or advanced tools.
            </p>
          </div>
          <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
        </summary>

        <div className="mt-4 overflow-hidden rounded-2xl border border-white/5 bg-card shadow-xl">
          {typedRaces.length === 0 ? (
            <div className="p-8 text-center italic text-slate-500">No races defined.</div>
          ) : (
            typedRaces.map((race) => {
              const actionRow = platformRaceActionByRaceId.get(race.id) || null

              return (
                <PendingLink
                  href={`/admin/races/${race.id}`}
                  key={race.id}
                  className="group grid min-w-0 gap-3 border-b border-white/5 p-4 transition-colors last:border-b-0 hover:bg-white/[0.02] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                      Round {race.round} • {race.season}
                    </div>
                    <div className="break-words text-base font-bold leading-tight text-white">{race.race_name}</div>
                    <div className="break-words text-sm text-slate-400">
                      {race.circuits?.name} {race.circuits?.emoji}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 lg:justify-end">
                    <div className={`max-w-full rounded-full border px-3 py-1.5 text-left text-[11px] font-bold uppercase leading-4 tracking-[0.14em] sm:tracking-[0.18em] lg:text-right ${getPlatformRaceActionBadgeClasses(actionRow?.actionState || 'done')}`}>
                      {getPlatformRaceActionLabel(actionRow?.actionState || 'done')}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-600 transition-colors group-hover:text-red-500" />
                  </div>
                </PendingLink>
              )
            })
          )}
        </div>
      </details>
    </div>
  )
}
