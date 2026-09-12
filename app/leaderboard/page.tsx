import { ArrowRight, Trophy, UsersRound } from 'lucide-react'
import { getCurrentSeason } from '@/utils/season'
import { getRequestUserContext } from '@/utils/request-context'
import { getProfileDisplayName } from '@/utils/profile-name'
import { getCompetitionRank, sortCompetitionStandings } from '@/utils/competition'
import { PendingLink } from '@/components/ui/pending-link'
import { ShareImageActions, type StandingsShareCardData } from '@/components/ui/share-image-actions'
import { LeaderboardEntryDetails } from '@/components/ui/leaderboard-entry-details'
import { isTestModeProfile } from '@/utils/test-mode'

export const revalidate = 0

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
  profiles?:
    | {
        display_name?: string | null
        email?: string | null
        tenant_id?: string | null
        is_test?: boolean | null
        tenants?: { is_test?: boolean | null } | Array<{ is_test?: boolean | null }> | null
      }
    | Array<{
        display_name?: string | null
        email?: string | null
        tenant_id?: string | null
        is_test?: boolean | null
        tenants?: { is_test?: boolean | null } | Array<{ is_test?: boolean | null }> | null
      }>
    | null
}

function getLeaderboardProfile(entry: LeaderboardEntry) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
}

