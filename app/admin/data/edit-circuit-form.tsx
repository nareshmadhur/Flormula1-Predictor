'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, X } from 'lucide-react'
import { updateCircuit } from '@/app/actions/admin-data'

type CircuitRow = {
  id: string
  name: string
  city?: string | null
  country?: string | null
  emoji?: string | null
}

export function EditCircuitForm({ circuit }: { circuit: CircuitRow }) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleSubmit = async (formData: FormData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback(null)

    try {
      await updateCircuit(formData)
      setFeedback('Saved')
      setIsEditing(false)
      router.refresh()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Failed to update circuit.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isEditing) {
    return (
      <div className="flex items-center justify-end gap-2">
        {feedback && <span className="text-xs text-green-300">{feedback}</span>}
        <button
          type="button"
          onClick={() => {
            setFeedback(null)
            setIsEditing(true)
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-200 transition-colors hover:bg-white/10"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    )
  }

  return (
    <form action={handleSubmit} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="circuit_id" value={circuit.id} />
      <input
        name="name"
        defaultValue={circuit.name}
        required
        className="w-44 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
      />
      <input
        name="city"
        defaultValue={circuit.city || ''}
        className="w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
      />
      <input
        name="country"
        defaultValue={circuit.country || ''}
        className="w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
      />
      <input
        name="emoji"
        defaultValue={circuit.emoji || ''}
        className="w-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center rounded-full bg-red-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-red-500 disabled:opacity-50"
      >
        {isSubmitting ? 'Saving...' : 'Save'}
      </button>
      <button
        type="button"
        onClick={() => {
          setFeedback(null)
          setIsEditing(false)
        }}
        className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-colors hover:bg-white/10"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {feedback && !isSubmitting && <span className="text-xs text-red-300">{feedback}</span>}
    </form>
  )
}
