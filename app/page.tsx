import { createClient } from '@/utils/supabase/server'
import { ArrowRight, ChevronRight, Flag, Timer, Trophy } from 'lucide-react'
import { format, isPast } from 'date-fns'
import { getCurrentSeason } from '@/utils/season'
import { getProfileDisplayName } from '@/utils/profile-name'
import { PendingLink } from '@/components/ui/pending-link'
import { getUserTenantContext } from '@/utils/tenant'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getCompetitionRank, sortCompetitionStandings } from '@/utils/competition'
import { getRoundLabel } from '@/utils/race-copy'

export const revalidate = 0

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
      }
    | Array<{
        display_name?: string | null
        email?: string | null
        tenant_id?: string | null
      }>
    | null
}

function getLeaderboardProfile(entry: LeaderboardEntry) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
}

export default async function HomePage() {
  const supabase = await createClient()
  const currentSeason = await getCurrentSeason(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [access, groupContext] = user
    ? await Promise.all([
        getAdminAccessContext(supabase),
        getUserTenantContext(supabase, user.id),
      ])
    : [
        null,
        {
          tenantId: null,
          tenantName: null,
          tenantSlug: null,
          role: null,
        },
      ]

  const hasGroup = Boolean(groupContext.tenantId)
  const activeView = hasGroup && !access?.isPlatformAdmin ? 'group' : 'global'

  const { data: upcomingRaces } = await supabase
    .from('races')
    .select('*, circuits(name, country, emoji)')
    .eq('season', currentSeason)
    .gte('race_start_at', new Date().toISOString())
    .neq('status', 'cancelled')
    .order('race_start_at', { ascending: true })
    .limit(1)

  const nextRace = upcomingRaces?.[0]

  const { data: leaderboard } = await supabase
    .from('leaderboard_cache')
    .select('user_id, total_points, exact_hits, races_scored, profiles(display_name, email, tenant_id)')
    .eq('season', currentSeason)

  const allLeaderboard = sortCompetitionStandings((leaderboard || []) as LeaderboardEntry[])
  const filteredLeaderboard = allLeaderboard.filter((entry) => {
    const profile = getLeaderboardProfile(entry)

    if (activeView !== 'group') return true
    return profile?.tenant_id === groupContext.tenantId
  })
  const featuredLeaderboard = filteredLeaderboard.slice(0, 8)
  const currentUserRank = user ? getCompetitionRank(filteredLeaderboard, user.id) : null
  const currentUserEntry = user
    ? filteredLeaderboard.find((entry) => entry.user_id === user.id) || null
    : null

  const { data: latestScoredRaces } = await supabase
    .from('races')
    .select('*, circuits(name, country, emoji)')
    .eq('season', currentSeason)
    .eq('status', 'scored')
    .order('race_start_at', { ascending: false })
    .limit(1)

  const latestScored = latestScoredRaces?.[0]

  const standingsTitle =
    activeView === 'group' && groupContext.tenantName
      ? `${groupContext.tenantName} standings`
      : 'Season standings'

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black shadow-2xl">
        <div className="absolute -right-10 top-0 p-12 opacity-10 pointer-events-none">
          <Trophy className="h-52 w-52 text-red-500" />
        </div>

        <div className="relative space-y-5 p-6 md:p-8 lg:p-9">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-sm font-bold uppercase tracking-wider text-red-300">
              Season {currentSeason}
            </span>
            {activeView === 'group' && groupContext.tenantName && (
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-slate-200">
                Playing in {groupContext.tenantName}
              </span>
            )}
          </div>

          <div className="space-y-3">
            <h1 className="text-4xl font-black italic tracking-tighter md:text-5xl">{standingsTitle}</h1>

            {user && currentUserRank && currentUserEntry ? (
              <div className="flex flex-wrap gap-3 text-sm font-bold uppercase tracking-widest text-slate-200">
                <span className="rounded-full border border-white/10 bg-black/30 px-4 py-2">
                  #{currentUserRank} · {currentUserEntry.total_points} pts · {currentUserEntry.exact_hits} exact
                </span>
              </div>
            ) : (
              <div className="text-sm font-medium text-slate-400">Lock: FP1 - 5m</div>
            )}
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/35 p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-sm font-bold uppercase tracking-widest text-slate-500">Leaderboard</div>
              <PendingLink
                href={activeView === 'group' ? '/leaderboard?view=tenant' : '/leaderboard?view=global'}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Full leaderboard
                <ArrowRight className="h-4 w-4" />
              </PendingLink>
            </div>

            <div className="space-y-3">
              {featuredLeaderboard.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm italic text-slate-500">
                  No standings yet.
                </div>
              ) : (
                featuredLeaderboard.map((entry, index) => {
                  const profile = getLeaderboardProfile(entry)
                  const isCurrentUser = entry.user_id === user?.id

                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 transition-colors ${
                        index === 0
                          ? 'border-yellow-500/25 bg-yellow-500/10'
                          : isCurrentUser
                            ? 'border-red-500/20 bg-red-500/10'
                            : 'border-white/5 bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/40 text-base font-black italic text-white">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-lg font-semibold text-white">
                            {getProfileDisplayName(profile?.display_name, profile?.email)}
                            {isCurrentUser && (
                              <span className="ml-2 rounded-full border border-red-500/25 bg-red-500/15 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-red-300">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-slate-400">
                            {entry.exact_hits} exact · {entry.races_scored} races
                          </div>
                        </div>
                      </div>

                      <div className="text-right text-2xl font-black italic text-red-500">{entry.total_points}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {user ? (
              <>
                <PendingLink
                  href={activeView === 'group' ? '/leaderboard?view=tenant' : '/leaderboard?view=global'}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-all hover:bg-red-500"
                >
                  Standings
                  <ChevronRight className="h-5 w-5" />
                </PendingLink>
                <PendingLink
                  href="/predictions"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-white transition-colors hover:bg-white/10"
                >
                  My season
                </PendingLink>
              </>
            ) : (
              <>
                <PendingLink
                  href="/signup"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-all hover:bg-red-500"
                >
                  Join now
                  <ChevronRight className="h-5 w-5" />
                </PendingLink>
                <PendingLink
                  href="/season"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-white transition-colors hover:bg-white/10"
                >
                  Season
                </PendingLink>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-red-400">
            <Flag className="h-4 w-4" /> Next Race
          </div>

          {nextRace ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                  {getRoundLabel(nextRace.round)}
                </div>
                <h2 className="text-3xl font-black italic tracking-tight text-white">{nextRace.race_name}</h2>
                <p className="mt-1 text-slate-400">
                  {nextRace.circuits?.emoji} {nextRace.circuits?.name}, {nextRace.circuits?.country}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                  <div className="mb-1 flex items-center text-xs font-bold uppercase tracking-widest text-slate-500">
                    <Timer className="mr-1 h-3.5 w-3.5 text-red-400" /> Race Start
                  </div>
                  <div className="font-semibold text-white">{format(new Date(nextRace.race_start_at), 'PPP p')}</div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                  <div className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">
                    Lock (FP1 - 5m)
                  </div>
                  <div
                    className={`font-semibold ${
                      isPast(new Date(nextRace.prediction_lock_at)) ? 'text-red-400' : 'text-amber-300'
                    }`}
                  >
                    {format(new Date(nextRace.prediction_lock_at), 'PPP p')}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <PendingLink
                  href={user ? `/race/${nextRace.id}/predict` : `/race/${nextRace.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
                >
                  {user ? 'Predict' : 'Race'}
                  <ChevronRight className="h-5 w-5" />
                </PendingLink>
                <PendingLink
                  href="/season"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition-colors hover:bg-white/10"
                >
                  Season
                  <ArrowRight className="h-4 w-4" />
                </PendingLink>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-slate-500">
              No upcoming race.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-xl">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
            <Trophy className="h-4 w-4 text-yellow-500" /> Latest Results
          </div>

          {latestScored ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                  {getRoundLabel(latestScored.round)}
                </div>
                <h2 className="mt-2 text-3xl font-black italic tracking-tight text-white">
                  {latestScored.race_name}
                </h2>
                <p className="mt-1 text-slate-400">
                  {latestScored.circuits?.emoji} {latestScored.circuits?.name}, {latestScored.circuits?.country}
                </p>
              </div>

              <div className="flex flex-wrap gap-4 pt-1">
                <PendingLink
                  href={`/race/${latestScored.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white transition-colors hover:bg-white/10"
                >
                  Recap
                  <ArrowRight className="h-4 w-4" />
                </PendingLink>
                <PendingLink
                  href="/season"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-bold text-white transition-colors hover:bg-white/10"
                >
                  Season
                </PendingLink>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-slate-500">
              No results yet.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
