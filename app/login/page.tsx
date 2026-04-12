'use client'

import { login } from '@/app/auth/actions'
import { initialAuthActionState } from '@/app/auth/action-state'
import { use, useActionState } from 'react'
import { RaceStartLights } from '@/components/ui/race-start-lights'
import { PendingLink } from '@/components/ui/pending-link'
import { AuthResendConfirmationForm } from '@/components/ui/auth-resend-confirmation-form'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>
}) {
  const params = use(searchParams)
  const next = getClientNextPath(params.next)

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto animate-in fade-in duration-500 mt-20">
      <div className="bg-card border border-white/10 p-8 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-black italic tracking-tighter mb-2 text-center">Welcome back</h1>
        <p className="mb-6 text-center text-sm text-slate-400">Jump back into your standings and next race picks.</p>
        
        <LoginForm initialError={params.error} initialMessage={params.message} next={next} />
      </div>
    </div>
  )
}

function getClientNextPath(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return ''
  return value
}

function LoginForm({
  initialError,
  initialMessage,
  next,
}: {
  initialError?: string
  initialMessage?: string
  next?: string
}) {
  const [state, formAction, pending] = useActionState(login, initialAuthActionState)
  const error = state.error || initialError
  const email = state.email
  const showResend = state.canResendConfirmation && email

  return (
    <form className="flex-1 flex flex-col w-full justify-center gap-4 text-foreground" action={formAction}>
      <input type="hidden" name="next" value={next ?? ''} />

      {!pending && initialMessage && (
        <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center text-emerald-300">
          {initialMessage}
        </p>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-base touch-target"
          name="email"
          placeholder="you@example.com"
          type="email"
          defaultValue={email ?? ''}
          required
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300" htmlFor="password">
            Password
          </label>
          <PendingLink
            href="/forgot-password"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition-colors hover:text-red-400"
          >
            Forgot password?
          </PendingLink>
        </div>
        <input
          className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-base touch-target"
          type="password"
          name="password"
          placeholder="••••••••"
          required
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className={`race-submit-shell font-bold rounded-xl px-4 py-4 mt-4 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] touch-target ${
          pending
            ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {pending && <RaceStartLights />}
        {pending ? 'Signing In...' : 'Sign In'}
      </button>
      
      {!pending && error && (
        <p className="mt-4 p-4 bg-red-500/10 text-red-400 text-center rounded-xl border border-red-500/20">
          {error}
        </p>
      )}

      {!pending && showResend && (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="mb-3 text-sm text-slate-300">
            Still waiting on the confirmation email? Send it again.
          </p>
          <AuthResendConfirmationForm email={email} next={next} />
        </div>
      )}

      <p className="text-center text-sm text-slate-400">
        New here?{' '}
        <PendingLink
          href={next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'}
          className="inline-flex items-center gap-1 font-bold text-red-500 transition-colors hover:text-red-400 hover:underline"
        >
          Create an account
        </PendingLink>
      </p>
    </form>
  )
}
