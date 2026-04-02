'use client'

import { useActionState } from 'react'
import { applyOpenF1ScheduleImport } from '@/app/actions/admin-import'
import {
  initialScheduleImportActionState,
  type ScheduleImportActionState,
} from '@/app/admin/schedule/action-state'

type ApplyScheduleImportFormProps = {
  season: number
  disabled?: boolean
}

export function ApplyScheduleImportForm({
  season,
  disabled = false,
}: ApplyScheduleImportFormProps) {
  const [state, formAction, pending] = useActionState<ScheduleImportActionState, FormData>(
    applyOpenF1ScheduleImport,
    initialScheduleImportActionState
  )

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="season" value={season} />

      {state.status !== 'idle' && state.message && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            state.status === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/30 bg-red-500/10 text-red-200'
          }`}
        >
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || pending}
        className="inline-flex w-full items-center justify-center rounded-full border border-red-500/30 bg-red-500/12 px-4 py-2.5 text-sm font-bold text-red-50 transition-colors hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Syncing season...' : 'Apply OpenF1 schedule'}
      </button>
    </form>
  )
}
