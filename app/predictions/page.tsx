import { createClient } from '@/utils/supabase/server'
import { AlertCircle, Calendar, ChevronRight, Clock3, MapPin, Trophy } from 'lucide-react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import { redirect } from 'next/navigation'
import { getRoundLabel } from '@/utils/race-copy'
import { getEffectiveRaceStatus, RaceStatus } from '@/utils/race-status'
import { getCurrentSeason } from '@/utils/season'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantAssignmentRequired } from '@/components/ui/tenant-assignment-required'
import { PendingLink } from '@/components/ui/pending-link'

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

type SeasonFilterKey = 'action' | 'waiting' | 'scored' | 'missed'

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

function getRaceStatusLabel(status: RaceStatus) {
  if (status === 'upcoming') return 'Predictions open'
  if (status === 'locked') return 'Locked'
  if (status === 'completed') return 'Scoring pending'
  if (status === 'scored') return 'Final score'
  return 'Cancelled'
}

function getRaceActionLabel(status: RaceStatus, hasPredicted: boolean) {
  if (status === 'upcoming') {
    return hasPredicted ? 'Edit Entry' : 'Make Prediction'
  }

  if (status === 'locked' || status === 'completed') {
    return hasPredicted ? 'Track Results' : 'Review Weekend'
  }

  if (status === 'scored') {
    return hasPredicted ? 'View Recap' : 'Review Weekend'
  }

  return 'View Details'
}

function getDefaultTab({
  openCount,
  waitingCount,
  scoredCount,
  missedCount,
}: {
  openCount: number
  waitingCount: number
  scoredCount: number
  missedCount: number
}): SeasonFilterKey {
  if (openCount > 0) return 'action'
  if (waitingCount > 0) return 'waiting'
  if (scoredCount > 0) return 'scored'
  if (missedCount > 0) return 'missed'
  return 'action'
}

function resolveFilter(rawValue: string | undefined, fallback: SeasonFilterKey): SeasonFilterKey {
  if (rawValue === 'action' || rawValue === 'waiting' || rawValue === 'scored' || rawValue === 'missed') {
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
      description: 'Your picks are locked. The next step is waiting for the official result or final score.',
      status: 'Waiting on the result pipeline',
    }
  }

  if (kind === 'scored' && race) {
    return {
      eyebrow: 'Latest Result',
      headline: race.race_name,
      description:
        typeof score === 'number'
          ? `This weekend is final. You came away with ${score} pts.`
          : 'This weekend has been scored and is ready to review.',
      status: typeof score === 'number' ? `${score} pts banked` : 'Final score published',
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
    eyebrow: 'My Season',
    headline: 'Season Pause',
    description: 'No races are currently scheduled for this season.',
    status: 'No active weekend',
  }
}

