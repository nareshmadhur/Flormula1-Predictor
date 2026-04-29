'use client'

import { useMemo } from 'react'
import { FormActionButton } from '@/components/ui/form-action-button'

type DriverRecord = {
  id: string
  code: string
  full_name: string
}

type BonusOptionRecord = {
  id: string
  label?: string | null
}

type BonusQuestionRecord = {
  id: string
  question_text: string
  bonus_options?: BonusOptionRecord[]
}

type RaceResultRecord = {
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
}

type RaceBonusAnswerRecord = {
  bonus_question_id: string
  correct_bonus_option_id: string
}

type SuggestedEntry = {
  code: string
  fullName: string
  localDriverId: string | null
} | null

type SuggestedPodium = {
  source: string
  p1: SuggestedEntry
  p2: SuggestedEntry
  p3: SuggestedEntry
}

type OfficialResultsFormProps = {
  raceId: string
  action: (formData: FormData) => void | Promise<void>
  drivers: DriverRecord[]
  bonusQuestions: BonusQuestionRecord[]
  existingResult: RaceResultRecord | null
  existingBonusAnswers: RaceBonusAnswerRecord[]
  suggestedPodium: SuggestedPodium | null
}

function getSuggestedLabel(entry: SuggestedEntry) {
  if (!entry) return null
  return `${entry.code} · ${entry.fullName}`
}

export function OfficialResultsForm({
  raceId,
  action,
  drivers,
  bonusQuestions,
  existingResult,
  existingBonusAnswers,
  suggestedPodium,
}: OfficialResultsFormProps) {
  const suggestedDefaults = useMemo(
    () => ({
      p1: existingResult?.p1_driver_id || suggestedPodium?.p1?.localDriverId || '',
      p2: existingResult?.p2_driver_id || suggestedPodium?.p2?.localDriverId || '',
      p3: existingResult?.p3_driver_id || suggestedPodium?.p3?.localDriverId || '',
    }),
    [existingResult, suggestedPodium]
  )

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="race_id" value={raceId} />

      <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
        {bonusQuestions.length > 0 ? (
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              Save the podium and set the correct answer for each bonus question in the same submit.
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-[0.18em]">
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
                Step 1 · Podium
              </span>
              <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-slate-300">
                Step 2 · {bonusQuestions.length} bonus answer{bonusQuestions.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
        ) : (
          <div>Save the official podium here. There are no bonus answers for this weekend.</div>
        )}
      </div>

      {suggestedPodium && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
          <div className="font-semibold">Suggested podium from {suggestedPodium.source}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestedPodium.p1 && (
              <span className="rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1">
                P1 · {getSuggestedLabel(suggestedPodium.p1)}
              </span>
            )}
            {suggestedPodium.p2 && (
              <span className="rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1">
                P2 · {getSuggestedLabel(suggestedPodium.p2)}
              </span>
            )}
            {suggestedPodium.p3 && (
              <span className="rounded-full border border-emerald-500/20 bg-black/20 px-3 py-1">
                P3 · {getSuggestedLabel(suggestedPodium.p3)}
              </span>
            )}
          </div>
          <div className="mt-2 text-emerald-200/80">Prefilled where the app found a driver match. Review before saving.</div>
        </div>
      )}

      <div className={`grid gap-4 ${bonusQuestions.length > 0 ? 'xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}`}>
        <div className="space-y-4 rounded-xl border border-white/5 bg-black/30 p-4">
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-300">Step 1 · Podium</h3>
            <p className="mt-1 text-xs text-slate-500">Review the finishing top three before publishing.</p>
          </div>
          {[1, 2, 3].map((position) => (
            <div key={position}>
              <label className="mb-1 block text-xs font-bold text-slate-500">P{position}</label>
              <select
                name={`p${position}_driver_id`}
                defaultValue={suggestedDefaults[`p${position}` as keyof typeof suggestedDefaults]}
                required
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
              >
                <option value="" disabled className="bg-slate-900 text-white">
                  Select Driver
                </option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id} className="bg-slate-900 text-white">
                    {driver.code} - {driver.full_name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        {bonusQuestions.length > 0 && (
          <div className="space-y-4 rounded-xl border border-white/5 bg-black/30 p-4">
            <div>
              <h3 className="text-sm font-bold uppercase text-slate-300">Step 2 · Bonus Answers</h3>
              <p className="mt-1 text-xs text-slate-500">
                Set the correct answer for each bonus question here before you save.
              </p>
            </div>
            {bonusQuestions.map((question) => {
              const existingAnswer = existingBonusAnswers.find(
                (answer) => answer.bonus_question_id === question.id
              )

              return (
                <div key={question.id}>
                  <label className="mb-1 block text-xs font-bold text-slate-500">{question.question_text}</label>
                  <select
                    name={`bonus_${question.id}`}
                    defaultValue={existingAnswer?.correct_bonus_option_id || ''}
                    required
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2"
                  >
                    <option value="" disabled className="bg-slate-900 text-white">
                      Select Correct Option
                    </option>
                    {question.bonus_options?.map((option) => (
                      <option key={option.id} value={option.id} className="bg-slate-900 text-white">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <FormActionButton
        idleLabel={bonusQuestions.length > 0 ? 'Save result and bonus answers' : 'Save official results'}
        pendingLabel={bonusQuestions.length > 0 ? 'Saving result and bonus answers...' : 'Saving official results...'}
        tone="primary"
      />
    </form>
  )
}
