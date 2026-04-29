import { createClient } from '@/utils/supabase/server'
import { ChevronDown, Medal, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { getRoundLabel } from '@/utils/race-copy'
import { getCurrentSeason } from '@/utils/season'
import { getUserTenantContext } from '@/utils/tenant'
import { getAdminAccessContext } from '@/utils/admin-access'
import { getProfileDisplayName } from '@/utils/profile-name'
import { getCompetitionRank, sortCompetitionStandings } from '@/utils/competition'
import { PendingLink } from '@/components/ui/pending-link'
import {
  buildUserLeaderboardBreakdowns,
  type PodiumSlotBreakdown,
  type PodiumSlotOutcome,
} from '@/utils/leaderboard-breakdown'
import { isTestModeProfile } from '@/utils/test-mode'

export const revalidate = 0

type LeaderboardPageProps = {
  searchParams: Promise<{
    view?: string | string[] | undefined
  }>
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

type ScoredRace = {
  id: string
  round: number
  race_name: string
  race_start_at: string
}

type PredictionBreakdownRow = {
  id: string
  user_id: string
  race_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type RaceResultRow = {
  race_id: string
  p1_driver_id: string
  p2_driver_id: string
  p3_driver_id: string
}

type RaceScoreRow = {
  user_id: string
  race_id: string
  total_points: number
  podium_points: number
  bonus_points: number
  exact_hits: number
}

type DriverRow = {
  id: string
  code?: string | null
  emoji?: string | null
}

type BonusQuestionRow = {
  id: string
  race_id: string
  question_text: string
  display_order?: number | null
  bonus_options?: Array<{
    id: string
    label?: string | null
  }> | null
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

function getLeaderboardProfile(entry: LeaderboardEntry) {
  if (Array.isArray(entry.profiles)) {
    return entry.profiles[0] || null
  }

  return entry.profiles || null
}

function getRankDisplay(index: number) {
  if (index === 0) return <Medal className="h-5 w-5 text-yellow-500" />
  if (index === 1) return <Medal className="h-5 w-5 text-slate-300" />
  if (index === 2) return <Medal className="h-5 w-5 text-amber-600" />
  return <span>{index + 1}</span>
}

function getOutcomeClasses(outcome: PodiumSlotOutcome) {
  if (outcome === 'exact') {
    return 'border-green-500/25 bg-green-500/10 text-green-100'
  }

  if (outcome === 'podium') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-100'
  }

  return 'border-red-500/20 bg-red-500/10 text-red-100'
}

function getSlotStatusText(slot: PodiumSlotBreakdown) {
  if (slot.outcome === 'exact') return '✓'
  if (slot.outcome === 'podium') return slot.actualPositionLabel ? slot.actualPositionLabel : 'podium'
  return '✕'
}

const summaryGridTemplate = '4rem minmax(0,1fr) 5.5rem 5.5rem 5.5rem 1.5rem'
const breakdownGridTemplate = 'minmax(210px, 2.3fr) repeat(3, minmax(88px, 1fr)) minmax(92px, 0.9fr) minmax(56px, 0.55fr)'

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const supabase = await createClient()
  const currentSeason = await getCurrentSeason(supabase)
  const query = await searchParams
  const requestedView = Array.isArray(query.view) ? query.view[0] : query.view
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const access = user ? await getAdminAccessContext(supabase) : null
  const groupContext = user
    ? await getUserTenantContext(supabase, user.id)
    : {
        tenantId: null,
        tenantName: null,
        tenantSlug: null,
        role: null,
      }

  const hasGroup = Boolean(groupContext.tenantId)
  const defaultView = hasGroup && !access?.isPlatformAdmin ? 'tenant' : 'global'
  const activeView =
    requestedView === 'global'
      ? 'global'
      : requestedView === 'tenant' && hasGroup
        ? 'tenant'
        : defaultView

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

  if (leaderboardResult.error) {
    console.error('Error fetching leaderboard:', leaderboardResult.error)
  }

  const visibleLeaderboard = ((leaderboardResult.data || []) as LeaderboardEntry[]).filter((entry) => {
    const profile = getLeaderboardProfile(entry)

    if (activeView !== 'tenant') return testModeFilterAvailable ? !isTestModeProfile(profile) : true
    return profile?.tenant_id === groupContext.tenantId
  })

  const sortedVisibleLeaderboard = sortCompetitionStandings(visibleLeaderboard)
  const visibleUserIds = sortedVisibleLeaderboard.map((entry) => entry.user_id)
  const currentUserRank = user ? getCompetitionRank(sortedVisibleLeaderboard, user.id) : null
  const currentUserEntry = user
    ? sortedVisibleLeaderboard.find((entry) => entry.user_id === user.id) || null
    : null
  const leaderPoints = sortedVisibleLeaderboard[0]?.total_points ?? 0
  const pointsBehindLeader =
    currentUserEntry && currentUserRank !== 1 ? leaderPoints - currentUserEntry.total_points : 0

  const leaderboardTitle =
    activeView === 'tenant' && groupContext.tenantName
      ? `${groupContext.tenantName.toUpperCase()} STANDINGS`
      : 'SEASON STANDINGS'

  const { data: scoredRaces } =
    visibleUserIds.length > 0
      ? await supabase
          .from('races')
          .select('id, round, race_name, race_start_at')
          .eq('season', currentSeason)
          .eq('status', 'scored')
          .order('race_start_at', { ascending: false })
      : { data: [] as ScoredRace[] }

  const scoredRaceIds = ((scoredRaces || []) as ScoredRace[]).map((race) => race.id)

  let predictionBreakdownRows: PredictionBreakdownRow[] = []
  let raceResultRows: RaceResultRow[] = []
  let raceScoreRows: RaceScoreRow[] = []
  let bonusQuestionRows: BonusQuestionRow[] = []
  let predictionBonusAnswerRows: PredictionBonusAnswerRow[] = []
  let raceBonusAnswerRows: RaceBonusAnswerRow[] = []

  if (visibleUserIds.length > 0 && scoredRaceIds.length > 0) {
    const [predictionsResult, raceResultsResult, scoresResult, questionsResult, correctBonusResult] = await Promise.all([
      supabase
        .from('predictions')
        .select('id, user_id, race_id, p1_driver_id, p2_driver_id, p3_driver_id')
        .in('user_id', visibleUserIds)
        .in('race_id', scoredRaceIds),
      supabase
        .from('race_results')
        .select('race_id, p1_driver_id, p2_driver_id, p3_driver_id')
        .in('race_id', scoredRaceIds),
      supabase
        .from('user_race_scores')
        .select('user_id, race_id, total_points, podium_points, bonus_points, exact_hits')
        .in('user_id', visibleUserIds)
        .in('race_id', scoredRaceIds),
      supabase
        .from('bonus_questions')
        .select('id, race_id, question_text, display_order, bonus_options(id, label)')
        .in('race_id', scoredRaceIds)
        .order('display_order', { ascending: true }),
      supabase
        .from('race_bonus_answers')
        .select('race_id, bonus_question_id, correct_bonus_option_id')
        .in('race_id', scoredRaceIds),
    ])

    if (predictionsResult.error) {
      console.error('Leaderboard breakdown predictions fetch error:', predictionsResult.error)
    } else {
      predictionBreakdownRows = (predictionsResult.data || []) as PredictionBreakdownRow[]
    }

    if (raceResultsResult.error) {
      console.error('Leaderboard breakdown results fetch error:', raceResultsResult.error)
    } else {
      raceResultRows = (raceResultsResult.data || []) as RaceResultRow[]
    }

    if (scoresResult.error) {
      console.error('Leaderboard breakdown scores fetch error:', scoresResult.error)
    } else {
      raceScoreRows = (scoresResult.data || []) as RaceScoreRow[]
    }

    if (questionsResult.error) {
      console.error('Leaderboard breakdown questions fetch error:', questionsResult.error)
    } else {
      bonusQuestionRows = (questionsResult.data || []) as BonusQuestionRow[]
    }

    if (correctBonusResult.error) {
      console.error('Leaderboard breakdown race bonus fetch error:', correctBonusResult.error)
    } else {
      raceBonusAnswerRows = (correctBonusResult.data || []) as RaceBonusAnswerRow[]
    }

    const predictionIds = predictionBreakdownRows.map((prediction) => prediction.id)

    if (predictionIds.length > 0) {
      const predictionBonusResult = await supabase
        .from('prediction_bonus_answers')
        .select('prediction_id, bonus_question_id, bonus_option_id')
        .in('prediction_id', predictionIds)

      if (predictionBonusResult.error) {
        console.error('Leaderboard breakdown prediction bonus fetch error:', predictionBonusResult.error)
      } else {
        predictionBonusAnswerRows = (predictionBonusResult.data || []) as PredictionBonusAnswerRow[]
      }
    }
  }

  const { data: drivers } = await supabase.from('drivers').select('id, code, emoji')
  const driversById = new Map(
    ((drivers || []) as DriverRow[]).map((driver) => [driver.id, { code: driver.code, emoji: driver.emoji }])
  )

  const breakdownByUserId = buildUserLeaderboardBreakdowns({
    races: (scoredRaces || []) as ScoredRace[],
    predictions: predictionBreakdownRows,
    raceResults: raceResultRows,
    raceScores: raceScoreRows,
    bonusQuestions: bonusQuestionRows,
    predictionBonusAnswers: predictionBonusAnswerRows,
    raceBonusAnswers: raceBonusAnswerRows,
    driversById,
  })

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-4">
          <Trophy className="h-10 w-10 text-yellow-500" />
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter">{leaderboardTitle}</h1>
          </div>
        </div>

        {hasGroup && (
          <div className="inline-flex rounded-2xl border border-white/10 bg-black/20 p-1">
            <PendingLink
              href="/leaderboard?view=tenant"
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeView === 'tenant' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              My Group
            </PendingLink>
            <PendingLink
              href="/leaderboard?view=global"
              className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                activeView === 'global' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              Everyone
            </PendingLink>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {user && currentUserRank && currentUserEntry && (
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-200">
            #{currentUserRank} · {currentUserEntry.total_points} pts ·{' '}
            {currentUserRank === 1 ? 'Leading' : `${pointsBehindLeader} behind`}
          </span>
        )}

        {sortedVisibleLeaderboard.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${getOutcomeClasses('exact')}`}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              Exact
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${getOutcomeClasses('podium')}`}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              Right driver
            </span>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${getOutcomeClasses('miss')}`}
            >
              <span className="h-2 w-2 rounded-full bg-current opacity-80" />
              Miss
            </span>
          </div>
        )}

        {!user && sortedVisibleLeaderboard.length > 0 && (
          <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-300">
            {sortedVisibleLeaderboard.length} players
          </span>
        )}
      </div>

      {sortedVisibleLeaderboard.length > 0 && (
        <div className="text-xs text-slate-500">Click a player to inspect scored weekends.</div>
      )}

      {sortedVisibleLeaderboard.length > 0 && (
        <div
          className="hidden w-full items-center gap-4 rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-xs font-bold uppercase tracking-widest text-slate-500 lg:grid"
          style={{ gridTemplateColumns: summaryGridTemplate }}
        >
          <div>Rank</div>
          <div className="min-w-0">Player</div>
          <div className="text-right">Points</div>
          <div className="text-right">Exact</div>
          <div className="text-right">Races</div>
          <div />
        </div>
      )}

      <div className="space-y-3">
        {sortedVisibleLeaderboard.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-card p-8 text-center text-slate-500 italic shadow-xl">
            No predictions scored yet.
          </div>
        ) : (
          sortedVisibleLeaderboard.map((entry, index) => {
            const profile = getLeaderboardProfile(entry)
            const userBreakdown = breakdownByUserId.get(entry.user_id) || []
            const isCurrentUser = entry.user_id === user?.id

            return (
              <details
                key={entry.user_id}
                open={isCurrentUser}
                className={`rounded-2xl border bg-card shadow-xl ${isCurrentUser ? 'border-red-500/25' : 'border-white/5'}`}
              >
                <summary className="list-none cursor-pointer px-5 py-3.5 md:px-6">
                  <div className="lg:hidden">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 text-base font-black italic text-white">
                            {getRankDisplay(index)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-lg font-semibold text-white">
                                {getProfileDisplayName(profile?.display_name, profile?.email)}
                              </div>
                              {isCurrentUser && (
                                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-red-300">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-sm text-slate-400">
                              {entry.total_points} pts · {entry.exact_hits} exact · {entry.races_scored} races
                            </div>
                          </div>
                        </div>
                      </div>
                      <ChevronDown className="mt-3 h-4 w-4 shrink-0 text-slate-500" />
                    </div>
                  </div>

                  <div
                    className="hidden w-full items-center gap-4 lg:grid"
                    style={{ gridTemplateColumns: summaryGridTemplate }}
                  >
                    <div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30 text-base font-black italic text-white">
                        {getRankDisplay(index)}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-lg font-semibold text-white">
                          {getProfileDisplayName(profile?.display_name, profile?.email)}
                        </div>
                        {isCurrentUser && (
                          <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-red-300">
                            You
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right text-xl font-black italic text-red-500">
                      {entry.total_points}
                    </div>
                    <div className="text-right text-lg font-bold text-white">
                      {entry.exact_hits}
                    </div>
                    <div className="text-right text-lg font-bold text-white">
                      {entry.races_scored}
                    </div>
                    <div className="flex justify-end">
                      <ChevronDown className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                </summary>

                <div className="border-t border-white/5 px-5 pb-5 pt-4 md:px-6 md:pb-6">
                  {userBreakdown.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                      Scored race detail is not available here yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <div className="min-w-[720px] space-y-1.5 text-sm lg:min-w-0">
                        <div
                          className="grid text-[11px] font-bold uppercase tracking-widest text-slate-500"
                          style={{ gridTemplateColumns: breakdownGridTemplate }}
                        >
                          <div className="rounded-l-xl border border-white/10 bg-black/20 px-3 py-2 text-left">Race</div>
                          <div className="border-y border-white/10 bg-black/20 px-2 py-2 text-center">P1</div>
                          <div className="border-y border-white/10 bg-black/20 px-2 py-2 text-center">P2</div>
                          <div className="border-y border-white/10 bg-black/20 px-2 py-2 text-center">P3</div>
                          <div className="border-y border-white/10 bg-black/20 px-2 py-2 text-center">Bonus</div>
                          <div className="rounded-r-xl border border-white/10 bg-black/20 px-2 py-2 text-right">Pts</div>
                        </div>

                        {userBreakdown.map((race) => {
                          const showActualPodium = race.slots.some((slot) => slot.outcome !== 'exact')
                          const showBonusDetail = race.bonusItems.length > 0
                          const showDetailRow = showActualPodium || showBonusDetail

                          return (
                            <div
                              key={race.raceId}
                              className="overflow-hidden rounded-xl border border-white/5"
                            >
                              <div
                                className="grid items-stretch"
                                style={{ gridTemplateColumns: breakdownGridTemplate }}
                              >
                                <div className={`border-r border-white/5 bg-black/25 px-3 py-2.5 ${showDetailRow ? 'rounded-tl-xl' : 'rounded-l-xl'}`}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold uppercase tracking-widest text-red-500">
                                      {getRoundLabel(race.round)}
                                    </span>
                                    <span className="truncate text-[13px] font-bold leading-tight text-white">{race.raceName}</span>
                                  </div>
                                  <div className="mt-0.5 text-[11px] text-slate-500">{format(new Date(race.raceStartAt), 'PPP')}</div>
                                </div>

                                {race.slots.map((slot) => (
                                  <div
                                    key={`${race.raceId}-${slot.slot}`}
                                    className="border-r border-white/5 bg-black/25 px-2 py-2 text-center last:border-r-0"
                                  >
                                    <div
                                      className={`inline-flex min-w-[72px] items-center justify-center rounded-full border px-2.5 py-1 text-[13px] font-bold ${getOutcomeClasses(slot.outcome)}`}
                                    >
                                      <span className="truncate font-black italic leading-none">{slot.predictedLabel}</span>
                                      <span className="ml-1.5 text-[10px] font-bold uppercase tracking-widest opacity-85">
                                        {getSlotStatusText(slot)}
                                      </span>
                                    </div>
                                  </div>
                                ))}

                                <div className="border-r border-white/5 bg-black/25 px-2 py-2 text-center">
                                  <div className="inline-flex min-w-[48px] items-center justify-center rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white">
                                    {race.bonusTotalCount > 0 ? `${race.bonusCorrectCount}/${race.bonusTotalCount}` : '-'}
                                  </div>
                                </div>

                                <div className={`bg-black/25 px-2 py-2 text-right ${showDetailRow ? 'rounded-tr-xl' : 'rounded-r-xl'}`}>
                                  <div className="text-base font-black italic text-red-400">{race.totalPoints}</div>
                                </div>
                              </div>

                              {showDetailRow && (
                                <div
                                  className="grid items-stretch border-t border-white/5 text-xs text-slate-300"
                                  style={{ gridTemplateColumns: breakdownGridTemplate }}
                                >
                                  <div className="rounded-bl-xl bg-black/20 px-3 py-2 font-bold uppercase tracking-widest text-slate-500">
                                    {showActualPodium ? 'Actual' : 'Bonus'}
                                  </div>
                                  {showActualPodium ? (
                                    <>
                                      <div className="bg-black/20 px-2 py-2 text-center">
                                        {race.actualPodiumLabels[0]?.replace(/^P1\s/, '')}
                                      </div>
                                      <div className="bg-black/20 px-2 py-2 text-center">
                                        {race.actualPodiumLabels[1]?.replace(/^P2\s/, '')}
                                      </div>
                                      <div className="bg-black/20 px-2 py-2 text-center">
                                        {race.actualPodiumLabels[2]?.replace(/^P3\s/, '')}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="col-span-3 bg-black/20 px-2 py-2 text-center text-slate-500">
                                      Podium matched
                                    </div>
                                  )}
                                  <div className="bg-black/20 px-2 py-2">
                                    {showBonusDetail ? (
                                      <div className="flex flex-wrap items-center justify-center gap-1">
                                        {race.bonusItems.map((item) => (
                                          <span
                                            key={`${race.raceId}-${item.label}`}
                                            className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                                              item.isCorrect
                                                ? 'border-green-500/20 bg-green-500/10 text-green-200'
                                                : 'border-red-500/20 bg-red-500/10 text-red-200'
                                            }`}
                                            title={`${item.label}: picked ${item.selectedLabel}, correct ${item.correctLabel}`}
                                          >
                                            {item.label} {item.isCorrect ? '✓' : '✕'}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-center text-slate-500">-</div>
                                    )}
                                  </div>
                                  <div className="rounded-br-xl bg-black/20 px-2 py-2" />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )
          })
        )}
      </div>
    </div>
  )
}
