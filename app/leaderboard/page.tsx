import { createClient } from '@/utils/supabase/server'
import { Trophy, Medal } from 'lucide-react'
import { getCurrentSeason } from '@/utils/season'
import { getUserTenantContext } from '@/utils/tenant'
import { getAdminAccessContext } from '@/utils/admin-access'
import { TenantContextBanner } from '@/components/ui/tenant-context-banner'
import { getProfileDisplayName } from '@/utils/profile-name'
import { sortCompetitionStandings, getCompetitionRank } from '@/utils/competition'
import { PendingLink } from '@/components/ui/pending-link'

export const revalidate = 0 // always fetch fresh data for leaderboard

type LeaderboardPageProps = {
  searchParams: Promise<{
    view?: string | string[] | undefined
  }>
}

type LeaderboardEntry = {
  user_id: string
  total_points: number
  exact_hits: number
  races_scored: number
  profiles?: {
    display_name?: string | null
    email?: string | null
    tenant_id?: string | null
  } | Array<{
    display_name?: string | null
    email?: string | null
    tenant_id?: string | null
  }> | null
}

function getLeaderboardProfile(entry: LeaderboardEntry) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const supabase = await createClient()
  const currentSeason = await getCurrentSeason(supabase)
  const query = await searchParams
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view
  const { data: { user } } = await supabase.auth.getUser()
  const access = user ? await getAdminAccessContext(supabase) : null
  const tenantContext = user ? await getUserTenantContext(supabase, user.id) : {
    tenantId: null,
    tenantName: null,
    tenantSlug: null,
    role: null,
  }
  const canUseTenantView = Boolean(tenantContext.tenantId)
  const defaultView = canUseTenantView && !access?.isPlatformAdmin ? 'tenant' : 'global'
  const activeView =
    requestedView === 'global'
      ? 'global'
      : requestedView === 'tenant' && canUseTenantView
        ? 'tenant'
        : defaultView

  // Fetch from the leaderboard cache or calculate. For v1, let's fetch from the cache.
  // Wait, we need to join with profiles to get display_name.
  
  const { data: leaderboard, error } = await supabase
    .from('leaderboard_cache')
    .select(`
      user_id,
      total_points,
      exact_hits,
      races_scored,
      profiles ( display_name, email, tenant_id )
    `)
    .eq('season', currentSeason)
    .order('total_points', { ascending: false })
    .order('exact_hits', { ascending: false })

  if (error) {
    console.error('Error fetching leaderboard:', error)
  }

  const visibleLeaderboard = (leaderboard || []).filter((entry: LeaderboardEntry) => {
    const profile = getLeaderboardProfile(entry)

    if (activeView !== 'tenant') return true
    return profile?.tenant_id === tenantContext.tenantId
  })
  const sortedVisibleLeaderboard = sortCompetitionStandings(visibleLeaderboard as LeaderboardEntry[])
  const currentUserRank = user ? getCompetitionRank(sortedVisibleLeaderboard, user.id) : null
  const currentUserEntry = user
    ? sortedVisibleLeaderboard.find((entry) => entry.user_id === user.id) || null
    : null
  const leaderPoints = sortedVisibleLeaderboard[0]?.total_points ?? 0
  const pointsBehindLeader =
    currentUserEntry && currentUserRank !== 1 ? leaderPoints - currentUserEntry.total_points : 0

  const leaderboardTitle = activeView === 'tenant' && tenantContext.tenantName
    ? `${tenantContext.tenantName.toUpperCase()} LEADERBOARD`
    : 'GLOBAL LEADERBOARD'
  const leaderboardSubtitle = activeView === 'tenant'
    ? 'See who is leading inside your tenant competition.'
    : canUseTenantView
      ? 'Compare your tenant results against the full cross-tenant field.'
      : 'See who is predicting the podium best across every tenant.'

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center space-x-4">
        <Trophy className="w-10 h-10 text-yellow-500" />
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter">{leaderboardTitle}</h1>
          <p className="text-slate-400">{leaderboardSubtitle}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {canUseTenantView && (
            <TenantContextBanner
              tenantName={tenantContext.tenantName}
              label={activeView === 'tenant' ? 'Viewing' : 'Your tenant'}
            />
          )}

          {user && !canUseTenantView && !access?.isPlatformAdmin && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300">
              You can browse the global leaderboard while waiting for tenant assignment.
            </div>
          )}

          {access?.isPlatformAdmin && (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200">
              {canUseTenantView
                ? 'Platform admins default to the global leaderboard, but can still switch into their tenant competition.'
                : 'Platform admins default to the global leaderboard so race control stays cross-tenant.'}
            </div>
          )}
        </div>

        {canUseTenantView && (
          <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
            <PendingLink
              href="/leaderboard?view=tenant"
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeView === 'tenant'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              My Tenant
            </PendingLink>
            <PendingLink
              href="/leaderboard?view=global"
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeView === 'global'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Global
            </PendingLink>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Your Position</div>
          <div className="mt-3 text-4xl font-black italic text-white">
            {currentUserRank ? `#${currentUserRank}` : 'N/A'}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {user
              ? activeView === 'tenant'
                ? 'Your standing inside this tenant competition.'
                : 'Your standing across every tenant in the app.'
              : 'Sign in to see your place in the standings.'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Predictors In View</div>
          <div className="mt-3 text-4xl font-black italic text-white">{sortedVisibleLeaderboard.length}</div>
          <p className="mt-2 text-sm text-slate-400">
            {activeView === 'tenant'
              ? 'Only members from your tenant are counted here.'
              : 'Everyone with scored results across all tenants.'}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-5 shadow-xl">
          <div className="text-sm font-bold uppercase tracking-wider text-slate-500">
            {currentUserRank && currentUserRank !== 1 ? 'Gap To Lead' : 'Leader Points'}
          </div>
          <div className="mt-3 text-4xl font-black italic text-red-500">
            {currentUserRank && currentUserRank !== 1 ? pointsBehindLeader : leaderPoints}
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {currentUserRank && currentUserRank !== 1
              ? 'Points needed to catch the leader in this view.'
              : 'Current pace at the top of this leaderboard.'}
          </p>
        </div>
      </div>

      <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black/20 border-b border-white/5">
                <th className="p-4 font-semibold text-slate-300 w-16 text-center">Rank</th>
                <th className="p-4 font-semibold text-slate-300">Predictor</th>
                <th className="p-4 font-semibold text-slate-300 text-right">Points</th>
                <th className="p-4 font-semibold text-slate-300 text-right hidden sm:table-cell">Exact Hits</th>
                <th className="p-4 font-semibold text-slate-300 text-right hidden sm:table-cell">Races</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedVisibleLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    No predictions scored yet. The season is waiting!
                  </td>
                </tr>
              ) : (
                sortedVisibleLeaderboard.map((entry: LeaderboardEntry, index: number) => {
                  const profile = getLeaderboardProfile(entry)

                  return (
                    <tr key={entry.user_id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-center font-bold text-lg">
                      {index === 0 ? <Medal className="w-6 h-6 text-yellow-500 mx-auto" /> :
                       index === 1 ? <Medal className="w-6 h-6 text-slate-300 mx-auto" /> :
                       index === 2 ? <Medal className="w-6 h-6 text-amber-600 mx-auto" /> :
                       <span className="text-slate-500">{index + 1}</span>}
                    </td>
                    <td className="p-4">
                      <div className="font-semibold">
                        {getProfileDisplayName(profile?.display_name, profile?.email)}
                      </div>
                    </td>
                    <td className="p-4 text-right font-black text-xl text-red-500">
                      {entry.total_points}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-400 hidden sm:table-cell">
                      {entry.exact_hits}
                    </td>
                    <td className="p-4 text-right text-slate-400 hidden sm:table-cell">
                      {entry.races_scored}
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
