import type { Metadata } from 'next'
import { format } from 'date-fns'
import { ArrowRight, Calendar, ChevronRight, Flag, Timer, Trophy } from 'lucide-react'
import { PendingLink } from '@/components/ui/pending-link'
import { PageBackLink } from '@/components/ui/page-back-link'
import { RaceStatusPill } from '@/components/ui/race-status-pill'
import { RaceMetaStrip } from '@/components/ui/race-meta-strip'
import { SectionHeader } from '@/components/ui/section-header'
import { getProfileDisplayName } from '@/utils/profile-name'
import { getPublicSeasonData, type PublicSeasonLeaderboardEntry, type PublicSeasonRaceSummary } from '@/utils/public-season'
import { getRoundLabel } from '@/utils/race-copy'
import { getAbsoluteUrl } from '@/utils/site'
import { getPublicRaceActionLabel, getRaceTone } from '@/utils/race-experience'

export const revalidate = 0

type TimelineFilter = 'all' | 'open' | 'pending' | 'scored' | 'cancelled' | 'full'

type PageProps = {
  searchParams: Promise<{
    filter?: string | string[] | undefined
  }>
}

function getLeaderboardProfile(entry: PublicSeasonLeaderboardEntry) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
}

function resolveTimelineFilter(rawValue: string | undefined): TimelineFilter {
  if (
    rawValue === 'all' ||
    rawValue === 'open' ||
    rawValue === 'pending' ||
    rawValue === 'scored' ||
    rawValue === 'cancelled' ||
    rawValue === 'full'
  ) {
    return rawValue
  }

  return 'all'
}

function matchesTimelineFilter(race: PublicSeasonRaceSummary, filter: TimelineFilter) {
  if (filter === 'all' || filter === 'full') return true
  if (filter === 'open') return race.effectiveStatus === 'upcoming'
  if (filter === 'pending') {
    return race.effectiveStatus === 'locked' || race.effectiveStatus === 'completed'
  }
  if (filter === 'scored') return race.effectiveStatus === 'scored'
  return race.effectiveStatus === 'cancelled'
}

function getTimelineTone(status: PublicSeasonRaceSummary['effectiveStatus']) {
  if (status === 'upcoming') {
    return {
      frame: 'border-white/8 bg-black/20',
      round: 'text-red-300',
      statusPill: 'border-red-500/25 bg-red-500/10 text-red-200',
      meta: 'border-white/8 bg-black/25 text-slate-100',
      metaLabel: 'text-slate-500',
      button: 'border-white/10 bg-white/5 text-white hover:bg-white/10',
    }
  }

  if (status === 'locked' || status === 'completed') {
    return {
      frame: 'border-amber-500/20 bg-amber-500/8',
      round: 'text-amber-300',
      statusPill: 'border-amber-500/25 bg-amber-500/10 text-amber-100',
      meta: 'border-amber-500/10 bg-black/20 text-amber-50',
      metaLabel: 'text-amber-200/70',
      button: 'border-amber-500/25 bg-amber-500/12 text-amber-100 hover:bg-amber-500/18',
    }
  }

  if (status === 'scored') {
    return {
      frame: 'border-emerald-500/20 bg-emerald-500/8',
      round: 'text-emerald-300',
      statusPill: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100',
      meta: 'border-emerald-500/10 bg-black/20 text-emerald-50',
      metaLabel: 'text-emerald-200/70',
      button: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/18',
    }
  }

  return {
    frame: 'border-red-500/20 bg-red-500/8',
    round: 'text-red-300',
    statusPill: 'border-red-500/20 bg-red-500/10 text-red-200',
    meta: 'border-red-500/10 bg-black/20 text-slate-200',
    metaLabel: 'text-red-200/70',
    button: 'border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/15',
  }
}

