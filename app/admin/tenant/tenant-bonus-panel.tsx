import { CheckCircle2, HelpCircle, Lock } from 'lucide-react'
import { FormActionButton } from '@/components/ui/form-action-button'
import { RaceStatusPill } from '@/components/ui/race-status-pill'
import { getRoundLabel } from '@/utils/race-copy'
import { type RaceStatus } from '@/utils/race-status'
import {
  addTenantBonusQuestion,
  saveTenantBonusAnswers,
} from '@/app/actions/tenant-bonus'
import { TenantBonusQuestionCard } from './tenant-bonus-question-card'

type TenantBonusRace = {
  id: string
  round: number
  race_name: string
  effectiveStatus: RaceStatus
}

type TenantBonusOption = {
  id: string
  label?: string | null
}

export type TenantBonusVenueOption = {
  id: string
  name: string
  country?: string | null
  emoji?: string | null
}

export type TenantBonusQuestion = {
  id: string
  race_id: string
  question_text: string
  points: number
  display_order?: number | null
  bonus_options?: TenantBonusOption[]
}

export type TenantBonusAnswer = {
  race_id: string
  bonus_question_id: string
  correct_bonus_option_id: string
}

type TenantBonusPanelProps = {
  groupName: string
  races: TenantBonusRace[]
  questions: TenantBonusQuestion[]
  answers: TenantBonusAnswer[]
  venueOptions: TenantBonusVenueOption[]
}

function getBonusStatusCopy(status: RaceStatus) {
  if (status === 'upcoming') return 'Add or edit questions before entries close.'
  if (status === 'locked') return 'Entries are locked. Set answers after the race.'
  if (status === 'completed') return 'Set answers before scores are published.'
  if (status === 'scored') return 'Scores are published. Changing answers requires rescoring.'
  return 'Cancelled races do not need bonus management.'
}

