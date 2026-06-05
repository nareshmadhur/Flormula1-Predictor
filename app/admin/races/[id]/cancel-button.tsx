'use client'

import { useState } from 'react'
import { XCircle } from 'lucide-react'
import { cancelRace } from '@/app/actions/admin'
import { useRouter } from 'next/navigation'

export default function CancelRaceButton({ raceId, raceStatus }: { raceId: string, raceStatus: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleCancel = async () => {
    if (isLoading) return
    if (!confirm('Are you sure you want to cancel this race? This will prevent any further predictions and mark the race as cancelled.')) return

    setIsLoading(true)
    try {
      await cancelRace(raceId)
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  // Don't show cancel button if race is already cancelled, completed, or scored
  if (raceStatus === 'cancelled' || raceStatus === 'completed' || raceStatus === 'scored') {
    return null
  }

  return (
    <button
      onClick={handleCancel}
      disabled={isLoading}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-orange-500/20 bg-orange-500/10 px-4 py-2 font-bold text-orange-500 shadow-lg transition-colors hover:bg-orange-500/20 hover:shadow-orange-500/10 disabled:cursor-not-allowed disabled:bg-orange-500/10 lg:w-auto"
    >
      <XCircle className="h-4 w-4 shrink-0" />
      {isLoading ? 'Cancelling...' : 'Cancel race'}
    </button>
  )
}
