import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, ClipboardList, Lock, TimerReset, Trophy } from 'lucide-react'
import { format, formatDistanceToNowStrict } from 'date-fns'
import PredictionForm from './prediction-form'
import { getRoundLabel } from '@/utils/race-copy'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantAssignmentRequired } from '@/components/ui/tenant-assignment-required'
import { getCompetitionRank, sortCompetitionStandings } from '@/utils/competition'
import { RaceStatusPill } from '@/components/ui/race-status-pill'
import { RaceMetaStrip } from '@/components/ui/race-meta-strip'
import { SectionHeader } from '@/components/ui/section-header'
import { getRaceParticipationLabel, getRaceTone } from '@/utils/race-experience'

type Driver = {
  id: string
  code: string
  full_name: string
  emoji?: string | null
}

type BonusOption = {
  id: string
  label?: string | null
}

type BonusQuestion = {
  id: string
  question_text: string
  points: number
  bonus_options?: BonusOption[]
}

type LeaderboardStanding = {
  user_id: string
  total_points: number
  exact_hits: number
  races_scored: number
  profiles?:
    | {
        tenant_id?: string | null
      }
    | Array<{
        tenant_id?: string | null
      }>
    | null
}

type RaceScoreEntry = {
  user_id: string
  total_points: number
  exact_hits: number
}

type ComparisonTone = 'exact' | 'podium' | 'miss'

function getStandingProfile(entry: LeaderboardStanding) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
}

function getMovementLabel(currentRank: number | null, previousRank: number | null) {
  if (!currentRank) {
    return { title: 'Not ranked', detail: 'No leaderboard position yet.' }
  }

  if (!previousRank) {
    return { title: `#${currentRank}`, detail: 'First scored result in this view.' }
  }

  if (currentRank < previousRank) {
    return {
      title: `Up ${previousRank - currentRank}`,
      detail: `Moved from #${previousRank} to #${currentRank}.`,
    }
  }

  if (currentRank > previousRank) {
    return {
      title: `Down ${currentRank - previousRank}`,
      detail: `Dropped from #${previousRank} to #${currentRank}.`,
    }
  }

  return { title: `#${currentRank}`, detail: 'Position unchanged after this race.' }
}

function getDriverLabel(drivers: Driver[], driverId?: string | null) {
  if (!driverId) return 'Not selected'

  const driver = drivers.find((entry) => entry.id === driverId)
  if (!driver) return 'Unknown driver'

  return `${driver.code} - ${driver.full_name}${driver.emoji ? ` ${driver.emoji}` : ''}`
}

function getBonusAnswerLabel(question: BonusQuestion, optionId?: string | null) {
  if (!optionId) return 'No answer submitted'

  const option = question.bonus_options?.find((entry) => entry.id === optionId)
  return option?.label || 'Unknown option'
}

function getComparisonTone(predictedDriverId?: string | null, officialDriverId?: string | null, officialPodiumIds: string[] = []) {
  if (!predictedDriverId || !officialDriverId) return 'miss' as ComparisonTone
  if (predictedDriverId === officialDriverId) return 'exact' as ComparisonTone
  if (officialPodiumIds.includes(predictedDriverId)) return 'podium' as ComparisonTone
  return 'miss' as ComparisonTone
}

function getComparisonToneClasses(tone: ComparisonTone) {
  if (tone === 'exact') return 'border-green-500/20 bg-green-500/10 text-green-200'
  if (tone === 'podium') return 'border-amber-500/20 bg-amber-500/10 text-amber-100'
  return 'border-red-500/20 bg-red-500/10 text-red-200'
}

