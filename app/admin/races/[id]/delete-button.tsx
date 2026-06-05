'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { deleteRace } from '@/app/actions/admin'
import { useRouter } from 'next/navigation'

export default function DeleteRaceButton({ raceId }: { raceId: string }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  
  const handleDelete = async () => {
    if (isLoading) return
    if (!confirm('Are you completely sure you want to delete this race? This will wipe all predictions, bonuses, and scores attached to it.')) return
    
    const formData = new FormData()
    formData.append('race_id', raceId)
    setIsLoading(true)
    try {
      await deleteRace(formData)
      router.push('/admin')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isLoading}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2 font-bold text-red-500 shadow-lg transition-colors hover:bg-red-500/20 hover:shadow-red-500/10 disabled:cursor-not-allowed disabled:bg-red-500/10 lg:w-auto"
    >
      <Trash2 className="h-4 w-4 shrink-0" />
      {isLoading ? 'Deleting...' : 'Delete race'}
    </button>
  )
}
