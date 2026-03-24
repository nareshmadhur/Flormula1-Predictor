'use client'

import { useState } from 'react'
import { Edit3, Trash2 } from 'lucide-react'
import { deleteBonusQuestion, updateBonusQuestion } from '@/app/actions/admin'

export default function BonusQuestionCard({ question, raceId }: { question: any, raceId: string }) {
  const [isEditing, setIsEditing] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Delete this bonus question?')) return
    const fd = new FormData()
    fd.append('question_id', question.id)
    fd.append('race_id', raceId)
    await deleteBonusQuestion(fd)
  }

  if (isEditing) {
    return (
      <div className="bg-black/50 p-4 rounded-xl border border-amber-500/50">
        <form 
          action={async (fd) => {
            await updateBonusQuestion(fd)
            setIsEditing(false)
          }} 
          className="space-y-3"
        >
          <input type="hidden" name="question_id" value={question.id} />
          <input type="hidden" name="race_id" value={raceId} />
          
          <div className="flex gap-2">
            <input name="question_text" defaultValue={question.question_text} required className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2" />
            <input name="points" type="number" defaultValue={question.points} required className="w-20 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-center" />
          </div>
          
          <div className="space-y-2">
            <p className="text-xs text-slate-500 font-bold uppercase">Options</p>
            {[0, 1, 2, 3].map(i => {
              const opt = question.bonus_options?.[i]
              return (
                <div key={i} className="flex gap-2">
                  {opt && <input type="hidden" name="option_ids" value={opt.id} />}
                  {!opt && <input type="hidden" name="option_ids" value="" />}
                  <input name="options" defaultValue={opt?.label || ''} placeholder={`Option ${String.fromCharCode(65 + i)}`} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm" />
                </div>
              )
            })}
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white transition-colors">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="bg-black/30 p-4 rounded-xl border border-white/5 group">
      <div className="font-bold flex justify-between items-start">
        <span className="pr-4">{question.question_text}</span>
        <div className="flex items-center space-x-3 shrink-0">
           <span className="text-red-500">{question.points} pt</span>
           <button onClick={() => setIsEditing(true)} className="text-slate-500 hover:text-amber-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
             <Edit3 className="w-4 h-4" />
           </button>
           <button onClick={handleDelete} className="text-slate-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
             <Trash2 className="w-4 h-4" />
           </button>
        </div>
      </div>
      <ul className="mt-2 space-y-1 text-sm text-slate-400 list-disc list-inside">
        {question.bonus_options?.map((o: any) => (
          <li key={o.id}>{o.label}</li>
        ))}
      </ul>
    </div>
  )
}
