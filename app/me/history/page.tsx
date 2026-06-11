import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { CalendarClock, ChevronDown, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { getCurrentSeason } from '@/utils/season'
import { getRoundLabel } from '@/utils/race-copy'
import { getEffectiveRaceStatus, type RaceStatus } from '@/utils/race-status'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantContextBanner } from '@/components/ui/tenant-context-banner'
import { TenantAssignmentRequired } from '@/components/ui/tenant-assignment-required'
import { PendingLink } from '@/components/ui/pending-link'
import { PageBackLink } from '@/components/ui/page-back-link'
import { RaceStatusPill } from '@/components/ui/race-status-pill'
import { SectionHeader } from '@/components/ui/section-header'
import { getMemberRaceActionLabel } from '@/utils/race-experience'
import { getRaceWeekendConsistency } from '@/utils/group-race-experience'

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
  id: string
  race_id: string
}

type ScoreRow = {
  race_id: string
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
}

type BonusOptionRow = {
  id: string
  label?: string | null
}

type BonusQuestionRow = {
  id: string
  race_id: string
  question_text: string
  bonus_options?: BonusOptionRow[] | null
}

type PredictionBonusAnswerRow = {
  prediction_id: string
  bonus_question_id: string
  bonus_option_id: string
}

type RaceBonusAnswerRow = {
  race_id: string
  bonus_question_id: string
  correct_bonus_option_id: string
}

type BonusHistoryItem = {
  questionText: string
  selectedLabel: string
  officialLabel: string | null
  isCorrect: boolean
  isResolved: boolean
}

type HistoryEntry = {
  race: SeasonRace
  status: RaceStatus
  hasPredicted: boolean
  score?: ScoreRow
  category: 'awaiting' | 'scored' | 'missed' | 'upcoming'
  summary: string
  bonusHistory: BonusHistoryItem[]
}

function getCategoryTitle(category: HistoryEntry['category']) {
  if (category === 'awaiting') return 'Awaiting Results'
  if (category === 'scored') return 'Scored Weekends'
  if (category === 'missed') return 'Missed Weekends'
  return 'Upcoming Weekends'
}

function getActionLabel(entry: HistoryEntry) {
  return getMemberRaceActionLabel(entry.status, entry.hasPredicted)
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
    return 'No entry · 0 pts'
  }

  if ((status === 'locked' || status === 'completed') && hasPredicted) {
    return status === 'locked' ? 'Entry locked.' : 'Scoring pending.'
  }

  if ((status === 'locked' || status === 'completed') && !hasPredicted) {
    return status === 'locked' ? 'No entry.' : 'No entry · scoring pending.'
  }

  if (hasPredicted) {
    return 'Entry saved.'
  }

  return 'Window open.'
}

