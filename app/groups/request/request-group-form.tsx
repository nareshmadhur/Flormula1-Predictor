'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { submitGroupRequest } from '@/app/actions/group-requests'
import { FormActionButton } from '@/components/ui/form-action-button'
import {
  initialGroupRequestActionState,
  type GroupRequestActionState,
} from './action-state'

type RequestGroupFormProps = {
  currentGroupName: string
}

export function RequestGroupForm({ currentGroupName }: RequestGroupFormProps) {
  const router = useRouter()
  const [state, formAction] = useActionState<GroupRequestActionState, FormData>(
    submitGroupRequest,
    initialGroupRequestActionState
  )

  useEffect(() => {
    if (state.status === 'success') router.refresh()
  }, [router, state.status])

  return (
    <form action={formAction} className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-200">Group name</span>
        <input
          name="requested_name"
          required
          minLength={3}
          maxLength={80}
          placeholder="Example: Amsterdam Office Pool"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-200">About this group</span>
        <textarea
          name="description"
          rows={4}
          maxLength={500}
          placeholder="Who is the group for? A short note helps the admin review it."
          className="w-full resize-y rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-200">Expected players</span>
        <input
          name="expected_player_count"
          type="number"
          min="2"
          max="500"
          defaultValue="10"
          required
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base text-white"
        />
      </label>

      <label className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-left">
        <input
          type="checkbox"
          name="move_acknowledged"
          required
          className="mt-1 h-5 w-5 rounded border-white/20 bg-black/40 text-red-600 accent-red-600"
        />
        <span className="text-sm leading-6 text-amber-100">
          When approved, move my account from {currentGroupName} into the new group and make me its group admin.
          My existing picks, scores, and history stay with my account.
        </span>
      </label>

      <FormActionButton idleLabel="Request private group" pendingLabel="Sending request..." />

      {state.message && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm leading-6 ${
            state.status === 'success'
              ? 'border-green-500/20 bg-green-500/10 text-green-200'
              : 'border-red-500/20 bg-red-500/10 text-red-300'
          }`}
        >
          {state.message}
        </div>
      )}
    </form>
  )
}
