'use client'

import { resendConfirmation } from '@/app/auth/actions'
import { initialAuthActionState } from '@/app/auth/action-state'
import { RaceStartLights } from '@/components/ui/race-start-lights'
import { useActionState } from 'react'

export function AuthResendConfirmationForm({
  email,
  next,
  compact = false,
}: {
  email?: string
  next?: string
  compact?: boolean
}) {
  const [state, formAction, pending] = useActionState(
    resendConfirmation,
    initialAuthActionState
  )

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="email" value={email ?? ''} />
      <input type="hidden" name="next" value={next ?? ''} />

      <button
        type="submit"
        disabled={pending || !email}
        className={`race-submit-shell inline-flex items-center justify-center rounded-xl px-4 py-3 text-sm font-bold transition-all ${
          pending || !email
            ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
            : 'bg-white/8 text-slate-100 hover:bg-white/12'
        } ${compact ? 'w-auto min-w-[12rem]' : 'w-full'}`}
      >
        {pending && <RaceStartLights />}
        {pending ? 'Sending confirmation...' : 'Resend confirmation'}
      </button>

      {!pending && state.message && (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {state.message}
        </p>
      )}

      {!pending && state.error && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {state.error}
        </p>
      )}
    </form>
  )
}
