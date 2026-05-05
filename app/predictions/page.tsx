import { createClient } from '@/utils/supabase/server'
import { AlertCircle, Calendar, ChevronRight, Clock3, MapPin, Trophy } from 'lucide-react'
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
  }>
}

type FilterCard = {
  key: SeasonFilterKey
  label: string
  hint: string
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
        ? `Entry locked in. Predictions close ${formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true })}.`
        : `Your next weekend is live. Submit before predictions close ${formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true })}.`,
      status: hasPredicted ? 'Entry locked in' : 'No entry yet',
    }
  }

  if (kind === 'waiting' && race) {
    return {
      eyebrow: 'Results Pending',
      headline: race.race_name,
      description: hasPredicted
        ? 'Your picks are locked. The next step is waiting for the official result or final score.'
        : 'The race is finished. No entry was submitted, and final scoring is still pending.',
      status: hasPredicted ? 'Waiting on scoring' : 'No entry submitted',
    }
  }

  if (kind === 'upcoming' && race) {
    return {
      eyebrow: 'Next Race',
      headline: race.race_name,
      description: hasPredicted
        ? `Entry saved. You can still edit before predictions close ${formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true })}.`
        : 'This race is on the schedule. It becomes the main action when it is the next unentered round.',
      status: hasPredicted ? 'Entry saved' : 'Upcoming',
    }
  }

  if (kind === 'scored' && race) {
    return {
      eyebrow: 'Latest Result',
      headline: race.race_name,
      description:
        !hasPredicted
          ? 'This weekend is final. No entry was submitted for this round.'
          : typeof score === 'number'
          ? `This weekend is final. You came away with ${score} pts.`
          : 'This weekend has been scored and is ready to review.',
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
      description: 'There is no open window right now. Review the last missed weekend and reset for the next one.',
      status: 'Missed weekend',
    }
  }

  return {
    eyebrow: 'My Race',
    headline: 'Season Pause',
    description: 'No races are currently scheduled for this season.',
    status: 'No active weekend',
  }
}

function getActiveSectionCopy(tab: SeasonFilterKey) {
  if (tab === 'action') {
    return {
      title: 'Needs Action',
      description: 'The next race that still needs your entry.',
      empty: 'No race needs your entry right now.',
    }
  }

  if (tab === 'upcoming') {
    return {
      title: 'Upcoming',
      description: 'Future race weekends, kept quiet until they become the next focus.',
      empty: 'No upcoming race weekends right now.',
    }
  }

  if (tab === 'waiting') {
    return {
      title: 'Locked In',
      description: 'Your entered races that are now waiting on results or scoring.',
      empty: 'Nothing is waiting on results right now.',
    }
  }

  if (tab === 'scored') {
    return {
      title: 'Results',
      description: 'Completed weekends with points ready to review.',
      empty: 'No races have been scored yet this season.',
    }
  }

  return {
    title: 'Missed',
    description: 'Closed weekends that counted without your prediction.',
    empty: 'You have not missed any race weekends this season.',
  }
}

function formatRaceDateTime(value: string) {
  return format(new Date(value), 'MMM d, p')
}

