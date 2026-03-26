'use client'

import { Power } from 'lucide-react'
import { useState } from 'react'
import { toggleDriverActive } from '@/app/actions/admin-data'

export function ToggleDriverButton({ id, active }: { id: string, active: boolean }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (isLoading) return
    setIsLoading(true)
    try {
      await toggleDriverActive(id, active)
      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      console.error('Error toggling driver status:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`p-2 rounded-lg transition-colors touch-target ${
        isLoading
          ? 'bg-slate-600 cursor-not-allowed'
          : active
            ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
            : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
      }`}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Power className="w-4 h-4" />
      )}
    </button>
  )
}