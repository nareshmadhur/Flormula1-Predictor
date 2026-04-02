import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarClock, History, Trophy } from 'lucide-react'
import { getCurrentSeason } from '@/utils/season'
import { getRoundLabel } from '@/utils/race-copy'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantContextBanner } from '@/components/ui/tenant-context-banner'
import { TenantAssignmentRequired } from '@/components/ui/tenant-assignment-required'
import { PendingLink } from '@/components/ui/pending-link'

export const revalidate = 0

type SeasonRace = {
  id: string
  round: number
  race_name: string
  status: RaceStatus
  race_start_at: string
  prediction_lock_at: string
  circuits?: {
    emoji?: string | null
    name?: string | null
    country?: string | null
  } | null
}

type PredictionRow = {
  race_id: string
}

type ScoreRow = {
  race_id: string
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
}

type HistoryEntry = {
  race: SeasonRace
  status: RaceStatus
  hasPredicted: boolean
  score?: ScoreRow
  category: 'awaiting' | 'scored' | 'missed' | 'upcoming'
  summary: string
}

function getCategoryTitle(category: HistoryEntry['category']) {
  if (category === 'awaiting') return 'Awaiting Results'
  if (category === 'scored') return 'Scored Weekends'
  if (category === 'missed') return 'Missed Weekends'
  return 'Upcoming Weekends'
}

function getActionLabel(entry: HistoryEntry) {
  if (entry.category === 'upcoming') {
    return entry.hasPredicted ? 'Edit pick' : 'Predict now'
  }

  return 'Race recap'
}

function getCategoryOrder(category: HistoryEntry['category']) {
  if (category === 'awaiting') return 0
  if (category === 'scored') return 1
  if (category === 'missed') return 2
  return 3
}

function getEntrySummary(status: RaceStatus, hasPredicted: boolean, score?: ScoreRow) {
  if (status === 'scored' && score) {
    return `${score.total_points} pts total · ${score.podium_points} podium · ${score.bonus_points} bonus`
  }

  if (status === 'scored' && !hasPredicted) {
    return 'No entry submitted. This round counted as 0.'
  }

  if ((status === 'locked' || status === 'completed') && hasPredicted) {
    return status === 'locked'
      ? 'Entry locked in. Weekend is live.'
      : 'Race finished. Final scoring is still pending.'
  }

  if ((status === 'locked' || status === 'completed') && !hasPredicted) {
    return status === 'locked'
      ? 'The window closed without an entry.'
      : 'Missed this race. Final scoring is still pending.'
  }

  if (hasPredicted) {
    return 'Entry saved. You can still edit before lock.'
  }

  return 'Prediction window is open.'
}