function RaceListCard({
  race,
  status,
  hasPredicted,
  score,
  filterKey,
  isFeatured = false,
}: {
  race: RaceCardData
  status: RaceStatus
  hasPredicted: boolean
  score?: number
  filterKey: SeasonFilterKey
  isFeatured?: boolean
}) {
  const isPrimaryAction = status === 'upcoming' && filterKey === 'action'
  const tone = getRaceTone(status)
  const actionLabel =
    filterKey === 'upcoming' && status === 'upcoming'
      ? hasPredicted
        ? 'View entry'
        : 'View race'
      : getMemberRaceActionLabel(status, hasPredicted)

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
            {isFeatured && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-300">
                Featured above
              </span>
            )}
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
                href={`/race/${race.id}/predict`}
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

  const openRaces = typedRaces.filter((race) => getEffectiveRaceStatus(race) === 'upcoming')
  const nextOpenRace = openRaces[0] || null
  const actionableRaces = nextOpenRace && !predictedRaceIds.has(nextOpenRace.id) ? [nextOpenRace] : []
  const upcomingScheduleRaces = openRaces.filter((race) => race.id !== actionableRaces[0]?.id)
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

  const defaultTab = postRaceDefaultTab || getDefaultTab({
    actionCount: actionableRaces.length,
    upcomingCount: upcomingScheduleRaces.length,
    waitingCount: waitingRaces.length,
    scoredCount: scoredRaces.length,
    missedCount: missedRaces.length,
  })
  const activeTab = resolveFilter(rawTab, defaultTab)

  const hero =
    latestFinishedRace && latestFinishedIsRecent
      ? {
          kind: latestFinishedStatus === 'scored' ? 'scored' as const : 'waiting' as const,
          race: latestFinishedRace,
        }
      : actionableRaces[0]
        ? { kind: 'action' as const, race: actionableRaces[0] }
        : nextOpenRace
          ? { kind: 'upcoming' as const, race: nextOpenRace }
      : waitingRaces[0]
        ? { kind: 'waiting' as const, race: waitingRaces[0] }
        : scoredRaces[0]
          ? { kind: 'scored' as const, race: scoredRaces[0] }
          : missedRaces[0]
            ? { kind: 'missed' as const, race: missedRaces[0] }
            : { kind: 'empty' as const, race: null }

  const heroHasPredicted = hero.race ? predictedRaceIds.has(hero.race.id) : false
  const heroScore = hero.race ? scoreByRaceId.get(hero.race.id) : undefined
  const heroContent = getHeroContent({
    kind: hero.kind,
    race: hero.race,
    hasPredicted: heroHasPredicted,
    score: heroScore,
  })

  const filterCards: FilterCard[] = [
    {
      key: 'action',
      label: 'Needs Action',
      hint: 'Only the next unentered race gets urgency.',
      count: actionableRaces.length,
      href: '/predictions?tab=action',
      icon: Calendar,
    },
    {
      key: 'upcoming',
      label: 'Upcoming',
      hint: 'Future weekends without the alarm bells.',
      count: upcomingScheduleRaces.length,
      href: '/predictions?tab=upcoming',
      icon: Calendar,
    },
    {
      key: 'waiting',
      label: 'Locked In',
      hint: 'Locked entries waiting on the pipeline.',
      count: waitingRaces.length,
      href: '/predictions?tab=waiting',
      icon: Clock3,
    },
    {
      key: 'scored',
      label: 'Results',
      hint: 'Completed weekends with points.',
      count: scoredRaces.length,
      href: '/predictions?tab=scored',
      icon: Trophy,
    },
    {
      key: 'missed',
      label: 'Missed',
      hint: 'Closed races without an entry.',
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
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_21rem]">
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
                  <RaceStatusPill status={getEffectiveRaceStatus(hero.race)} size="xs" />
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

                <div className="mt-4 flex items-center text-slate-400">
                  <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-slate-500" />
                  <span>
                    {hero.race.circuits?.name}, {hero.race.circuits?.country} {hero.race.circuits?.emoji}
                  </span>
                </div>

                <PendingLink
                  href={`/race/${hero.race.id}/predict`}
                  className={`mt-5 inline-flex items-center gap-1.5 rounded-xl px-5 py-3 font-bold transition-all ${
                    hero.kind === 'action'
                      ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-500'
                      : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {getMemberRaceActionLabel(getEffectiveRaceStatus(hero.race), heroHasPredicted)}
                  <ChevronRight className="ml-1 h-5 w-5" />
                </PendingLink>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-slate-400">
                No races are currently scheduled for this season.
              </div>
            )}
          </div>
        </div>

        <aside className="self-start rounded-3xl border border-white/10 bg-card p-5 shadow-2xl xl:sticky xl:top-24">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Race queue</div>
            <h2 className="text-2xl font-black italic tracking-tight text-white">Current focus</h2>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {filterCards.map((card) => {
              const Icon = card.icon
              const isActive = card.key === activeTab

              return (
                <PendingLink
                  key={card.key}
                  href={card.href}
                  className={`rounded-2xl border p-4 text-left transition-all ${
                    isActive
                      ? 'border-red-500/30 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.12)]'
                      : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                        <Icon className={`h-4 w-4 ${isActive ? 'text-red-300' : 'text-slate-400'}`} />
                        {card.label}
                      </div>
                      {isActive && <p className="mt-2 text-sm text-slate-400">{card.hint}</p>}
                    </div>
                    <div className={`shrink-0 text-3xl font-black italic ${isActive ? 'text-red-300' : 'text-white'}`}>
                      {card.count}
                    </div>
                  </div>
                </PendingLink>
              )
            })}
          </div>
        </aside>
      </section>

      <section className="space-y-4">
        <SectionHeader
          eyebrow={activeSection.title}
          title={activeSection.title}
          description={activeSection.description}
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
                isFeatured={Boolean(hero.race && hero.race.id === race.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
