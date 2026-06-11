'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteUserAccount } from '@/app/actions/admin-data'

type DeleteUserButtonProps = {
  disabled?: boolean
  profileId: string
  userLabel: string
}

export function DeleteUserButton({
  disabled = false,
  profileId,
  userLabel,
}: DeleteUserButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (pending || disabled) return
    const confirmed = confirm(`Delete ${userLabel}? This removes their account, profile, predictions, and score history.`)
    if (!confirmed) return

    setPending(true)
    setError(null)

    try {
      await deleteUserAccount(profileId)
      router.refresh()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not delete user account.')
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
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${
          pending || disabled
            ? 'border-white/10 bg-white/5 text-slate-500'
            : 'border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/15'
        }`}
      >
        <Trash2 className="h-4 w-4" />
        {pending ? 'Deleting...' : 'Delete User'}
      </button>
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}