export default async function UserHistoryPage() {
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

  const { data: races, error: racesError } = await supabase
    .from('races')
    .select('id, round, race_name, status, race_start_at, prediction_lock_at, circuits(emoji, name, country)')
    .eq('season', currentSeason)
    .neq('status', 'cancelled')
    .order('race_start_at', { ascending: false })

  if (racesError) {
    console.error('Season races fetch error:', racesError)
  }

  const { data: predictions, error: predictionsError } = await supabase
    .from('predictions')
    .select('race_id')
    .eq('user_id', user.id)

  if (predictionsError) {
    console.error('Predictions fetch error:', predictionsError)
  }

  const { data: scores } = await supabase
    .from('user_race_scores')
    .select('race_id, total_points, podium_points, bonus_points, exact_hits')
    .eq('user_id', user.id)

  const typedRaces = (races || []) as SeasonRace[]
  const predictedRaceIds = new Set(((predictions || []) as PredictionRow[]).map((prediction) => prediction.race_id))
  const scoreByRaceId = new Map(((scores || []) as ScoreRow[]).map((score) => [score.race_id, score]))

  const entries = typedRaces.map((race) => {
    const status = getEffectiveRaceStatus(race)
    const hasPredicted = predictedRaceIds.has(race.id)
    const score = scoreByRaceId.get(race.id)

    let category: HistoryEntry['category'] = 'upcoming'
    if (status === 'scored' && hasPredicted) category = 'scored'
    else if ((status === 'locked' || status === 'completed') && hasPredicted) category = 'awaiting'
    else if ((status === 'locked' || status === 'completed' || status === 'scored') && !hasPredicted) category = 'missed'

    return {
      race,
      status,
      hasPredicted,
      score,
      category,
      summary: getEntrySummary(status, hasPredicted, score),
    }
  })

  const groupedEntries = [...entries].sort((left, right) => {
    const categoryOrder = getCategoryOrder(left.category) - getCategoryOrder(right.category)
    if (categoryOrder !== 0) return categoryOrder

    return new Date(right.race.race_start_at).getTime() - new Date(left.race.race_start_at).getTime()
  })

  const enteredCount = entries.filter((entry) => entry.hasPredicted).length
  const missedCount = entries.filter((entry) => entry.category === 'missed').length
  const totalPoints = Array.from(scoreByRaceId.values()).reduce((sum, score) => sum + score.total_points, 0)
  const exactHits = Array.from(scoreByRaceId.values()).reduce((sum, score) => sum + score.exact_hits, 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="flex items-center text-3xl font-black italic tracking-tighter">
            <History className="mr-3 h-8 w-8 text-red-500" /> MY SEASON
          </h1>
          <p className="text-sm text-slate-400">See what is entered, still live, scored, or missed.</p>
        </div>
        <TenantContextBanner tenantName={tenantContext.tenantName} label="Playing in" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-card p-4 shadow-xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Entered</div>
          <div className="mt-2 text-3xl font-black italic text-white">{enteredCount}</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-4 shadow-xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Missed</div>
          <div className="mt-2 text-3xl font-black italic text-white">{missedCount}</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-4 shadow-xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Points</div>
          <div className="mt-2 text-3xl font-black italic text-red-500">{totalPoints}</div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-card p-4 shadow-xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Exact</div>
          <div className="mt-2 text-3xl font-black italic text-white">{exactHits}</div>
        </div>
      </div>

      <div className="space-y-6">
        {groupedEntries.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-12 text-center text-slate-400 shadow-xl">
            Your season story starts with the next race weekend.
          </div>
        ) : (
          (['awaiting', 'scored', 'missed', 'upcoming'] as const).map((category) => {
            const sectionEntries = groupedEntries.filter((entry) => entry.category === category)
            if (sectionEntries.length === 0) return null

            return (
              <section key={category} className="space-y-4">
                <div className="flex items-center gap-3">
                  {category === 'scored' ? (
                    <Trophy className="h-6 w-6 text-red-500" />
                  ) : (
                    <CalendarClock className="h-6 w-6 text-red-500" />
                  )}
                  <h2 className="text-2xl font-black italic tracking-tighter">{getCategoryTitle(category)}</h2>
                </div>

                <div className="grid gap-4">
                  {sectionEntries.map((entry) => (
                    <div
                      key={entry.race.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02] md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="text-sm font-bold uppercase tracking-widest text-red-500">
                          {getRoundLabel(entry.race.round)}
                        </div>
                        <h3 className="text-xl font-bold">{entry.race.race_name}</h3>
                        <div className="text-sm text-slate-400">
                          {entry.race.circuits?.emoji} {entry.race.circuits?.name}, {entry.race.circuits?.country}
                        </div>
                        <p className="max-w-2xl text-sm text-slate-300">{entry.summary}</p>
                      </div>

                      {entry.score ? (
                        <div className="flex gap-4 items-center">
                          <div className="min-w-24 rounded-xl border border-white/5 bg-black/30 p-4 text-center">
                            <div className="mb-1 text-xs font-bold uppercase text-slate-500">Total</div>
                            <div className="text-3xl font-black italic text-red-500">{entry.score.total_points}</div>
                          </div>
                          <div className="hidden min-w-24 rounded-xl border border-white/5 bg-black/30 p-4 text-center sm:block">
                            <div className="mb-1 text-xs font-bold uppercase text-slate-500">Podium</div>
                            <div className="text-xl font-bold text-white">{entry.score.podium_points}</div>
                          </div>
                          <div className="hidden min-w-24 rounded-xl border border-white/5 bg-black/30 p-4 text-center sm:block">
                            <div className="mb-1 text-xs font-bold uppercase text-slate-500">Bonus</div>
                            <div className="text-xl font-bold text-white">{entry.score.bonus_points}</div>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`rounded-xl border p-4 text-center text-sm font-bold ${
                            entry.category === 'missed'
                              ? 'border-red-500/20 bg-red-500/10 text-red-300'
                              : entry.category === 'awaiting'
                                ? 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                : 'border-white/5 bg-black/30 text-slate-300'
                          }`}
                        >
                          {entry.category === 'missed'
                            ? 'No Entry'
                            : entry.category === 'awaiting'
                              ? 'Awaiting Score'
                              : entry.hasPredicted
                                ? 'Entered'
                                : 'Open'}
                        </div>
                      )}

                      <div className="shrink-0">
                        <PendingLink
                          href={`/race/${entry.race.id}/predict`}
                          className="inline-flex items-center gap-1.5 font-bold text-red-400 transition-colors hover:text-red-300"
                        >
                          {getActionLabel(entry)}
                        </PendingLink>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}
