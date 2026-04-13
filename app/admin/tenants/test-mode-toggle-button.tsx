'use client'

import { FlaskConical } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toggleProfileTestMode, toggleTenantTestMode } from '@/app/actions/admin-data'

type TestModeToggleButtonProps = {
  id: string
  active: boolean
  target: 'group' | 'person'
  disabled?: boolean
}

export function TestModeToggleButton({
  id,
  active,
  target,
  disabled = false,
}: TestModeToggleButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (pending || disabled) return

    setPending(true)
    setError(null)

    try {
      if (target === 'group') {
        await toggleTenantTestMode(id, active)
      } else {
        await toggleProfileTestMode(id, active)
      }

      router.refresh()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update test mode.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || disabled}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.14em] transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
          active
            ? 'border-amber-500/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15'
            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
        }`}
      >
        <FlaskConical className="h-3.5 w-3.5" />
        {pending ? 'Saving...' : active ? 'Unmark Test' : 'Mark Test'}
      </button>
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}
