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
      className="bg-red-500/10 hover:bg-red-500/20 disabled:bg-red-500/10 disabled:cursor-not-allowed text-red-500 font-bold px-4 py-2 rounded-lg border border-red-500/20 transition-colors flex items-center shadow-lg hover:shadow-red-500/10"
    >
      <Trash2 className="w-4 h-4 mr-2" />
      {isLoading ? 'DELETING...' : 'DELETE RACE'}
    </button>
  )
}
