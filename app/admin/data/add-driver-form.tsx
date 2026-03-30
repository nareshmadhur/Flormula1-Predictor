'use client'

import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addDriver } from '@/app/actions/admin-data'

type ConstructorOption = {
  id: string
  name: string
}

export function AddDriverForm({ constructors }: { constructors: ConstructorOption[] }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [formKey, setFormKey] = useState(0)

  const handleSubmit = async (formData: FormData) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setFeedback(null)
    try {
      await addDriver(formData)
      setFeedback({ type: 'success', message: 'Driver added to the reference data.' })
      setFormKey((current) => current + 1)
      router.refresh()
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to add driver.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold mb-4">Add Driver</h2>
      <div className="bg-card border border-white/5 rounded-2xl p-6 shadow-xl">
         {feedback && (
           <div
             className={`mb-4 rounded-xl border px-4 py-3 text-sm font-medium ${
               feedback.type === 'success'
                 ? 'border-green-500/30 bg-green-500/10 text-green-300'
                 : 'border-red-500/30 bg-red-500/10 text-red-300'
             }`}
           >
             {feedback.message}
           </div>
         )}

         <form key={formKey} action={handleSubmit} className="space-y-4">
           <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Full Name</label>
              <input
                name="full_name"
                placeholder="e.g. Max Verstappen"
                required
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base touch-target"
                disabled={isSubmitting}
              />
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Code</label>
                <input
                  name="code"
                  placeholder="VER"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 uppercase text-base touch-target"
                  disabled={isSubmitting}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Emoji</label>
                <input
                  name="emoji"
                  placeholder="🇳🇱"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base touch-target"
                  disabled={isSubmitting}
                />
             </div>
           </div>
           <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Constructor</label>
              <select
                name="constructor_id"
                required
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-base touch-target"
                disabled={isSubmitting}
              >
                <option value="" disabled className="bg-slate-900 text-white">Select Constructor</option>
                {constructors?.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
                ))}
              </select>
           </div>
           <button
             type="submit"
             disabled={isSubmitting}
             className={`w-full bg-amber-600 hover:bg-amber-500 text-white font-black italic tracking-widest text-base rounded-xl px-4 py-4 mt-4 transition-all flex justify-center items-center shadow-lg hover:shadow-amber-500/30 touch-target ${
               isSubmitting ? 'cursor-not-allowed opacity-50' : ''
             }`}
           >
             {isSubmitting ? 'Creating...' : 'CREATE DRIVER'}
             {!isSubmitting && <Plus className="w-5 h-5 ml-2" />}
           </button>
         </form>
      </div>
    </div>
  )
}