function getActiveSectionCopy(tab: SeasonFilterKey) {
  if (tab === 'action') {
    return {
      title: 'Open Now',
      description: 'Race weekends you can still enter or update.',
      empty: 'No open prediction windows right now.',
    }
  }

  if (tab === 'waiting') {
    return {
      title: 'Results Pending',
      description: 'Your entered races that are now waiting on results or scoring.',
      empty: 'Nothing is waiting on results right now.',
    }
  }

  if (tab === 'scored') {
    return {
      title: 'Final Scores',
      description: 'Completed weekends with points ready to review.',
      empty: 'No races have been scored yet this season.',
    }
  }

  return {
    title: 'Missed Weekends',
    description: 'Closed weekends that counted without your prediction.',
    empty: 'You have not missed any race weekends this season.',
  }
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
  const isActionable = status === 'upcoming'

  const frameClasses =
    filterKey === 'action'
      ? hasPredicted
        ? 'border-green-500/20 bg-card'
        : 'border-red-500/20 bg-card'
      : filterKey === 'waiting'
        ? 'border-amber-500/20 bg-card'
        : filterKey === 'scored'
          ? 'border-yellow-500/20 bg-card'
          : 'border-white/10 bg-card'

  const infoItems =
    filterKey === 'action'
      ? [
          {
            label: 'Status',
            value: hasPredicted ? 'Entry locked in' : 'No entry yet',
          },
          {
            label: 'Lock',
            value: format(new Date(race.prediction_lock_at), 'MMM d, p'),
            detail: formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true }),
          },
          {
            label: 'Race',
            value: format(new Date(race.race_start_at), 'MMM d, p'),
          },
        ]
      : filterKey === 'waiting'
        ? [
            {
              label: 'State',
              value: status === 'locked' ? 'Weekend in progress' : 'Scoring pending',
            },
            {
              label: 'Locked',
              value: format(new Date(race.prediction_lock_at), 'MMM d, p'),
            },
            {
              label: 'Race',
              value: format(new Date(race.race_start_at), 'MMM d, p'),
            },
          ]
        : filterKey === 'scored'
          ? [
              {
                label: 'Score',
                value: typeof score === 'number' ? `${score} pts` : 'Final score',
              },
              {
                label: 'Race',
                value: format(new Date(race.race_start_at), 'MMM d, p'),
              },
              {
                label: 'State',
                value: 'Ready to review',
              },
            ]
          : [
              {
                label: 'Status',
                value: 'Missed weekend',
              },
              {
                label: 'Race',
                value: format(new Date(race.race_start_at), 'MMM d, p'),
              },
              {
                label: 'Next step',
                value: 'Review the result',
              },
            ]

  return (
    <div className={`rounded-2xl border p-5 shadow-xl transition-colors hover:bg-white/[0.02] ${frameClasses}`}>
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-red-500">{getRoundLabel(race.round)}</span>
            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-medium text-slate-300">
              {getRaceStatusLabel(status)}
            </span>
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

          <div className="mt-3">
            <h2 className="truncate text-2xl font-bold text-white">{race.race_name}</h2>
            <div className="mt-1 flex items-center text-slate-400">
              <MapPin className="mr-1.5 h-4 w-4 shrink-0 text-slate-500" />
              <span className="truncate">
                {race.circuits?.name}, {race.circuits?.country} {race.circuits?.emoji}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {infoItems.map((item) => (
            <div
              key={`${race.id}-${item.label}`}
              className="inline-flex min-w-[10rem] flex-col rounded-full border border-white/8 bg-black/25 px-4 py-2.5"
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.label}</span>
              <span className="mt-1 text-sm font-semibold text-slate-100">{item.value}</span>
              {item.detail && <span className="text-xs text-slate-500">{item.detail}</span>}
            </div>
          ))}
        </div>

        <div className="w-full xl:w-auto">
          <PendingLink
            href={`/race/${race.id}/predict`}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-6 py-3 font-bold transition-all xl:w-auto ${
              isActionable
                ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-500'
                : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
          >
            {getRaceActionLabel(status, hasPredicted)}
            <ChevronRight className="ml-1 h-5 w-5" />
          </PendingLink>
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

  const defaultTab = getDefaultTab({
    openCount: openRaces.length,
    waitingCount: waitingRaces.length,
    scoredCount: scoredRaces.length,
    missedCount: missedRaces.length,
  })
  const activeTab = resolveFilter(rawTab, defaultTab)

  const hero =
    openRaces[0]
      ? { kind: 'action' as const, race: openRaces[0] }
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
      label: 'Open Now',
      hint: 'Prediction windows still live.',
      count: openRaces.length,
      href: '/predictions?tab=action',
      icon: Calendar,
    },
    {
      key: 'waiting',
      label: 'Results Pending',
      hint: 'Locked entries waiting on the pipeline.',
      count: waitingRaces.length,
      href: '/predictions?tab=waiting',
      icon: Clock3,
    },
    {
      key: 'scored',
      label: 'Final Scores',
      hint: 'Completed weekends with points.',
      count: scoredRaces.length,
      href: '/predictions?tab=scored',
      icon: Trophy,
    },
    {
      key: 'missed',
      label: 'Missed Weekends',
      hint: 'Closed races without an entry.',
      count: missedRaces.length,
      href: '/predictions?tab=missed',
      icon: AlertCircle,
    },
  ]

  const activeSection = getActiveSectionCopy(activeTab)
  const activeRaces =
    activeTab === 'action'
      ? openRaces
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

            <div className="space-y-2">
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">My Season</div>
              <h1 className="text-3xl font-black italic tracking-tighter text-white md:text-5xl">
                {heroContent.headline}
              </h1>
              <p className="max-w-2xl text-slate-300">{heroContent.description}</p>
            </div>

            {hero.race ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-red-500">
                    {heroContent.eyebrow}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
                    {getRoundLabel(hero.race.round)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300">
                    {getRaceStatusLabel(getEffectiveRaceStatus(hero.race))}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="rounded-full border border-white/8 bg-black/25 px-4 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">{heroContent.status}</div>
                  </div>
                  <div className="rounded-full border border-white/8 bg-black/25 px-4 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Lock</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">
                      {format(new Date(hero.race.prediction_lock_at), 'MMM d, p')}
                    </div>
                    {hero.kind === 'action' && (
                      <div className="text-xs text-slate-500">
                        {formatDistanceToNowStrict(new Date(hero.race.prediction_lock_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                  <div className="rounded-full border border-white/8 bg-black/25 px-4 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Race</div>
                    <div className="mt-1 text-sm font-semibold text-slate-100">
                      {format(new Date(hero.race.race_start_at), 'MMM d, p')}
                    </div>
                  </div>
                </div>

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
                  {getRaceActionLabel(getEffectiveRaceStatus(hero.race), heroHasPredicted)}
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
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Views</div>
            <h2 className="text-2xl font-black italic tracking-tight text-white">Focus now</h2>
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
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">{activeSection.title}</div>
            <h2 className="mt-1 text-2xl font-black italic tracking-tight text-white">{activeSection.title}</h2>
            <p className="text-slate-400">{activeSection.description}</p>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-300">
            {activeRaces.length} race{activeRaces.length === 1 ? '' : 's'}
          </div>
        </div>

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
                isFeatured={Boolean(hero.race && hero.kind === activeTab && hero.race.id === race.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