function PublicRaceRow({
  race,
}: {
  race: PublicSeasonRaceSummary
}) {
  const actionLabel = getPublicRaceActionLabel(race.effectiveStatus)
  const isCancelled = race.effectiveStatus === 'cancelled'
  const primaryTimeLabel = race.effectiveStatus === 'upcoming' ? 'Lock' : 'Race'
  const primaryTimeValue =
    race.effectiveStatus === 'upcoming' ? race.prediction_lock_at : race.race_start_at
  const tone = getTimelineTone(race.effectiveStatus)

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-xl ${tone.frame}`}>
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
          <span className={tone.round}>{getRoundLabel(race.round)}</span>
          <RaceStatusPill status={race.effectiveStatus} size="xs" />
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <h2
              className={`text-lg font-black italic tracking-tight sm:text-xl ${
                isCancelled ? 'text-slate-300 line-through decoration-red-400/80' : 'text-white'
              }`}
            >
              {race.race_name}
            </h2>
            <div className={`mt-0.5 text-sm ${isCancelled ? 'text-slate-500' : 'text-slate-400'}`}>
              {race.circuits?.emoji} {race.circuits?.name}, {race.circuits?.country}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <RaceMetaStrip
              items={[
                {
                  label: primaryTimeLabel,
                  value: format(new Date(primaryTimeValue), 'MMM d, p'),
                  icon: race.effectiveStatus === 'upcoming' ? Timer : Calendar,
                  tone: getRaceTone(race.effectiveStatus),
                },
              ]}
            />

            <PendingLink
              href={`/race/${race.id}`}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-bold transition-colors ${tone.button}`}
            >
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </PendingLink>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateMetadata(): Promise<Metadata> {
  const { currentSeason } = await getPublicSeasonData()
  const title = `${currentSeason} Season Hub`
  const description = 'Follow the calendar, public results, and season standings without signing in.'

  return {
    title,
    description,
    alternates: {
      canonical: '/season',
    },
    openGraph: {
      title,
      description,
      url: getAbsoluteUrl('/season'),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function PublicSeasonPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams
  const activeFilter = resolveTimelineFilter(
    typeof resolvedSearchParams.filter === 'string' ? resolvedSearchParams.filter : resolvedSearchParams.filter?.[0]
  )
  const {
    currentSeason,
    allRaces,
    nextRace,
    recentResults,
    leaderboard,
    pendingPublication,
    upcomingRaces,
    totalRaces,
    totalScored,
  } = await getPublicSeasonData()
  const focusedRaceMap = new Map<string, PublicSeasonRaceSummary>()
  const focusCandidates = [
    ...pendingPublication,
    ...upcomingRaces.slice(0, 4),
    ...recentResults.slice(0, 3),
  ]
  focusCandidates.forEach((race) => focusedRaceMap.set(race.id, race))
  const focusedRaces = [...focusedRaceMap.values()]
  const timelineRaces =
    activeFilter === 'all'
      ? focusedRaces.length > 0
        ? focusedRaces
        : allRaces.slice(0, 6)
      : allRaces.filter((race) => matchesTimelineFilter(race, activeFilter))
  const filterCounts = {
    all: focusedRaces.length || Math.min(allRaces.length, 6),
    open: allRaces.filter((race) => race.effectiveStatus === 'upcoming').length,
    pending: allRaces.filter((race) => race.effectiveStatus === 'locked' || race.effectiveStatus === 'completed').length,
    scored: allRaces.filter((race) => race.effectiveStatus === 'scored').length,
    cancelled: allRaces.filter((race) => race.effectiveStatus === 'cancelled').length,
    full: allRaces.length,
  }
  const filterLinks: Array<{ key: TimelineFilter; label: string; count: number; href: string }> = [
    { key: 'all', label: 'Focus', count: filterCounts.all, href: '/season' },
    { key: 'open', label: 'Upcoming', count: filterCounts.open, href: '/season?filter=open' },
    { key: 'pending', label: 'Awaiting', count: filterCounts.pending, href: '/season?filter=pending' },
    { key: 'scored', label: 'Scored', count: filterCounts.scored, href: '/season?filter=scored' },
    { key: 'cancelled', label: 'Cancelled', count: filterCounts.cancelled, href: '/season?filter=cancelled' },
    { key: 'full', label: 'Full', count: filterCounts.full, href: '/season?filter=full' },
  ]
  const waitingRace = pendingPublication[0] || null
  const latestResult = recentResults[0] || null
  const followingRace = upcomingRaces.find((race) => race.id !== nextRace?.id) || null

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageBackLink href="/" label="Back to home" />
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6 shadow-2xl md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-bold uppercase tracking-wider text-slate-300">
            Season {currentSeason}
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-medium text-slate-200">
            {totalScored}/{totalRaces} scored
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-medium text-slate-200">
            {pendingPublication.length} awaiting results
          </span>
        </div>

        <SectionHeader
          className="mt-4"
          eyebrow="Season"
          title="Season board"
          description="Current gaps first, then the next lock and the latest result."
          aside={
            <div className="flex flex-wrap gap-3">
              <PendingLink
                href="/leaderboard"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-white transition-colors hover:bg-white/10"
              >
                Standings
              </PendingLink>
              <PendingLink
                href="/signup"
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-colors hover:bg-red-500"
              >
                Join before next lock
                <ChevronRight className="h-5 w-5" />
              </PendingLink>
            </div>
          }
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/8 p-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-amber-100">
            <Flag className="h-4 w-4" /> Awaiting results
          </div>
          {waitingRace ? (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-amber-200/80">
                  {getRoundLabel(waitingRace.round)}
                </div>
                <h2 className="mt-1 text-xl font-black italic tracking-tight text-white">{waitingRace.race_name}</h2>
                <p className="mt-1 text-sm text-amber-50/75">
                  Most recent weekend still waiting for a published recap.
                </p>
              </div>
              <PendingLink
                href={`/race/${waitingRace.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-black/20 px-4 py-2 text-sm font-bold text-amber-50 transition-colors hover:bg-black/30"
              >
                Check race
                <ChevronRight className="h-4 w-4" />
              </PendingLink>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No completed weekends are waiting on results.</p>
          )}
        </div>

        <div className="rounded-2xl border border-red-500/18 bg-red-500/8 p-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-red-100">
            <Timer className="h-4 w-4" /> Next lock
          </div>
          {nextRace ? (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-red-200/80">
                  {getRoundLabel(nextRace.round)}
                </div>
                <h2 className="mt-1 text-xl font-black italic tracking-tight text-white">{nextRace.race_name}</h2>
                <p className="mt-1 text-sm text-red-50/75">
                  Locks {format(new Date(nextRace.prediction_lock_at), 'MMM d, p')}
                  {followingRace ? `, then ${followingRace.race_name}` : ''}.
                </p>
              </div>
              <PendingLink
                href={`/race/${nextRace.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-500"
              >
                Open race
                <ChevronRight className="h-4 w-4" />
              </PendingLink>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No upcoming race is open yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/8 p-4 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">
            <Trophy className="h-4 w-4" /> Latest recap
          </div>
          {latestResult ? (
            <div className="mt-3 space-y-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-widest text-emerald-200/80">
                  {getRoundLabel(latestResult.round)}
                </div>
                <h2 className="mt-1 text-xl font-black italic tracking-tight text-white">{latestResult.race_name}</h2>
                <p className="mt-1 text-sm text-emerald-50/75">
                  Published result and standings impact are ready to review.
                </p>
              </div>
              <PendingLink
                href={`/race/${latestResult.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-black/20 px-4 py-2 text-sm font-bold text-emerald-50 transition-colors hover:bg-black/30"
              >
                View recap
                <ArrowRight className="h-4 w-4" />
              </PendingLink>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">No scored race has been published yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl">
        <SectionHeader
          eyebrow="Race board"
          title="Race board"
          description={
            activeFilter === 'all'
              ? 'Focused on current gaps, the next few locks, and recent recaps.'
              : 'Filtered race calendar, still ordered by what is most useful first.'
          }
          aside={
            <div className="flex flex-wrap gap-2">
              {filterLinks.map((filter) => {
                const isActive = filter.key === activeFilter

                return (
                  <PendingLink
                    key={filter.key}
                    href={filter.href}
                    className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] transition-colors ${
                      isActive
                        ? 'border-red-500/30 bg-red-500/12 text-red-200'
                        : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {filter.label} {filter.count}
                  </PendingLink>
                )
              })}
            </div>
          }
        />

        <div className="mt-5 space-y-3">
          {timelineRaces.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
              No races here.
            </div>
          ) : (
            timelineRaces.map((race) => <PublicRaceRow key={race.id} race={race} />)
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-xl">
        <SectionHeader
          eyebrow="Standings"
          title="Standings"
          aside={
            <PendingLink
              href="/leaderboard"
              className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
            >
              Full
              <ArrowRight className="h-3.5 w-3.5" />
            </PendingLink>
          }
        />

        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {leaderboard.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500 lg:col-span-2 xl:col-span-3">
              No standings yet.
            </div>
          ) : (
            leaderboard.slice(0, 6).map((entry, index) => {
              const profile = getLeaderboardProfile(entry)

              return (
                <div
                  key={entry.user_id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                    index === 0 ? 'border-yellow-500/25 bg-yellow-500/10' : 'border-white/5 bg-black/20'
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-sm font-black italic text-white">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white break-words">
                        {getProfileDisplayName(profile?.display_name, profile?.email)}
                      </div>
                      <div className="text-xs text-slate-400">
                        {entry.exact_hits} exact · {entry.races_scored} races
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right text-lg font-black italic text-red-500">{entry.total_points}</div>
                </div>
              )
            })
          )}
        </div>
      </section>
    </div>
  )
}
