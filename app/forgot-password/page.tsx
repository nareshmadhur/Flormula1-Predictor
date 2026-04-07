'use client'

import { forgotPassword } from '@/app/auth/actions'
import { initialAuthActionState } from '@/app/auth/action-state'
import { PendingLink } from '@/components/ui/pending-link'
import { RaceStartLights } from '@/components/ui/race-start-lights'
import { useActionState } from 'react'

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    forgotPassword,
    initialAuthActionState
  )

  if (state.message) {
    return (
      <div className="mx-auto mt-20 flex w-full max-w-md flex-1 flex-col justify-center gap-2 px-8 animate-in fade-in duration-500">
        <div className="rounded-3xl border border-white/10 bg-card p-8 text-center shadow-2xl">
          <h1 className="mb-3 text-3xl font-black italic tracking-tighter text-emerald-400">
            Check your email
          </h1>
          <p className="mb-4 text-slate-300">
            We sent a reset link to <span className="font-semibold text-white">{state.email}</span>.
          </p>
          <p className="mb-6 text-sm text-slate-400">
            Open the latest email, then choose a new password from the link inside.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold">
            <PendingLink
              href="/login"
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-white"
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
          Reset password
        </h1>
        <p className="mb-6 text-center text-sm text-slate-400">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>

        <form
          className="flex flex-1 flex-col justify-center gap-4 text-foreground"
          action={formAction}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              className="touch-target w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base outline-none transition-all focus:border-red-500 focus:ring-1 focus:ring-red-500"
              defaultValue={state.email ?? ''}
              name="email"
              type="email"
              placeholder="you@example.com"
              required
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
            {pending ? 'Sending reset link...' : 'Send reset link'}
          </button>

          {!pending && state.error && (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-red-400">
              {state.error}
            </p>
          )}

          <p className="text-center text-sm text-slate-400">
            Remembered it?{' '}
            <PendingLink
              href="/login"
              className="inline-flex items-center gap-1 font-bold text-red-500 transition-colors hover:text-red-400 hover:underline"
            >
              Sign in
            </PendingLink>
          </p>
        </form>
      </div>
    </div>
  )
}
