'use client'

import { useActionState } from 'react'
import { ArrowRight } from 'lucide-react'
import { acceptGroupInvite } from '@/app/actions/group-invites'
import { FormActionButton } from '@/components/ui/form-action-button'
import {
  initialJoinInviteActionState,
  type JoinInviteActionState,
} from '@/app/join/[token]/action-state'

type JoinInviteFormProps = {
  token: string
  groupName: string
  currentGroupName?: string | null
  currentGroupSlug?: string | null
}

export function JoinInviteForm({ token, groupName, currentGroupName, currentGroupSlug }: JoinInviteFormProps) {
  const [state, formAction] = useActionState<JoinInviteActionState, FormData>(
    acceptGroupInvite,
    initialJoinInviteActionState
  )
  const isSwitching = Boolean(currentGroupName && currentGroupName !== groupName)
  const switchingFromMain = currentGroupSlug === 'main'

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {isSwitching && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
          {switchingFromMain
            ? `You are currently playing in Main Group. Joining ${groupName} moves your private standings view, while your past picks stay with your account.`
            : `You are currently in ${currentGroupName}. Joining ${groupName} will move your group view, while your past picks stay with your account.`}
        </div>
      )}

      <FormActionButton
        idleLabel={switchingFromMain ? `Move to ${groupName}` : isSwitching ? `Switch to ${groupName}` : `Join ${groupName}`}
        pendingLabel="Joining..."
        className="gap-2"
      />

      <div className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        Continue to group standings
        <ArrowRight className="h-3.5 w-3.5" />
      </div>

      {state.status === 'error' && state.message && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {state.message}
        </div>
      )}
    </form>
  )
}
