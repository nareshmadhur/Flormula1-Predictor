'use client'

import { useState } from 'react'
import { updateRaceStatuses } from '@/app/actions/admin'
import { RefreshCw } from 'lucide-react'

export function MaintenanceSection() {
  const [isLoading, setIsLoading] = useState(false)

  const handleUpdateStatuses = async () => {
    if (isLoading) return

    setIsLoading(true)
    try {
      await updateRaceStatuses()
      window.location.reload()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred while updating statuses')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-card border border-white/5 p-6 rounded-2xl shadow-xl">
      <h2 className="text-xl font-bold mb-4">Maintenance</h2>

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