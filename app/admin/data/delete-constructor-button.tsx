'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteConstructor } from '@/app/actions/admin-data'

type DeleteConstructorButtonProps = {
  id: string
  disabled?: boolean
  reason?: string
}

export function DeleteConstructorButton({ id, disabled = false, reason }: DeleteConstructorButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    if (isLoading || disabled) return
    if (!confirm('Delete this obsolete constructor? This is only allowed when no drivers or bonus options use it.')) return

    setIsLoading(true)
    setError(null)

    try {
      await deleteConstructor(id)
      router.refresh()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete constructor.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isLoading}
        title={disabled ? reason : 'Delete obsolete constructor'}
        className={`rounded-lg p-2 transition-colors touch-target ${
          disabled || isLoading
            ? 'cursor-not-allowed bg-slate-800 text-slate-600'
            : 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
        }`}
      >
        {isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </button>
      {error && <span className="max-w-56 text-right text-xs leading-5 text-red-300">{error}</span>}
    </div>
  )
}
