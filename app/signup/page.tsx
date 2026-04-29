'use client'

import { signup } from '@/app/auth/actions'
import { initialAuthActionState } from '@/app/auth/action-state'
import { use, useActionState } from 'react'
import { PendingLink } from '@/components/ui/pending-link'
import { RaceStartLights } from '@/components/ui/race-start-lights'
import { AuthResendConfirmationForm } from '@/components/ui/auth-resend-confirmation-form'

export default function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = use(searchParams)
  const next = getClientNextPath(params.next)
  const [state, formAction, pending] = useActionState(signup, initialAuthActionState)

  if (state.message) {
    return (
      <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto animate-in fade-in duration-500 mt-20">
        <div className="bg-card border border-white/10 p-8 rounded-3xl shadow-2xl text-center">
          <h1 className="text-3xl font-black italic tracking-tighter mb-4 text-green-500">Check your email</h1>
          <p className="text-lg text-slate-300 mb-4">
            {state.message}
          </p>
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-blue-300 text-sm mb-6 text-left">
            <p className="font-bold mb-1 flex items-center">
              <span className="mr-2 text-xl">⚠️</span> Quick tip
            </p>
            Please check your <strong>Spam</strong> or <strong>Junk</strong> folder if you don&apos;t see it. 
            <br/><br/>
            Search for <span className="font-bold text-white">Confirm your signup</span> if it lands elsewhere.
          </div>
          {state.email && (
            <div className="mb-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
              <p className="mb-3 text-sm text-slate-300">
                Didn&apos;t get it yet? Send another confirmation email.
              </p>
              <AuthResendConfirmationForm email={state.email} next={next} />
            </div>
          )}
          <p className="text-slate-400 text-sm">
            Once confirmed, you can <PendingLink href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="inline-flex items-center gap-1 text-red-500 hover:text-red-400 font-bold hover:underline transition-colors">sign in here</PendingLink>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto animate-in fade-in duration-500 mt-20">
      <div className="bg-card border border-white/10 p-8 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-black italic tracking-tighter mb-2 text-center">Join the grid</h1>
        <p className="mb-6 text-center text-sm text-slate-400">Create your account, confirm your email, and get ready for the next lock.</p>
        
        <SignupForm formAction={formAction} pending={pending} error={state.error} next={next} />
      </div>
    </div>
  )
}

function getClientNextPath(value?: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return ''
  return value
}

function SignupForm({
  error,
  formAction,
  pending,
  next,
}: {
  error?: string
  formAction: (formData: FormData) => void
  pending: boolean
  next?: string
}) {
  return (
    <form className="flex-1 flex flex-col w-full justify-center gap-4 text-foreground" action={formAction}>
      <input type="hidden" name="next" value={next ?? ''} />

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor="display_name">
          Display Name
        </label>
        <input
          className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-base touch-target"
          name="display_name"
          placeholder="Your public display name"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-base touch-target"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor="password">
          Password
        </label>
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
        {pending ? 'Signing Up...' : 'Sign Up'}
      </button>
      
      {!pending && error && (
        <p className="mt-4 p-4 bg-red-500/10 text-red-400 text-center rounded-xl border border-red-500/20">
          {error}
        </p>
      )}

      <p className="text-center text-sm text-slate-400">
        Already have an account?{' '}
        <PendingLink
          href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="inline-flex items-center gap-1 font-bold text-red-500 transition-colors hover:text-red-400 hover:underline"
        >
          Sign in
        </PendingLink>
      </p>
    </form>
  )
}
