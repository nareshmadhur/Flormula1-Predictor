'use client'

import { useMemo, useState } from 'react'
import { submitPrediction } from '@/app/actions/predictions'
import { AlertCircle, CheckCircle, ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { RaceStartLights } from '@/components/ui/race-start-lights'
import { SectionHeader } from '@/components/ui/section-header'

type RaceFormData = {
  id: string
}

type ConstructorRecord =
  | {
      name?: string | null
      short_code?: string | null
    }
  | Array<{
      name?: string | null
      short_code?: string | null
    }>
  | null

type Driver = {
  id: string
  code: string
  full_name: string
  emoji?: string | null
  constructors?: ConstructorRecord
}

type BonusOption = {
  id: string
  label?: string | null
  display_order?: number | null
}

type BonusQuestion = {
  id: string
  question_text: string
  points: number
  bonus_options?: BonusOption[] | null
}

type ExistingPrediction = {
  id?: string
  p1_driver_id?: string | null
  p2_driver_id?: string | null
  p3_driver_id?: string | null
} | null

type ExistingBonusAnswer = {
  bonus_question_id: string
  bonus_option_id: string
}

type PredictionFormProps = {
  race: RaceFormData
  drivers: Driver[] | null
  bonusQuestions: BonusQuestion[] | null
  existingPrediction?: ExistingPrediction
  existingBonusAnswers?: ExistingBonusAnswer[] | null
  isLocked: boolean
}

type SlotKey = 'p1' | 'p2' | 'p3'

type PodiumDraftSlotProps = {
  slot: SlotKey
  label: string
  driver: Driver | undefined
  isActive: boolean
  onActivate: (slot: SlotKey) => void
  onClear: (slot: SlotKey) => void
}

function getConstructorRecord(constructors?: ConstructorRecord) {
  if (!constructors) return null
  return Array.isArray(constructors) ? constructors[0] || null : constructors
}

function PodiumDraftSlot({
  slot,
  label,
  driver,
  isActive,
  onActivate,
  onClear,
}: PodiumDraftSlotProps) {
  const tone =
    slot === 'p1'
      ? 'border-yellow-500/25 bg-yellow-500/10'
      : slot === 'p2'
        ? 'border-slate-300/20 bg-slate-300/10'
        : 'border-amber-700/25 bg-amber-700/10'

  const constructorRecord = getConstructorRecord(driver?.constructors)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onActivate(slot)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onActivate(slot)
        }
      }}
      className={`relative rounded-2xl border p-3 text-left transition-all ${
        isActive
          ? 'border-red-500/40 bg-red-500/10 shadow-[0_0_16px_rgba(239,68,68,0.12)]'
          : 'border-white/10 bg-black/20 hover:bg-white/[0.03]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.2em] ${tone}`}>
            {label}
          </div>
          {driver ? (
            <>
              <div className="mt-2 truncate text-base font-black italic tracking-tight text-white">
                {driver.code} {driver.emoji}
              </div>
              <div className="mt-0.5 truncate text-sm text-slate-300">{driver.full_name}</div>
              <div className="mt-1 truncate text-xs uppercase tracking-widest text-slate-500">
                {constructorRecord?.name || 'Team pending'}
                {constructorRecord?.short_code ? ` · ${constructorRecord.short_code}` : ''}
              </div>
            </>
          ) : (
            <>
              <div className="mt-2 text-sm font-semibold text-slate-100">
                {slot === 'p1' ? 'Choose winner' : slot === 'p2' ? 'Choose P2' : 'Choose P3'}
              </div>
              <div className="mt-1 text-xs text-slate-500">Tap to draft from the board below.</div>
            </>
          )}
        </div>

        {driver && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onClear(slot)
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function PredictionForm({
  race,
  drivers,
  bonusQuestions,
  existingPrediction,
  existingBonusAnswers,
  isLocked,
}: PredictionFormProps) {
  const [p1, setP1] = useState(existingPrediction?.p1_driver_id || '')
  const [p2, setP2] = useState(existingPrediction?.p2_driver_id || '')
  const [p3, setP3] = useState(existingPrediction?.p3_driver_id || '')
  const [activeSlot, setActiveSlot] = useState<SlotKey>(() => {
    if (!existingPrediction?.p1_driver_id) return 'p1'
    if (!existingPrediction?.p2_driver_id) return 'p2'
    if (!existingPrediction?.p3_driver_id) return 'p3'
    return 'p1'
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [bonusOpen, setBonusOpen] = useState(() => Boolean(existingBonusAnswers?.length))

  const initialBonusState: Record<string, string> = {}
  existingBonusAnswers?.forEach((answer) => {
    initialBonusState[answer.bonus_question_id] = answer.bonus_option_id
  })

  const [bonusAnswers, setBonusAnswers] = useState<Record<string, string>>(initialBonusState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success?: boolean; error?: string } | null>(null)

  const selectedIds = { p1, p2, p3 }
  const hasDuplicate = p1 && p2 && p3 && new Set([p1, p2, p3]).size !== 3
  const isComplete = Boolean(p1 && p2 && p3 && !hasDuplicate)
  const answeredBonusCount = (bonusQuestions || []).filter((question) => Boolean(bonusAnswers[question.id])).length

  const driversById = useMemo(() => {
    return new Map((drivers || []).map((driver) => [driver.id, driver]))
  }, [drivers])

  const activeDriverId = selectedIds[activeSlot]
  const filteredDrivers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return (drivers || []).filter((driver) => {
      const constructorRecord = getConstructorRecord(driver.constructors)
      const haystack = [driver.code, driver.full_name, driver.emoji, constructorRecord?.name, constructorRecord?.short_code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return query ? haystack.includes(query) : true
    })
  }, [drivers, searchTerm])

  const handleAssignDriver = (driverId: string) => {
    if (isLocked) return

    const chosenElsewhere =
      (activeSlot !== 'p1' && selectedIds.p1 === driverId) ||
      (activeSlot !== 'p2' && selectedIds.p2 === driverId) ||
      (activeSlot !== 'p3' && selectedIds.p3 === driverId)

    if (chosenElsewhere) return

    if (activeSlot === 'p1') setP1(driverId)
    if (activeSlot === 'p2') setP2(driverId)
    if (activeSlot === 'p3') setP3(driverId)

    if (activeSlot === 'p1' && !selectedIds.p2) {
      setActiveSlot('p2')
    } else if ((activeSlot === 'p1' || activeSlot === 'p2') && !selectedIds.p3) {
      setActiveSlot(activeSlot === 'p1' ? 'p2' : 'p3')
    }
  }

  const handleClearSlot = (slot: SlotKey) => {
    if (slot === 'p1') setP1('')
    if (slot === 'p2') setP2('')
    if (slot === 'p3') setP3('')
    setActiveSlot(slot)
  }

  const handleBonusChange = (questionId: string, optionId: string) => {
    if (isLocked) return
    setBonusAnswers((current) => ({ ...current, [questionId]: optionId }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isComplete || isLocked) return

    setIsSubmitting(true)
    setSubmitResult(null)

    const formData = new FormData()
    formData.append('race_id', race.id)
    formData.append('p1_driver_id', p1)
    formData.append('p2_driver_id', p2)
    formData.append('p3_driver_id', p3)

    const bonusMap = Object.entries(bonusAnswers).map(([questionId, optionId]) => ({
      question_id: questionId,
      option_id: optionId,
    }))
    formData.append('bonus_answers', JSON.stringify(bonusMap))

    try {
      const result = await submitPrediction(formData)
      if (result?.error) {
        setSubmitResult({ error: result.error })
      } else {
        setSubmitResult({ success: true })
      }
    } catch {
      setSubmitResult({ error: 'An unexpected error occurred.' })
    }

    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-28">
      <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
        <SectionHeader
          eyebrow="Podium"
          title="Pick your top three"
          aside={
            <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-300">
              {[p1, p2, p3].filter(Boolean).length}/3 picked
            </div>
          }
        />

        <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <PodiumDraftSlot
              slot="p1"
              label="P1"
              driver={driversById.get(p1)}
              isActive={activeSlot === 'p1'}
              onActivate={setActiveSlot}
              onClear={handleClearSlot}
            />
            <PodiumDraftSlot
              slot="p2"
              label="P2"
              driver={driversById.get(p2)}
              isActive={activeSlot === 'p2'}
              onActivate={setActiveSlot}
              onClear={handleClearSlot}
            />
            <PodiumDraftSlot
              slot="p3"
              label="P3"
              driver={driversById.get(p3)}
              isActive={activeSlot === 'p3'}
              onActivate={setActiveSlot}
              onClear={handleClearSlot}
            />
        </div>

        {hasDuplicate && !isLocked && (
          <div className="mt-3 flex items-center rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400">
            <AlertCircle className="mr-2 h-4 w-4" />
            Each podium slot needs a different driver.
          </div>
        )}

        <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.25em] text-slate-500">Driver Board</div>
              <div className="mt-1 text-base font-bold text-white">
                Picking for {activeSlot.toUpperCase()} {activeSlot === 'p1' ? 'winner' : activeSlot === 'p2' ? 'P2' : 'P3'}
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-300">
              <Search className="h-4 w-4 text-slate-500" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search driver or team"
                className="w-40 bg-transparent outline-none placeholder:text-slate-500"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filteredDrivers.map((driver) => {
                const constructorRecord = getConstructorRecord(driver.constructors)
                const takenByOtherSlot =
                  (activeSlot !== 'p1' && p1 === driver.id) ||
                  (activeSlot !== 'p2' && p2 === driver.id) ||
                  (activeSlot !== 'p3' && p3 === driver.id)
                const isSelected = activeDriverId === driver.id

                return (
                  <button
                    key={driver.id}
                    type="button"
                    onClick={() => handleAssignDriver(driver.id)}
                    disabled={takenByOtherSlot || isLocked}
                    className={`rounded-2xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-red-500/40 bg-red-500/10 shadow-[0_0_16px_rgba(239,68,68,0.12)]'
                        : takenByOtherSlot
                          ? 'cursor-not-allowed border-white/5 bg-black/20 text-slate-500 opacity-45'
                          : 'border-white/10 bg-black/25 hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-black italic text-white">
                          {driver.code} {driver.emoji}
                        </div>
                        <div className="mt-0.5 truncate text-sm font-medium text-slate-200">{driver.full_name}</div>
                        {constructorRecord?.name && (
                          <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                            {constructorRecord.name}
                            {constructorRecord.short_code ? ` · ${constructorRecord.short_code}` : ''}
                          </div>
                        )}
                      </div>
                      {isSelected && <CheckCircle className="h-5 w-5 shrink-0 text-red-400" />}
                    </div>
                  </button>
                )
              })}
          </div>

          {filteredDrivers.length === 0 && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-center text-sm text-slate-400">
              No drivers match that search.
            </div>
          )}
        </div>
      </section>

      {bonusQuestions && bonusQuestions.length > 0 && (
        <section className="rounded-3xl border border-white/10 bg-card p-6 shadow-2xl md:p-8">
          <button
            type="button"
            onClick={() => setBonusOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <SectionHeader eyebrow="Bonus" title="Bonus calls" />

            <div className="flex items-center gap-3">
              <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-sm font-bold text-slate-300">
                {answeredBonusCount}/{bonusQuestions.length} answered
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/20 text-slate-300">
                {bonusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            </div>
          </button>

          {bonusOpen && (
            <div className="mt-5 space-y-4">
              {bonusQuestions.map((question) => (
                <div key={question.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <p className="text-base font-bold text-slate-100">{question.question_text}</p>
                    <span className="inline-flex rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      +{question.points} pt
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {question.bonus_options
                      ?.slice()
                      .sort((left, right) => (left.display_order || 0) - (right.display_order || 0))
                      .map((option) => (
                        <label
                          key={option.id}
                          className={`touch-target flex cursor-pointer items-center rounded-xl border p-3 transition-all ${
                            bonusAnswers[question.id] === option.id
                              ? 'border-red-500 bg-red-500/20 text-white'
                              : 'border-white/5 bg-black/30 text-slate-300 hover:border-white/20'
                          } ${isLocked ? 'cursor-default opacity-70' : ''}`}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option.id}
                            checked={bonusAnswers[question.id] === option.id}
                            onChange={() => handleBonusChange(question.id, option.id)}
                            disabled={isLocked}
                            className="hidden"
                          />
                          <div className="flex-1 text-sm font-medium">{option.label || 'Option'}</div>
                          {bonusAnswers[question.id] === option.id && <CheckCircle className="h-4 w-4 text-red-500" />}
                        </label>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {submitResult && (
        <div
          className={`flex items-center rounded-xl border p-4 font-bold ${
            submitResult.success
              ? 'border-green-500/30 bg-green-500/20 text-green-400'
              : 'border-red-500/30 bg-red-500/20 text-red-400'
          }`}
        >
          {submitResult.success ? 'Prediction saved successfully.' : submitResult.error}
        </div>
      )}

      {!isLocked && (
        <div className="sticky bottom-4 z-20">
          <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-md">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white">
                  {isComplete ? 'Ready to submit' : 'Finish your podium'}
                </div>
                <div className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                  {[p1, p2, p3].filter(Boolean).length}/3 picked
                  {bonusQuestions?.length ? ` · ${answeredBonusCount}/${bonusQuestions.length} bonus` : ''}
                </div>
              </div>

              <button
                type="submit"
                disabled={!isComplete || isSubmitting}
                className={`race-submit-shell w-full rounded-xl px-5 py-3 text-base font-black italic uppercase tracking-widest transition-all shadow-2xl sm:w-auto ${
                  isComplete && !isSubmitting
                    ? 'bg-red-600 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:bg-red-500'
                    : 'cursor-not-allowed border border-white/5 bg-slate-800 text-slate-500'
                }`}
              >
                {isSubmitting && <RaceStartLights />}
                {isSubmitting ? 'Saving...' : existingPrediction ? 'Update Prediction' : 'Lock It In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
