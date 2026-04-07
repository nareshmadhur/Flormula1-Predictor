'use client'

import { updatePassword } from '@/app/auth/actions'
import { initialAuthActionState } from '@/app/auth/action-state'
import { PendingLink } from '@/components/ui/pending-link'
import { RaceStartLights } from '@/components/ui/race-start-lights'
import { useActionState } from 'react'

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialAuthActionState
  )

  if (state.message) {
    return (
      <div className="mx-auto mt-20 flex w-full max-w-md flex-1 flex-col justify-center gap-2 px-8 animate-in fade-in duration-500">
        <div className="rounded-3xl border border-white/10 bg-card p-8 text-center shadow-2xl">
          <h1 className="mb-3 text-3xl font-black italic tracking-tighter text-emerald-400">
            Password updated
          </h1>
          <p className="mb-6 text-slate-300">
            Your account is ready with the new password.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
            <PendingLink
              href="/predictions"
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-white"
            >
              Go to My Season
            </PendingLink>
            <PendingLink
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-white/8 px-4 py-3 text-slate-100"
            >
              Back to sign in
            </PendingLink>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto mt-20 flex w-full max-w-md flex-1 flex-col justify-center gap-2 px-8 animate-in fade-in duration-500">
      <div className="rounded-3xl border border-white/10 bg-card p-8 shadow-2xl">
        <h1 className="mb-2 text-center text-3xl font-black italic tracking-tighter">
          Choose a new password
        </h1>
        <p className="mb-6 text-center text-sm text-slate-400">
          Set the password you want to use from now on.
        </p>

        <form
          className="flex flex-1 flex-col justify-center gap-4 text-foreground"
          action={formAction}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="password">
              New password
            </label>
            <input
              className="touch-target w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base outline-none transition-all focus:border-red-500 focus:ring-1 focus:ring-red-500"
              name="password"
              type="password"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="confirm_password">
              Confirm password
            </label>
            <input
              className="touch-target w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base outline-none transition-all focus:border-red-500 focus:ring-1 focus:ring-red-500"
              name="confirm_password"
              type="password"
              placeholder="Repeat your new password"
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className={`race-submit-shell mt-4 rounded-xl px-4 py-4 font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] touch-target ${
              pending
                ? 'cursor-not-allowed bg-slate-600 text-slate-400'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {pending && <RaceStartLights />}
            {pending ? 'Saving new password...' : 'Save new password'}
          </button>

          {!pending && state.error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-red-400">
              {state.error}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
