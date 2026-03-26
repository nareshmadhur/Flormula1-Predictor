'use client'

import { login } from '@/app/auth/actions'
import { useState, useEffect } from 'react'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  return <LoginPageClient searchParams={searchParams} />
}

function LoginPageClient({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const [params, setParams] = useState<{ error?: string } | null>(null)
  
  useEffect(() => {
    searchParams.then(setParams)
  }, [searchParams])

  return (
    <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto animate-in fade-in duration-500 mt-20">
      <div className="bg-card border border-white/10 p-8 rounded-3xl shadow-2xl">
        <h1 className="text-3xl font-black italic tracking-tighter mb-6 text-center">WELCOME BACK</h1>
        
        <LoginForm error={params?.error} />
      </div>
    </div>
  )
}

function LoginForm({ error }: { error?: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (formData: FormData) => {
    if (isSubmitting) return
    
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      await login(formData)
    } catch (err) {
      setSubmitError('An unexpected error occurred. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex-1 flex flex-col w-full justify-center gap-4 text-foreground" action={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300" htmlFor="email">
          Email
        </label>
        <input
          className="w-full rounded-xl px-4 py-3 bg-black/40 border border-white/10 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-base touch-target"
          name="email"
          placeholder="you@example.com"
          required
          disabled={isSubmitting}
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
          disabled={isSubmitting}
        />
      </div>

      <button 
        type="submit" 
        disabled={isSubmitting}
        className={`font-bold rounded-xl px-4 py-4 mt-4 transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] touch-target ${
          isSubmitting 
            ? 'bg-slate-600 text-slate-400 cursor-not-allowed' 
            : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {isSubmitting ? 'Signing In...' : 'Sign In'}
      </button>
      
      {(error || submitError) && (
        <p className="mt-4 p-4 bg-red-500/10 text-red-400 text-center rounded-xl border border-red-500/20">
          {error || submitError}
        </p>
      )}
    </form>
  )
}
