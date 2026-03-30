import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { AlertCircle, CircleHelp, ClipboardList, Flag, Lock, Trophy } from 'lucide-react'
import PredictionForm from './prediction-form'
import { getEffectiveRaceStatus } from '@/utils/race-status'
import { getUserTenantContext } from '@/utils/tenant'
import { TenantAssignmentRequired } from '@/components/ui/tenant-assignment-required'

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

export default async function PredictPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { id } = params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
    return <div className="text-center p-12 text-slate-400">Race not found.</div>
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

  const predictionPodium = prediction ? [
    { label: 'P1', value: getDriverLabel(drivers, prediction.p1_driver_id) },
    { label: 'P2', value: getDriverLabel(drivers, prediction.p2_driver_id) },
    { label: 'P3', value: getDriverLabel(drivers, prediction.p3_driver_id) },
  ] : []

  const officialPodium = raceResult ? [
    { label: 'P1', value: getDriverLabel(drivers, raceResult.p1_driver_id) },
    { label: 'P2', value: getDriverLabel(drivers, raceResult.p2_driver_id) },
    { label: 'P3', value: getDriverLabel(drivers, raceResult.p3_driver_id) },
  ] : []

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-3xl mx-auto">
      <div className="bg-card border border-white/10 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Flag className="w-48 h-48" />
        </div>

        <div className="relative z-10 space-y-2">
          <div className="text-sm font-bold text-red-500 uppercase tracking-widest flex items-center space-x-2">
            <span>Round {race.round}</span>
            {shouldShowReadOnlyState && (
              <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full flex items-center">
                <Lock className="w-3 h-3 mr-1" /> Locked
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">
            {race.race_name}
          </h1>
          <p className="text-xl text-slate-300 flex items-center space-x-2 pb-4">
            <span className="text-2xl">{race.circuits?.emoji}</span>
            <span>{race.circuits?.name}, {race.circuits?.country}</span>
          </p>
        </div>
      </div>

      {!shouldShowReadOnlyState && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start space-x-3 text-amber-500">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="text-sm font-medium">
            Predictions close exactly 5 minutes before the formation lap starts. Ensure you lock in your choices!
          </div>
        </div>
      )}

      {shouldShowReadOnlyState ? (
        <div className="space-y-6 pb-12">
          <div className="grid gap-6 md:grid-cols-2">
            <section className="bg-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
              <h2 className="text-2xl font-black italic tracking-tighter mb-6 flex items-center border-b border-white/5 pb-4">
                <ClipboardList className="w-6 h-6 mr-2 text-red-500" /> YOUR ENTRY
              </h2>

              {prediction ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    {predictionPodium.map((entry) => (
                      <div key={entry.label} className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{entry.label}</div>
                        <div className="mt-1 font-semibold text-slate-100">{entry.value}</div>
                      </div>
                    ))}
                  </div>

                  {typedBonusQuestions.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Bonus Answers</div>
                      {typedBonusQuestions.map((question) => (
                        <div key={question.id} className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
                          <div className="font-semibold text-slate-200">{question.question_text}</div>
                          <div className="mt-1 text-sm text-slate-400">
                            {getBonusAnswerLabel(question, bonusAnswerMap.get(question.id))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5 text-amber-300">
                  Prediction window is closed and you did not submit an entry for this race.
                </div>
              )}
            </section>

            <section className="bg-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
              <h2 className="text-2xl font-black italic tracking-tighter mb-6 flex items-center border-b border-white/5 pb-4">
                <Trophy className="w-6 h-6 mr-2 text-red-500" /> RACE STATUS
              </h2>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Current State</div>
                  <div className="mt-1 font-semibold text-slate-100">
                    {effectiveStatus === 'locked' && 'Predictions locked. Waiting for the race to finish.'}
                    {effectiveStatus === 'completed' && 'Race finished. Official scoring is still pending.'}
                    {effectiveStatus === 'scored' && 'Race scored. Your points are final for this event.'}
                    {effectiveStatus === 'cancelled' && 'This race was cancelled.'}
                  </div>
                </div>

                {raceResult ? (
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Official Podium</div>
                    {officialPodium.map((entry) => (
                      <div key={entry.label} className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{entry.label}</div>
                        <div className="mt-1 font-semibold text-slate-100">{entry.value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/5 bg-black/30 px-4 py-3 text-slate-400">
                    Official podium has not been entered yet.
                  </div>
                )}

                {typedBonusQuestions.length > 0 && raceBonusAnswers && raceBonusAnswers.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Official Bonus Answers</div>
                    {typedBonusQuestions.map((question) => (
                      <div key={question.id} className="rounded-xl border border-white/5 bg-black/30 px-4 py-3">
                        <div className="font-semibold text-slate-200">{question.question_text}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {getBonusAnswerLabel(question, officialBonusAnswerMap.get(question.id))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {effectiveStatus === 'scored' && userScore && (
            <section className="bg-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
              <h2 className="text-2xl font-black italic tracking-tighter mb-6 flex items-center border-b border-white/5 pb-4">
                <CircleHelp className="w-6 h-6 mr-2 text-red-500" /> SCORE BREAKDOWN
              </h2>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Total</div>
                  <div className="mt-2 text-4xl font-black italic text-red-500">{userScore.total_points}</div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Podium</div>
                  <div className="mt-2 text-3xl font-black italic text-slate-100">{userScore.podium_points}</div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-black/30 p-5 text-center">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Bonus</div>
                  <div className="mt-2 text-3xl font-black italic text-slate-100">{userScore.bonus_points}</div>
                </div>
              </div>
            </section>
          )}
        </div>
      ) : (
        <PredictionForm
          race={race}
          drivers={activeDrivers}
          bonusQuestions={bonusQuestions}
          existingPrediction={prediction}
          existingBonusAnswers={predictionBonusAnswers}
          isLocked={isLocked}
        />
      )}
    </div>
  )
}
