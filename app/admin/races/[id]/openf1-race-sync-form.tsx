'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { syncRaceFromOpenF1 } from '@/app/actions/admin'
import {
  initialScheduleImportActionState,
  type ScheduleImportActionState,
} from '@/app/admin/schedule/action-state'
import { FormActionButton } from '@/components/ui/form-action-button'

type OpenF1RaceSyncFormProps = {
  raceId: string
  disabled?: boolean
}

export function OpenF1RaceSyncForm({
  raceId,
  disabled = false,
}: OpenF1RaceSyncFormProps) {
  const router = useRouter()
  const [state, formAction] = useActionState<ScheduleImportActionState, FormData>(
    syncRaceFromOpenF1,
    initialScheduleImportActionState
  )

  useEffect(() => {
    if (state.status !== 'success') return
    router.refresh()
  }, [router, state.status])

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="race_id" value={raceId} />

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

      <FormActionButton
        idleLabel="Sync schedule from OpenF1"
        pendingLabel="Syncing schedule..."
        tone="secondary"
        disabled={disabled}
      />
    </form>
  )
}
