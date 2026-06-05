import { createClient } from '@/utils/supabase/server'
import { AlertCircle, Calendar, ChevronRight, Clock3, Flag, MapPin, Trophy, Users } from 'lucide-react'
import { differenceInCalendarDays, format, formatDistanceToNowStrict } from 'date-fns'
import { redirect } from 'next/navigation'
import { getRoundLabel } from '@/utils/race-copy'
import { getEffectiveRaceStatus, RaceStatus } from '@/utils/race-status'
import { getCurrentSeason } from '@/utils/season'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantAssignmentRequired } from '@/components/ui/tenant-assignment-required'
import { PendingLink } from '@/components/ui/pending-link'
import { RaceStatusPill } from '@/components/ui/race-status-pill'
import { RaceMetaStrip } from '@/components/ui/race-meta-strip'
import { SectionHeader } from '@/components/ui/section-header'
import { getMemberRaceActionLabel, getRaceParticipationLabel, getRaceTone } from '@/utils/race-experience'
import { getPrivateGroupRaceExperience } from '@/utils/group-race-experience'
import { formatAmsterdamDateTime } from '@/utils/amsterdam-time'
import { getRaceFocus } from '@/utils/race-focus'

export const revalidate = 0

type Circuit = {
  name?: string | null
  country?: string | null
  emoji?: string | null
}

type RaceCardData = {
  id: string
  round: number
  season: number
  race_name: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  circuits?: Circuit | null
}

type PredictionRow = {
  race_id: string
}

type ScoreRow = {
  race_id: string
  total_points: number
}

type SeasonFilterKey = 'action' | 'upcoming' | 'waiting' | 'scored' | 'missed'

type SeasonDashboardPageProps = {
  searchParams: Promise<{
    tab?: string | string[] | undefined
    joined?: string | string[] | undefined
  }>
}

type FilterCard = {
  key: SeasonFilterKey
  label: string
  count: number
  href: string
  icon: typeof Calendar
}

function getDefaultTab({
  actionCount,
  upcomingCount,
  waitingCount,
  scoredCount,
  missedCount,
}: {
  actionCount: number
  upcomingCount: number
  waitingCount: number
  scoredCount: number
  missedCount: number
}): SeasonFilterKey {
  if (actionCount > 0) return 'action'
  if (waitingCount > 0) return 'waiting'
  if (scoredCount > 0) return 'scored'
  if (missedCount > 0) return 'missed'
  if (upcomingCount > 0) return 'upcoming'
  return 'action'
}

function resolveFilter(rawValue: string | undefined, fallback: SeasonFilterKey): SeasonFilterKey {
  if (
    rawValue === 'action' ||
    rawValue === 'upcoming' ||
    rawValue === 'waiting' ||
    rawValue === 'scored' ||
    rawValue === 'missed'
  ) {
    return rawValue
  }

  return fallback
}

function getHeroContent({
  kind,
  race,
  hasPredicted,
  score,
}: {
  kind: SeasonFilterKey | 'empty'
  race: RaceCardData | null
  hasPredicted: boolean
  score?: number
}) {
  if (kind === 'action' && race) {
    return {
      eyebrow: 'Next Race',
      headline: race.race_name,
      description: hasPredicted
        ? `Entries close ${formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true })}.`
        : `Submit before entries close ${formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true })}.`,
      status: hasPredicted ? 'Entry saved' : 'No entry yet',
    }
  }

  if (kind === 'waiting' && race) {
    return {
      eyebrow: 'Results Pending',
      headline: race.race_name,
      description: hasPredicted ? 'Waiting for results.' : 'No entry submitted.',
      status: hasPredicted ? 'Waiting on scoring' : 'No entry submitted',
    }
  }

  if (kind === 'upcoming' && race) {
    return {
      eyebrow: 'Next Race',
      headline: race.race_name,
      description: hasPredicted
        ? `Editable until ${formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true })}.`
        : 'Upcoming.',
      status: hasPredicted ? 'Entry saved' : 'Upcoming',
    }
  }

  if (kind === 'scored' && race) {
    return {
      eyebrow: 'Latest Result',
      headline: race.race_name,
      description:
        !hasPredicted
          ? 'No entry submitted.'
          : typeof score === 'number'
          ? `${score} pts.`
          : 'Final score published.',
      status: !hasPredicted
        ? 'No entry submitted'
        : typeof score === 'number'
          ? `${score} pts banked`
          : 'Final score published',
    }
  }

  if (kind === 'missed' && race) {
    return {
      eyebrow: 'Catch Up',
      headline: race.race_name,
      description: 'No entry submitted.',
      status: 'Missed weekend',
    }
  }

  return {
    eyebrow: 'My Race',
    headline: 'Season Pause',
    description: 'No races scheduled.',
    status: 'No active weekend',
  }
}

