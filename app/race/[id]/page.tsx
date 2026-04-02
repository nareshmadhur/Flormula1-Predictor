import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Calendar, ChevronRight, CircleHelp, Clock3, Flag, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { getEffectiveRaceStatus, RaceStatus } from '@/utils/race-status'
import {
  getBonusAnswerLabel,
  getDriverLabel,
  getPublicRacePageData,
} from '@/utils/race-page'
import { getRoundLabel } from '@/utils/race-copy'
import { getAbsoluteUrl } from '@/utils/site'
import { PendingLink } from '@/components/ui/pending-link'

export const revalidate = 0

type PageProps = {
  params: Promise<{ id: string }>
}

function getStatusLabel(status: RaceStatus) {
  if (status === 'upcoming') return 'Predictions Open'
  if (status === 'locked') return 'Predictions Locked'
  if (status === 'completed') return 'Awaiting Published Results'
  if (status === 'scored') return 'Scored And Published'
  return 'Cancelled'
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
    return `Follow the ${raceName} schedule, prediction deadline, and bonus questions before the grid locks.`
  }

  if (status === 'scored') {
    return `See the published ${raceName} podium, bonus answers, and season context on the public race hub.`
  }

  return `Track the ${raceName} status, published results, and official race updates on the public race hub.`
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

  const { race, drivers, bonusQuestions, raceResult, raceBonusAnswers, previousRace, nextRace } = raceData
  const effectiveStatus = getEffectiveRaceStatus(race)
  const officialBonusAnswerMap = new Map(
    raceBonusAnswers.map((answer) => [answer.bonus_question_id, answer.correct_bonus_option_id])
  )

  const officialPodium = raceResult
    ? [
        { label: 'P1', value: getDriverLabel(drivers, raceResult.p1_driver_id) },
        { label: 'P2', value: getDriverLabel(drivers, raceResult.p2_driver_id) },
        { label: 'P3', value: getDriverLabel(drivers, raceResult.p3_driver_id) },
      ]
    : []

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
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-medium text-slate-200">
              {getStatusLabel(effectiveStatus)}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-black italic tracking-tighter md:text-5xl">{race.race_name}</h1>
            <p className="flex items-center gap-2 text-base text-slate-300 md:text-lg">
              <span className="text-2xl">{race.circuits?.emoji}</span>
              <span>
                {race.circuits?.name}, {race.circuits?.country}
              </span>
            </p>
          </div>

          <p className="max-w-3xl text-slate-300">{getStatusDescription(effectiveStatus)}</p>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                <Calendar className="mr-2 h-4 w-4 text-red-400" /> Race Start
              </div>
              <div className="mt-2 text-base font-bold text-white">
                {format(new Date(race.race_start_at), 'PPP p')}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">
                <Clock3 className="mr-2 h-4 w-4 text-amber-400" /> Prediction Lock (FP1 - 5m)
              </div>
              <div className="mt-2 text-base font-bold text-white">
                {format(new Date(race.prediction_lock_at), 'PPP p')}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Public page</div>
              <div className="mt-2 text-sm font-medium text-slate-300">Schedule and results.</div>
            </div>
          </div>

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

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
          <h2 className="mb-5 flex items-center border-b border-white/5 pb-3 text-xl font-black italic tracking-tighter md:text-2xl">
            <Trophy className="mr-2 h-5 w-5 text-red-500" /> Official podium
          </h2>

          {officialPodium.length > 0 ? (
            <div className="space-y-3">
              {officialPodium.map((entry) => (
                <div key={entry.label} className="rounded-2xl border border-white/5 bg-black/30 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">{entry.label}</div>
                  <div className="mt-1 font-semibold text-slate-100">{entry.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-200">
              Official podium pending.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-card p-5 shadow-2xl md:p-6">
          <h2 className="mb-5 flex items-center border-b border-white/5 pb-3 text-xl font-black italic tracking-tighter md:text-2xl">
            <CircleHelp className="mr-2 h-5 w-5 text-red-500" /> Bonus tracker
          </h2>

          {bonusQuestions.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-slate-400">
              No bonus questions.
            </div>
          ) : (
            <div className="space-y-3">
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
      </div>

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
