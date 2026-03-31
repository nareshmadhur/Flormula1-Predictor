'use client'

import { LogOut } from 'lucide-react'
import { useFormStatus } from 'react-dom'

export function SignOutButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-1 text-xs font-medium transition-colors sm:text-sm ${
        pending
          ? 'cursor-not-allowed text-slate-500'
          : 'text-red-400 hover:text-red-300'
      }`}
    >
      {pending && <LogOut className="h-3.5 w-3.5 animate-pulse" />}
      {pending ? 'Signing Out...' : 'Sign Out'}
    </button>
  )
}
