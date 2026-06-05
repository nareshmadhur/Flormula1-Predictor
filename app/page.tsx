import type { Metadata } from 'next'
import { createClient } from '@/utils/supabase/server'
import { ArrowRight, ChevronRight, Flag, Gauge, Timer, Trophy, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { differenceInCalendarDays, format, isPast } from 'date-fns'
import { getCurrentSeason } from '@/utils/season'
import { getProfileDisplayName } from '@/utils/profile-name'
import { PendingLink } from '@/components/ui/pending-link'
import { getUserTenantContext } from '@/utils/tenant'
import { getCompetitionRank, sortCompetitionStandings } from '@/utils/competition'
import { getRoundLabel } from '@/utils/race-copy'
import { SectionHeader } from '@/components/ui/section-header'
import { RaceMetaStrip } from '@/components/ui/race-meta-strip'
import { isTestModeProfile } from '@/utils/test-mode'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { getRaceStatusLabel } from '@/utils/race-experience'
import { getRaceFocus } from '@/utils/race-focus'

export const revalidate = 0

export const metadata: Metadata = {
  title: 'Predict the Podium',
  description:
    'A free Formula 1 fan scoreboard for private groups: make podium picks, follow race results, and compare season standings. No betting, wagers, or cash prizes.',
  openGraph: {
    title: 'FLORMULA1 - Predict the Podium',
    description:
      'Run a free Formula 1 podium prediction league for private groups. No betting, wagers, or cash prizes.',
  },
  twitter: {
    title: 'FLORMULA1 - Predict the Podium',
    description:
      'Run a free Formula 1 podium prediction league for private groups. No betting, wagers, or cash prizes.',
  },
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

type RaceSummary = {
  id: string
  race_name: string
  round: number | null
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  circuits?: {
    name?: string | null
    country?: string | null
    emoji?: string | null
  } | null
}

type LandingFeature = {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  tone: string
}

const landingFeatures: LandingFeature[] = [
  {
    eyebrow: 'Private groups',
    title: 'Private grids',
    description: 'Create a private group table.',
    icon: Users,
    tone: 'text-cyan-300',
  },
  {
    eyebrow: 'Race weekend',
    title: 'Race-weekend picks',
    description: 'Pick the top three before lock.',
    icon: Flag,
    tone: 'text-red-300',
  },
  {
    eyebrow: 'Standings',
    title: 'Live season table',
    description: 'Track points, exact hits, and gaps.',
    icon: Gauge,
    tone: 'text-emerald-300',
  },
]

function getLeaderboardProfile(entry: LeaderboardEntry) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
}

function VisitorLandingHero({
  currentSeason,
  nextRace,
  featuredLeaderboard,
}: {
  currentSeason: number
  nextRace?: RaceSummary | null
  featuredLeaderboard: LeaderboardEntry[]
}) {
  const previewStandings = featuredLeaderboard.slice(0, 3)
  const raceLabel = nextRace?.round ? getRoundLabel(nextRace.round) : `Season ${currentSeason}`
  const raceTitle = nextRace?.race_name || 'Race weekend ready'
  const raceVenue = nextRace?.circuits
    ? `${nextRace.circuits.emoji || ''} ${nextRace.circuits.name || 'Circuit'}, ${nextRace.circuits.country || 'TBA'}`
    : 'Calendar, picks, and standings in one place'

  return (
    <section className="f1-landing-scene relative overflow-hidden rounded-lg border border-white/10 px-5 py-5 shadow-2xl md:px-8 md:py-7 lg:px-10">
      <div aria-hidden="true" className="f1-hero-vignette" />
      <div aria-hidden="true" className="f1-track-ribbon" />
      <div aria-hidden="true" className="f1-speed-bands" />

      <div className="relative z-10 flex min-h-[500px] flex-col justify-between gap-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-lg border border-red-400/35 bg-red-500/15 px-3 py-1.5 text-xs font-bold uppercase text-red-100">
            Season {currentSeason}
          </span>
          <span className="inline-flex items-center rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase text-slate-100">
            Private leagues
          </span>
          <span className="f1-start-gantry ml-auto hidden items-center gap-1 rounded-lg border border-white/10 bg-black/35 px-3 py-1.5 md:inline-flex">
            {[0, 1, 2, 3, 4].map((light) => (
              <span key={light} className="f1-gantry-light h-2.5 w-2.5 rounded-full" />
            ))}
          </span>
        </div>

        <div className="f1-hero-copy max-w-4xl space-y-5 py-5 md:py-8">
          <div className="text-xs font-black uppercase text-red-200">Race control for private leagues</div>
          <h1 className="f1-hero-title max-w-4xl text-4xl font-black italic leading-[0.98] text-white sm:text-5xl md:text-6xl">
            Predict F1 podiums with your friends.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-200 md:text-lg">
            Make your top-three call, follow the result, and track your private season table.
          </p>

          <div className="flex flex-wrap gap-3">
            <PendingLink
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
            >
              Join the grid
              <ChevronRight className="h-5 w-5" />
            </PendingLink>
            <PendingLink
              href="/season"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/35 px-5 py-3 font-bold text-white transition-colors hover:bg-white/10"
            >
              View season
              <ArrowRight className="h-4 w-4" />
            </PendingLink>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.05fr_1fr]">
          <div className="rounded-lg border border-white/10 bg-black/45 p-4 shadow-xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase text-red-300">{raceLabel}</div>
                <div className="mt-1 text-xl font-black italic text-white">{raceTitle}</div>
              </div>
              <Timer className="h-7 w-7 shrink-0 text-cyan-300" />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[10px] font-bold uppercase text-slate-500">Race weekend</div>
                <div className="mt-2 text-sm font-semibold text-slate-100">{raceVenue}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <div className="text-[10px] font-bold uppercase text-slate-500">Prediction lock</div>
                <div className="mt-2 text-sm font-semibold text-slate-100">
                  {nextRace ? format(new Date(nextRace.prediction_lock_at), 'EEE d MMM, p') : 'Before FP1'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/45 p-4 shadow-xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase text-slate-500">Season table</div>
                <div className="mt-1 text-xl font-black italic text-white">Standings preview</div>
              </div>
              <Trophy className="h-7 w-7 shrink-0 text-amber-300" />
            </div>
            <div className="space-y-2">
              {previewStandings.length > 0 ? (
                previewStandings.map((entry, index) => {
                  const profile = getLeaderboardProfile(entry)

                  return (
                    <div
                      key={entry.user_id}
                      className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-black italic text-white">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">
                          {getProfileDisplayName(profile?.display_name, profile?.email)}
                        </div>
                        <div className="text-xs text-slate-500">{entry.exact_hits} exact hits</div>
                      </div>
                      <div className="text-right text-lg font-black italic text-red-400">{entry.total_points}</div>
                    </div>
                  )
                })
              ) : (
                ['Pole picker', 'Late braker', 'Pit wall'].map((label, index) => (
                  <div
                    key={label}
                    className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-black italic text-white">
                      {index + 1}
                    </div>
                    <div className="text-sm font-bold text-white">{label}</div>
                    <div className="text-right text-lg font-black italic text-red-400">0</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LandingPurposeGrid() {
  return (
    <section className="grid gap-3 md:grid-cols-3" aria-label="What FLORMULA1 does">
      {landingFeatures.map((feature) => {
        const Icon = feature.icon

        return (
          <div key={feature.title} className="f1-feature-card rounded-lg border border-white/10 bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-black uppercase text-slate-500">{feature.eyebrow}</span>
              <Icon className={`h-6 w-6 ${feature.tone}`} />
            </div>
            <h2 className="mt-5 text-lg font-black italic text-white">{feature.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p>
          </div>
        )
      })}
    </section>
  )
}

export default async function HomePage() {
  const supabase = await createClient()
  const currentSeason = await getCurrentSeason(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const groupContext = user
    ? await getUserTenantContext(supabase, user.id)
    : {
        tenantId: null,
        tenantName: null,
        tenantSlug: null,
        role: null,
      }

  const hasGroup = Boolean(groupContext.tenantId)
  const activeView = hasGroup ? 'group' : 'global'

  const { data: seasonRaces } = await supabase
    .from('races')
    .select('*, circuits(name, country, emoji)')
    .eq('season', currentSeason)
    .neq('status', 'cancelled')
    .order('race_start_at', { ascending: true })

  const raceFocus = getRaceFocus((seasonRaces || []) as RaceSummary[])
  const currentWeekendRace = raceFocus.currentWeekend
  const nextRace = raceFocus.nextOpenRace
  const focusRace = raceFocus.primaryRace
  const focusRaceStatus = focusRace ? getEffectiveRaceStatus(focusRace) : null

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

  const allLeaderboard = sortCompetitionStandings((leaderboardResult.data || []) as LeaderboardEntry[])
  const filteredLeaderboard = allLeaderboard.filter((entry) => {
    const profile = getLeaderboardProfile(entry)

    if (activeView !== 'group') return testModeFilterAvailable ? !isTestModeProfile(profile) : true
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
  const showLatestRecapFirst = Boolean(
    user &&
      latestScored &&
      differenceInCalendarDays(new Date(), new Date(latestScored.race_start_at)) <= 7
  )

  const standingsTitle =
    activeView === 'group' && groupContext.tenantName
      ? `${groupContext.tenantName} standings`
      : 'Season standings'

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      {user ? (
        <section className="relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black shadow-2xl">
          <div className="pointer-events-none absolute -right-10 top-0 p-12 opacity-10">
            <Trophy className="h-52 w-52 text-red-500" />
          </div>

          <div className="relative space-y-5 p-6 md:p-8 lg:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-lg border border-red-500/30 bg-red-500/15 px-3 py-1 text-sm font-bold uppercase text-red-300">
                Season {currentSeason}
              </span>
              {activeView === 'group' && groupContext.tenantName && (
                <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm font-medium text-slate-200">
                  Playing in {groupContext.tenantName}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1.5">
                <h1 className="text-2xl font-black italic text-white md:text-3xl">{standingsTitle}</h1>
                {showLatestRecapFirst && (
                  <p className="max-w-2xl text-sm text-slate-400">Latest result is ready.</p>
                )}
              </div>
              {currentUserRank && currentUserEntry && (
                <div className="flex flex-wrap gap-3 text-sm font-bold uppercase text-slate-200">
                  <span className="rounded-lg border border-white/10 bg-black/30 px-4 py-2">
                    #{currentUserRank} · {currentUserEntry.total_points} pts · {currentUserEntry.exact_hits} exact
                  </span>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-white/10 bg-black/35 p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="text-sm font-bold uppercase text-slate-500">Leaderboard</div>
                <PendingLink
                  href={activeView === 'group' ? '/leaderboard?view=tenant' : '/leaderboard?view=global'}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  Full leaderboard
                  <ArrowRight className="h-4 w-4" />
                </PendingLink>
              </div>

              <div className="space-y-3">
                {featuredLeaderboard.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/10 px-5 py-8 text-center text-sm italic text-slate-500">
                    No standings yet.
                  </div>
                ) : (
                  featuredLeaderboard.map((entry, index) => {
                    const profile = getLeaderboardProfile(entry)
                    const isCurrentUser = entry.user_id === user.id

                    return (
                      <div
                        key={entry.user_id}
                        className={`flex items-center justify-between gap-4 rounded-lg border px-4 py-4 transition-colors ${
                          index === 0
                            ? 'border-yellow-500/25 bg-yellow-500/10'
                            : isCurrentUser
                              ? 'border-red-500/20 bg-red-500/10'
                              : 'border-white/5 bg-white/[0.03]'
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-4">
                          <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-base font-black italic text-white">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-lg font-semibold text-white">
                              {getProfileDisplayName(profile?.display_name, profile?.email)}
                              {isCurrentUser && (
                                <span className="ml-2 rounded-lg border border-red-500/25 bg-red-500/15 px-2 py-0.5 text-xs font-bold uppercase text-red-300">
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
              {showLatestRecapFirst && latestScored ? (
                <>
                  <PendingLink
                    href={`/race/${latestScored.id}/predict`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
                  >
                    Latest recap
                    <ChevronRight className="h-5 w-5" />
                  </PendingLink>
                  <PendingLink
                    href="/predictions"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-5 py-3 font-bold text-white transition-colors hover:bg-white/10"
                  >
                    My Race
                  </PendingLink>
                </>
              ) : (
                <>
                  <PendingLink
                    href="/predictions"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
                  >
                    My Race
                    <ChevronRight className="h-5 w-5" />
                  </PendingLink>
                  <PendingLink
                    href={activeView === 'group' ? '/leaderboard?view=tenant' : '/leaderboard?view=global'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-5 py-3 font-bold text-white transition-colors hover:bg-white/10"
                  >
                    Standings
                  </PendingLink>
                </>
              )}
            </div>
          </div>
        </section>
      ) : (
        <>
          <VisitorLandingHero
            currentSeason={currentSeason}
            nextRace={nextRace}
            featuredLeaderboard={featuredLeaderboard}
          />
          <LandingPurposeGrid />
        </>
      )}

      <div className="space-y-4">
        <section className={`rounded-3xl border border-white/10 bg-card p-6 shadow-xl ${showLatestRecapFirst ? 'order-2' : ''}`}>
          <SectionHeader
            eyebrow={currentWeekendRace ? 'Race weekend' : 'Next race'}
            title={currentWeekendRace ? 'This weekend' : 'Next race'}
          />

          {focusRace && focusRaceStatus ? (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-red-500">
                  {focusRace.round ? getRoundLabel(focusRace.round) : `Season ${currentSeason}`}
                </div>
                <h2 className="text-3xl font-black italic tracking-tight text-white">{focusRace.race_name}</h2>
                <p className="mt-1 text-slate-400">
                  {focusRace.circuits?.emoji} {focusRace.circuits?.name}, {focusRace.circuits?.country}
                </p>
              </div>

              <RaceMetaStrip
                items={[
                  {
                    label: 'Status',
                    value: getRaceStatusLabel(focusRaceStatus),
                    tone:
                      focusRaceStatus === 'upcoming'
                        ? 'open'
                        : focusRaceStatus === 'scored'
                          ? 'scored'
                          : 'pending',
                    icon: Timer,
                  },
                  {
                    label: focusRaceStatus === 'upcoming' ? 'Lock' : 'Race',
                    value: format(
                      new Date(
                        focusRaceStatus === 'upcoming'
                          ? focusRace.prediction_lock_at
                          : focusRace.race_start_at
                      ),
                      'PPP p'
                    ),
                    tone: focusRaceStatus === 'upcoming' && !isPast(new Date(focusRace.prediction_lock_at)) ? 'open' : 'pending',
                  },
                ]}
              />

              <div className="flex flex-wrap gap-4 pt-1">
                <PendingLink
                  href={user ? `/race/${focusRace.id}/predict` : `/race/${focusRace.id}`}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
                >
                  {focusRaceStatus === 'upcoming' ? (user ? 'Predict' : 'Race') : 'Track weekend'}
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

              {currentWeekendRace && nextRace && nextRace.id !== focusRace.id && (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Up next</div>
                  <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-bold text-white">{nextRace.race_name}</div>
                      <p className="mt-1 text-sm text-slate-400">
                        Entries close {format(new Date(nextRace.prediction_lock_at), 'EEE d MMM, p')}.
                      </p>
                    </div>
                    <PendingLink
                      href={user ? `/race/${nextRace.id}/predict` : `/race/${nextRace.id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-white/10"
                    >
                      {user ? 'Predict' : 'Race'}
                      <ChevronRight className="h-4 w-4" />
                    </PendingLink>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-slate-500">
              No race weekend scheduled.
            </div>
          )}
        </section>

        <section className={`rounded-3xl border border-white/10 bg-card p-6 shadow-xl ${showLatestRecapFirst ? 'order-1' : ''}`}>
          <SectionHeader eyebrow="Latest results" title="Latest results" />

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
                  href={user ? `/race/${latestScored.id}/predict` : `/race/${latestScored.id}#top-scorers`}
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
