import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  Crown,
  ShieldCheck,
  Trophy,
  Users,
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
import { GroupInvitePanel } from './group-invite-panel'

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

function getRaceStatusCopy(status: RaceStatus) {
  if (status === 'upcoming') return 'Prediction window is open.'
  if (status === 'locked') return 'Predictions are locked and the weekend is in motion.'
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

function getMemberAccessLabel(member: TenantMember) {
  if (member.role !== 'admin') {
    return 'Tenant member'
  }

  if (member.admin_scope === 'platform') {
    return 'Platform admin'
  }

  return 'Tenant admin'
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
          <div className="text-sm font-bold uppercase tracking-[0.3em] text-amber-300">Tenant Ops</div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white">TENANT ASSIGNMENT REQUIRED</h1>
          <p className="text-slate-300">
            Tenant operations only make sense once this admin account belongs to a tenant competition.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          {access.isPlatformAdmin && (
            <PendingLink
              href="/admin/tenants"
              className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
            >
              Open Tenant Setup
            </PendingLink>
          )}
          <PendingLink
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-colors hover:bg-white/10"
          >
            View Global Leaderboard
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

  const typedTenant = (tenantResult.data as TenantRecord | null) ?? null
  const typedMembers = ((membersResult.data || []) as TenantMember[]).map((member) => ({
    ...member,
    is_test: member.is_test ?? false,
  }))
  const typedRaces = (races || []) as RaceRecord[]
  const memberIds = typedMembers.map((member) => member.id)

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

  const settledRaceIds = typedRaces
    .filter((race) => {
      const status = getEffectiveRaceStatus(race)
      return status === 'locked' || status === 'completed' || status === 'scored'
    })
    .map((race) => race.id)

  const { data: nextRacePredictions } =
    featuredRace && memberIds.length > 0
      ? await supabase
          .from('predictions')
          .select('user_id, race_id')
          .eq('race_id', featuredRace.id)
          .in('user_id', memberIds)
      : { data: [] as PredictionEntry[] }

  const { data: settledPredictions } =
    settledRaceIds.length > 0 && memberIds.length > 0
      ? await supabase
          .from('predictions')
          .select('user_id, race_id')
          .in('race_id', settledRaceIds)
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
    ? 'Invite links need the latest database update before they can be used.'
    : null
  const inviteMigrationNotice =
    !inviteQuery.error && inviteQueryWithToken.error?.message?.includes('share_token')
      ? 'Run the latest database update before creating or re-copying invite links from this screen.'
      : null
  const groupInvites = inviteQuery.error
    ? []
    : ((inviteQuery.data || []) as GroupInviteRecord[]).map((invite) => ({
        ...invite,
        invite_url: invite.share_token ? getAbsoluteUrl(getInvitePath(invite.share_token)) : null,
      }))

  const leaderboard = sortCompetitionStandings((leaderboardRows || []) as LeaderboardEntry[])
  const leaderboardByUserId = new Map(leaderboard.map((entry) => [entry.user_id, entry]))
  const nextRacePredictionUserIds = new Set(
    ((nextRacePredictions || []) as PredictionEntry[]).map((entry) => entry.user_id)
  )
  const tenantAdminCount = typedMembers.filter(
    (member) => member.role === 'admin' && member.admin_scope === 'tenant'
  ).length
  const platformAdminCount = typedMembers.filter(
    (member) => member.role === 'admin' && member.admin_scope === 'platform'
  ).length
  const nextRaceCoverage = featuredRace ? nextRacePredictionUserIds.size : 0
  const missedEntriesCount =
    settledRaceIds.length > 0
      ? settledRaceIds.length * typedMembers.length - ((settledPredictions || []) as PredictionEntry[]).length
      : 0

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
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Link href={access.isPlatformAdmin ? '/admin' : '/leaderboard?view=tenant'} className="inline-flex items-center text-sm font-medium text-slate-400 hover:text-white">
            <ChevronLeft className="mr-1 h-4 w-4" />
            {access.isPlatformAdmin ? 'Back to Race Control' : 'Back to Group Leaderboard'}
          </Link>
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-red-500" />
            <div>
              <h1 className="text-3xl font-black italic tracking-tighter text-red-500">GROUP OPERATIONS</h1>
              <p className="text-slate-400">
                Track submissions, roster health, and standings for {typedTenant?.name || 'your group'} without touching shared race control.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TenantContextBanner tenantName={typedTenant?.name || null} label="Operating in" />
            {typedTenant?.is_test && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-bold uppercase tracking-wider text-amber-200">
                Test group
              </div>
            )}
            {access.isPlatformAdmin ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
                Platform admin mode stays active while you inspect group competition health.
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
                Group admin mode is scoped to this roster, its standings, and weekend participation.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="#group-invites"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-all hover:bg-red-500"
          >
            Create Invite
            <ArrowRight className="h-4 w-4" />
          </a>
          <PendingLink
            href="/leaderboard?view=tenant"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            Open Group Standings
            <ArrowRight className="h-4 w-4" />
          </PendingLink>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Members</div>
          <div className="mt-3 text-4xl font-black italic text-white">{typedMembers.length}</div>
          <p className="mt-2 text-sm text-slate-400">People currently competing in this group.</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Group Admins</div>
          <div className="mt-3 text-4xl font-black italic text-white">{tenantAdminCount}</div>
          <p className="mt-2 text-sm text-slate-400">
            {platformAdminCount > 0
              ? `${platformAdminCount} platform admin(s) also compete here.`
              : 'No platform admins are attached to this group.'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">
            {featuredRace ? 'Group Predictions Submitted' : 'Season Submissions'}
          </div>
          <div className="mt-3 text-4xl font-black italic text-white">
            {featuredRace ? `${nextRaceCoverage}/${typedMembers.length}` : '0/0'}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {featuredRace
              ? `${featuredRace.race_name} entries saved from this group. ${getRaceStatusCopy(getEffectiveRaceStatus(featuredRace))}`
              : 'No race is currently active for this tenant.'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Missed Entries</div>
          <div className="mt-3 text-4xl font-black italic text-white">{missedEntriesCount}</div>
          <p className="mt-2 text-sm text-slate-400">Closed weekends across the season with no submitted entry.</p>
        </div>
      </div>

      <GroupInvitePanel
        groupName={typedTenant?.name || 'your group'}
        invites={groupInvites}
        setupMessage={inviteSetupMessage}
        migrationNotice={inviteMigrationNotice}
      />

      <div className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
          <h2 className="mb-6 flex items-center border-b border-white/5 pb-4 text-2xl font-black italic tracking-tighter">
            <Trophy className="mr-2 h-6 w-6 text-red-500" /> GROUP LEADERBOARD SNAPSHOT
          </h2>

          {leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-slate-400">
              No scored results yet for this group.
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.slice(0, 5).map((entry, index) => {
                const member = typedMembers.find((record) => record.id === entry.user_id)

                return (
                  <div key={entry.user_id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-black/30 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 font-black italic text-white">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-100">
                          {getProfileDisplayName(member?.display_name, member?.email)}
                          {member?.is_test && (
                            <span className="ml-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                              Test
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400">
                          {entry.exact_hits} exact hits · {entry.races_scored} scored races
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black italic text-red-500">{entry.total_points}</div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">points</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
          <h2 className="mb-6 flex items-center border-b border-white/5 pb-4 text-2xl font-black italic tracking-tighter">
            <ShieldCheck className="mr-2 h-6 w-6 text-red-500" /> GROUP HEALTH
          </h2>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/5 bg-black/30 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Current Season</div>
              <div className="mt-2 text-2xl font-bold text-white">Season {currentSeason}</div>
              <p className="mt-2 text-sm text-slate-400">
                {openRaces.length} open, {lockedOrCompletedRaces.length} in flight, {scoredRaces.length} scored.
              </p>
            </div>

            {featuredRace ? (
              <div className="rounded-2xl border border-white/5 bg-black/30 p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Featured Race</div>
                <div className="mt-2 text-xl font-bold text-white">{featuredRace.race_name}</div>
                <p className="mt-1 text-sm text-slate-400">
                  Round {featuredRace.round} · {featuredRace.circuits?.name}, {featuredRace.circuits?.country} {featuredRace.circuits?.emoji}
                </p>
                <p className="mt-3 text-sm text-slate-300">{getRaceStatusCopy(getEffectiveRaceStatus(featuredRace))}</p>
                <PendingLink
                  href={`/race/${featuredRace.id}/predict`}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-bold text-slate-100 transition-colors hover:bg-white/10"
                >
                  Open Race Page
                </PendingLink>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-slate-400">
                No featured race is available right now.
              </div>
            )}

            <div className="rounded-2xl border border-white/5 bg-black/30 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">What Group Admins Watch</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                <li>Roster health and who still needs to enter the next race.</li>
                <li>Missed weekends so the competition stays active.</li>
                <li>Who is leading the tenant season and where momentum is building.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
        <h2 className="mb-6 flex items-center border-b border-white/5 pb-4 text-2xl font-black italic tracking-tighter">
          <Users className="mr-2 h-6 w-6 text-red-500" /> GROUP ROSTER
        </h2>

        {roster.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-slate-400">
            No members are assigned to this group yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm text-slate-400">
                  <th className="p-4 font-bold">Member</th>
                  <th className="p-4 font-bold">Access</th>
                  <th className="p-4 font-bold text-right">Points</th>
                  <th className="p-4 font-bold text-right hidden sm:table-cell">Scored</th>
                  <th className="p-4 font-bold text-right">Featured Race</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {roster.map(({ member, standing, featuredRaceStatus }) => (
                  <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-slate-100">
                        {getProfileDisplayName(member.display_name, member.email)}
                        {member.is_test && (
                          <span className="ml-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                            Test
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-500">{member.email}</div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-slate-200">
                        {member.role === 'admin' ? <Crown className="h-4 w-4 text-red-400" /> : <Users className="h-4 w-4 text-slate-400" />}
                        {getMemberAccessLabel(member)}
                      </div>
                    </td>
                    <td className="p-4 text-right text-xl font-black italic text-red-500">
                      {standing?.total_points ?? 0}
                    </td>
                    <td className="p-4 text-right text-slate-400 hidden sm:table-cell">
                      {standing?.races_scored ?? 0}
                    </td>
                    <td className="p-4 text-right">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-sm font-bold ${
                          featuredRaceStatus === 'Entered' || featuredRaceStatus === 'Locked in' || featuredRaceStatus === 'Scored'
                            ? 'bg-green-500/20 text-green-300'
                            : featuredRaceStatus === 'Needs entry'
                              ? 'bg-amber-500/20 text-amber-300'
                              : featuredRaceStatus.includes('Missed')
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-white/5 text-slate-300'
                        }`}
                      >
                        {featuredRaceStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