function getActiveSectionCopy(tab: SeasonFilterKey) {
  if (tab === 'action') {
    return {
      title: 'Needs Action',
      empty: 'No race needs your entry right now.',
    }
  }

  if (tab === 'upcoming') {
    return {
      title: 'Upcoming',
      empty: 'No upcoming race weekends right now.',
    }
  }

  if (tab === 'waiting') {
    return {
      title: 'Locked In',
      empty: 'Nothing is waiting on results right now.',
    }
  }

  if (tab === 'scored') {
    return {
      title: 'Results',
      empty: 'No races have been scored yet this season.',
    }
  }

  return {
    title: 'Missed',
    empty: 'You have not missed any race weekends this season.',
  }
}

function formatRaceDateTime(value: string) {
  return formatAmsterdamDateTime(value, { includeWeekday: false }) || format(new Date(value), 'MMM d, p')
}

function RaceListCard({
  race,
  status,
  hasPredicted,
  score,
  filterKey,
}: {
  race: RaceCardData
  status: RaceStatus
  hasPredicted: boolean
  score?: number
  filterKey: SeasonFilterKey
}) {
  const isPrimaryAction = status === 'upcoming' && filterKey === 'action'
  const tone = getRaceTone(status)
  const actionLabel =
    filterKey === 'upcoming' && status === 'upcoming'
      ? hasPredicted
        ? 'View entry'
        : 'View race'
      : getMemberRaceActionLabel(status, hasPredicted)
  const actionHref = `/race/${race.id}/predict`

  const frameClasses =
    tone === 'open'
      ? hasPredicted || filterKey === 'upcoming'
        ? 'border-green-500/20 bg-card'
        : 'border-red-500/20 bg-card'
      : tone === 'pending'
        ? 'border-amber-500/20 bg-card'
        : tone === 'scored'
          ? 'border-emerald-500/20 bg-card'
          : 'border-white/10 bg-card'

  const metaItems =
    filterKey === 'action'
      ? [
          {
            icon: Clock3,
            value: hasPredicted
              ? `Lock ${formatRaceDateTime(race.prediction_lock_at)}`
              : `Closes ${formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true })}`,
          },
          {
            icon: Calendar,
            value: `Race ${formatRaceDateTime(race.race_start_at)}`,
          },
        ]
      : filterKey === 'upcoming'
        ? [
            {
              icon: Clock3,
              value: `Lock ${formatRaceDateTime(race.prediction_lock_at)}`,
            },
            {
              icon: Calendar,
              value: `Race ${formatRaceDateTime(race.race_start_at)}`,
            },
          ]
        : filterKey === 'waiting'
        ? [
            {
              icon: Clock3,
              value:
                status === 'locked'
                  ? `Weekend live`
                  : `Scoring pending`,
            },
            {
              icon: Calendar,
              value: `Race ${formatRaceDateTime(race.race_start_at)}`,
            },
          ]
        : filterKey === 'scored'
          ? [
              {
                icon: Trophy,
                value: typeof score === 'number' ? `${score} pts` : 'Final score',
              },
              {
                icon: Calendar,
                value: `Race ${formatRaceDateTime(race.race_start_at)}`,
              },
            ]
          : [
              {
                icon: AlertCircle,
                value: 'No entry',
              },
              {
                icon: Calendar,
                value: `Race ${formatRaceDateTime(race.race_start_at)}`,
              },
            ]

  return (
    <div className={`rounded-2xl border p-5 shadow-xl transition-colors hover:bg-white/[0.02] ${frameClasses}`}>
      <div className="flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-red-500">{getRoundLabel(race.round)}</span>
            <RaceStatusPill status={status} size="xs" />
            {hasPredicted && status === 'upcoming' && (
              <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-green-400">
                Entered
              </span>
            )}
            {typeof score === 'number' && filterKey === 'scored' && (
              <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
                {score} pts
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-white">{race.race_name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400">
                <span className="inline-flex min-w-0 items-center">
                  <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0 break-words">
                    {race.circuits?.name}, {race.circuits?.country} {race.circuits?.emoji}
                  </span>
                </span>
              </div>
            </div>

            <div className="w-full lg:w-auto">
              <PendingLink
                href={actionHref}
                className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3 font-bold transition-all lg:w-auto ${
                  isPrimaryAction
                    ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-500'
                    : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
              >
                {actionLabel}
                <ChevronRight className="ml-1 h-5 w-5" />
              </PendingLink>
            </div>
          </div>

          <RaceMetaStrip
            className="mt-3"
            items={[
              ...metaItems.map((item) => ({
                label: undefined,
                value: item.value,
                icon: item.icon,
                tone: (
                  filterKey === 'action'
                    ? 'open'
                    : filterKey === 'waiting'
                      ? 'pending'
                      : filterKey === 'scored'
                        ? 'scored'
                        : 'default'
                ) as 'default' | 'open' | 'pending' | 'scored',
              })),
              {
                value: getRaceParticipationLabel(status, hasPredicted),
                icon: hasPredicted ? Trophy : AlertCircle,
                tone:
                  hasPredicted && status === 'upcoming'
                    ? 'scored'
                    : filterKey === 'waiting'
                      ? 'pending'
                      : 'default',
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}

export default async function SeasonDashboardPage({ searchParams }: SeasonDashboardPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const currentSeason = await getCurrentSeason(supabase)
  const tenantContext = await getUserTenantContext(supabase, user.id)

  if (!tenantContext.tenantId) {
    return <TenantAssignmentRequired isAdmin={tenantContext.role === 'admin'} />
  }

  const query = await searchParams
  const rawTab = Array.isArray(query.tab) ? query.tab[0] : query.tab
  const joinedGroup = Array.isArray(query.joined) ? query.joined[0] : query.joined

  const { data: races } = await supabase
    .from('races')
    .select('*, circuits(name, country, emoji)')
    .eq('season', currentSeason)
    .neq('status', 'cancelled')
    .order('race_start_at', { ascending: true })

  const { data: predictions } = await supabase.from('predictions').select('race_id').eq('user_id', user.id)

  const { data: scores } = await supabase
    .from('user_race_scores')
    .select('race_id, total_points')
    .eq('user_id', user.id)

  const typedRaces = (races || []) as RaceCardData[]
  const typedPredictions = (predictions || []) as PredictionRow[]
  const typedScores = (scores || []) as ScoreRow[]

  const predictedRaceIds = new Set(typedPredictions.map((prediction) => prediction.race_id))
  const scoreByRaceId = new Map(typedScores.map((score) => [score.race_id, score.total_points]))

  const raceFocus = getRaceFocus(typedRaces)
  const openRaces = raceFocus.upcomingRaces
  const currentWeekendRace = raceFocus.currentWeekend
  const nextOpenRace = raceFocus.nextOpenRace
  const nextOpenRaceExperience = await getPrivateGroupRaceExperience(tenantContext.tenantId, nextOpenRace?.id)
  const actionableRaces = nextOpenRace && !predictedRaceIds.has(nextOpenRace.id) ? [nextOpenRace] : []
  const upcomingScheduleRaces = openRaces.filter((race) => race.id !== nextOpenRace?.id)
  const waitingRaces = typedRaces.filter((race) => {
    const status = getEffectiveRaceStatus(race)
    return (status === 'locked' || status === 'completed') && predictedRaceIds.has(race.id)
  })
  const scoredRaces = [...typedRaces]
    .filter((race) => getEffectiveRaceStatus(race) === 'scored' && predictedRaceIds.has(race.id))
    .sort((left, right) => new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime())
  const missedRaces = [...typedRaces]
    .filter((race) => {
      const status = getEffectiveRaceStatus(race)
      return (status === 'locked' || status === 'completed' || status === 'scored') && !predictedRaceIds.has(race.id)
    })
    .sort((left, right) => new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime())
  const latestFinishedRace = [...typedRaces]
    .filter((race) => {
      const status = getEffectiveRaceStatus(race)
      return status === 'completed' || status === 'scored'
    })
    .sort((left, right) => new Date(right.race_start_at).getTime() - new Date(left.race_start_at).getTime())[0] || null
  const latestFinishedStatus = latestFinishedRace ? getEffectiveRaceStatus(latestFinishedRace) : null
  const latestFinishedIsRecent = latestFinishedRace
    ? differenceInCalendarDays(new Date(), new Date(latestFinishedRace.race_start_at)) <= 7
    : false

  const postRaceDefaultTab: SeasonFilterKey | null =
    latestFinishedRace && latestFinishedIsRecent
      ? predictedRaceIds.has(latestFinishedRace.id)
        ? latestFinishedStatus === 'scored'
          ? 'scored'
          : 'waiting'
        : 'missed'
      : null

  const currentWeekendDefaultTab =
    currentWeekendRace
      ? predictedRaceIds.has(currentWeekendRace.id)
        ? 'waiting'
        : 'missed'
      : null

  const defaultTab =
    currentWeekendDefaultTab ||
    (actionableRaces.length > 0
      ? 'action'
      : nextOpenRace
        ? 'upcoming'
        : postRaceDefaultTab || getDefaultTab({
            actionCount: actionableRaces.length,
            upcomingCount: upcomingScheduleRaces.length,
            waitingCount: waitingRaces.length,
            scoredCount: scoredRaces.length,
            missedCount: missedRaces.length,
          }))
  const activeTab = resolveFilter(rawTab, defaultTab)

  const hero =
    currentWeekendRace
      ? {
          kind: predictedRaceIds.has(currentWeekendRace.id) ? 'waiting' as const : 'missed' as const,
          race: currentWeekendRace,
        }
      : actionableRaces[0]
        ? { kind: 'action' as const, race: actionableRaces[0] }
        : nextOpenRace
          ? { kind: 'upcoming' as const, race: nextOpenRace }
          : latestFinishedRace && latestFinishedIsRecent
            ? {
                kind: latestFinishedStatus === 'scored' ? 'scored' as const : 'waiting' as const,
                race: latestFinishedRace,
              }
      : waitingRaces[0]
        ? { kind: 'waiting' as const, race: waitingRaces[0] }
        : scoredRaces[0]
          ? { kind: 'scored' as const, race: scoredRaces[0] }
          : missedRaces[0]
            ? { kind: 'missed' as const, race: missedRaces[0] }
            : { kind: 'empty' as const, race: null }

  const heroHasPredicted = hero.race ? predictedRaceIds.has(hero.race.id) : false
  const heroScore = hero.race ? scoreByRaceId.get(hero.race.id) : undefined
  const heroStatus = hero.race ? getEffectiveRaceStatus(hero.race) : null
  const heroHref = hero.race ? `/race/${hero.race.id}/predict` : ''
  const heroContent = getHeroContent({
    kind: hero.kind,
    race: hero.race,
    hasPredicted: heroHasPredicted,
    score: heroScore,
  })
  const showUpNextRace = Boolean(
    currentWeekendRace &&
      nextOpenRace &&
      nextOpenRace.id !== hero.race?.id
  )
  const nextOpenRaceHasPredicted = nextOpenRace ? predictedRaceIds.has(nextOpenRace.id) : false

  const filterCards: FilterCard[] = [
    {
      key: 'action',
      label: 'Needs Action',
      count: actionableRaces.length,
      href: '/predictions?tab=action',
      icon: Calendar,
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      count: upcomingScheduleRaces.length,
      href: '/predictions?tab=upcoming',
      icon: Calendar,
    },
    {
      key: 'waiting',
      label: 'Locked In',
      count: waitingRaces.length,
      href: '/predictions?tab=waiting',
      icon: Clock3,
    },
    {
      key: 'scored',
      label: 'Results',
      count: scoredRaces.length,
      href: '/predictions?tab=scored',
      icon: Trophy,
    },
    {
      key: 'missed',
      label: 'Missed',
      count: missedRaces.length,
      href: '/predictions?tab=missed',
      icon: AlertCircle,
    },
  ]

  const activeSection = getActiveSectionCopy(activeTab)
  const activeRaces =
    activeTab === 'action'
      ? actionableRaces
      : activeTab === 'upcoming'
        ? upcomingScheduleRaces
      : activeTab === 'waiting'
        ? waitingRaces
        : activeTab === 'scored'
          ? scoredRaces
          : missedRaces

  const listRaces = activeRaces

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {joinedGroup && (
        <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-5 shadow-xl">
          <div className="flex items-start gap-3">
            <Flag className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Group joined</div>
              <h1 className="mt-1 text-2xl font-black italic text-white">You joined {joinedGroup}</h1>
              <p className="mt-2 text-sm leading-6 text-emerald-50/80">
                Your private standings are ready. Start with the race weekend below.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-5">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black shadow-2xl">
          <div className="space-y-5 p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
                Season {currentSeason}
              </span>
              {tenantContext.tenantName && (
                <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-slate-300">
                  Playing in {tenantContext.tenantName}
                </span>
              )}
            </div>

            <SectionHeader
              eyebrow="My Race"
              title={heroContent.headline}
              description={heroContent.description}
            />

            {hero.race ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-red-500">
                    {heroContent.eyebrow}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
                    {getRoundLabel(hero.race.round)}
                  </span>
                  <RaceStatusPill status={heroStatus || getEffectiveRaceStatus(hero.race)} size="xs" />
                </div>

                <RaceMetaStrip
                  className="mt-4"
                  items={[
                    { value: heroContent.status, icon: heroHasPredicted ? Trophy : AlertCircle },
                    {
                      value:
                        hero.kind === 'action'
                          ? `Closes ${formatDistanceToNowStrict(new Date(hero.race.prediction_lock_at), { addSuffix: true })}`
                          : `Lock ${formatRaceDateTime(hero.race.prediction_lock_at)}`,
                      icon: Clock3,
                      tone: hero.kind === 'action' ? 'open' : 'pending',
                    },
                    {
                      value: `Race ${formatRaceDateTime(hero.race.race_start_at)}`,
                      icon: Calendar,
                    },
                  ]}
                />

                {hero.race.id === nextOpenRace?.id && nextOpenRaceExperience && (
                  <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
                      <span className="flex items-center gap-2 text-sm font-bold text-slate-200">
                        <Users className="h-4 w-4 text-red-300" />
                        {nextOpenRaceExperience.submittedEntries}/{nextOpenRaceExperience.totalMembers} group entries
                      </span>
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Details</span>
                    </summary>
                    <p className="mt-3 text-sm text-slate-400">
                      {nextOpenRaceExperience.totalMembers > 0 &&
                      nextOpenRaceExperience.submittedEntries === nextOpenRaceExperience.totalMembers
                        ? `Everyone submitted for ${hero.race.race_name}.`
                        : 'Picks stay hidden until the deadline.'}
                    </p>
                  </details>
                )}

                <div className="mt-4 flex items-center text-slate-400">
                  <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>
                    {hero.race.circuits?.name}, {hero.race.circuits?.country} {hero.race.circuits?.emoji}
                  </span>
                </div>

                <PendingLink
                  href={heroHref}
                  className={`mt-5 inline-flex items-center gap-1.5 rounded-xl px-5 py-3 font-bold transition-all ${
                    hero.kind === 'action'
                      ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-500'
                      : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {getMemberRaceActionLabel(heroStatus || getEffectiveRaceStatus(hero.race), heroHasPredicted)}
                  <ChevronRight className="ml-1 h-5 w-5" />
                </PendingLink>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-slate-400">
                No races are currently scheduled for this season.
              </div>
            )}

            {showUpNextRace && nextOpenRace && (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Up next
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
                    {getRoundLabel(nextOpenRace.round)}
                  </span>
                  <RaceStatusPill status={getEffectiveRaceStatus(nextOpenRace)} size="xs" />
                </div>

                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold tracking-tight text-white">{nextOpenRace.race_name}</h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {nextOpenRaceHasPredicted
                        ? `Entry saved. Editable until ${formatRaceDateTime(nextOpenRace.prediction_lock_at)}.`
                        : `Entries close ${formatDistanceToNowStrict(new Date(nextOpenRace.prediction_lock_at), { addSuffix: true })}.`}
                    </p>
                    {nextOpenRaceExperience && (
                      <p className="mt-2 text-sm text-slate-500">
                        {nextOpenRaceExperience.submittedEntries}/{nextOpenRaceExperience.totalMembers} group entries saved.
                      </p>
                    )}
                  </div>
                  <PendingLink
                    href={`/race/${nextOpenRace.id}/predict`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10"
                  >
                    {getMemberRaceActionLabel(getEffectiveRaceStatus(nextOpenRace), nextOpenRaceHasPredicted)}
                    <ChevronRight className="h-4 w-4" />
                  </PendingLink>
                </div>
              </div>
            )}

            {latestFinishedRace && latestFinishedRace.id !== hero.race?.id && (
              <div className="border-t border-white/10 bg-black/20 px-6 py-4 md:px-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Latest recap</div>
                    <div className="mt-1 font-bold text-white">
                      {latestFinishedRace.race_name}
                      {!predictedRaceIds.has(latestFinishedRace.id) ? ' · No entry submitted' : ''}
                    </div>
                  </div>
                  <PendingLink
                    href={`/race/${latestFinishedRace.id}/predict`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition-colors hover:bg-white/10"
                  >
                    Review weekend
                    <ChevronRight className="h-4 w-4" />
                  </PendingLink>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" aria-label="My races">
          {filterCards.map((card) => {
            const isActive = card.key === activeTab

            return (
              <PendingLink
                key={card.key}
                href={card.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors ${
                  isActive
                    ? 'border-red-500/35 bg-red-500/15 text-red-100'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                {card.label}
                <span className="rounded-full bg-black/25 px-2 py-0.5 text-xs">{card.count}</span>
              </PendingLink>
            )
          })}
        </nav>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title={activeSection.title}
          aside={
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-300">
              {activeRaces.length} race{activeRaces.length === 1 ? '' : 's'}
            </div>
          }
        />

        {activeRaces.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-8 text-center text-slate-400 shadow-xl">
            {activeSection.empty}
          </div>
        ) : (
          <div className="grid gap-4">
            {listRaces.map((race) => (
              <RaceListCard
                key={race.id}
                race={race}
                status={getEffectiveRaceStatus(race)}
                hasPredicted={predictedRaceIds.has(race.id)}
                score={scoreByRaceId.get(race.id)}
                filterKey={activeTab}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
