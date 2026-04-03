'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createCircuitFromOpenF1Import } from '@/app/actions/admin-import'
import { initialScheduleImportActionState, type ScheduleImportActionState } from '@/app/admin/schedule/action-state'

type CreateCircuitMatchFormProps = {
  name: string
  city?: string | null
  country?: string | null
  emoji?: string | null
}

export function CreateCircuitMatchForm({
  name,
  city,
  country,
  emoji,
}: CreateCircuitMatchFormProps) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<ScheduleImportActionState, FormData>(
    createCircuitFromOpenF1Import,
    initialScheduleImportActionState
  )

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh()
    }
  }, [router, state.status])

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="city" value={city || ''} />
      <input type="hidden" name="country" value={country || ''} />
      <input type="hidden" name="emoji" value={emoji || ''} />

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
        disabled={pending}
        className="inline-flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/12 px-4 py-2.5 text-sm font-bold text-red-50 transition-colors hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? 'Creating circuit...' : 'Create circuit'}
      </button>
    </form>
  )
}
