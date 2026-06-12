import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Calendar, ChevronRight, Clock3, Flag, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { getEffectiveRaceStatus, RaceStatus } from '@/utils/race-status'
import {
  getBonusAnswerLabel,
  getDriverLabel,
  getPublicRacePageData,
  type PublicRaceTopScorer,
} from '@/utils/race-page'
import { getRoundLabel } from '@/utils/race-copy'
import { getAbsoluteUrl } from '@/utils/site'
import { getProfileDisplayName } from '@/utils/profile-name'
import { PendingLink } from '@/components/ui/pending-link'
import { RaceStatusPill } from '@/components/ui/race-status-pill'
import { RaceMetaStrip } from '@/components/ui/race-meta-strip'
import { SectionHeader } from '@/components/ui/section-header'
import { ShareImageActions, type RaceResultShareCardData } from '@/components/ui/share-image-actions'
import { getRaceTone } from '@/utils/race-experience'

export const revalidate = 0

type PageProps = {
  params: Promise<{ id: string }>
}

function getStatusDescription(status: RaceStatus) {
  if (status === 'upcoming') {
    return 'Open until FP1 minus five minutes.'
  }

  if (status === 'locked') {
    return 'Predictions are closed.'
  }

  if (status === 'completed') {
    return 'Results pending.'
  }

  if (status === 'scored') {
    return 'Results are live.'
  }

  return 'This race was cancelled.'
}

function getMetadataDescription(raceName: string, status: RaceStatus) {
  if (status === 'upcoming') {
    return `Follow the ${raceName} schedule and pick deadline before the grid locks.`
  }

  if (status === 'scored') {
    return `See the published ${raceName} podium, top scorers, and season context on the public race hub.`
  }

  return `Track the ${raceName} status, published results, and official race updates on the public race hub.`
}

function getTopScorerProfile(scorer: PublicRaceTopScorer) {
  if (Array.isArray(scorer.profiles)) {
    return scorer.profiles[0] || null
  }

  return scorer.profiles || null
}

