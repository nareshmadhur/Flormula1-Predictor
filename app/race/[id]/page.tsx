import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Calendar, ChevronRight, CircleHelp, Clock3, Flag, Trophy } from 'lucide-react'
import { format } from 'date-fns'
import { getEffectiveRaceStatus, RaceStatus } from '@/utils/race-status'
import {
  getBonusAnswerLabel,
  getDriverLabel,
  getPublicRacePageData,
} from '@/utils/race-page'
import { getAbsoluteUrl } from '@/utils/site'

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
    return 'This public race hub is live before lock so people can check the schedule, review bonus questions, and head into the prediction flow.'
  }

  if (status === 'locked') {
    return 'Predictions are closed for this race. Official results and scoring updates will appear here once race control has finished the pipeline.'
  }

  if (status === 'completed') {
    return 'The race has finished. Official podium and scoring are still waiting to be published.'
  }

  if (status === 'scored') {
    return 'Official results are published. Share this page to recap the race, then open your account to see your personal score breakdown.'
  }

  return 'This race is no longer active.'
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

  const { race, drivers, bonusQuestions, raceResult, raceBonusAnswers } = raceData
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-black shadow-2xl">
        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
          <Flag className="h-56 w-56" />
        </div>

        <div className="relative space-y-6 p-8 md:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-red-500/30 bg-red-500/15 px-3 py-1 text-sm font-bold uppercase tracking-wider text-red-300">
              Season {race.season}
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-medium text-slate-200">
              Round {race.round}
            </span>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-sm font-medium text-slate-200">
              {getStatusLabel(effectiveStatus)}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-4xl font-black italic tracking-tighter md:text-5xl">{race.race_name}</h1>
            <p className="flex items-center gap-2 text-lg text-slate-300">
              <span className="text-2xl">{race.circuits?.emoji}</span>
              <span>
                {race.circuits?.name}, {race.circuits?.country}
              </span>
            </p>
          </div>

          <p className="max-w-3xl text-slate-300">{getStatusDescription(effectiveStatus)}</p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                <Calendar className="mr-2 h-4 w-4 text-red-400" /> Race Start
              </div>
              <div className="mt-3 text-lg font-bold text-white">
                {format(new Date(race.race_start_at), 'PPP p')}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center text-xs font-bold uppercase tracking-wider text-slate-500">
                <Clock3 className="mr-2 h-4 w-4 text-amber-400" /> Prediction Lock
              </div>
              <div className="mt-3 text-lg font-bold text-white">
                {format(new Date(race.prediction_lock_at), 'PPP p')}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Shareable Route</div>
              <div className="mt-3 text-sm font-medium text-slate-300">Public status and published results live here.</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/leaderboard"
              className="inline-flex items-center rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
            >
              View Leaderboard
            </Link>
            {effectiveStatus === 'upcoming' && (
              <Link
                href={`/race/${race.id}/predict`}
                className="inline-flex items-center rounded-xl bg-red-600 px-5 py-3 font-bold text-white transition-all hover:bg-red-500"
              >
                Predict This Race
                <ChevronRight className="ml-1 h-5 w-5" />
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
          <h2 className="mb-6 flex items-center border-b border-white/5 pb-4 text-2xl font-black italic tracking-tighter">
            <Trophy className="mr-2 h-6 w-6 text-red-500" /> OFFICIAL PODIUM
          </h2>

          {officialPodium.length > 0 ? (
            <div className="space-y-3">
              {officialPodium.map((entry) => (
                <div key={entry.label} className="rounded-2xl border border-white/5 bg-black/30 px-4 py-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{entry.label}</div>
                  <div className="mt-1 font-semibold text-slate-100">{entry.value}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-200">
              Official podium has not been published yet. This page will update once results are entered.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
          <h2 className="mb-6 flex items-center border-b border-white/5 pb-4 text-2xl font-black italic tracking-tighter">
            <CircleHelp className="mr-2 h-6 w-6 text-red-500" /> BONUS TRACKER
          </h2>

          {bonusQuestions.length === 0 ? (
            <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-slate-400">
              No bonus questions were configured for this race.
            </div>
          ) : (
            <div className="space-y-3">
              {bonusQuestions.map((question) => (
                <div key={question.id} className="rounded-2xl border border-white/5 bg-black/30 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-100">{question.question_text}</div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-slate-300">
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

      <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
        <h2 className="text-2xl font-black italic tracking-tighter">Why This Page Exists</h2>
        <p className="mt-3 max-w-3xl text-slate-300">
          This public hub is the shareable layer of the app. It keeps the schedule, race state, and published
          outcomes visible without forcing people into the prediction form before they understand what is happening.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-xl border border-white/10 bg-black/30 px-5 py-3 font-bold text-slate-100 transition-all hover:bg-white/10"
          >
            Back To Home
          </Link>
          <Link
            href={`/race/${race.id}/predict`}
            className="inline-flex items-center rounded-xl border border-red-500/30 bg-red-500/15 px-5 py-3 font-bold text-red-200 transition-all hover:bg-red-500/25"
          >
            Open Personal Race Page
            <ChevronRight className="ml-1 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  )
}
