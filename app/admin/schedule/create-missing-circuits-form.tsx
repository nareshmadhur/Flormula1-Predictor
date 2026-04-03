'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createAllMissingCircuitsFromOpenF1Import } from '@/app/actions/admin-import'
import { initialScheduleImportActionState, type ScheduleImportActionState } from '@/app/admin/schedule/action-state'

type CreateMissingCircuitsFormProps = {
  season: number
  disabled?: boolean
}

export function CreateMissingCircuitsForm({
  season,
  disabled = false,
}: CreateMissingCircuitsFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ScheduleImportActionState, FormData>(
    createAllMissingCircuitsFromOpenF1Import,
    initialScheduleImportActionState
  )

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh()
    }
  }, [router, state.status])

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
        className="inline-flex w-full items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-slate-100 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Creating circuits...' : 'Create missing circuits'}
      </button>
    </form>
  )
}
