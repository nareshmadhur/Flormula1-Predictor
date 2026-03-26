'use client'

import { useState } from 'react'
import { submitPrediction } from '@/app/actions/predictions'
import { Trophy, CheckCircle, Car, AlertCircle } from 'lucide-react'

export default function PredictionForm({ 
  race, 
  drivers, 
  bonusQuestions, 
  existingPrediction, 
  existingBonusAnswers,
  isLocked 
}: any) {
  const [p1, setP1] = useState(existingPrediction?.p1_driver_id || '')
  const [p2, setP2] = useState(existingPrediction?.p2_driver_id || '')
  const [p3, setP3] = useState(existingPrediction?.p3_driver_id || '')
  
  const initialBonusState = {} as any
  existingBonusAnswers?.forEach((a: any) => {
    initialBonusState[a.bonus_question_id] = a.bonus_option_id
  })
  
  const [bonusAnswers, setBonusAnswers] = useState(initialBonusState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{ success?: boolean, error?: string } | null>(null)

  const hasDuplicate = p1 && p2 && p3 && new Set([p1, p2, p3]).size !== 3
  const isComplete = p1 && p2 && p3 && !hasDuplicate

  const handleBonusChange = (qId: string, optionId: string) => {
    if (isLocked) return
    setBonusAnswers({ ...bonusAnswers, [qId]: optionId })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isComplete || isLocked) return

    setIsSubmitting(true)
    setSubmitResult(null)

    const formData = new FormData()
    formData.append('race_id', race.id)
    formData.append('p1_driver_id', p1)
    formData.append('p2_driver_id', p2)
    formData.append('p3_driver_id', p3)
    
    // Pass bonus answers as a JSON string
    const bonusMap = Object.entries(bonusAnswers).map(([qid, oid]) => ({
      question_id: qid, option_id: oid
    }))
    formData.append('bonus_answers', JSON.stringify(bonusMap))

    try {
      const result = await submitPrediction(formData)
      if (result?.error) {
        setSubmitResult({ error: result.error })
      } else {
        setSubmitResult({ success: true })
      }
    } catch (err) {
      setSubmitResult({ error: 'An unexpected error occurred.' })
    }
    
    setIsSubmitting(false)
  }

  const DriverSelect = ({ value, onChange, label, pos }: any) => (
    <div className="space-y-2">
      <label className="text-lg font-black italic tracking-tight flex items-center text-slate-300">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 text-white font-bold
          ${pos === 1 ? 'bg-yellow-500' : pos === 2 ? 'bg-slate-400' : 'bg-amber-700'}
        `}>
          P{pos}
        </span>
        {label}
      </label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        disabled={isLocked}
        className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-medium appearance-none focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all disabled:opacity-50 touch-target text-base"
      >
        <option value="" disabled className="bg-slate-900 text-white">Select Driver</option>
        {drivers?.map((d: any) => (
          <option key={d.id} value={d.id} className="bg-slate-900 text-white">
            {d.code} - {d.full_name} {d.emoji}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-8 pb-12">
      <div className="bg-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
        <h2 className="text-2xl font-black italic tracking-tighter mb-6 flex items-center border-b border-white/5 pb-4">
          <Trophy className="w-6 h-6 mr-2 text-red-500" /> PODIUM PREDICTION
        </h2>

        <div className="space-y-6">
          <DriverSelect value={p1} onChange={setP1} label="Race Winner" pos={1} />
          <DriverSelect value={p2} onChange={setP2} label="Second Place" pos={2} />
          <DriverSelect value={p3} onChange={setP3} label="Third Place" pos={3} />
        </div>

        {hasDuplicate && !isLocked && (
          <p className="text-red-500 text-sm mt-4 font-medium flex items-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            <AlertCircle className="w-4 h-4 mr-2" /> You cannot select the same driver for multiple positions.
          </p>
        )}
      </div>

      {bonusQuestions && bonusQuestions.length > 0 && (
        <div className="bg-card border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl">
          <h2 className="text-2xl font-black italic tracking-tighter mb-6 flex items-center border-b border-white/5 pb-4">
            <Car className="w-6 h-6 mr-2 text-red-500" /> BONUS QUESTIONS
          </h2>
          
          <div className="space-y-8">
             {bonusQuestions.map((q: any) => (
               <div key={q.id} className="space-y-4">
                 <p className="text-lg font-bold text-slate-200">{q.question_text} <span className="text-xs text-slate-500 ml-2 uppercase font-black bg-black px-2 py-1 rounded">+{q.points} pt</span></p>
                 <div className="grid sm:grid-cols-2 gap-3">
                   {q.bonus_options?.sort((a:any,b:any) => a.display_order - b.display_order).map((opt: any) => (
                     <label 
                       key={opt.id} 
                       className={`
                         flex items-center p-4 rounded-xl border cursor-pointer transition-all touch-target
                         ${bonusAnswers[q.id] === opt.id 
                           ? 'bg-red-500/20 border-red-500 text-white' 
                           : 'bg-black/30 border-white/5 hover:border-white/20 text-slate-300'}
                         ${isLocked ? 'cursor-default opacity-70' : ''}
                       `}
                     >
                       <input 
                         type="radio" 
                         name={q.id} 
                         value={opt.id}
                         checked={bonusAnswers[q.id] === opt.id}
                         onChange={() => handleBonusChange(q.id, opt.id)}
                         disabled={isLocked}
                         className="hidden"
                       />
                       <div className="flex-1 font-medium">{opt.label || 'Option'}</div>
                       {bonusAnswers[q.id] === opt.id && <CheckCircle className="w-5 h-5 text-red-500" />}
                     </label>
                   ))}
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {submitResult && (
        <div className={`p-4 rounded-xl border font-bold flex items-center ${
          submitResult.success ? 'bg-green-500/20 border-green-500/30 text-green-400' : 'bg-red-500/20 border-red-500/30 text-red-400'
        }`}>
          {submitResult.success ? 'Predictions saved successfully!' : submitResult.error}
        </div>
      )}

      {!isLocked && (
        <button
          type="submit"
          disabled={!isComplete || isSubmitting}
          className={`w-full py-4 rounded-xl font-black text-xl italic tracking-widest uppercase transition-all shadow-2xl ${
            isComplete && !isSubmitting
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]'
              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
          }`}
        >
          {isSubmitting ? 'Saving...' : existingPrediction ? 'Update Prediction' : 'Lock It In'}
        </button>
      )}
    </form>
  )
}