const summaryGridTemplate = '4rem minmax(0,1fr) 5.5rem 5.5rem 5.5rem 1.5rem'

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const { supabase, user, tenantContext: groupContext } = await getRequestUserContext()
  const currentSeason = await getCurrentSeason(supabase)
  const query = await searchParams
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view

  const hasGroup = Boolean(groupContext.tenantId)
  const defaultView = hasGroup ? 'tenant' : 'global'
  const activeView =
    requestedView === 'global'
      ? 'global'
      : requestedView === 'tenant' && hasGroup
        ? 'tenant'
        : defaultView

  const leaderboardWithTestMode = await supabase
    .from('leaderboard_cache')
    .select('user_id, total_points, exact_hits, races_scored, profiles(display_name, email, tenant_id, is_test, tenants(is_test))')
    .eq('season', currentSeason)

  const leaderboardResult = leaderboardWithTestMode.error?.message?.includes('is_test')
    ? await supabase
        .from('leaderboard_cache')
        .select('user_id, total_points, exact_hits, races_scored, profiles(display_name, email, tenant_id)')
        .eq('season', currentSeason)
    : leaderboardWithTestMode
  const testModeFilterAvailable = !leaderboardWithTestMode.error

  if (leaderboardResult.error) {
    console.error('Error fetching leaderboard:', leaderboardResult.error)
  }

  const visibleLeaderboard = ((leaderboardResult.data || []) as LeaderboardEntry[]).filter((entry) => {
    const profile = getLeaderboardProfile(entry)

    if (activeView !== 'tenant') return testModeFilterAvailable ? !isTestModeProfile(profile) : true
    return profile?.tenant_id === groupContext.tenantId
  })

  const sortedVisibleLeaderboard = sortCompetitionStandings(visibleLeaderboard)
  const currentUserRank = user ? getCompetitionRank(sortedVisibleLeaderboard, user.id) : null
  const currentUserEntry = user
    ? sortedVisibleLeaderboard.find((entry) => entry.user_id === user.id) || null
    : null
  const leaderPoints = sortedVisibleLeaderboard[0]?.total_points ?? 0
  const pointsBehindLeader =
    currentUserEntry && currentUserRank !== 1 ? leaderPoints - currentUserEntry.total_points : 0

  const leaderboardTitle =
    activeView === 'tenant' && groupContext.tenantName
      ? `${groupContext.tenantName.toUpperCase()} STANDINGS`
      : 'SEASON STANDINGS'
  const scoredRaceCount = sortedVisibleLeaderboard[0]?.races_scored ?? 0
  const standingsShareCard: StandingsShareCardData | null =
    sortedVisibleLeaderboard.length > 0
      ? {
          kind: 'standings',
          season: currentSeason,
          title:
            activeView === 'tenant' && groupContext.tenantName
              ? groupContext.tenantName
              : 'Season standings',
          subtitle:
            activeView === 'tenant' && groupContext.tenantName
              ? `${groupContext.tenantName} private table`
              : 'Global season table',
          caption: `${sortedVisibleLeaderboard.length} player${sortedVisibleLeaderboard.length === 1 ? '' : 's'}`,
          footer:
            currentUserRank && currentUserEntry && currentUserRank > 5
              ? `You are #${currentUserRank} with ${currentUserEntry.total_points} pts after ${scoredRaceCount} scored races.`
              : `After ${scoredRaceCount} scored race${scoredRaceCount === 1 ? '' : 's'}.`,
          entries: sortedVisibleLeaderboard.slice(0, 5).map((entry, index) => {
            const profile = getLeaderboardProfile(entry)

            return {
              rank: index + 1,
              name: getProfileDisplayName(profile?.display_name, profile?.email),
              points: entry.total_points,
              exactHits: entry.exact_hits,
              highlight: entry.user_id === user?.id,
            }
          }),
        }
      : null

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <Trophy className="h-10 w-10 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter">{leaderboardTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end">
          {hasGroup && (
            <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
              <PendingLink
                href="/leaderboard?view=tenant"
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  activeView === 'tenant' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                My Group
              </PendingLink>
              <PendingLink
                href="/leaderboard?view=global"
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                  activeView === 'global' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                Everyone
              </PendingLink>
            </div>
          )}

          {standingsShareCard && (
            <ShareImageActions
              title="Share standings card"
              description="Creates a polished PNG you can paste straight into group chats, stories, or social posts."
              fileName={`flormula1-${activeView === 'tenant' ? 'group' : 'season'}-standings-${currentSeason}.png`}
              data={standingsShareCard}
            />
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user && currentUserRank && currentUserEntry && (
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-200">
            #{currentUserRank} · {currentUserEntry.total_points} pts ·{' '}
            {currentUserRank === 1 ? 'Leading' : `${pointsBehindLeader} behind`}
          </span>
        )}

        {!user && sortedVisibleLeaderboard.length > 0 && (
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-300">
            {sortedVisibleLeaderboard.length} players
          </span>
        )}
      </div>

      {user && groupContext.role === 'user' && groupContext.tenantSlug === 'main' && (
        <section className="flex flex-col gap-3 rounded-2xl border border-red-500/15 bg-red-500/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <UsersRound className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
            <div>
              <div className="font-bold text-white">Want a private standings table?</div>
              <p className="mt-1 text-sm leading-6 text-red-100/75">
                Request a group, then invite people after a platform admin approves it.
              </p>
            </div>
          </div>
          <PendingLink
            href="/groups/request"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-500"
          >
            Start a private group
            <ArrowRight className="h-4 w-4" />
          </PendingLink>
        </section>
      )}

      {sortedVisibleLeaderboard.length > 0 && (
        <div className="text-xs text-slate-500">Click a player to inspect scored weekends.</div>
      )}

      {sortedVisibleLeaderboard.length > 0 && (
        <div
          className="hidden w-full items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 lg:grid"
          style={{ gridTemplateColumns: summaryGridTemplate }}
        >
          <div>Rank</div>
          <div className="min-w-0">Player</div>
          <div className="text-right">Points</div>
          <div className="text-right">Exact</div>
          <div className="text-right">Races</div>
          <div />
        </div>
      )}

      <div className="space-y-3">
        {sortedVisibleLeaderboard.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-8 text-center text-slate-500 italic shadow-xl">
            No predictions scored yet.
          </div>
        ) : (
          sortedVisibleLeaderboard.map((entry, index) => {
            const profile = getLeaderboardProfile(entry)
            const isCurrentUser = entry.user_id === user?.id

            return (
              <LeaderboardEntryDetails
                key={entry.user_id}
                userId={entry.user_id}
                season={currentSeason}
                view={activeView}
                rank={index + 1}
                name={getProfileDisplayName(profile?.display_name, profile?.email)}
                totalPoints={entry.total_points}
                exactHits={entry.exact_hits}
                racesScored={entry.races_scored}
                isCurrentUser={isCurrentUser}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