export default async function PredictPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { id } = params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const tenantContext = await getUserTenantContext(supabase, user.id)

  if (!tenantContext.tenantId) {
    return <TenantAssignmentRequired isAdmin={tenantContext.role === 'admin'} />
  }

  const { data: race, error: raceError } = await supabase
    .from('races')
    .select('*, circuits(name, country, emoji)')
    .eq('id', id)
    .single()

  if (raceError || !race) {
    return <div className="p-12 text-center text-slate-400">Race not found.</div>
  }

  const effectiveStatus = getEffectiveRaceStatus(race)
  const isLocked = effectiveStatus === 'locked' || effectiveStatus === 'completed' || effectiveStatus === 'cancelled'
  const shouldShowReadOnlyState = isLocked || effectiveStatus === 'scored'

  const { data: allDrivers } = await supabase
    .from('drivers')
    .select('id, code, full_name, emoji')
    .order('full_name')

  const { data: activeDrivers } = await supabase
    .from('drivers')
    .select('*, constructors(name, short_code)')
    .eq('active', true)
    .order('full_name')

  const { data: bonusQuestions } = await supabase
    .from('bonus_questions')
    .select('*, bonus_options(*)')
    .eq('race_id', id)
    .eq('is_active', true)
    .order('display_order')

  const { data: prediction } = await supabase
    .from('predictions')
    .select('*')
    .eq('race_id', id)
    .eq('user_id', user.id)
    .single()

  let predictionBonusAnswers: Array<{ bonus_question_id: string; bonus_option_id: string }> = []
  if (prediction) {
    const { data: pba } = await supabase
      .from('prediction_bonus_answers')
      .select('bonus_question_id, bonus_option_id')
      .eq('prediction_id', prediction.id)
    predictionBonusAnswers = pba || []
  }

  const { data: raceResult } = await supabase
    .from('race_results')
    .select('*')
    .eq('race_id', id)
    .single()

  const { data: raceBonusAnswers } = await supabase
    .from('race_bonus_answers')
    .select('bonus_question_id, correct_bonus_option_id')
    .eq('race_id', id)

  const { data: userScore } = await supabase
    .from('user_race_scores')
    .select('*')
    .eq('race_id', id)
    .eq('user_id', user.id)
    .single()

  const drivers = (allDrivers || []) as Driver[]
  const typedBonusQuestions = (bonusQuestions || []) as BonusQuestion[]

  const bonusAnswerMap = new Map<string, string>()
  predictionBonusAnswers.forEach((answer) => {
    bonusAnswerMap.set(answer.bonus_question_id, answer.bonus_option_id)
  })

  const officialBonusAnswerMap = new Map<string, string>()
  ;(raceBonusAnswers || []).forEach((answer) => {
    officialBonusAnswerMap.set(answer.bonus_question_id, answer.correct_bonus_option_id)
  })

  const predictionPodium = prediction
    ? [
        { label: 'P1', driverId: prediction.p1_driver_id, value: getDriverLabel(drivers, prediction.p1_driver_id) },
        { label: 'P2', driverId: prediction.p2_driver_id, value: getDriverLabel(drivers, prediction.p2_driver_id) },
        { label: 'P3', driverId: prediction.p3_driver_id, value: getDriverLabel(drivers, prediction.p3_driver_id) },
      ]
    : []

  const officialPodium = raceResult
    ? [
        { label: 'P1', driverId: raceResult.p1_driver_id, value: getDriverLabel(drivers, raceResult.p1_driver_id) },
        { label: 'P2', driverId: raceResult.p2_driver_id, value: getDriverLabel(drivers, raceResult.p2_driver_id) },
        { label: 'P3', driverId: raceResult.p3_driver_id, value: getDriverLabel(drivers, raceResult.p3_driver_id) },
      ]
    : []

  const actualPodiumIds = raceResult
    ? [raceResult.p1_driver_id, raceResult.p2_driver_id, raceResult.p3_driver_id].filter(Boolean)
    : []
  const podiumHitCount = prediction
    ? [prediction.p1_driver_id, prediction.p2_driver_id, prediction.p3_driver_id].filter((driverId) =>
        actualPodiumIds.includes(driverId)
      ).length
    : 0
  const exactPodiumHits = userScore?.exact_hits ?? 0
  const shuffledPodiumHits = Math.max(podiumHitCount - exactPodiumHits, 0)
  const missedPodiumSpots = Math.max(3 - podiumHitCount, 0)
  const correctBonusCount = typedBonusQuestions.filter(
    (question) =>
      bonusAnswerMap.get(question.id) &&
      bonusAnswerMap.get(question.id) === officialBonusAnswerMap.get(question.id)
  ).length

  const lockCountdown =
    effectiveStatus === 'upcoming'
      ? formatDistanceToNowStrict(new Date(race.prediction_lock_at), { addSuffix: true })
      : null

  let globalMovement = { title: 'Unavailable', detail: 'This race has not updated the overall table yet.' }
  let groupMovement = { title: 'Unavailable', detail: 'This race has not updated your group table yet.' }

  if (effectiveStatus === 'scored' && userScore) {
    const { data: leaderboardRows } = await supabase
      .from('leaderboard_cache')
      .select('user_id, total_points, exact_hits, races_scored, profiles(tenant_id)')
      .eq('season', race.season)

    const { data: raceScoreRows } = await supabase
      .from('user_race_scores')
      .select('user_id, total_points, exact_hits')
      .eq('race_id', id)

    const raceScoreMap = new Map(
      ((raceScoreRows || []) as RaceScoreEntry[]).map((entry) => [entry.user_id, entry])
    )

    const currentStandings = sortCompetitionStandings((leaderboardRows || []) as LeaderboardStanding[])
    const previousStandings = sortCompetitionStandings(
      currentStandings.flatMap((entry) => {
        const raceScore = raceScoreMap.get(entry.user_id)
        const previousEntry = {
          ...entry,
          total_points: entry.total_points - (raceScore?.total_points || 0),
          exact_hits: entry.exact_hits - (raceScore?.exact_hits || 0),
          races_scored: entry.races_scored - (raceScore ? 1 : 0),
        }

        return previousEntry.races_scored > 0 ? [previousEntry] : []
      })
    )

    const currentGlobalRank = getCompetitionRank(currentStandings, user.id)
    const previousGlobalRank = getCompetitionRank(previousStandings, user.id)
    globalMovement = getMovementLabel(currentGlobalRank, previousGlobalRank)

    const currentGroupStandings = sortCompetitionStandings(
      currentStandings.filter((entry) => getStandingProfile(entry)?.tenant_id === tenantContext.tenantId)
    )
    const previousGroupStandings = sortCompetitionStandings(
      previousStandings.filter((entry) => getStandingProfile(entry)?.tenant_id === tenantContext.tenantId)
    )
    const currentGroupRank = getCompetitionRank(currentGroupStandings, user.id)
    const previousGroupRank = getCompetitionRank(previousGroupStandings, user.id)
    groupMovement = getMovementLabel(currentGroupRank, previousGroupRank)
  }

  const compactNote =
    effectiveStatus === 'upcoming'
      ? prediction
        ? 'Entry locked in for now. You can still edit before FP1 minus five minutes.'
        : 'Pick your podium before FP1 minus five minutes.'
      : effectiveStatus === 'locked'
        ? prediction
          ? 'Your entry is locked while the weekend plays out.'
          : 'The window is closed for this round.'
        : effectiveStatus === 'completed'
          ? 'The race is finished. Final scoring is still on the way.'
          : effectiveStatus === 'scored'
            ? prediction
              ? 'Final result is in. Compare your call below.'
              : 'No entry this round. Official result below.'
            : 'This round is closed.'

  return (
    <div className="mx-auto max-w-5xl space-y-5 animate-in fade-in duration-500">
      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-medium text-slate-300">
            {getRoundLabel(race.round)}
          </span>
          <RaceStatusPill status={effectiveStatus} size="xs" />
          {effectiveStatus === 'upcoming' && lockCountdown && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-medium text-slate-300">
              <TimerReset className="h-3.5 w-3.5 text-red-400" />
              Locks {lockCountdown}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-4">
          <SectionHeader title={race.race_name} description={compactNote} />

          <p className="flex flex-wrap items-center gap-2 text-sm text-slate-400 md:text-base">
            <span className="text-lg">{race.circuits?.emoji}</span>
            <span>
              {race.circuits?.name}, {race.circuits?.country}
            </span>
          </p>

          <RaceMetaStrip
            items={[
              {
                label: 'Entry',
                value: getRaceParticipationLabel(effectiveStatus, Boolean(prediction)),
                icon: prediction ? ClipboardList : AlertCircle,
                tone:
                  prediction && effectiveStatus === 'upcoming'
                    ? 'scored'
                    : getRaceTone(effectiveStatus),
              },
              {
                label: 'Lock',
                value: format(new Date(race.prediction_lock_at), 'MMM d, p'),
                icon: TimerReset,
                tone: effectiveStatus === 'upcoming' ? 'open' : getRaceTone(effectiveStatus),
              },
              {
                label: 'Race',
                value: format(new Date(race.race_start_at), 'MMM d, p'),
                icon: Trophy,
              },
            ]}
          />
        </div>
      </section>

      {!shouldShowReadOnlyState && (
        <PredictionForm
          race={race}
          drivers={activeDrivers}
          bonusQuestions={bonusQuestions}
          existingPrediction={prediction}
          existingBonusAnswers={predictionBonusAnswers}
          isLocked={isLocked}
        />
      )}

      {shouldShowReadOnlyState && (
        <div className="grid gap-5 pb-12 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <SectionHeader
                eyebrow="Race audit"
                title={prediction ? 'Your call vs official' : 'Official result'}
              />

              {!prediction && (
                <div className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] text-amber-300">
                  <Lock className="mr-2 h-4 w-4" />
                  No entry submitted
                </div>
              )}
            </div>

            <div className="mt-4 hidden grid-cols-[4rem,minmax(0,1fr),minmax(0,1fr),auto] gap-3 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 md:grid">
              <span>Slot</span>
              <span>Your pick</span>
              <span>Official</span>
              <span>Result</span>
            </div>

            <div className="mt-3 space-y-2">
              {(prediction ? predictionPodium : officialPodium).map((entry, index) => {
                const officialEntry = officialPodium[index]
                const tone = prediction
                  ? getComparisonTone(entry.driverId, officialEntry?.driverId, actualPodiumIds)
                  : 'miss'

                return (
                  <div
                    key={entry.label}
                    className={`grid gap-2 rounded-2xl border p-3 md:grid-cols-[4rem,minmax(0,1fr),minmax(0,1fr),auto] md:items-center ${
                      prediction ? getComparisonToneClasses(tone) : 'border-white/10 bg-black/25 text-slate-100'
                    }`}
                  >
                    <div className="text-sm font-black uppercase tracking-widest">{entry.label}</div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 md:hidden">Your pick</div>
                      <div className="mt-1 text-sm font-semibold md:mt-0">{prediction ? entry.value : 'No entry'}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] opacity-70 md:hidden">Official</div>
                      <div className="mt-1 text-sm font-semibold md:mt-0">{officialEntry?.value || 'Awaiting official result'}</div>
                    </div>
                    {prediction && officialEntry && (
                      <div className="justify-self-start rounded-full border border-current/20 bg-black/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] md:justify-self-end">
                        {tone === 'exact' ? 'Exact' : tone === 'podium' ? 'On podium' : 'Miss'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {typedBonusQuestions.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Bonus Calls</div>
                <div className="mt-3 space-y-2">
                  {typedBonusQuestions.map((question) => {
                    const predictedAnswer = bonusAnswerMap.get(question.id)
                    const officialAnswer = officialBonusAnswerMap.get(question.id)
                    const isCorrect = Boolean(predictedAnswer && officialAnswer && predictedAnswer === officialAnswer)

                    return (
                      <div key={question.id} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                        <div className="font-semibold text-slate-100">{question.question_text}</div>
                        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr),minmax(0,1fr),auto] md:items-center">
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Your call</div>
                            <div className="mt-1 text-sm text-slate-200">
                              {prediction ? getBonusAnswerLabel(question, predictedAnswer) : 'No answer submitted'}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Official</div>
                            <div className="mt-1 text-sm text-slate-200">
                              {officialAnswer ? getBonusAnswerLabel(question, officialAnswer) : 'Awaiting official answer'}
                            </div>
                          </div>
                          {prediction && officialAnswer && (
                            <div
                              className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${
                                isCorrect
                                  ? 'border-green-500/20 bg-green-500/10 text-green-300'
                                  : 'border-red-500/20 bg-red-500/10 text-red-300'
                              }`}
                            >
                              {isCorrect ? 'Correct' : 'Miss'}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          <div className="space-y-4">
            {effectiveStatus === 'scored' && userScore ? (
              <>
                <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
                  <SectionHeader eyebrow="Weekend" title="Weekend result" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-center">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Total</div>
                      <div className="mt-2 text-3xl font-black italic text-red-500">{userScore.total_points}</div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-center">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Podium</div>
                      <div className="mt-2 text-2xl font-black italic text-slate-100">{userScore.podium_points}</div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/30 p-4 text-center">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Bonus</div>
                      <div className="mt-2 text-2xl font-black italic text-slate-100">{userScore.bonus_points}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Podium read</div>
                      <div className="mt-2 text-base font-bold text-white">
                        {exactPodiumHits} exact · {shuffledPodiumHits} on podium
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {missedPodiumSpots === 0
                          ? 'Every slot landed on the podium.'
                          : `${missedPodiumSpots} slot${missedPodiumSpots === 1 ? '' : 's'} missed completely.`}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Bonus read</div>
                      <div className="mt-2 text-base font-bold text-white">
                        {typedBonusQuestions.length > 0 ? `${correctBonusCount}/${typedBonusQuestions.length} correct` : 'No bonus'}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {typedBonusQuestions.length > 0 ? 'Bonus points are included above.' : 'This round had no bonus questions.'}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
                  <div className="flex items-center text-xs font-bold uppercase tracking-[0.25em] text-slate-500">
                    <Trophy className="mr-2 h-4 w-4 text-red-500" /> Table impact
                  </div>

                  <div className="mt-4 space-y-3">
                    <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Everyone</div>
                      <div className="mt-2 text-base font-bold text-white">{globalMovement.title}</div>
                      <p className="mt-1 text-sm text-slate-400">{globalMovement.detail}</p>
                    </div>
                    <div className="rounded-2xl border border-white/5 bg-black/30 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">My group</div>
                      <div className="mt-2 text-base font-bold text-white">{groupMovement.title}</div>
                      <p className="mt-1 text-sm text-slate-400">{groupMovement.detail}</p>
                    </div>
                    {!prediction && (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                        This round counts as a missed weekend in your season.
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Race status</div>
                <div className="mt-3 rounded-2xl border border-white/5 bg-black/30 p-4 text-sm text-slate-300">
                  {effectiveStatus === 'locked'
                    ? 'The window is closed. Official results are not published yet.'
                    : effectiveStatus === 'completed'
                      ? 'The race is complete, but final scoring is still pending.'
                      : 'This race is no longer open for prediction.'}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
