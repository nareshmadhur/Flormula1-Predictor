'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  refreshRaceResultFromSource,
  type RaceResultRefreshState,
} from '@/app/actions/race-results'
import { FormActionButton } from '@/components/ui/form-action-button'

const initialRefreshState: RaceResultRefreshState = {
  status: 'idle',
}

export function ResultRefreshForm({ raceId }: { raceId: string }) {
  const router = useRouter()
  const [state, formAction] = useActionState(refreshRaceResultFromSource, initialRefreshState)

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh()
    }
  }, [router, state.status])

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="race_id" value={raceId} />

      <FormActionButton
        idleLabel="Check official source"
        pendingLabel="Checking source..."
        tone="secondary"
      />

      {state.status !== 'idle' && state.message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            state.status === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
              : 'border-red-500/20 bg-red-500/10 text-red-200'
          }`}
        >
          {state.message}
        </div>
      )}
    </form>
  )
}
