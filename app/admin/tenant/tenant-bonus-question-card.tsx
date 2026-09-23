'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import {
  deleteTenantBonusQuestion,
  updateTenantBonusQuestion,
} from '@/app/actions/tenant-bonus'
import { type BonusAnswerType } from '@/utils/bonus-answers'
import {
  ReferenceOptionPicker,
  type ReferenceOptionPickerOption,
} from './reference-option-picker'

type BonusOption = {
  id: string
  label?: string | null
  option_type?: 'custom_text' | 'driver' | 'constructor' | null
  driver_id?: string | null
  constructor_id?: string | null
  display_order?: number | null
}

type BonusQuestion = {
  id: string
  question_text: string
  points: number
  answer_type?: BonusAnswerType | null
  bonus_options?: BonusOption[]
}

type TenantBonusQuestionCardProps = {
  question: BonusQuestion
  raceId: string
  canEdit: boolean
  scopeTenantId?: string
  driverOptions?: ReferenceOptionPickerOption[]
  constructorOptions?: ReferenceOptionPickerOption[]
}

export function TenantBonusQuestionCard({
  question,
  raceId,
  canEdit,
  scopeTenantId,
  driverOptions = [],
  constructorOptions = [],
}: TenantBonusQuestionCardProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const customOptions = (question.bonus_options || [])
    .filter((option) => !option.option_type || option.option_type === 'custom_text')
    .sort((left, right) => (left.display_order || 0) - (right.display_order || 0))
  const selectedDriverIds = Array.from(
    new Set(
      (question.bonus_options || [])
        .filter((option) => option.option_type === 'driver' && option.driver_id)
        .map((option) => option.driver_id as string)
    )
  )
  const selectedConstructorIds = Array.from(
    new Set(
      (question.bonus_options || [])
        .filter((option) => option.option_type === 'constructor' && option.constructor_id)
        .map((option) => option.constructor_id as string)
    )
  )

  function includeExistingReferenceOptions(
    options: ReferenceOptionPickerOption[],
    selectedIds: string[],
    type: 'driver' | 'constructor'
  ) {
    const knownIds = new Set(options.map((option) => option.id))
    const existingOptions: ReferenceOptionPickerOption[] = []

    for (const option of question.bonus_options || []) {
      if (option.option_type !== type) continue

      const id = type === 'driver' ? option.driver_id : option.constructor_id
      if (!id || knownIds.has(id) || !selectedIds.includes(id)) continue

      existingOptions.push({
        id,
        primary: option.label || 'Existing option',
        secondary: 'Existing question option',
        searchText: option.label || '',
      })
    }

    return [...options, ...existingOptions]
  }

  const editDriverOptions = includeExistingReferenceOptions(driverOptions, selectedDriverIds, 'driver')
  const editConstructorOptions = includeExistingReferenceOptions(
    constructorOptions,
    selectedConstructorIds,
    'constructor'
  )

  const handleDelete = async () => {
    if (isSubmitting) return
    if (!confirm('Delete this group bonus question?')) return

    setIsSubmitting(true)
    setFeedback(null)

    const formData = new FormData()
    formData.append('question_id', question.id)
    formData.append('race_id', raceId)
    if (scopeTenantId) formData.append('tenant_id', scopeTenantId)

    try {
      await deleteTenantBonusQuestion(formData)
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to delete group bonus question.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditing && canEdit) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-black/35 p-4">
        <form
          action={async (formData) => {
            if (isSubmitting) return

            setIsSubmitting(true)
            setFeedback(null)

            try {
              await updateTenantBonusQuestion(formData)
              setIsEditing(false)
              router.refresh()
            } catch (error) {
              setFeedback(error instanceof Error ? error.message : 'Failed to update group bonus question.')
            } finally {
              setIsSubmitting(false)
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="question_id" value={question.id} />
          <input type="hidden" name="race_id" value={raceId} />
          {scopeTenantId && <input type="hidden" name="tenant_id" value={scopeTenantId} />}

          <div className="flex gap-2">
            <input
              name="question_text"
              defaultValue={question.question_text}
              required
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2"
            />
            <input
              name="points"
              type="number"
              min={1}
              max={25}
              defaultValue={question.points}
              required
              className="w-20 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-center"
            />
          </div>

          {question.answer_type === 'numeric' ? (
            <p className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-slate-400">
              This question accepts a non-negative number. Its answer type is fixed once answers are saved.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase text-slate-500">Custom options</p>
                {customOptions.map((option, index) => (
                  <div key={option.id} className="flex gap-2">
                    <input type="hidden" name="option_ids" value={option.id} />
                    <input
                      name="options"
                      defaultValue={option.label || ''}
                      placeholder={`Custom option ${String.fromCharCode(65 + index)}`}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm"
                    />
                  </div>
                ))}
                {[0, 1].map((index) => (
                  <div key={`new-${index}`} className="flex gap-2">
                    <input type="hidden" name="option_ids" value="" />
                    <input
                      name="options"
                      placeholder={`Add custom option ${String.fromCharCode(65 + customOptions.length + index)}`}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              {editDriverOptions.length > 0 && (
                <details
                  open={selectedDriverIds.length > 0}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <summary className="flex cursor-pointer list-none items-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400 [&::-webkit-details-marker]:hidden">
                    Driver options
                  </summary>
                  <ReferenceOptionPicker
                    name="driver_options"
                    options={editDriverOptions}
                    initialSelectedIds={selectedDriverIds}
                    searchPlaceholder="Search drivers"
                  />
                </details>
              )}

              {editConstructorOptions.length > 0 && (
                <details
                  open={selectedConstructorIds.length > 0}
                  className="rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <summary className="flex cursor-pointer list-none items-center text-xs font-bold uppercase tracking-[0.18em] text-slate-400 [&::-webkit-details-marker]:hidden">
                    Constructor options
                  </summary>
                  <ReferenceOptionPicker
                    name="constructor_options"
                    options={editConstructorOptions}
                    initialSelectedIds={selectedConstructorIds}
                    searchPlaceholder="Search constructors"
                  />
                </details>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setFeedback(null)
                setIsEditing(false)
              }}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-amber-500"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          {feedback && (
            <p role="alert" className="text-sm text-red-300">
              {feedback}
            </p>
          )}
        </form>
      </div>
    )
  }

  return (
    <div className="group rounded-xl border border-white/5 bg-black/25 p-4">
      <div className="flex items-start justify-between gap-3 font-bold">
        <span>{question.question_text}</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-red-400">{question.points} pt</span>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {question.answer_type === 'numeric' ? 'Number' : 'Options'}
          </span>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="text-slate-500 opacity-0 transition-colors hover:text-amber-400 focus:opacity-100 group-hover:opacity-100"
                aria-label="Edit group bonus question"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="text-slate-500 opacity-0 transition-colors hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                aria-label="Delete group bonus question"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
      {question.answer_type === 'numeric' ? (
        <p className="mt-2 text-sm text-slate-400">Members enter a non-negative number.</p>
      ) : (
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
          {question.bonus_options?.map((option) => (
            <li key={option.id}>{option.label}</li>
          ))}
        </ul>
      )}
      {!canEdit && (
        <div className="mt-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs font-medium text-slate-400">
          Question locked after the prediction deadline.
        </div>
      )}
      {feedback && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {feedback}
        </p>
      )}
    </div>
  )
}
