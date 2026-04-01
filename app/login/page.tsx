'use client'

import { login } from '@/app/auth/actions'
import { initialAuthActionState } from '@/app/auth/action-state'
import { use, useActionState } from 'react'
import { RaceStartLights } from '@/components/ui/race-start-lights'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = use(searchParams)

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto animate-in fade-in duration-500 mt-20">
      <div className="bg-card border border-white/10 p-8 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-black italic tracking-tighter mb-2 text-center">Welcome back</h1>
        <p className="mb-6 text-center text-sm text-slate-400">Jump back into your standings and next race picks.</p>
        
        <LoginForm initialError={params.error} />
      </div>
    </div>
  )
}

function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, pending] = useActionState(login, initialAuthActionState)
  const error = state.error || initialError

  return (
    <form className="flex-1 flex flex-col w-full justify-center gap-4 text-foreground" action={formAction}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-base touch-target"
          name="email"
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
        {pending ? 'Signing In...' : 'Sign In'}
      </button>
      
      {!pending && error && (
        <p className="mt-4 p-4 bg-red-500/10 text-red-400 text-center rounded-xl border border-red-500/20">
          {error}
        </p>
      )}
    </form>
  )
}
