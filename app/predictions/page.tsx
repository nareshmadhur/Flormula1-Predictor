import { createClient } from '@/utils/supabase/server'
import { Calendar, ChevronRight, Clock3, MapPin, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { redirect } from 'next/navigation'
import { getEffectiveRaceStatus, RaceStatus } from '@/utils/race-status'
import { getCurrentSeason } from '@/utils/season'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantContextBanner } from '@/components/ui/tenant-context-banner'
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

function getRaceStatusLabel(status: RaceStatus) {
  if (status === 'upcoming') return 'Open for predictions'
  if (status === 'locked') return 'Locked'
  if (status === 'completed') return 'Awaiting score'
  if (status === 'scored') return 'Scored'
  return 'Cancelled'
}

function getRaceActionLabel(status: RaceStatus, hasPredicted: boolean) {
  if (status === 'upcoming') {
    return hasPredicted ? 'Edit Prediction' : 'Predict Now'
  }

  if (status === 'locked' || status === 'completed' || status === 'scored') {
    return 'View Race'
  }

  return 'View Details'
}

function RaceListCard({
  race,
  status,
  hasPredicted,
  score,
}: {
  race: RaceCardData
  status: RaceStatus
  hasPredicted: boolean
  score?: number
}) {
  const isActionable = status === 'upcoming'

  return (
    <div
      className={`group rounded-2xl border p-6 shadow-xl transition-all hover:bg-white/[0.02] ${
        hasPredicted ? 'border-green-500/30 bg-card' : 'border-white/5 bg-card'
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-red-500">
              Round {race.round}
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs font-medium text-slate-300">
              {getRaceStatusLabel(status)}
            </span>
            {hasPredicted && (
              <span className="rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-green-400">
                Entered
              </span>
            )}
            {typeof score === 'number' && (
              <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-red-300">
                {score} pts
              </span>
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">{race.race_name}</h2>
            <div className="mt-1 flex items-center text-slate-400">
              <MapPin className="mr-1.5 h-4 w-4 text-slate-500" />
              <span>
                {race.circuits?.name}, {race.circuits?.country} {race.circuits?.emoji}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <div className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-slate-300">
              <span className="mr-2 text-slate-500">Race:</span>
              {format(new Date(race.race_start_at), 'MMM d, p')}
            </div>
            <div className="rounded-lg border border-white/5 bg-black/30 px-3 py-2 text-slate-300">
              <span className="mr-2 text-slate-500">Lock (FP1 - 5m):</span>
              {format(new Date(race.prediction_lock_at), 'MMM d, p')}
            </div>
          </div>
        </div>

        <div className="w-full shrink-0 sm:w-auto">
          <PendingLink
            href={`/race/${race.id}/predict`}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-6 py-3 font-bold transition-all sm:w-auto ${
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

export default async function SeasonDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const currentSeason = await getCurrentSeason(supabase)
  const tenantContext = await getUserTenantContext(supabase, user.id)

  if (!tenantContext.tenantId) {
    return <TenantAssignmentRequired isAdmin={tenantContext.role === 'admin'} />
  }

  const { data: races } = await supabase
    .from('races')
    .select('*, circuits(name, country, emoji)')
    .eq('season', currentSeason)
    .neq('status', 'cancelled')
    .order('race_start_at', { ascending: true })

  const { data: predictions } = await supabase
    .from('predictions')
    .select('race_id')
    .eq('user_id', user.id)

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
  const lockedRaces = typedRaces.filter((race) => {
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

  const nextRace = openRaces[0] || lockedRaces[0] || missedRaces[0] || scoredRaces[0] || null

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black shadow-2xl">
        <div className="grid gap-6 p-8 md:grid-cols-[1.4fr,0.9fr] md:p-10">
          <div className="space-y-4">
            <div className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-sm font-bold uppercase tracking-wider text-red-300">
              Season {currentSeason}
            </div>
            <TenantContextBanner tenantName={tenantContext.tenantName} />
            <div>
              <h1 className="text-4xl font-black italic tracking-tighter md:text-5xl">SEASON DASHBOARD</h1>
              <p className="mt-2 max-w-2xl text-slate-300">
                Track what needs your attention, what is waiting on results, and what you have already scored.
              </p>
            </div>

            {nextRace ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {getRaceStatusLabel(getEffectiveRaceStatus(nextRace))}
                </div>
                <div className="mt-2 text-2xl font-bold text-white">{nextRace.race_name}</div>
                <div className="mt-1 text-slate-400">
                  {nextRace.circuits?.name}, {nextRace.circuits?.country} {nextRace.circuits?.emoji}
                </div>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-300">
                  <span className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                    Race: {format(new Date(nextRace.race_start_at), 'MMM d, p')}
                  </span>
                  <span className="rounded-lg border border-white/5 bg-black/30 px-3 py-2">
                    Lock (FP1 - 5m): {format(new Date(nextRace.prediction_lock_at), 'MMM d, p')}
                  </span>
                </div>
                <PendingLink
                  href={`/race/${nextRace.id}/predict`}
                  className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-all hover:bg-red-500"
                >
                  Open Race
                  <ChevronRight className="ml-1 h-5 w-5" />
                </PendingLink>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5 text-slate-400">
                No races are currently scheduled for this season.
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
                <Calendar className="mr-2 h-4 w-4 text-red-400" /> Open Predictions
              </div>
              <div className="mt-3 text-4xl font-black italic text-white">{openRaces.length}</div>
              <p className="mt-2 text-sm text-slate-400">Races you can still enter or edit right now.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
                <Clock3 className="mr-2 h-4 w-4 text-amber-400" /> Awaiting Results
              </div>
              <div className="mt-3 text-4xl font-black italic text-white">{lockedRaces.length}</div>
              <p className="mt-2 text-sm text-slate-400">Locked or completed races still moving through the pipeline.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
                <Trophy className="mr-2 h-4 w-4 text-yellow-400" /> Scored Entries
              </div>
              <div className="mt-3 text-4xl font-black italic text-white">{typedScores.length}</div>
              <p className="mt-2 text-sm text-slate-400">Races where your points are already final.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
                <Clock3 className="mr-2 h-4 w-4 text-red-400" /> Missed Weekends
              </div>
              <div className="mt-3 text-4xl font-black italic text-white">{missedRaces.length}</div>
              <p className="mt-2 text-sm text-slate-400">Closed races that counted without your prediction.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black italic tracking-tight">Ready To Predict</h2>
            <p className="text-slate-400">The races you can still submit or update.</p>
          </div>
        </div>

        {openRaces.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-8 text-center text-slate-400 shadow-xl">
            No open prediction windows right now.
          </div>
        ) : (
          <div className="grid gap-6">
            {openRaces.map((race) => (
              <RaceListCard
                key={race.id}
                race={race}
                status={getEffectiveRaceStatus(race)}
                hasPredicted={predictedRaceIds.has(race.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black italic tracking-tight">Awaiting Results</h2>
          <p className="text-slate-400">Locked races and finished races where you already entered a prediction.</p>
        </div>

        {lockedRaces.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-8 text-center text-slate-400 shadow-xl">
            Nothing is waiting on results right now.
          </div>
        ) : (
          <div className="grid gap-6">
            {lockedRaces.map((race) => (
              <RaceListCard
                key={race.id}
                race={race}
                status={getEffectiveRaceStatus(race)}
                hasPredicted={predictedRaceIds.has(race.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black italic tracking-tight">Missed Weekends</h2>
          <p className="text-slate-400">Closed races that now sit in your season story as missed opportunities.</p>
        </div>

        {missedRaces.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-8 text-center text-slate-400 shadow-xl">
            You have not missed any race weekends this season.
          </div>
        ) : (
          <div className="grid gap-6">
            {missedRaces.slice(0, 5).map((race) => (
              <RaceListCard
                key={race.id}
                race={race}
                status={getEffectiveRaceStatus(race)}
                hasPredicted={false}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-black italic tracking-tight">Recently Scored</h2>
          <p className="text-slate-400">Latest races with final points available.</p>
        </div>

        {scoredRaces.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-8 text-center text-slate-400 shadow-xl">
            No races have been scored yet this season.
          </div>
        ) : (
          <div className="grid gap-6">
            {scoredRaces.slice(0, 5).map((race) => (
              <RaceListCard
                key={race.id}
                race={race}
                status={getEffectiveRaceStatus(race)}
                hasPredicted={predictedRaceIds.has(race.id)}
                score={scoreByRaceId.get(race.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
