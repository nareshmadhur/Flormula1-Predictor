'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addConstructor } from '@/app/actions/admin-data'

export function AddConstructorForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [formKey, setFormKey] = useState(0)

  const handleSubmit = async (formData: FormData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback(null)

    try {
      await addConstructor(formData)
      setFeedback({ type: 'success', message: 'Constructor added to the reference data.' })
      setFormKey((current) => current + 1)
      router.refresh()
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to add constructor.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-card p-6 shadow-xl">
      <h2 className="text-xl font-bold">Add Constructor</h2>

      {feedback && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${
            feedback.type === 'success'
              ? 'border-green-500/30 bg-green-500/10 text-green-300'
              : 'border-red-500/30 bg-red-500/10 text-red-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <form key={formKey} action={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-400">Name</label>
          <input
            name="name"
            placeholder="e.g. Red Bull Racing"
            required
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base"
            disabled={isSubmitting}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Short Code</label>
            <input
              name="short_code"
              placeholder="RBR"
              required
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base uppercase"
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-400">Emoji</label>
            <input
              name="emoji"
              placeholder="🏁"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-base"
              disabled={isSubmitting}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex w-full items-center justify-center rounded-xl bg-amber-600 px-4 py-4 text-base font-black italic tracking-widest text-white shadow-lg transition-all hover:bg-amber-500 hover:shadow-amber-500/30 ${
            isSubmitting ? 'cursor-not-allowed opacity-50' : ''
          }`}
        >
          {isSubmitting ? 'Creating...' : 'CREATE CONSTRUCTOR'}
          {!isSubmitting && <Plus className="ml-2 h-5 w-5" />}
        </button>
      </form>
    </div>
  )
}
