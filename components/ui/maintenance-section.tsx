'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateRaceStatuses } from '@/app/actions/admin'
import { RefreshCw } from 'lucide-react'

export function MaintenanceSection() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleUpdateStatuses = async () => {
    if (isLoading) return

    setIsLoading(true)
    setMessage(null)
    try {
      const result = await updateRaceStatuses()
      if (result?.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: result?.message || 'Race statuses updated.' })
        router.refresh()
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while updating statuses.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card border border-white/5 p-6 rounded-2xl shadow-xl">
      <h2 className="text-xl font-bold mb-4">Maintenance</h2>

      {message && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleUpdateStatuses}
        disabled={isLoading}
        className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-700/50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Updating...
          </>
        ) : (
          <>
            <RefreshCw className="w-4 h-4 mr-2" />
            Update Race Statuses
          </>
        )}
      </button>
    </div>
  )
}
