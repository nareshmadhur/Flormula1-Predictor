'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateRaceStatuses } from '@/app/actions/admin'
import { repairScoresAndLeaderboardsAction } from '@/app/actions/scoring'
import { RefreshCw, Wrench } from 'lucide-react'

export function MaintenanceSection() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isRepairing, setIsRepairing] = useState(false)
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

  const handleRepairScores = async () => {
    if (isRepairing) return

    setIsRepairing(true)
    setMessage(null)
    try {
      const result = await repairScoresAndLeaderboardsAction()
      if ('success' in result && result.success) {
        setMessage({ type: 'success', text: result.message })
        router.refresh()
      } else {
        setMessage({ type: 'error', text: 'Could not repair scores and leaderboards.' })
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while repairing scores.',
      })
    } finally {
      setIsRepairing(false)
    }
  }

  return (
    <div className="bg-card border border-white/5 p-6 rounded-2xl shadow-xl">
      <h2 className="text-xl font-bold mb-1">Repair derived data</h2>
      <p className="mb-4 text-sm text-slate-400">
        Use these after schedule, result, or scoring corrections. Normal result publishing already runs scoring.
      </p>

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

      <div className="space-y-3">
        <button
          onClick={handleUpdateStatuses}
          disabled={isLoading}
          className="w-full rounded-xl bg-slate-700 px-4 py-3 text-left text-white transition-colors hover:bg-slate-600 disabled:cursor-not-allowed disabled:bg-slate-700/50"
        >
          {isLoading ? (
            <span className="flex items-center gap-3">
              <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-b-2 border-white"></div>
              <span className="min-w-0 break-words text-sm font-bold">Refreshing race states...</span>
            </span>
          ) : (
            <span className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block break-words text-sm font-bold">Refresh race states</span>
                <span className="mt-1 block break-words text-xs font-medium text-slate-300">
                  Checks race timing against now and updates open, live, completed, or scored state.
                </span>
              </span>
            </span>
          )}
        </button>

        <button
          onClick={handleRepairScores}
          disabled={isRepairing}
          className="w-full rounded-xl bg-red-600/80 px-4 py-3 text-left text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-600/40"
        >
          {isRepairing ? (
            <span className="flex items-center gap-3">
              <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-b-2 border-white"></div>
              <span className="min-w-0 break-words text-sm font-bold">Repairing scores and standings...</span>
            </span>
          ) : (
            <span className="flex items-start gap-3">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block break-words text-sm font-bold">Repair scores & standings</span>
                <span className="mt-1 block break-words text-xs font-medium text-red-100/80">
                  Finds completed or scored races that already have official results, recalculates user scores, then rebuilds affected season standings. It does not fetch or edit official results.
                </span>
              </span>
            </span>
          )}
        </button>
      </div>
    </div>
  )
}