export function TenantBonusPanel({
  groupName,
  races,
  questions,
  answers,
  venueOptions,
}: TenantBonusPanelProps) {
  const questionsByRaceId = new Map<string, TenantBonusQuestion[]>()
  const answerByQuestionId = new Map<string, string>()

  questions.forEach((question) => {
    const current = questionsByRaceId.get(question.race_id) || []
    current.push(question)
    questionsByRaceId.set(question.race_id, current)
  })

  questionsByRaceId.forEach((raceQuestions, raceId) => {
    questionsByRaceId.set(
      raceId,
      [...raceQuestions].sort((left, right) => (left.display_order || 0) - (right.display_order || 0))
    )
  })

  answers.forEach((answer) => {
    answerByQuestionId.set(answer.bonus_question_id, answer.correct_bonus_option_id)
  })

  const liveRaces = races.filter((race) => race.effectiveStatus !== 'cancelled')
  const highlightedRaces = liveRaces
    .filter((race) => race.effectiveStatus !== 'scored' || (questionsByRaceId.get(race.id) || []).length > 0)
    .slice(0, 6)
  const unansweredCount = questions.filter((question) => !answerByQuestionId.has(question.id)).length

  return (
    <section id="group-bonus" className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-red-200">
            <HelpCircle className="h-4 w-4" />
            Bonus questions
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-white">
            Group bonus questions
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Add questions for {groupName} before entries close. After the race, set the correct answers here.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-300">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            Answers
          </div>
          <div className="mt-2 font-semibold text-white">
            {unansweredCount === 0 ? 'All answers saved' : `${unansweredCount} answer${unansweredCount === 1 ? '' : 's'} pending`}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Scoring needs an answer for each active bonus question.
          </p>
        </div>
      </div>

      {highlightedRaces.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/5 bg-black/25 p-5 text-sm text-slate-400">
          No races need group bonus questions right now.
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {highlightedRaces.map((race) => {
            const raceQuestions = questionsByRaceId.get(race.id) || []
            const canEditQuestions = race.effectiveStatus === 'upcoming'
            const canSaveAnswers = raceQuestions.length > 0 && race.effectiveStatus !== 'upcoming'

            return (
              <div key={race.id} className="rounded-2xl border border-white/5 bg-black/20 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
                        {getRoundLabel(race.round)}
                      </span>
                      <RaceStatusPill status={race.effectiveStatus} size="xs" />
                    </div>
                    <h3 className="mt-2 text-xl font-bold tracking-tight text-white">{race.race_name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{getBonusStatusCopy(race.effectiveStatus)}</p>
                  </div>

                  <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-300">
                    {canEditQuestions ? <HelpCircle className="h-3.5 w-3.5 text-red-300" /> : <Lock className="h-3.5 w-3.5 text-amber-300" />}
                    {raceQuestions.length} group question{raceQuestions.length === 1 ? '' : 's'}
                  </div>
                </div>

                {raceQuestions.length > 0 && (
                  <div className="mt-4 grid gap-3">
                    {raceQuestions.map((question) => (
                      <TenantBonusQuestionCard
                        key={question.id}
                        question={question}
                        raceId={race.id}
                        canEdit={canEditQuestions}
                      />
                    ))}
                  </div>
                )}

                {canEditQuestions && (
                  <form action={addTenantBonusQuestion} className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
                    <input type="hidden" name="race_id" value={race.id} />
                    <div>
                      <h4 className="text-sm font-bold text-slate-200">Add question</h4>
                      <p className="mt-1 text-xs text-slate-500">Only members of {groupName} will see it.</p>
                    </div>
                    <input
                      name="question_text"
                      placeholder="Example: Which driver gets fastest lap?"
                      required
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
                    />
                    <input
                      name="points"
                      type="number"
                      min={1}
                      max={25}
                      defaultValue={1}
                      required
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
                    />
                    <div className="grid gap-2 md:grid-cols-2">
                      <input name="options" placeholder="Option A" className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm" />
                      <input name="options" placeholder="Option B" className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm" />
                      <input name="options" placeholder="Option C (optional)" className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm" />
                      <input name="options" placeholder="Option D (optional)" className="rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm" />
                    </div>
                    {venueOptions.length > 0 && (
                      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
                        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          Add venue options
                        </summary>
                        <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                          {venueOptions.map((venue) => (
                            <label
                              key={venue.id}
                              className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/25 px-3 py-2 text-sm text-slate-300"
                            >
                              <input
                                type="checkbox"
                                name="venue_options"
                                value={venue.id}
                                className="mt-1"
                              />
                              <span>
                                <span className="font-semibold text-slate-100">
                                  {venue.name}{venue.emoji ? ` ${venue.emoji}` : ''}
                                </span>
                                {venue.country && (
                                  <span className="block text-xs text-slate-500">{venue.country}</span>
                                )}
                              </span>
                            </label>
                          ))}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                          Venue options are stored as circuit references, not just typed labels.
                        </p>
                      </details>
                    )}
                    <FormActionButton idleLabel="Save question" pendingLabel="Saving question..." tone="amber" />
                  </form>
                )}

                {canSaveAnswers && (
                  <form action={saveTenantBonusAnswers} className="mt-4 space-y-3 rounded-xl border border-emerald-500/15 bg-emerald-500/8 p-4">
                    <input type="hidden" name="race_id" value={race.id} />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-100">Set answers</h4>
                      <p className="mt-1 text-xs text-emerald-100/70">
                        These answers apply only to {groupName}.
                      </p>
                    </div>
                    {raceQuestions.map((question) => (
                      <div key={question.id}>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/70">
                          {question.question_text}
                        </label>
                        <select
                          name={`bonus_${question.id}`}
                          defaultValue={answerByQuestionId.get(question.id) || ''}
                          required
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
                        >
                          <option value="" disabled className="bg-slate-900 text-white">
                            Select correct option
                          </option>
                          {question.bonus_options?.map((option) => (
                            <option key={option.id} value={option.id} className="bg-slate-900 text-white">
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <FormActionButton idleLabel="Save group answers" pendingLabel="Saving answers..." tone="primary" />
                  </form>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
