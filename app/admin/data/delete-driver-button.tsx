'use client'

import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteDriver } from '@/app/actions/admin-data'

export function DeleteDriverButton({ id }: { id: string }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleClick = async () => {
    if (isLoading) return
    if (!confirm('Are you sure you want to delete this driver?')) return

    setIsLoading(true)
    try {
      await deleteDriver(id)
      // Refresh the page to show updated data
      window.location.reload()
    } catch (error) {
      console.error('Error deleting driver:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`p-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors touch-target ${
        isLoading ? 'cursor-not-allowed opacity-50' : ''
      }`}
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <Trash2 className="w-4 h-4" />
      )}
    </button>
  )
}