function getRaceScoreRank(scores: PublicRaceTopScorer[], index: number) {
  const score = scores[index]
  const firstMatchingScoreIndex = scores.findIndex((entry) => entry.total_points === score.total_points)

  return firstMatchingScoreIndex + 1
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const raceData = await getPublicRacePageData(id)

  if (!raceData) {
    return {
      title: 'Race Not Found',
    }
  }

  const { race } = raceData
  const effectiveStatus = getEffectiveRaceStatus(race)
  const title = `${race.race_name} Race Hub`
  const description = getMetadataDescription(race.race_name, effectiveStatus)

  return {
    title,
    description,
    alternates: {
      canonical: `/race/${race.id}`,
    },
    openGraph: {
      title,
      description,
      url: getAbsoluteUrl(`/race/${race.id}`),
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function PublicRacePage({ params }: PageProps) {
  const { id } = await params
  const raceData = await getPublicRacePageData(id)

  if (!raceData) {
    notFound()
  }

  const { race, drivers, bonusQuestions, raceResult, raceBonusAnswers, topScorers, previousRace, nextRace } = raceData
  const effectiveStatus = getEffectiveRaceStatus(race)
  const officialBonusAnswerMap = new Map(
    raceBonusAnswers.map((answer) => [answer.bonus_question_id, answer.correct_bonus_option_id])
  )
  const winningScore = topScorers[0]?.total_points ?? null

  const officialPodium = raceResult
    ? [
        { label: 'P1', value: getDriverLabel(drivers, raceResult.p1_driver_id) },
        { label: 'P2', value: getDriverLabel(drivers, raceResult.p2_driver_id) },
        { label: 'P3', value: getDriverLabel(drivers, raceResult.p3_driver_id) },
      ]
    : []
  const raceShareCard: RaceResultShareCardData | null =
    effectiveStatus === 'scored' && officialPodium.length > 0
      ? {
          kind: 'race-result',
          season: race.season,
          title: race.race_name,
          subtitle: race.round ? getRoundLabel(race.round) : 'Race recap',
          headline: 'Official podium and top scorers',
          detail:
            topScorers.length > 0
              ? `${topScorers.length} player${topScorers.length === 1 ? '' : 's'} published for this race recap.`
              : 'Official podium is live.',
          footer:
            topScorers.length > 0
              ? `${getProfileDisplayName(
                  getTopScorerProfile(topScorers[0])?.display_name,
                  getTopScorerProfile(topScorers[0])?.email
                )} led the race on ${winningScore ?? 0} pts.`
              : `${race.race_name} official result is live.`,
          podium: officialPodium.map((entry) => ({
            slot: entry.label,
            value: entry.value,
          })),
          scorers: topScorers.slice(0, 5).map((score, index) => {
            const profile = getTopScorerProfile(score)

            return {
              rank: getRaceScoreRank(topScorers, index),
              name: getProfileDisplayName(profile?.display_name, profile?.email),
              points: score.total_points,
              highlight: winningScore !== null && score.total_points === winningScore,
            }
          }),
        }
      : null

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black shadow-2xl">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <Flag className="h-56 w-56" />
        </div>

        <div className="relative space-y-5 p-6 md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-sm font-bold uppercase tracking-wider text-red-300">
              Season {race.season}
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-medium text-slate-200">
              {getRoundLabel(race.round)}
            </span>
            <RaceStatusPill status={effectiveStatus} />
          </div>

          <SectionHeader
            title={race.race_name}
            description={getStatusDescription(effectiveStatus)}
          />

          <p className="flex items-center gap-2 text-base text-slate-300 md:text-lg">
            <span className="text-2xl">{race.circuits?.emoji}</span>
            <span>
              {race.circuits?.name}, {race.circuits?.country}
            </span>
          </p>

          <RaceMetaStrip
            items={[
              {
                label: 'Race',
                value: format(new Date(race.race_start_at), 'PPP p'),
                icon: Calendar,
              },
              {
                label: 'Lock',
                value: format(new Date(race.prediction_lock_at), 'PPP p'),
                icon: Clock3,
                tone: effectiveStatus === 'upcoming' ? 'open' : getRaceTone(effectiveStatus),
              },
            ]}
          />

          <div className="flex flex-wrap gap-4">
            <PendingLink
              href="/season"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
            >
              Season
            </PendingLink>
            <PendingLink
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
            >
              Standings
            </PendingLink>
            {effectiveStatus === 'scored' && (
              <PendingLink
                href={`/race/${race.id}#top-scorers`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
              >
                Top scorers
              </PendingLink>
            )}
            {effectiveStatus === 'upcoming' && (
              <PendingLink
                href={`/race/${race.id}/predict`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-all hover:bg-red-500"
              >
                Predict
                <ChevronRight className="ml-1 h-5 w-5" />
              </PendingLink>
            )}
          </div>
        </div>
      </section>

      {effectiveStatus === 'scored' ? (
        <section id="top-scorers" className="scroll-mt-24 rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
          <SectionHeader
            eyebrow="Race recap"
            title="Result and top scorers"
            aside={
              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
                {topScorers.length} player{topScorers.length === 1 ? '' : 's'}
              </span>
            }
          />

          {raceShareCard && (
            <div className="mt-4">
              <ShareImageActions
                title="Copy a race recap card"
                description="Builds a share-ready PNG for the official podium and top scorers."
                fileName={`flormula1-${race.season}-${race.round || 'race'}-recap.png`}
                data={raceShareCard}
              />
            </div>
          )}

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-white/5 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Official</div>
                  <h3 className="mt-1 text-lg font-black italic leading-tight text-white">Podium</h3>
                </div>
                <Trophy className="h-5 w-5 text-yellow-500" />
              </div>

              {officialPodium.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {officialPodium.map((entry, index) => (
                    <div
                      key={entry.label}
                      className={`grid grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        index === 0
                          ? 'border-yellow-500/25 bg-yellow-500/10'
                          : 'border-white/5 bg-black/25'
                      }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/30 text-xs font-black italic text-white">
                        {entry.label}
                      </div>
                      <div className="min-w-0">
                        <div className="break-words text-sm font-semibold text-slate-100">{entry.value}</div>
                        {index === 0 && (
                          <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.18em] text-yellow-200">
                            Winner
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-200">
                  Official podium pending.
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/20">
              <div className="hidden grid-cols-[3.5rem_minmax(0,1fr)_4.75rem_4.75rem_4.75rem_4.75rem] gap-3 border-b border-white/5 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 lg:grid">
                <div>Rank</div>
                <div>Player</div>
                <div className="text-right">Total</div>
                <div className="text-right">Podium</div>
                <div className="text-right">Bonus</div>
                <div className="text-right">Exact</div>
              </div>

              {topScorers.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500">
                  No published player scores for this race.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {topScorers.map((score, index) => {
                    const profile = getTopScorerProfile(score)
                    const isWinner = winningScore !== null && score.total_points === winningScore
                    const rank = getRaceScoreRank(topScorers, index)

                    return (
                      <div
                        key={score.user_id}
                        className="grid gap-3 px-4 py-3 sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:items-center lg:grid-cols-[3.5rem_minmax(0,1fr)_4.75rem_4.75rem_4.75rem_4.75rem]"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/30 text-sm font-black italic text-white lg:h-auto lg:w-auto lg:justify-start lg:border-0 lg:bg-transparent">
                          {rank}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="break-words font-semibold text-white">
                              {getProfileDisplayName(profile?.display_name, profile?.email)}
                            </div>
                            {isWinner && (
                              <span className="rounded-full border border-yellow-500/25 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-yellow-200">
                                Top
                              </span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-400 lg:hidden">
                            {score.podium_points} podium · {score.bonus_points} bonus · {score.exact_hits} exact
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <div className="text-2xl font-black italic text-red-500 lg:text-lg">{score.total_points}</div>
                          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 lg:hidden">pts</div>
                        </div>
                        <div className="hidden text-right text-sm font-bold text-slate-100 lg:block">{score.podium_points}</div>
                        <div className="hidden text-right text-sm font-bold text-slate-100 lg:block">{score.bonus_points}</div>
                        <div className="hidden text-right text-sm font-bold text-slate-100 lg:block">{score.exact_hits}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
          <SectionHeader eyebrow="Results" title="Official podium" />

          {officialPodium.length > 0 ? (
            <div className="mt-4 space-y-3">
              {officialPodium.map((entry) => (
                <div key={entry.label} className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{entry.label}</div>
                  <div className="mt-1 font-semibold text-slate-100">{entry.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-200">
              Official podium pending.
            </div>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
        <SectionHeader eyebrow="Bonus" title="Bonus tracker" />

        {bonusQuestions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-white/5 bg-black/30 p-5 text-slate-400">
            Group bonus questions are private to each group. Sign in to view your group MCQs on the prediction page.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {bonusQuestions.map((question) => (
              <div key={question.id} className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-slate-100">{question.question_text}</div>
                  <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                    {question.points} pts
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-400">
                  {getBonusAnswerLabel(question, officialBonusAnswerMap.get(question.id))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-wrap gap-4">
        {previousRace && (
          <PendingLink
            href={`/race/${previousRace.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            {getRoundLabel(previousRace.round)}
          </PendingLink>
        )}
        {nextRace && (
          <PendingLink
            href={`/race/${nextRace.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            {getRoundLabel(nextRace.round)}
          </PendingLink>
        )}
        <PendingLink
          href="/season"
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
        >
          Season
        </PendingLink>
        <PendingLink
          href={`/race/${race.id}/predict`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/15 px-5 py-3 font-bold text-red-200 transition-all hover:bg-red-500/25"
        >
          My picks
          <ChevronRight className="ml-1 h-5 w-5" />
        </PendingLink>
      </section>
    </div>
  )
}
