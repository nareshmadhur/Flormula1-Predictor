'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ChevronDown, Medal } from 'lucide-react'
import { getRoundLabel } from '@/utils/race-copy'

type PodiumSlotBreakdown = {
  slot: 'P1' | 'P2' | 'P3'
  predictedLabel: string
  outcome: 'exact' | 'podium' | 'miss'
  actualPositionLabel?: 'P1' | 'P2' | 'P3'
}

type BonusBreakdownItem = {
  label: string
  selectedLabel: string
  correctLabel: string
  isCorrect: boolean
}

type UserRaceLeaderboardBreakdown = {
  raceId: string
  round: number
  raceName: string
  raceStartAt: string
  totalPoints: number
  bonusItems: BonusBreakdownItem[]
  bonusCorrectCount: number
  bonusTotalCount: number
  slots: PodiumSlotBreakdown[]
  actualPodiumLabels: string[]
}

type LeaderboardEntryDetailsProps = {
  userId: string
  season: number
  view: 'global' | 'tenant'
  rank: number
  name: string
  totalPoints: number
  exactHits: number
  racesScored: number
  isCurrentUser: boolean
}

const summaryGridTemplate = '4rem minmax(0,1fr) 5.5rem 5.5rem 5.5rem 1.5rem'
const breakdownGridTemplate = 'minmax(210px, 2.3fr) repeat(3, minmax(88px, 1fr)) minmax(92px, 0.9fr) minmax(56px, 0.55fr)'

function getRankDisplay(rank: number) {
  if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500" />
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-300" />
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />
  return <span>{rank}</span>
}

function getOutcomeClasses(outcome: PodiumSlotBreakdown['outcome']) {
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
  if (slot.outcome === 'podium') return slot.actualPositionLabel || 'podium'
  return '✕'
}

export function LeaderboardEntryDetails({
  userId,
  season,
  view,
  rank,
  name,
  totalPoints,
  exactHits,
  racesScored,
  isCurrentUser,
}: LeaderboardEntryDetailsProps) {
  const [breakdown, setBreakdown] = useState<UserRaceLeaderboardBreakdown[] | null>(null)
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  const handleToggle = (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.open || loadState !== 'idle') return

    setLoadState('loading')
    const params = new URLSearchParams({ season: String(season), view })

    void fetch(`/api/leaderboard/${encodeURIComponent(userId)}/breakdown?${params.toString()}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Leaderboard detail request failed')
        const payload = (await response.json()) as { breakdown?: UserRaceLeaderboardBreakdown[] }
        setBreakdown(payload.breakdown || [])
        setLoadState('ready')
      })
      .catch(() => {
        setLoadState('error')
      })
  }

  const showUnavailable = loadState === 'error' || (loadState === 'ready' && breakdown?.length === 0)

  return (
    <details
      className={`rounded-2xl border bg-card shadow-xl ${isCurrentUser ? 'border-red-500/25' : 'border-white/5'}`}
      onToggle={handleToggle}
    >
      <summary className="list-none cursor-pointer px-5 py-3.5 md:px-6">
        <div className="lg:hidden">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/30 text-base font-black italic text-white">
                  {getRankDisplay(rank)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-lg font-semibold text-white">{name}</div>
                    {isCurrentUser && (
                      <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-red-300">
                        You
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    {totalPoints} pts · {exactHits} exact · {racesScored} races
                  </div>
                </div>
              </div>
            </div>
            <ChevronDown className="mt-3 h-4 w-4 shrink-0 text-slate-500" />
          </div>
        </div>

        <div className="hidden w-full items-center gap-4 lg:grid" style={{ gridTemplateColumns: summaryGridTemplate }}>
          <div>
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30 text-base font-black italic text-white">
              {getRankDisplay(rank)}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="truncate text-lg font-semibold text-white">{name}</div>
              {isCurrentUser && (
                <span className="rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-red-300">
                  You
                </span>
              )}
            </div>
          </div>

          <div className="text-right text-xl font-black italic text-red-500">{totalPoints}</div>
          <div className="text-right text-lg font-bold text-white">{exactHits}</div>
          <div className="text-right text-lg font-bold text-white">{racesScored}</div>
          <div className="flex justify-end">
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </div>
        </div>
      </summary>

      <div className="border-t border-white/5 px-5 pb-5 pt-4 md:px-6 md:pb-6">
        {loadState === 'loading' ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
            Loading scored race detail…
          </div>
        ) : showUnavailable ? (
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

              {(breakdown || []).map((race) => {
                const showActualPodium = race.slots.some((slot) => slot.outcome !== 'exact')
                const showBonusDetail = race.bonusItems.length > 0
                const showDetailRow = showActualPodium || showBonusDetail

                return (
                  <div key={race.raceId} className="overflow-hidden rounded-xl border border-white/5">
                    <div className="grid items-stretch" style={{ gridTemplateColumns: breakdownGridTemplate }}>
                      <div
                        className={`border-r border-white/5 bg-black/25 px-3 py-2.5 ${
                          showDetailRow ? 'rounded-tl-xl' : 'rounded-l-xl'
                        }`}
                      >
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

                      <div
                        className={`bg-black/25 px-2 py-2 text-right ${showDetailRow ? 'rounded-tr-xl' : 'rounded-r-xl'}`}
                      >
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
                            <div className="bg-black/20 px-2 py-2 text-center">{race.actualPodiumLabels[0]?.replace(/^P1\s/, '')}</div>
                            <div className="bg-black/20 px-2 py-2 text-center">{race.actualPodiumLabels[1]?.replace(/^P2\s/, '')}</div>
                            <div className="bg-black/20 px-2 py-2 text-center">{race.actualPodiumLabels[2]?.replace(/^P3\s/, '')}</div>
                          </>
                        ) : (
                          <div className="col-span-3 bg-black/20 px-2 py-2 text-center text-slate-500">Podium matched</div>
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
}