function getBonusQuestionLabel(questionText: string) {
  const cleaned = questionText.replace(/\?$/, '').trim()
  if (cleaned.length <= 28) return cleaned
  return `${cleaned.slice(0, 28).trimEnd()}…`
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
    .select('id, race_id')
    .eq('user_id', user.id)

  if (predictionsError) {
    console.error('Predictions fetch error:', predictionsError)
  }

  const { data: scores } = await supabase
    .from('user_race_scores')
    .select('race_id, total_points, podium_points, bonus_points, exact_hits')
    .eq('user_id', user.id)

  const typedRaces = (races || []) as SeasonRace[]
  const typedPredictions = (predictions || []) as PredictionRow[]
  const predictedRaceIds = new Set(typedPredictions.map((prediction) => prediction.race_id))
  const scoreByRaceId = new Map(((scores || []) as ScoreRow[]).map((score) => [score.race_id, score]))
  const raceIds = typedRaces.map((race) => race.id)
  const predictionIds = typedPredictions.map((prediction) => prediction.id)

  const [{ data: bonusQuestions }, { data: predictionBonusAnswers }, { data: raceBonusAnswers }] = await Promise.all([
    raceIds.length > 0
      ? supabase
          .from('bonus_questions')
          .select('id, race_id, question_text, bonus_options(id, label)')
          .in('race_id', raceIds)
          .eq('tenant_id', tenantContext.tenantId)
          .eq('is_active', true)
          .order('display_order')
      : Promise.resolve({ data: [] as BonusQuestionRow[] }),
    predictionIds.length > 0
      ? supabase
          .from('prediction_bonus_answers')
          .select('prediction_id, bonus_question_id, bonus_option_id')
          .in('prediction_id', predictionIds)
      : Promise.resolve({ data: [] as PredictionBonusAnswerRow[] }),
    raceIds.length > 0
      ? supabase
          .from('race_bonus_answers')
          .select('race_id, bonus_question_id, correct_bonus_option_id')
          .in('race_id', raceIds)
      : Promise.resolve({ data: [] as RaceBonusAnswerRow[] }),
  ])

  const predictionByRaceId = new Map(typedPredictions.map((prediction) => [prediction.race_id, prediction.id]))
  const questionsByRaceId = new Map<string, BonusQuestionRow[]>()
  ;((bonusQuestions || []) as BonusQuestionRow[]).forEach((question) => {
    const group = questionsByRaceId.get(question.race_id) || []
    group.push(question)
    questionsByRaceId.set(question.race_id, group)
  })

  const predictionBonusAnswerMap = new Map<string, string>()
  ;((predictionBonusAnswers || []) as PredictionBonusAnswerRow[]).forEach((answer) => {
    predictionBonusAnswerMap.set(`${answer.prediction_id}:${answer.bonus_question_id}`, answer.bonus_option_id)
  })

  const raceBonusAnswerMap = new Map<string, string>()
  ;((raceBonusAnswers || []) as RaceBonusAnswerRow[]).forEach((answer) => {
    raceBonusAnswerMap.set(`${answer.race_id}:${answer.bonus_question_id}`, answer.correct_bonus_option_id)
  })

  const entries = typedRaces.map((race) => {
    const status = getEffectiveRaceStatus(race)
    const hasPredicted = predictedRaceIds.has(race.id)
    const score = scoreByRaceId.get(race.id)
    const predictionId = predictionByRaceId.get(race.id)
    const raceQuestions = questionsByRaceId.get(race.id) || []

    let category: HistoryEntry['category'] = 'upcoming'
    if (status === 'scored' && hasPredicted) category = 'scored'
    else if ((status === 'locked' || status === 'completed') && hasPredicted) category = 'awaiting'
    else if ((status === 'locked' || status === 'completed' || status === 'scored') && !hasPredicted) category = 'missed'

    const bonusHistory = predictionId
      ? raceQuestions.flatMap((question) => {
          const selectedOptionId = predictionBonusAnswerMap.get(`${predictionId}:${question.id}`)
          const officialOptionId = raceBonusAnswerMap.get(`${race.id}:${question.id}`) || null

          if (!selectedOptionId && !officialOptionId) {
            return []
          }

          const selectedLabel =
            question.bonus_options?.find((option) => option.id === selectedOptionId)?.label || 'No answer'
          const officialLabel =
            question.bonus_options?.find((option) => option.id === officialOptionId)?.label || null

          return [
            {
              questionText: question.question_text,
              selectedLabel,
              officialLabel,
              isCorrect: Boolean(selectedOptionId && officialOptionId && selectedOptionId === officialOptionId),
              isResolved: Boolean(officialOptionId),
            } satisfies BonusHistoryItem,
          ]
        })
      : []

    return {
      race,
      status,
      hasPredicted,
      score,
      category,
      summary: getEntrySummary(status, hasPredicted, score),
      bonusHistory,
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
  const consistency = getRaceWeekendConsistency(
    typedRaces.map((race) => ({
      id: race.id,
      status: getEffectiveRaceStatus(race),
      race_start_at: race.race_start_at,
    })),
    predictedRaceIds
  )
  const upcomingEntries = groupedEntries
    .filter((entry) => entry.category === 'upcoming')
    .sort((left, right) => new Date(left.race.race_start_at).getTime() - new Date(right.race.race_start_at).getTime())
  const nextUpcomingEntry = upcomingEntries[0] || null
  const futureCalendarEntries = upcomingEntries.slice(1)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageBackLink href="/predictions" label="Back to My Season" />
      <SectionHeader
        eyebrow="History"
        title="My season"
        aside={<TenantContextBanner tenantName={tenantContext.tenantName} label="Playing in" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
        <div className="rounded-2xl border border-white/5 bg-card p-4 shadow-xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Current run</div>
          <div className="mt-2 text-3xl font-black italic text-white">{consistency.currentRun}</div>
        </div>
      </div>

      {missedCount > 0 && nextUpcomingEntry && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          You missed {missedCount === 1 ? 'a race weekend' : `${missedCount} race weekends`}, but your season continues.
          {nextUpcomingEntry.hasPredicted
            ? ` Your ${nextUpcomingEntry.race.race_name} entry is already saved.`
            : ` ${nextUpcomingEntry.race.race_name} is your next chance to continue.`}
        </div>
      )}

      <div className="space-y-6">
        {groupedEntries.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-12 text-center text-slate-400 shadow-xl">
            Your season story starts with the next race weekend.
          </div>
        ) : (
          (['awaiting', 'scored', 'missed', 'upcoming'] as const).map((category) => {
            const sectionEntries =
              category === 'upcoming'
                ? nextUpcomingEntry
                  ? [nextUpcomingEntry]
                  : []
                : groupedEntries.filter((entry) => entry.category === category)
            if (sectionEntries.length === 0) return null

            return (
              <section key={category} className="space-y-4">
                <SectionHeader
                  eyebrow="Season story"
                  title={getCategoryTitle(category)}
                  aside={
                    category === 'scored' ? (
                      <Trophy className="h-6 w-6 text-red-500" />
                    ) : (
                      <CalendarClock className="h-6 w-6 text-red-500" />
                    )
                  }
                />

                <div className="grid gap-4">
                  {sectionEntries.map((entry) => (
                    <div
                      key={entry.race.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/5 bg-card p-5 shadow-xl transition-colors hover:bg-white/[0.02] md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-bold uppercase tracking-widest text-red-500">
                            {getRoundLabel(entry.race.round)}
                          </div>
                          <RaceStatusPill status={entry.status} size="xs" />
                        </div>
                        <h3 className="text-xl font-bold">{entry.race.race_name}</h3>
                        <div className="text-sm text-slate-400">
                          {entry.race.circuits?.emoji} {entry.race.circuits?.name}, {entry.race.circuits?.country}
                        </div>
                        <p className="max-w-2xl text-sm text-slate-300">{entry.summary}</p>
                        {entry.bonusHistory.length > 0 && (entry.category === 'scored' || entry.category === 'awaiting') && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {entry.bonusHistory.map((item) => (
                              <span
                                key={`${entry.race.id}-${item.questionText}`}
                                className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
                                  item.isResolved
                                    ? item.isCorrect
                                      ? 'border-green-500/20 bg-green-500/10 text-green-200'
                                      : 'border-red-500/20 bg-red-500/10 text-red-200'
                                    : 'border-amber-500/20 bg-amber-500/10 text-amber-200'
                                }`}
                                title={
                                  item.officialLabel
                                    ? `${item.questionText} · ${item.selectedLabel} · Correct: ${item.officialLabel}`
                                    : `${item.questionText} · ${item.selectedLabel}`
                                }
                              >
                                <span className="font-bold uppercase tracking-wide text-slate-300/80">
                                  {getBonusQuestionLabel(item.questionText)}
                                </span>
                                <span>{item.selectedLabel}</span>
                                {item.isResolved && (
                                  <span className="font-bold">
                                    {item.isCorrect ? '✓' : '✕'}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
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

        {futureCalendarEntries.length > 0 && (
          <details className="rounded-2xl border border-white/10 bg-card shadow-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Future calendar</div>
                <div className="mt-1 font-bold text-white">{futureCalendarEntries.length} later race weekends</div>
              </div>
              <ChevronDown className="h-5 w-5 text-slate-500" />
            </summary>
            <div className="grid gap-2 border-t border-white/5 p-4 md:grid-cols-2">
              {futureCalendarEntries.map((entry) => (
                <PendingLink
                  key={entry.race.id}
                  href={`/race/${entry.race.id}/predict`}
                  className="rounded-xl border border-white/5 bg-black/25 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="text-xs font-bold uppercase tracking-widest text-red-400">
                    {getRoundLabel(entry.race.round)}
                  </div>
                  <div className="mt-1 font-semibold text-white">{entry.race.race_name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {format(new Date(entry.race.race_start_at), 'MMM d, yyyy')}
                  </div>
                </PendingLink>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
